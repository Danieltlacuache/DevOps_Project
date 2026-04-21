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
    except Exception:
        return "secret_key_iteso_2026_fallback"

JWT_SECRET = get_jwt_secret()

USERS_TABLE       = dynamodb.Table(os.environ.get('USERS_TABLE'))
RESIDENTS_TABLE   = dynamodb.Table(os.environ.get('RESIDENTS_TABLE'))
CONDOS_TABLE      = dynamodb.Table(os.environ.get('CONDOS_TABLE'))
UNITS_TABLE       = dynamodb.Table(os.environ.get('UNITS_TABLE'))
TOKENS_TABLE      = dynamodb.Table(os.environ.get('ADMIN_TOKENS_TABLE'))
CONNECTIONS_TABLE = dynamodb.Table(os.environ.get('CONNECTIONS_TABLE'))
MAINT_TABLE       = dynamodb.Table(os.environ.get('MAINTENANCE_TASKS_TABLE'))
BUCKET_NAME       = os.environ.get('PHOTOS_BUCKET')
CDN_DOMAIN        = os.environ.get('CDN_DOMAIN')

WS_ENDPOINT = os.environ.get('WEBSOCKET_URL', '').replace('wss://', 'https://')
ws_management = boto3.client('apigatewaymanagementapi', endpoint_url=WS_ENDPOINT)

# ==============================================================================
# 2. UTILIDADES Y NOTIFICACIONES
# ==============================================================================

def response(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
        },
        'body': json.dumps(body, default=str)
    }

def verify_jwt(event):
    auth = (event.get('headers') or {}).get('Authorization', '')
    if not auth.startswith('Bearer '): return None
    try:
        return jwt.decode(auth[7:], JWT_SECRET, algorithms=['HS256'])
    except:
        return None

def notify_clients(payload):
    conns = CONNECTIONS_TABLE.scan(ProjectionExpression="connectionId").get('Items', [])
    for c in conns:
        try:
            ws_management.post_to_connection(ConnectionId=c['connectionId'], Data=json.dumps(payload, default=str))
        except:
            CONNECTIONS_TABLE.delete_item(Key={'connectionId': c['connectionId']})

def clean_expired_reservations():
    now_utc = datetime.datetime.utcnow().isoformat()
    occupied = UNITS_TABLE.scan(FilterExpression=Attr('estado').eq('Ocupado')).get('Items', [])
    for u in occupied:
        if u.get('fecha_fin') and str(u.get('fecha_fin')) <= now_utc:
            UNITS_TABLE.update_item(
                Key={'id': u['id']},
                UpdateExpression="SET estado = :s, ocupado_por = :empty, fecha_inicio = :empty, fecha_fin = :empty",
                ExpressionAttributeValues={':s': 'Disponible', ':empty': ''}
            )
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': u.get('condo_id')})

# ==============================================================================
# 3. HANDLER PRINCIPAL
# ==============================================================================

