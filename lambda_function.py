import json, boto3, hashlib, jwt, datetime, uuid, os
from boto3.dynamodb.conditions import Attr
from botocore.config import Config

# ==============================================================================
# CONFIGURACIÓN DE SERVICIOS (Optimizado para us-east-2)
# ==============================================================================
S3_CONFIG = Config(s3={'addressing_style': 'virtual'}, signature_version='s3v4')

dynamodb  = boto3.resource('dynamodb', region_name='us-east-2')
s3_client = boto3.client('s3', region_name='us-east-2', config=S3_CONFIG)

# Referencias a tablas desde variables de entorno (template.yaml)
USERS_TABLE       = dynamodb.Table(os.environ.get('USERS_TABLE'))
RESIDENTS_TABLE   = dynamodb.Table(os.environ.get('RESIDENTS_TABLE'))
ADMINS_DATA_TABLE = dynamodb.Table(os.environ.get('ADMINS_DATA_TABLE'))
CONDOS_TABLE      = dynamodb.Table(os.environ.get('CONDOS_TABLE'))
TOKENS_TABLE      = dynamodb.Table(os.environ.get('ADMIN_TOKENS_TABLE'))
BUCKET_NAME       = os.environ.get('PHOTOS_BUCKET')

JWT_SECRET = "secret_key_iteso_2026_final_v7" 

# ==============================================================================
# HELPERS (Centralización de respuesta y seguridad)
# ==============================================================================
def response(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
        },
        'body': json.dumps(body, default=str)
    }

def verify_jwt(event):
    auth = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
    token = auth[7:] if auth.startswith('Bearer ') else None
    try: return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except: return None

# ==============================================================================
# MÓDULO 1: AUTENTICACIÓN Y ROLES
# ==============================================================================
def login(event):
    data = json.loads(event.get('body', '{}'))
    email = data.get('email', '').lower().strip()
    user = USERS_TABLE.get_item(Key={'email': email}).get('Item')
    hashed = hashlib.sha256(data.get('password', '').encode()).hexdigest()
    
    if user and user['password'] == hashed:
        payload = {
            'email': user['email'], 'role': user.get('role', 'residente'),
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        }
        return response(200, {'token': jwt.encode(payload, JWT_SECRET, algorithm='HS256')})
    return response(401, {'msg': 'Credenciales incorrectas'})

def register(event):
    data = json.loads(event.get('body', '{}'))
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')
    admin_token = data.get('admin_token')
    role = 'residente'

    if admin_token:
        token_item = TOKENS_TABLE.get_item(Key={'token': admin_token}).get('Item')
        if token_item and not token_item.get('used', False):
            role = 'admin'
            TOKENS_TABLE.update_item(Key={'token': admin_token}, UpdateExpression="SET used = :u", ExpressionAttributeValues={':u': True})
        else: return response(400, {'msg': 'Token admin inválido'})

    # 1. Guardar en tabla de Auth
    USERS_TABLE.put_item(Item={
        'email': email, 'role': role,
        'password': hashlib.sha256(password.encode()).hexdigest()
    })

    # 2. Inicializar perfiles (Separación de Datos)
    if role == 'admin':
        ADMINS_DATA_TABLE.put_item(Item={'email': email, 'status': 'Activo', 'creado': datetime.datetime.utcnow().isoformat()})
    else:
        RESIDENTS_TABLE.put_item(Item={'id': str(uuid.uuid4()), 'email': email, 'status': 'Habilitado'})
    
    return response(201, {'msg': f'Registro exitoso como {role}'})

# ==============================================================================
# MÓDULO 2: GESTIÓN DE CONDOMINIOS (ADMIN)
# ==============================================================================
def req_upload(event):
    data = json.loads(event.get('body', '{}'))
    file_key = f"condos/{uuid.uuid4()}.png"
    url = s3_client.generate_presigned_url('put_object', Params={
        'Bucket': BUCKET_NAME, 'Key': file_key, 'ContentType': data.get('file_type', 'image/png')
    }, ExpiresIn=300)
    return response(200, {'upload_url': url, 'file_key': file_key})

def confirm_condo(event):
    u = verify_jwt(event)
    if not u or u.get('role') != 'admin': return response(403, {'msg': 'No autorizado'})
    data = json.loads(event.get('body', '{}'))
    item = {
        'id': str(uuid.uuid4()), 'admin_owner': u['email'], 'nombre': data['nombre'],
        'direccion': data['direccion'], 'estado': 'Disponible',
        'foto_url': f"https://{BUCKET_NAME}.s3.us-east-2.amazonaws.com/{data['file_key']}"
    }
    CONDOS_TABLE.put_item(Item=item)
    return response(201, item)

