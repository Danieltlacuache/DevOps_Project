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
        return "secret_key_iteso_2026_fallback"

JWT_SECRET = get_jwt_secret()

USERS_TABLE       = dynamodb.Table(os.environ.get('USERS_TABLE'))
RESIDENTS_TABLE   = dynamodb.Table(os.environ.get('RESIDENTS_TABLE'))
CONDOS_TABLE      = dynamodb.Table(os.environ.get('CONDOS_TABLE'))
UNITS_TABLE       = dynamodb.Table(os.environ.get('UNITS_TABLE'))
TOKENS_TABLE      = dynamodb.Table(os.environ.get('ADMIN_TOKENS_TABLE'))
CONNECTIONS_TABLE = dynamodb.Table(os.environ.get('CONNECTIONS_TABLE'))
BUCKET_NAME       = os.environ.get('PHOTOS_BUCKET')
CDN_DOMAIN        = os.environ.get('CDN_DOMAIN', f"{BUCKET_NAME}.s3.us-east-2.amazonaws.com")

WS_ENDPOINT = os.environ.get('WEBSOCKET_URL', '').replace('wss://', 'https://')
ws_management = boto3.client('apigatewaymanagementapi', endpoint_url=WS_ENDPOINT)

# ==============================================================================
# 2. HELPERS Y LIMPIEZA AUTOMÁTICA
# ==============================================================================
def response(status, body):
    return {
        'statusCode': status, 'headers': { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS' },
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
            try: ws_management.post_to_connection(ConnectionId=c['connectionId'], Data=json.dumps(payload, default=str))
            except: CONNECTIONS_TABLE.delete_item(Key={'connectionId': c['connectionId']})
    except Exception as e: print(f"WS Sync Error: {str(e)}")

def clean_expired_reservations():
    now_utc = datetime.datetime.utcnow().isoformat()
    occupied = UNITS_TABLE.scan(FilterExpression=Attr('estado').eq('Ocupado')).get('Items', [])
    for u in occupied:
        if u.get('fecha_fin') and u.get('fecha_fin') <= now_utc:
            UNITS_TABLE.update_item(
                Key={'id': u['id']},
                UpdateExpression="SET estado = :s, ocupado_por = :empty, fecha_inicio = :empty, fecha_fin = :empty",
                ExpressionAttributeValues={':s': 'Disponible', ':empty': ''}
            )
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': u.get('condo_id')})

# ==============================================================================
# 3. LÓGICA DE NEGOCIO
# ==============================================================================
def login(event):
    data = json.loads(event.get('body', '{}'))
    user = USERS_TABLE.get_item(Key={'email': data.get('email', '').lower().strip()}, ConsistentRead=True).get('Item')
    if not user: return response(401, {'msg': 'Credenciales incorrectas'})
    if user['password'] == hashlib.sha256(data.get('password', '').encode()).hexdigest():
        payload = {'email': user['email'], 'role': user['role'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=5)}
        return response(200, {'token': jwt.encode(payload, JWT_SECRET, algorithm='HS256')})
    return response(401, {'msg': 'Credenciales incorrectas'})

def list_units(event, user):
    clean_expired_reservations() 
    
    cid = event.get('queryStringParameters', {}).get('condo_id')
    if cid:
        if user.get('role') == 'residente':
            CONDOS_TABLE.update_item(Key={'id': cid}, UpdateExpression="ADD popularidad :inc", ExpressionAttributeValues={':inc': 1})
        items = UNITS_TABLE.scan(FilterExpression=Attr('condo_id').eq(cid)).get('Items', [])
    else:
        items = UNITS_TABLE.scan().get('Items', [])
    
    if user.get('role') == 'residente':
        return response(200, [u for u in items if str(u.get('estado', '')).strip().lower() == 'disponible' and not (str(u.get('borrado_logico')).lower() in ['true', '1', 't'])])
    return response(200, items)

# ==============================================================================
# 4. HANDLER PRINCIPAL
# ==============================================================================
def lambda_handler(event, context):
    rk = event.get('requestContext', {}).get('routeKey')
    if rk:
        if rk == '$connect': CONNECTIONS_TABLE.put_item(Item={'connectionId': event['requestContext']['connectionId']})
        elif rk == '$disconnect': CONNECTIONS_TABLE.delete_item(Key={'connectionId': event['requestContext']['connectionId']})
        return {'statusCode': 200}

    m, p = event.get('httpMethod'), event.get('path', '').replace('/Prod', '')
    if not p.startswith('/'): p = '/' + p
    if m == 'OPTIONS': return response(200, {})
    
    if p == '/auth/register' and m == 'POST': 
        data = json.loads(event.get('body', '{}'))
        role = 'residente'
        if data.get('admin_token'):
            tk = TOKENS_TABLE.get_item(Key={'token': data['admin_token']}).get('Item')
            if tk and not tk.get('used'):
                role = 'admin'
                TOKENS_TABLE.update_item(Key={'token': data['admin_token']}, UpdateExpression="SET used = :u", ExpressionAttributeValues={':u': True})
            else: return response(400, {'msg': 'Token Maestro inválido o en uso.'})
        try:
            USERS_TABLE.put_item(Item={'email': data['email'].lower(), 'password': hashlib.sha256(data['password'].encode()).hexdigest(), 'role': role}, ConditionExpression='attribute_not_exists(email)')
            return response(201, {'msg': 'Registrado', 'role': role})
        except: return response(400, {'msg': 'Correo registrado.'})

    if p == '/auth/login' and m == 'POST': return login(event)
    if p == '/config': return response(200, {'ws_url': os.environ.get('WEBSOCKET_URL', '').replace('https://', 'wss://')})

    user = verify_jwt(event)
    if not user: return response(401, {'msg': 'Token inválido'})

    if p == '/admin/token' and m == 'POST':
        if user.get('role') != 'admin': return response(403, {'msg': 'No autorizado'})
        nuevo_token = "ADMIN-" + str(uuid.uuid4())[:8].upper()
        TOKENS_TABLE.put_item(Item={'token': nuevo_token, 'used': False})
        return response(201, {'token': nuevo_token})

    if p == '/condos':
        if m == 'GET':
            items = CONDOS_TABLE.scan().get('Items', [])
            return response(200, sorted(items, key=lambda x: x.get('popularidad', 0), reverse=True)) if user.get('role') == 'residente' else response(200, [c for c in items if c.get('admin_owner') == user['email']])
        if m == 'POST': 
            key = f"uploads/{uuid.uuid4()}.png"
            return response(200, {'upload_url': s3_client.generate_presigned_url('put_object', Params={'Bucket': BUCKET_NAME, 'Key': key, 'ContentType': 'image/png'}, ExpiresIn=300), 'file_key': key})
        if m == 'PUT': 
            data = json.loads(event['body'])
            item = {'id': str(uuid.uuid4()), 'admin_owner': user['email'], 'nombre': data['nombre'], 'direccion': data['direccion'], 'popularidad': 0, 'foto_url': f"https://{CDN_DOMAIN}/{data['file_key']}"}
            CONDOS_TABLE.put_item(Item=item)
            notify_clients({'action': 'REFRESH'}) 
            return response(201, item)

    if p == '/units':
        if m == 'GET': return list_units(event, user)
        if m == 'PATCH':
            data = json.loads(event['body'])
            UNITS_TABLE.update_item(Key={'id': data['id']}, UpdateExpression="SET borrado_logico = :b", ExpressionAttributeValues={':b': data['action'] == 'delete'})
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data.get('condo_id')}) 
            return response(200, {'msg': 'OK'})
        if m == 'POST':
            data = json.loads(event['body'])
            unit = {'id': str(uuid.uuid4()), 'condo_id': data['condo_id'], 'nombre': data['nombre'], 'precio': Decimal(str(data['precio'])), 'estado': 'Disponible', 'borrado_logico': False, 'foto_url': f"https://{CDN_DOMAIN}/{data['file_key']}"}
            UNITS_TABLE.put_item(Item=unit)
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data['condo_id']}) 
            return response(201, unit)

    if p == '/units/reserve' and m == 'PUT':
        data = json.loads(event['body'])
        tarjeta = str(data.get('tarjeta', ''))
        if len(tarjeta) < 16:
            return response(400, {'msg': 'Pago declinado. Tarjeta inválida.'})

        RESIDENTS_TABLE.put_item(Item={'id': str(uuid.uuid4()), 'email': user['email'], 'unit_id': data['unit_id'], 'total': Decimal(str(data['total'])), 'fecha_inicio': data['fecha_inicio'], 'fecha_fin': data['fecha_fin'], 'fecha': datetime.datetime.utcnow().isoformat()})
        UNITS_TABLE.update_item(Key={'id': data['unit_id']}, UpdateExpression="SET estado = :s, ocupado_por = :u, fecha_inicio = :fi, fecha_fin = :ff", ExpressionAttributeValues={':s': 'Ocupado', ':u': user['email'], ':fi': data['fecha_inicio'], ':ff': data['fecha_fin']})
        notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data.get('condo_id')}) 
        return response(200, {'msg': 'Reserva confirmada'})

    if p == '/units/my-reservations' and m == 'GET':
        clean_expired_reservations() 
        now_utc = datetime.datetime.utcnow().isoformat()
        res = RESIDENTS_TABLE.scan(FilterExpression=Attr('email').eq(user['email'])).get('Items', [])
        
        activas = []
        for r in res:
            fecha_fin = r.get('fecha_fin')
            if fecha_fin and str(fecha_fin) > now_utc:
                # Obtenemos la unidad
                unit = UNITS_TABLE.get_item(Key={'id': r['unit_id']}).get('Item', {})
                if unit:
                    # NUEVO: Obtenemos también el nombre del condominio
                    condo = CONDOS_TABLE.get_item(Key={'id': unit['condo_id']}).get('Item', {})
                    unit['condo_name'] = condo.get('nombre', 'Condominio')
                
                r['unit_details'] = unit
                activas.append(r)
                
        return response(200, activas)

    return response(404, {'msg': f'Ruta {p} no encontrada'})