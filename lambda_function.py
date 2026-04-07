import json
import boto3
import hashlib
import jwt
import datetime
import uuid
import re
import os
import base64
from botocore.exceptions import ClientError
from decimal import Decimal
from boto3.dynamodb.conditions import Attr

# --- INICIALIZACIÓN DE RECURSOS ---
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

# Tablas (Sincronizadas con template.yaml)
users_table = dynamodb.Table(os.environ.get('USERS_TABLE', 'Users'))
residents_table = dynamodb.Table(os.environ.get('RESIDENTS_TABLE', 'Residents'))
payments_table = dynamodb.Table(os.environ.get('PAYMENTS_TABLE', 'Payments'))
announcements_table = dynamodb.Table(os.environ.get('ANNOUNCEMENTS_TABLE', 'Announcements'))
maintenance_table = dynamodb.Table(os.environ.get('MAINTENANCE_TABLE', 'Maintenance'))
condos_table = dynamodb.Table(os.environ.get('CONDOS_TABLE', 'Condominios'))

BUCKET_NAME = os.environ.get('PHOTOS_BUCKET')
secrets_client = boto3.client('secretsmanager')
JWT_SECRET_NAME = os.environ.get('JWT_SECRET_NAME', 'jwt-secret-key')

# --- HELPERS ---
def get_jwt_secret():
    try:
        response = secrets_client.get_secret_value(SecretId=JWT_SECRET_NAME)
        secret_dict = json.loads(response['SecretString'])
        return secret_dict.get('JWT_SECRET', 'fallback_secret_desarrollo')
    except:
        return 'fallback_secret_desarrollo'

def get_admin_master_key():
    return "ITESO_2026_ADMIN"

def is_valid_email(email):
    regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(regex, email) is not None

def get_body(e):
    b = e.get('body', '{}')
    return json.loads(b) if isinstance(b, str) else b

def response(s, b):
    return {
        'statusCode': s, 
        'headers': {
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*', 
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,DELETE,PUT', 
            'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        }, 
        'body': json.dumps(b, default=str)
    }

def get_token_from_header(e):
    h = e.get('headers', {})
    auth = h.get('Authorization') or h.get('authorization', '')
    return auth[7:] if auth.startswith('Bearer ') else None

def verify_token(t):
    if not t: return None
    try: return jwt.decode(t, get_jwt_secret(), algorithms=['HS256'])
    except: return None

# --- HANDLER PRINCIPAL ---
def lambda_handler(event, context):
    http_method = event.get('httpMethod')
    path = event.get('path')

    if http_method == 'OPTIONS':
        return response(200, {'message': 'CORS OK'})

    routes = {
        'POST': {
            '/auth/register': register,
            '/auth/login': login,
            '/residents': create_resident,
            '/payments': create_payment,
            '/announcements': create_announcement,
            '/maintenance': create_maintenance,
            '/condos': create_condo 
        },
        'GET': {
            '/residents': get_residents,
            '/payments': get_payments,
            '/announcements': get_announcements,
            '/maintenance': get_maintenance,
            '/condos': get_condos 
        },
        'DELETE': {
            '/residents': delete_resident
        },
        'PUT': {
            '/condos': update_condo_status
        }
    }

    handler_func = routes.get(http_method, {}).get(path)
    if handler_func:
        return handler_func(event)
    
    return response(404, {'message': f'Ruta no encontrada: {path}'})

# -------- LÓGICA DE CONDOMINIOS --------

def create_condo(event):
    payload = verify_token(get_token_from_header(event))
    if not payload or payload.get('role') != 'admin':
        return response(403, {'message': 'Solo administradores'})

    body = get_body(event)
    image_data = body.get('image_data') 
    foto_url = 'https://via.placeholder.com/400x200?text=Sin+Foto'

    if image_data and BUCKET_NAME:
        try:
            header, imgstr = image_data.split(';base64,')
            ext = header.split('/')[-1].split(';')[0]
            file_name = f"condos/{uuid.uuid4()}.{ext}"
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=file_name,
                Body=base64.b64decode(imgstr),
                ContentType=f"image/{ext}"
            )
            foto_url = f"https://{BUCKET_NAME}.s3.amazonaws.com/{file_name}"
        except Exception as e:
            print(f"Error S3: {str(e)}")

    condo = {
        'id': str(uuid.uuid4()),
        'admin_owner': payload.get('email').lower(),
        'nombre': body.get('nombre'),
        'direccion': body.get('direccion'),
        'descripcion': body.get('descripcion', 'Gestionado por CondoManager Pro'),
        'foto_url': foto_url,
        'estado': 'Disponible',
        'created_at': datetime.datetime.utcnow().isoformat()
    }
    condos_table.put_item(Item=condo)
    return response(201, condo)

def update_condo_status(event):
    payload = verify_token(get_token_from_header(event))
    if not payload or payload.get('role') != 'admin':
        return response(403, {'message': 'No autorizado'})

    body = get_body(event)
    condo_id = body.get('id')
    nuevo_estado = body.get('estado')

    try:
        condos_table.update_item(
            Key={'id': condo_id},
            UpdateExpression="SET estado = :s",
            ExpressionAttributeValues={':s': nuevo_estado}
        )
        return response(200, {'message': 'Estado actualizado'})
    except Exception as e:
        return response(500, {'message': str(e)})

