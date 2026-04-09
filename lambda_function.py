import json, boto3, hashlib, jwt, datetime, uuid, os
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

# Inicializar clientes de AWS
dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')
secrets_client = boto3.client('secretsmanager')

# Configuración de Tablas y Bucket (Variables de Entorno)
users_table = dynamodb.Table(os.environ.get('USERS_TABLE', 'Users'))
residents_table = dynamodb.Table(os.environ.get('RESIDENTS_TABLE', 'Residents'))
condos_table = dynamodb.Table(os.environ.get('CONDOS_TABLE', 'Condominios'))
admin_tokens_table = dynamodb.Table(os.environ.get('ADMIN_TOKENS_TABLE', 'AdminTokens'))
BUCKET_NAME = os.environ.get('PHOTOS_BUCKET')

SUPER_USER_EMAIL = "admin@admin.com" 

# --- FUNCIÓN PARA OBTENER EL SECRETO DE AWS ---
def get_secret():
    secret_name = "jwt-secret-key"
    try:
        response = secrets_client.get_secret_value(SecretId=secret_name)
        return response.get('SecretString', 'secret_key_iteso_fallback')
    except ClientError as e:
        print(f"Error obteniendo secreto: {e}")
        return "secret_key_iteso_fallback"

JWT_SECRET = get_secret()

def response(s, b):
    return {
        'statusCode': s, 
        'headers': {
            'Access-Control-Allow-Origin': '*', 
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
        }, 
        'body': json.dumps(b, default=str)
    }

def verify_token(e):
    h = e.get('headers', {})
    auth = h.get('Authorization') or h.get('authorization', '')
    t = auth[7:] if auth.startswith('Bearer ') else None
    if not t: return None
    try: 
        return jwt.decode(t, JWT_SECRET, algorithms=['HS256'])
    except: 
        return None

def lambda_handler(event, context):
    m, p = event.get('httpMethod'), event.get('path')
    if m == 'OPTIONS': return response(200, {})
    
    routes = {
        'POST': {'/auth/register': register, '/auth/login': login, '/auth/generate-token': gen_token, '/condos': req_upload},
        'GET': {'/condos': get_condos},
        'PUT': {'/condos': confirm_condo, '/condos/reserve': reserve_condo},
        'DELETE': {
            '/condos': delete_condo,
            '/condos/reserve': cancel_reserve  # Ruta para liberar reserva
        }
    }
    handler = routes.get(m, {}).get(p)
    return handler(event) if handler else response(404, {'msg': 'Ruta no encontrada'})

def register(e):
    b = json.loads(e.get('body', '{}'))
    email = b.get('email', '').lower().strip()
    tok = b.get('admin_token')
    role = 'residente'
    
    if tok:
        res = admin_tokens_table.get_item(Key={'token': tok}).get('Item')
        if res and not res.get('used'):
            admin_tokens_table.update_item(
                Key={'token': tok}, 
                UpdateExpression="SET used = :u", 
                ExpressionAttributeValues={':u': True}
            )
            role = 'admin'
        else: 
            return response(400, {'message': 'Token inválido o usado'})
    
    users_table.put_item(Item={
        'email': email, 
        'password': hashlib.sha256(b['password'].encode()).hexdigest(), 
        'role': role
    })
    return response(201, {'message': 'Registrado'})

def login(e):
    b = json.loads(e.get('body', '{}'))
    u = users_table.get_item(Key={'email': b.get('email', '').lower().strip()}).get('Item')
    if u and u['password'] == hashlib.sha256(b['password'].encode()).hexdigest():
        role = u.get('role', 'residente')
        t = jwt.encode({
            'email': u['email'], 
            'role': role, 
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        }, JWT_SECRET, algorithm='HS256')
        return response(200, {'token': t})
    return response(401, {'message': 'Credenciales incorrectas'})

def req_upload(e):
    b = json.loads(e.get('body', '{}'))
    key = f"condos/{uuid.uuid4()}.png"
    url = s3_client.generate_presigned_url(
        'put_object', 
        Params={'Bucket': BUCKET_NAME, 'Key': key, 'ContentType': b.get('file_type', 'image/png')}, 
        ExpiresIn=300
    )
    return response(200, {'upload_url': url, 'file_key': key})