def lambda_handler(event, context):
    # --- Lógica WebSockets ---
    rk = event.get('requestContext', {}).get('routeKey')
    if rk:
        cid = event['requestContext']['connectionId']
        if rk == '$connect':
            CONNECTIONS_TABLE.put_item(Item={'connectionId': cid})
        elif rk == '$disconnect':
            CONNECTIONS_TABLE.delete_item(Key={'connectionId': cid})
        return {'statusCode': 200}

    # --- Lógica REST API ---
    m = event.get('httpMethod')
    p = event.get('path', '').replace('/Prod', '')
    if not p.startswith('/'): p = '/' + p

    if m == 'OPTIONS': return response(200, {})

    # Registro de Usuarios (Soporte para Token de Admin y Mantenimiento)
    if p == '/auth/register' and m == 'POST':
        data = json.loads(event.get('body', '{}'))
        role = 'residente'
        tk_val = data.get('admin_token')
        
        if tk_val:
            tk = TOKENS_TABLE.get_item(Key={'token': tk_val}).get('Item')
            if tk and not tk.get('used'):
                role = tk.get('type', 'admin') # 'admin' o 'mantenimiento'
                TOKENS_TABLE.update_item(Key={'token': tk_val}, UpdateExpression="SET used = :u", ExpressionAttributeValues={':u': True})
            else:
                return response(400, {'msg': 'Token inválido o ya utilizado.'})

        hpw = hashlib.sha256(data['password'].encode()).hexdigest()
        try:
            USERS_TABLE.put_item(
                Item={'email': data['email'].lower(), 'password': hpw, 'role': role},
                ConditionExpression='attribute_not_exists(email)'
            )
            return response(201, {'msg': 'OK', 'role': role})
        except:
            return response(400, {'msg': 'El correo ya está registrado.'})

    if p == '/auth/login' and m == 'POST':
        data = json.loads(event.get('body', '{}'))
        u = USERS_TABLE.get_item(Key={'email': data.get('email', '').lower()}, ConsistentRead=True).get('Item')
        if u and u['password'] == hashlib.sha256(data.get('password', '').encode()).hexdigest():
            payload = {'email': u['email'], 'role': u['role'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=5)}
            return response(200, {'token': jwt.encode(payload, JWT_SECRET, algorithm='HS256')})
        return response(401, {'msg': 'Credenciales incorrectas'})

    if p == '/config' and m == 'GET':
        return response(200, {'ws_url': os.environ.get('WEBSOCKET_URL', '').replace('https://', 'wss://')})

    # RUTAS PROTEGIDAS
    user = verify_jwt(event)
    if not user: return response(401, {'msg': 'Token inválido o expirado'})

    # Gestión de Tokens (Admin puede generar para Admin o Mantenimiento)
    if p == '/admin/token' and m == 'POST':
        if user['role'] != 'admin': return response(403, {'msg': 'No autorizado'})
        data = json.loads(event.get('body', '{}'))
        t_type = data.get('type', 'admin')
        nuevo = ("MAINT-" if t_type == 'mantenimiento' else "ADMIN-") + str(uuid.uuid4())[:8].upper()
        TOKENS_TABLE.put_item(Item={'token': nuevo, 'used': False, 'type': t_type})
        return response(201, {'token': nuevo})

    # Gestión de Tareas de Mantenimiento
    if p == '/maintenance/tasks':
        if m == 'GET':
            if user['role'] == 'mantenimiento':
                tasks = MAINT_TABLE.scan(FilterExpression=Attr('assigned_to').eq(user['email'])).get('Items', [])
            else: # Admins ven todas
                tasks = MAINT_TABLE.scan().get('Items', [])
            return response(200, tasks)

        if m == 'POST': # Admin asigna tarea
            if user['role'] != 'admin': return response(403, {'msg': 'No autorizado'})
            data = json.loads(event['body'])
            task = {
                'id': str(uuid.uuid4()),
                'unit_id': data['unit_id'],
                'condo_id': data['condo_id'],
                'assigned_to': data['assigned_to'], # Email del técnico
                'descripcion': data['descripcion'],
                'status': 'Pendiente',
                'fecha': datetime.datetime.utcnow().isoformat()
            }
            MAINT_TABLE.put_item(Item=task)
            notify_clients({'action': 'REFRESH_TASKS'})
            return response(201, task)

        if m == 'PATCH': # Técnico actualiza estado
            data = json.loads(event['body'])
            MAINT_TABLE.update_item(
                Key={'id': data['id']},
                UpdateExpression="SET #s = :s",
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': data['status']}
            )
            notify_clients({'action': 'REFRESH_TASKS'})
            return response(200, {'msg': 'Estado actualizado'})

    # Condominios
    if p == '/condos':
        if m == 'GET':
            items = CONDOS_TABLE.scan().get('Items', [])
            if user['role'] == 'residente':
                return response(200, sorted(items, key=lambda x: x.get('popularidad', 0), reverse=True))
            return response(200, [c for c in items if c.get('admin_owner') == user['email']])
        
        if m == 'POST' and user['role'] == 'admin':
            key = f"uploads/{uuid.uuid4()}.png"
            url = s3_client.generate_presigned_url('put_object', Params={'Bucket': BUCKET_NAME, 'Key': key, 'ContentType': 'image/png'}, ExpiresIn=300)
            return response(200, {'upload_url': url, 'file_key': key})
            
        if m == 'PUT' and user['role'] == 'admin':
            data = json.loads(event['body'])
            item = {
                'id': str(uuid.uuid4()), 'admin_owner': user['email'], 'nombre': data['nombre'],
                'direccion': data['direccion'], 'popularidad': 0,
                'foto_url': f"https://{CDN_DOMAIN}/{data['file_key']}"
            }
            CONDOS_TABLE.put_item(Item=item)
            notify_clients({'action': 'REFRESH'})
            return response(201, item)

    # Unidades
    if p == '/units':
        if m == 'GET':
            clean_expired_reservations()
            cid = event.get('queryStringParameters', {}).get('condo_id')
            if cid:
                if user['role'] == 'residente':
                    CONDOS_TABLE.update_item(Key={'id': cid}, UpdateExpression="ADD popularidad :i", ExpressionAttributeValues={':i': 1})
                items = UNITS_TABLE.scan(FilterExpression=Attr('condo_id').eq(cid)).get('Items', [])
            else:
                items = UNITS_TABLE.scan().get('Items', [])
            
            if user['role'] == 'residente':
                return response(200, [u for u in items if u.get('estado') == 'Disponible' and not u.get('borrado_logico')])
            return response(200, items)

        if m == 'POST' and user['role'] == 'admin':
            data = json.loads(event['body'])
            unit = {
                'id': str(uuid.uuid4()), 'condo_id': data['condo_id'], 'nombre': data['nombre'],
                'precio': Decimal(str(data['precio'])), 'estado': 'Disponible', 'borrado_logico': False,
                'foto_url': f"https://{CDN_DOMAIN}/{data['file_key']}"
            }
            UNITS_TABLE.put_item(Item=unit)
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data['condo_id']})
            return response(201, unit)

        if m == 'PATCH' and user['role'] == 'admin':
            data = json.loads(event['body'])
            UNITS_TABLE.update_item(
                Key={'id': data['id']},
                UpdateExpression="SET borrado_logico = :b",
                ExpressionAttributeValues={':b': data['action'] == 'delete'}
            )
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data.get('condo_id')})
            return response(200, {'msg': 'OK'})

    # Reservas
    if p == '/units/reserve' and m == 'PUT':
        data = json.loads(event['body'])
        if len(str(data.get('tarjeta', ''))) < 16:
            return response(400, {'msg': 'Tarjeta inválida o rechazada'})
            
        RESIDENTS_TABLE.put_item(Item={
            'id': str(uuid.uuid4()), 'email': user['email'], 'unit_id': data['unit_id'],
            'total': Decimal(str(data['total'])), 'fecha_inicio': data['fecha_inicio'],
            'fecha_fin': data['fecha_fin'], 'fecha': datetime.datetime.utcnow().isoformat()
        })
        UNITS_TABLE.update_item(
            Key={'id': data['unit_id']},
            UpdateExpression="SET estado = :s, ocupado_por = :u, fecha_inicio = :fi, fecha_fin = :ff",
            ExpressionAttributeValues={':s': 'Ocupado', ':u': user['email'], ':fi': data['fecha_inicio'], ':ff': data['fecha_fin']}
        )
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
                unit = UNITS_TABLE.get_item(Key={'id': r['unit_id']}).get('Item', {})
                if unit:
                    condo = CONDOS_TABLE.get_item(Key={'id': unit['condo_id']}).get('Item', {})
                    unit['condo_name'] = condo.get('nombre', 'Edificio')
                r['unit_details'] = unit
                activas.append(r)
        return response(200, activas)

    return response(404, {'msg': 'Ruta no encontrada'})