import json, boto3, hashlib, jwt, datetime, uuid, os
from boto3.dynamodb.conditions import Attr
from botocore.config import Config
from decimal import Decimal

# ==============================================================================
# 1. CONFIGURACIÓN E INFRAESTRUCTURA
# ==============================================================================
S3_CONFIG = Config(s3={'addressing_style': 'virtual'}, signature_version='s3v4')
dynamodb  = boto3.resource('dynamodb', region_name='us-east-2')
s3_client = boto3.client('s3', region_name='us-east-2', config=S3_CONFIG)

def get_jwt_secret():
    client = boto3.client('secretsmanager', region_name='us-east-2')
    try:
        res = client.get_secret_value(SecretId=os.environ.get('SECRET_ID', 'CondoManager/JWT_Secret'))
        return json.loads(res['SecretString'])['JWT_KEY']
    except Exception as e:
        print(f"Error SecretsManager: {str(e)}")
        return "secret_key_iteso_2026_fallback"

JWT_SECRET = get_jwt_secret()

# Tablas conectadas al template.yaml
USERS_TABLE       = dynamodb.Table(os.environ.get('USERS_TABLE'))
RESIDENTS_TABLE   = dynamodb.Table(os.environ.get('RESIDENTS_TABLE'))
CONDOS_TABLE      = dynamodb.Table(os.environ.get('CONDOS_TABLE'))
UNITS_TABLE       = dynamodb.Table(os.environ.get('UNITS_TABLE'))
TOKENS_TABLE      = dynamodb.Table(os.environ.get('ADMIN_TOKENS_TABLE'))
CONNECTIONS_TABLE = dynamodb.Table(os.environ.get('CONNECTIONS_TABLE'))
BUCKET_NAME       = os.environ.get('PHOTOS_BUCKET')

WS_ENDPOINT = os.environ.get('WEBSOCKET_URL', '').replace('wss://', 'https://')
ws_management = boto3.client('apigatewaymanagementapi', endpoint_url=WS_ENDPOINT)

# ==============================================================================
# 2. HELPERS (Respuestas, Tokens y Notificaciones)
# ==============================================================================
def response(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS'
        },
        'body': json.dumps(body, default=str)
    }

def verify_jwt(event):
    auth = (event.get('headers') or {}).get('Authorization', '')
    if not auth.startswith('Bearer '): return None
    try: return jwt.decode(auth[7:], JWT_SECRET, algorithms=['HS256'])
    except: return None

def notify_clients(payload):
    try:
        conns = CONNECTIONS_TABLE.scan(ProjectionExpression="connectionId").get('Items', [])
        for c in conns:
            try:
                ws_management.post_to_connection(ConnectionId=c['connectionId'], Data=json.dumps(payload, default=str))
            except:
                CONNECTIONS_TABLE.delete_item(Key={'connectionId': c['connectionId']})
    except Exception as e: print(f"WS Sync Error: {str(e)}")

# ==============================================================================
# 3. MÓDULO DE AUTENTICACIÓN Y REGISTRO
# ==============================================================================
def register_user(event):
    data = json.loads(event.get('body', '{}'))
    email = data.get('email', '').lower().strip()
    password = data.get('password')
    admin_token = data.get('admin_token')
    
    role = 'residente'
    
    if admin_token:
        tk_item = TOKENS_TABLE.get_item(Key={'token': admin_token}).get('Item')
        if tk_item and not tk_item.get('used', False):
            role = 'admin'
            TOKENS_TABLE.update_item(
                Key={'token': admin_token}, 
                UpdateExpression="SET used = :u", 
                ExpressionAttributeValues={':u': True}
            )
        else:
            return response(400, {'msg': 'Token maestro inválido o ya utilizado'})

    hashed_pw = hashlib.sha256(password.encode()).hexdigest()
    try:
        USERS_TABLE.put_item(
            Item={'email': email, 'password': hashed_pw, 'role': role},
            ConditionExpression='attribute_not_exists(email)'
        )
        return response(201, {'msg': 'Usuario registrado', 'role': role})
    except:
        return response(400, {'msg': 'El usuario ya existe'})