def confirm_condo(e):
    p = verify_token(e)
    if not p or p.get('role') != 'admin': return response(403, {'msg': 'No autorizado'})
    b = json.loads(e.get('body', '{}'))
    url = f"https://{BUCKET_NAME}.s3.amazonaws.com/{b['file_key']}"
    item = {
        'id': str(uuid.uuid4()), 
        'admin_owner': p['email'], 
        'nombre': b['nombre'], 
        'direccion': b['direccion'], 
        'foto_url': url, 
        'estado': 'Disponible'
    }
    condos_table.put_item(Item=item)
    return response(201, item)

def get_condos(e):
    p = verify_token(e)
    if not p: return response(401, {'msg': 'No autorizado'})
    if p['role'] == 'admin':
        return response(200, condos_table.scan(FilterExpression=Attr('admin_owner').eq(p['email'])).get('Items', []))
    
    available = condos_table.scan(FilterExpression=Attr('estado').eq('Disponible')).get('Items', [])
    res_items = residents_table.scan(FilterExpression=Attr('email').eq(p['email'])).get('Items', [])
    my_reserva = []
    for r in res_items:
        c = condos_table.get_item(Key={'id': r['condo_id']}).get('Item')
        if c: my_reserva.append(c)
    return response(200, {'available': available, 'my_reserva': my_reserva})

def reserve_condo(e):
    p = verify_token(e)
    if not p: return response(401, {'msg': 'No autorizado'})
    b = json.loads(e.get('body', '{}'))
    condo_id = b.get('condo_id')
    
    # Evitar duplicados: solo registrar si no existe ya esa reserva
    existing = residents_table.scan(
        FilterExpression=Attr('email').eq(p['email']) & Attr('condo_id').eq(condo_id)
    ).get('Items', [])
    
    if not existing:
        residents_table.put_item(Item={'id': str(uuid.uuid4()), 'email': p['email'], 'condo_id': condo_id})
        condos_table.update_item(
            Key={'id': condo_id}, 
            UpdateExpression="SET estado = :s", 
            ExpressionAttributeValues={':s': 'Ocupado'}
        )
        return response(200, {'message': 'Reservado con éxito'})
    return response(400, {'message': 'Ya tienes una reserva en este edificio'})

def cancel_reserve(e):
    p = verify_token(e)
    if not p: return response(401, {'msg': 'No autorizado'})
    condo_id = e.get('queryStringParameters', {}).get('condo_id')
    
    try:
        # 1. Buscar y eliminar registros en Residents
        res_items = residents_table.scan(
            FilterExpression=Attr('email').eq(p['email']) & Attr('condo_id').eq(condo_id)
        ).get('Items', [])
        
        for item in res_items:
            residents_table.delete_item(Key={'id': item['id']})
            
        # 2. Liberar el Condominio
        condos_table.update_item(
            Key={'id': condo_id},
            UpdateExpression="SET estado = :s",
            ExpressionAttributeValues={':s': 'Disponible'}
        )
        return response(200, {'message': 'Reserva cancelada exitosamente'})
    except Exception as err:
        return response(500, {'message': str(err)})

def gen_token(e):
    p = verify_token(e)
    if not p or p['email'] != SUPER_USER_EMAIL: return response(403, {'msg': 'Denegado'})
    t = str(uuid.uuid4())[:8].upper()
    admin_tokens_table.put_item(Item={'token': t, 'used': False})
    return response(201, {'admin_token': t})

def delete_condo(e):
    cid = e.get('queryStringParameters', {}).get('id')
    try:
        item = condos_table.get_item(Key={'id': cid}).get('Item')
        if item and 'foto_url' in item:
            file_key = item['foto_url'].split('.com/')[-1]
            s3_client.delete_object(Bucket=BUCKET_NAME, Key=file_key)
        condos_table.delete_item(Key={'id': cid})
        return response(200, {'message': 'Condominio eliminado'})
    except Exception as err:
        return response(500, {'message': str(err)})