def delete_condo(event):
    u = verify_jwt(event)
    if not u or u.get('role') != 'admin': return response(403, {'msg': 'No autorizado'})
    cid = event.get('queryStringParameters', {}).get('id')
    condo = CONDOS_TABLE.get_item(Key={'id': cid}).get('Item')
    if condo:
        try: # Borrar imagen de S3 para optimizar almacenamiento
            key = f"condos/{condo['foto_url'].split('/')[-1]}"
            s3_client.delete_object(Bucket=BUCKET_NAME, Key=key)
        except: pass
        CONDOS_TABLE.delete_item(Key={'id': cid})
        return response(200, {'msg': 'Eliminado satisfactoriamente'})
    return response(404, {'msg': 'No encontrado'})

# ==============================================================================
# MÓDULO 3: MARKETPLACE Y RESERVAS (RESIDENTE)
# ==============================================================================
def list_condos(event):
    u = verify_jwt(event)
    if not u: return response(401, {'msg': 'No autorizado'})
    
    if u['role'] == 'admin':
        return response(200, CONDOS_TABLE.scan(FilterExpression=Attr('admin_owner').eq(u['email'])).get('Items', []))
    
    # Vista para Residentes
    av = CONDOS_TABLE.scan(FilterExpression=Attr('estado').eq('Disponible')).get('Items', [])
    res_items = RESIDENTS_TABLE.scan(FilterExpression=Attr('email').eq(u['email'])).get('Items', [])
    
    my = []
    for r in res_items:
        if r.get('condo_id'):
            c = CONDOS_TABLE.get_item(Key={'id': r['condo_id']}).get('Item')
            if c: my.append(c)
            
    return response(200, {'available': av, 'my_reserva': my})

def reserve_condo(event):
    u = verify_jwt(event)
    if not u: return response(401, {'msg': 'No autorizado'})
    cid = json.loads(event.get('body', '{}')).get('condo_id')
    
    # 1. Registrar en tabla RESIDENTS (Relación de servicio)
    RESIDENTS_TABLE.put_item(Item={
        'id': str(uuid.uuid4()), 'email': u['email'], 'condo_id': cid, 
        'fecha_reserva': datetime.datetime.utcnow().isoformat()
    })
    
    # 2. Actualizar estado del activo
    CONDOS_TABLE.update_item(Key={'id': cid}, UpdateExpression="SET estado = :s", ExpressionAttributeValues={':s': 'Ocupado'})
    return response(200, {'msg': 'Contratación exitosa'})

def cancel_reserve(event):
    u = verify_jwt(event)
    if not u: return response(401, {'msg': 'No autorizado'})
    cid = event.get('queryStringParameters', {}).get('condo_id')
    
    # Borrar registros en Residents
    items = RESIDENTS_TABLE.scan(FilterExpression=Attr('email').eq(u['email']) & Attr('condo_id').eq(cid)).get('Items', [])
    for i in items: RESIDENTS_TABLE.delete_item(Key={'id': i['id']})
    
    # Liberar activo
    CONDOS_TABLE.update_item(Key={'id': cid}, UpdateExpression="SET estado = :s", ExpressionAttributeValues={':s': 'Disponible'})
    return response(200, {'msg': 'Servicio finalizado / Reserva cancelada'})

def generate_token(event):
    u = verify_jwt(event)
    if not u or u.get('role') != 'admin': return response(403, {'msg': 'Acceso restringido'})
    new_t = str(uuid.uuid4())[:8].upper()
    TOKENS_TABLE.put_item(Item={'token': new_t, 'used': False, 'created_by': u['email']})
    return response(200, {'admin_token': new_t})

# ==============================================================================
# ENRUTADOR (ROUTER)
# ==============================================================================
def lambda_handler(event, context):
    m, p = event.get('httpMethod'), event.get('path')
    if m == 'OPTIONS': return response(200, {})
    
    routes = {
        'POST': {'/auth/login': login, '/auth/register': register, '/auth/generate-token': generate_token, '/condos': req_upload},
        'GET':  {'/condos': list_condos},
        'PUT':  {'/condos': confirm_condo, '/condos/reserve': reserve_condo},
        'DELETE': {'/condos': delete_condo, '/condos/reserve': cancel_reserve}
    }
    
    handler = routes.get(m, {}).get(p)
    if not handler: return response(404, {'msg': 'Ruta no definida'})
    
    try: return handler(event)
    except Exception as e: 
        print(f"Error detectado: {str(e)}")
        return response(500, {'error': 'Error interno del servidor'})