def get_condos(event):
    payload = verify_token(get_token_from_header(event))
    if not payload: return response(401, {'message': 'No autorizado'})

    email = payload.get('email', '').lower().strip()
    if payload.get('role') == 'admin':
        items = condos_table.scan(FilterExpression=Attr('admin_owner').eq(email)).get('Items', [])
    else:
        res_info = residents_table.scan(FilterExpression=Attr('email').eq(email)).get('Items', [])
        if res_info:
            target_id = res_info[0].get('condo_id')
            items = condos_table.scan(FilterExpression=Attr('id').eq(target_id)).get('Items', [])
        else:
            items = []
    return response(200, items)

# -------- LÓGICA DE RESIDENTES (AUTOMATIZADA) --------

def create_resident(event):
    payload = verify_token(get_token_from_header(event))
    if not payload or payload.get('role') != 'admin': return response(403, {'message': 'Acceso denegado'})
    
    body = get_body(event)
    condo_id = body.get('condo_id')
    
    resident = {
        'id': str(uuid.uuid4()), 
        'admin_owner': payload['email'].lower(), 
        'name': body.get('name'), 
        'apartment': body.get('apartment'), 
        'email': body.get('email', '').lower().strip(), 
        'condo_id': condo_id, 
        'created_at': datetime.datetime.utcnow().isoformat()
    }
    residents_table.put_item(Item=resident)

    # AUTOMATIZACIÓN: Cambiar estado del edificio a Ocupado
    if condo_id:
        try:
            condos_table.update_item(
                Key={'id': condo_id},
                UpdateExpression="SET estado = :s",
                ExpressionAttributeValues={':s': 'Ocupado'}
            )
        except: pass

    return response(201, resident)

def get_residents(event):
    payload = verify_token(get_token_from_header(event))
    if not payload: return response(401, {'message': 'No autorizado'})
    email = payload['email'].lower()
    if payload['role'] == 'admin':
        items = residents_table.scan(FilterExpression=Attr('admin_owner').eq(email)).get('Items', [])
    else:
        items = residents_table.scan(FilterExpression=Attr('email').eq(email)).get('Items', [])
    return response(200, items)

def delete_resident(event):
    payload = verify_token(get_token_from_header(event))
    if not payload or payload.get('role') != 'admin': return response(403, {'message': 'No admin'})

    params = event.get('queryStringParameters') or {}
    res_id = params.get('id')

    try:
        # Obtener condo_id antes de borrar para liberarlo
        res_item = residents_table.get_item(Key={'id': res_id}).get('Item')
        if res_item:
            condo_id = res_item.get('condo_id')
            residents_table.delete_item(Key={'id': res_id})
            
            # AUTOMATIZACIÓN: Volver a poner Disponible
            if condo_id:
                condos_table.update_item(
                    Key={'id': condo_id},
                    UpdateExpression="SET estado = :s",
                    ExpressionAttributeValues={':s': 'Disponible'}
                )
        return response(200, {'message': 'Eliminado y edificio liberado'})
    except Exception as e:
        return response(500, {'message': str(e)})

# -------- AUTENTICACIÓN --------

def register(event):
    body = get_body(event)
    email = body.get('email', '').lower().strip()
    password = body.get('password')
    admin_key = body.get('admin_key')
    if not email or not password or not is_valid_email(email):
        return response(400, {'message': 'Datos inválidos'})
    role = 'admin' if admin_key == get_admin_master_key() else 'residente'
    try:
        users_table.put_item(
            Item={'email': email, 'password': hashlib.sha256(password.encode()).hexdigest(), 'role': role},
            ConditionExpression='attribute_not_exists(email)'
        )
        return response(201, {'message': f'Registro exitoso como {role}'})
    except: return response(400, {'message': 'Usuario ya existe'})

def login(event):
    body = get_body(event)
    email = body.get('email', '').lower().strip()
    user = users_table.get_item(Key={'email': email}).get('Item')
    if not user or user['password'] != hashlib.sha256(body.get('password').encode()).hexdigest():
        return response(401, {'message': 'Credenciales incorrectas'})
    token = jwt.encode({'email': email, 'role': user['role'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)}, get_jwt_secret(), algorithm='HS256')
    return response(200, {'token': token})

# -------- OTROS --------

def create_announcement(event):
    p = verify_token(get_token_from_header(event))
    if not p or p['role'] != 'admin': return response(403, {'message': 'Error'})
    b = get_body(event)
    item = {'id': str(uuid.uuid4()), 'admin_owner': p['email'].lower(), 'title': b.get('title'), 'content': b.get('content'), 'date': datetime.datetime.utcnow().isoformat()}
    announcements_table.put_item(Item=item)
    return response(201, item)

def get_announcements(event): return response(200, announcements_table.scan().get('Items', []))

def create_payment(event):
    p = verify_token(get_token_from_header(event))
    if not p: return response(401, {'message': 'Error'})
    b = get_body(event)
    item = {'id': str(uuid.uuid4()), 'resident_email': p['email'].lower(), 'amount': Decimal(str(b.get('amount', 0))), 'status': 'completado'}
    payments_table.put_item(Item=item)
    return response(201, item)

def get_payments(event):
    p = verify_token(get_token_from_header(event))
    if not p: return response(401, {'message': 'Error'})
    items = payments_table.scan().get('Items', []) if p['role'] == 'admin' else payments_table.scan(FilterExpression=Attr('resident_email').eq(p['email'].lower())).get('Items', [])
    return response(200, items)

def create_maintenance(event):
    p = verify_token(get_token_from_header(event))
    if not p: return response(401, {'message': 'Error'})
    b = get_body(event)
    item = {'id': str(uuid.uuid4()), 'resident_email': p['email'].lower(), 'status': 'pendiente'}
    maintenance_table.put_item(Item=item)
    return response(201, item)

def get_maintenance(event): return response(200, maintenance_table.scan().get('Items', []))