def login(event):
    data = json.loads(event.get('body', '{}'))
    email = data.get('email', '').lower().strip()
    user = USERS_TABLE.get_item(Key={'email': email}).get('Item')
    
    if not user:
        return response(401, {'msg': 'Credenciales incorrectas'})
        
    hashed = hashlib.sha256(data.get('password', '').encode()).hexdigest()
    if user['password'] == hashed:
        payload = {'email': user['email'], 'role': user['role'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=5)}
        return response(200, {'token': jwt.encode(payload, JWT_SECRET, algorithm='HS256')})
    
    return response(401, {'msg': 'Credenciales incorrectas'})

# ==============================================================================
# 4. MÓDULO DE NEGOCIO (UNIDADES CON FILTRO INFALIBLE)
# ==============================================================================
def list_units(event, user):
    cid = event.get('queryStringParameters', {}).get('condo_id')
    
    if cid:
        filter_expr = Attr('condo_id').eq(cid)
        items = UNITS_TABLE.scan(FilterExpression=filter_expr).get('Items', [])
    else:
        items = UNITS_TABLE.scan().get('Items', [])
    
    if user.get('role') == 'residente':
        filtered_items = []
        for u in items:
            estado = str(u.get('estado', '')).strip().lower()
            bl = u.get('borrado_logico')
            is_deleted = str(bl).lower() in ['true', '1', 't'] if bl is not None else False
            
            if estado == 'disponible' and not is_deleted:
                filtered_items.append(u)
                
        return response(200, filtered_items)
    
    return response(200, items)

def update_unit_status(event, user):
    if user.get('role') != 'admin': return response(403, {'msg': 'No autorizado'})
    
    data = json.loads(event.get('body', '{}'))
    is_deleted = True if data.get('action') == 'delete' else False
    
    UNITS_TABLE.update_item(
        Key={'id': data['id']},
        UpdateExpression="SET borrado_logico = :b",
        ExpressionAttributeValues={':b': is_deleted}
    )
    notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data.get('condo_id')})
    return response(200, {'msg': 'Estado actualizado'})

