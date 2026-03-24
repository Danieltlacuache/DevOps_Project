import json
import boto3
import hashlib
import jwt
import datetime
import uuid
from botocore.exceptions import ClientError
from decimal import Decimal

# --- INICIALIZACIÓN (Fuera del handler para reutilizar conexiones) ---
dynamodb = boto3.resource('dynamodb')
users_table = dynamodb.Table('Users')
residents_table = dynamodb.Table('Residents')
payments_table = dynamodb.Table('Payments')
announcements_table = dynamodb.Table('Announcements')
maintenance_table = dynamodb.Table('Maintenance')

secrets_client = boto3.client('secretsmanager')
JWT_SECRET_NAME = 'jwt-secret-key'

# Variable global para cachear el secreto y ahorrar costos de lectura
cached_jwt_secret = None

def get_jwt_secret():
    """Obtiene la clave JWT de Secrets Manager y la guarda en caché"""
    global cached_jwt_secret
    if cached_jwt_secret:
        return cached_jwt_secret
    
    try:
        response = secrets_client.get_secret_value(SecretId=JWT_SECRET_NAME)
        secret_dict = json.loads(response['SecretString'])
        # Buscamos la llave 'JWT_SECRET' dentro del JSON guardado en AWS
        cached_jwt_secret = secret_dict.get('JWT_SECRET', 'fallback_secret_desarrollo')
        return cached_jwt_secret
    except Exception as e:
        print(f"Error crítico obteniendo secreto: {e}")
        return 'fallback_secret_desarrollo'

def lambda_handler(event, context):
    http_method = event.get('requestContext', {}).get('http', {}).get('method')
    path = event.get('rawPath', '')

    print(f"Request: {http_method} {path}")

    if http_method == 'OPTIONS':
        return response(200, {'message': 'CORS OK'})

    # Enrutamiento mejorado
    routes = {
        'POST': {
            '/auth/register': register,
            '/auth/login': login,
            '/residents': create_resident,
            '/payments': create_payment,
            '/announcements': create_announcement,
            '/maintenance': create_maintenance
        },
        'GET': {
            '/auth/users': lambda e: response(200, users_table.scan().get('Items', [])), # <--- AÑADE ESTA LÍNEA
            '/residents': get_residents,
            '/payments': get_payments,
            '/announcements': get_announcements,
            '/maintenance': get_maintenance
        }
    }

    handler_func = routes.get(http_method, {}).get(path)
    
    if handler_func:
        return handler_func(event)
    
    return response(404, {'message': f'Ruta no encontrada: {path}'})

# -------- LÓGICA DE NEGOCIO --------

def register(event):
    try:
        body = get_body(event)
        email, password = body.get('email'), body.get('password')

        if not email or not password:
            return response(400, {'message': 'Email y password obligatorios'})

        # Hash con salt básico (puedes mejorar esto con bcrypt en una Layer)
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        
        users_table.put_item(
            Item={'email': email, 'password': hashed_password},
            ConditionExpression='attribute_not_exists(email)' # Evita duplicados
        )
        return response(201, {'message': 'Usuario registrado'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return response(400, {'message': 'El usuario ya existe'})
        return response(500, {'message': str(e)})

def login(event):
    body = get_body(event)
    email, password = body.get('email'), body.get('password')
    
    res = users_table.get_item(Key={'email': email})
    user = res.get('item') # Corregido: 'Item' suele ser mayúscula en Dynamo
    user = res.get('Item')

    if not user or user['password'] != hashlib.sha256(password.encode()).hexdigest():
        return response(401, {'message': 'Credenciales inválidas'})

    token = jwt.encode({
        'email': email,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, get_jwt_secret(), algorithm='HS256')

    return response(200, {'token': token})

def create_resident(event):
    payload = verify_token(get_token_from_header(event))
    if not payload: return response(401, {'message': 'No autorizado'})

    body = get_body(event)
    resident = {
        'id': str(uuid.uuid4()),
        'name': body.get('name'),
        'apartment': body.get('apartment'),
        'email': body.get('email'),
        'created_at': datetime.datetime.utcnow().isoformat()
    }
    residents_table.put_item(Item=resident)
    return response(201, resident)

def get_residents(event):
    if not verify_token(get_token_from_header(event)): 
        return response(401, {'message': 'No autorizado'})
    
    items = residents_table.scan().get('Items', [])
    return response(200, items)

def create_payment(event):
    if not verify_token(get_token_from_header(event)): 
        return response(401, {'message': 'No autorizado'})

    body = get_body(event)
    payment = {
        'id': str(uuid.uuid4()),
        'residentId': body.get('residentId'),
        'amount': Decimal(str(body.get('amount', 0))), # Uso de Decimal para DynamoDB
        'date': body.get('date'),
        'created_at': datetime.datetime.utcnow().isoformat()
    }
    payments_table.put_item(Item=payment)
    return response(201, payment)

# --- Funciones de relleno para mantener la estructura ---
def get_payments(event): return response(200, payments_table.scan().get('Items', []))
def get_announcements(event): return response(200, announcements_table.scan().get('Items', []))
def create_announcement(event):
    body = get_body(event)
    item = {'id': str(uuid.uuid4()), 'title': body.get('title'), 'content': body.get('content')}
    announcements_table.put_item(Item=item)
    return response(201, item)
def get_maintenance(event): return response(200, maintenance_table.scan().get('Items', []))
def create_maintenance(event):
    body = get_body(event)
    item = {'id': str(uuid.uuid4()), 'status': 'pendiente', 'description': body.get('description')}
    maintenance_table.put_item(Item=item)
    return response(201, item)

# -------- HELPERS --------

def get_body(event):
    b = event.get('body', '{}')
    return json.loads(b) if isinstance(b, str) else b

def response(status, body):
    # Convertir Decimales a float/int para que JSON pueda serializar la respuesta
    return {
        'statusCode': status,
        'body': json.dumps(body, default=str) 
    }

def get_token_from_header(event):
    auth = event.get('headers', {}).get('authorization', '')
    return auth[7:] if auth.startswith('Bearer ') else None

def verify_token(token):
    if not token: return None
    try:
        return jwt.decode(token, get_jwt_secret(), algorithms=['HS256'])
    except:
        return None