# ==============================================================================
# 5. HANDLER PRINCIPAL (ROUTER)
# ==============================================================================
def lambda_handler(event, context):
    # --- Ruteo de WebSockets ---
    rk = event.get('requestContext', {}).get('routeKey')
    if rk:
        cid = event['requestContext']['connectionId']
        if rk == '$connect': CONNECTIONS_TABLE.put_item(Item={'connectionId': cid})
        elif rk == '$disconnect': CONNECTIONS_TABLE.delete_item(Key={'connectionId': cid})
        return {'statusCode': 200}

    # --- Limpieza de Ruta REST ---
    m = event.get('httpMethod')
    p = event.get('path', '').replace('/Prod', '')
    if not p.startswith('/'): p = '/' + p
    
    # --- Rutas Públicas ---
    if m == 'OPTIONS': return response(200, {})
    if p == '/auth/register' and m == 'POST': return register_user(event)
    if p == '/auth/login' and m == 'POST': return login(event)
    if p == '/config': return response(200, {'ws_url': os.environ.get('WEBSOCKET_URL')})

    # --- Verificación de Token ---
    user = verify_jwt(event)
    if not user: return response(401, {'msg': 'Token requerido o expirado'})

    # --- RUTA NUEVA: GENERAR TOKEN MAESTRO (SUPER ADMIN) ---
    if p == '/admin/token' and m == 'POST':
        if user.get('role') != 'admin':
            return response(403, {'msg': 'Solo administradores pueden crear llaves maestras'})
            
        nuevo_token = "ADMIN-" + str(uuid.uuid4())[:8].upper()
        
        TOKENS_TABLE.put_item(Item={
            'token': nuevo_token, 
            'used': False, 
            'creado_por': user.get('email'),
            'fecha': datetime.datetime.utcnow().isoformat()
        })
        
        return response(201, {'token': nuevo_token})

    # --- Rutas Protegidas de Negocio ---
    if p == '/condos':
        if m == 'GET':
            items = CONDOS_TABLE.scan().get('Items', [])
            rol_usuario = user.get('role', 'residente')
            correo_usuario = user.get('email', '')
            
            if rol_usuario == 'admin':
                mis_condos = [c for c in items if c.get('admin_owner') == correo_usuario]
                return response(200, mis_condos)
            else:
                return response(200, items)
                
        if m == 'POST': 
            key = f"uploads/{uuid.uuid4()}.png"
            url = s3_client.generate_presigned_url('put_object', Params={'Bucket': BUCKET_NAME, 'Key': key, 'ContentType': 'image/png'}, ExpiresIn=300)
            return response(200, {'upload_url': url, 'file_key': key})
            
        if m == 'PUT': 
            data = json.loads(event['body'])
            item = {'id': str(uuid.uuid4()), 'admin_owner': user['email'], 'nombre': data['nombre'], 'direccion': data['direccion'], 'foto_url': f"https://{BUCKET_NAME}.s3.us-east-2.amazonaws.com/{data['file_key']}"}
            CONDOS_TABLE.put_item(Item=item)
            notify_clients({'action': 'REFRESH'})
            return response(201, item)

    if p == '/units':
        if m == 'GET': return list_units(event, user)
        if m == 'PATCH': return update_unit_status(event, user)
        if m == 'POST':
            data = json.loads(event['body'])
            unit = {
                'id': str(uuid.uuid4()), 'condo_id': data['condo_id'], 'nombre': data['nombre'], 
                'precio': Decimal(str(data['precio'])), 'estado': 'Disponible', 'borrado_logico': False,
                'foto_url': f"https://{BUCKET_NAME}.s3.us-east-2.amazonaws.com/{data['file_key']}"
            }
            UNITS_TABLE.put_item(Item=unit)
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data['condo_id']})
            return response(201, unit)

    if p == '/units/reserve' and m == 'PUT':
        data = json.loads(event['body'])
        f_inicio = data.get('fecha_inicio', '')
        f_fin = data.get('fecha_fin', '')
        total_pagar = Decimal(str(data['total']))
        
        # Guardamos la reserva en la tabla del residente
        RESIDENTS_TABLE.put_item(Item={
            'id': str(uuid.uuid4()), 
            'email': user['email'], 
            'unit_id': data['unit_id'], 
            'total': total_pagar, 
            'fecha_inicio': f_inicio,
            'fecha_fin': f_fin,
            'fecha': datetime.datetime.utcnow().isoformat()
        })
        
        # Actualizamos la unidad para que el admin sepa quién y cuándo
        UNITS_TABLE.update_item(
            Key={'id': data['unit_id']}, 
            UpdateExpression="SET estado = :s, ocupado_por = :u, fecha_inicio = :fi, fecha_fin = :ff", 
            ExpressionAttributeValues={
                ':s': 'Ocupado', 
                ':u': user['email'],
                ':fi': f_inicio,
                ':ff': f_fin
            }
        )
        
        notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data.get('condo_id')})
        return response(200, {'msg': 'Reserva confirmada'})

    if p == '/units/my-reservations' and m == 'GET':
        res = RESIDENTS_TABLE.scan(FilterExpression=Attr('email').eq(user.get('email'))).get('Items', [])
        for r in res: r['unit_details'] = UNITS_TABLE.get_item(Key={'id': r['unit_id']}).get('Item', {})
        return response(200, res)

    return response(404, {'msg': f'Ruta {p} no encontrada'})