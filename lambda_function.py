import json, boto3, hashlib, jwt, datetime, uuid, os, random
from boto3.dynamodb.conditions import Attr
from botocore.config import Config
from decimal import Decimal

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
ANN_TABLE         = dynamodb.Table(os.environ.get('ANNOUNCEMENTS_TABLE'))
INCIDENTS_TABLE   = dynamodb.Table(os.environ.get('INCIDENTS_TABLE'))
FEES_TABLE        = dynamodb.Table(os.environ.get('FEES_TABLE'))

BUCKET_NAME       = os.environ.get('PHOTOS_BUCKET')
CDN_DOMAIN        = os.environ.get('CDN_DOMAIN', f"{BUCKET_NAME}.s3.us-east-2.amazonaws.com")

WS_ENDPOINT = os.environ.get('WEBSOCKET_URL', '').replace('wss://', 'https://')
ws_management = boto3.client('apigatewaymanagementapi', endpoint_url=WS_ENDPOINT)

def safe_str(val):
    return str(val) if val is not None else ""

def response(status, body):
    return {
        'statusCode': status, 'headers': { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
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
    except: pass

def clean_expired_reservations():
    now_utc = datetime.datetime.utcnow().isoformat()
    occupied = UNITS_TABLE.scan(FilterExpression=Attr('estado').eq('Ocupado')).get('Items', [])
    for u in occupied:
        end_date = safe_str(u.get('fecha_fin'))
        if end_date and end_date <= now_utc:
            UNITS_TABLE.update_item(Key={'id': u['id']}, UpdateExpression="SET estado = :s, ocupado_por = :empty, fecha_inicio = :empty, fecha_fin = :empty", ExpressionAttributeValues={':s': 'Disponible', ':empty': ''})
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': u.get('condo_id')})

def login(event):
    data = json.loads(event.get('body', '{}'))
    email = safe_str(data.get('email')).lower().strip()
    user = USERS_TABLE.get_item(Key={'email': email}, ConsistentRead=True).get('Item')
    
    if not user or user.get('password') != hashlib.sha256(safe_str(data.get('password')).encode()).hexdigest():
        return response(401, {'msg': 'Credenciales incorrectas'})
        
    payload = {'email': user['email'], 'role': user['role'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)}
    return response(200, {'token': jwt.encode(payload, JWT_SECRET, algorithm='HS256')})

def list_units(event, user):
    clean_expired_reservations() 
    cid = event.get('queryStringParameters', {}).get('condo_id')
    if cid:
        if user.get('role') == 'residente': CONDOS_TABLE.update_item(Key={'id': cid}, UpdateExpression="ADD popularidad :inc", ExpressionAttributeValues={':inc': 1})
        items = UNITS_TABLE.scan(FilterExpression=Attr('condo_id').eq(cid)).get('Items', [])
    else: items = UNITS_TABLE.scan().get('Items', [])
    
    if user.get('role') == 'residente': return response(200, [u for u in items if str(u.get('estado', '')).strip().lower() == 'disponible' and not (str(u.get('borrado_logico')).lower() in ['true', '1', 't'])])
    return response(200, items)

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
                role = tk.get('type', 'admin')
                TOKENS_TABLE.update_item(Key={'token': data['admin_token']}, UpdateExpression="SET used = :u", ExpressionAttributeValues={':u': True})
            else: return response(400, {'msg': 'Token inválido o en uso.'})
        try:
            USERS_TABLE.put_item(Item={'email': safe_str(data.get('email')).lower(), 'password': hashlib.sha256(safe_str(data.get('password')).encode()).hexdigest(), 'role': role}, ConditionExpression='attribute_not_exists(email)')
            return response(201, {'msg': 'Registrado', 'role': role})
        except: return response(400, {'msg': 'Correo registrado.'})

    if p == '/auth/login' and m == 'POST': return login(event)
    if p == '/config': return response(200, {'ws_url': os.environ.get('WEBSOCKET_URL', '').replace('https://', 'wss://')})

    user = verify_jwt(event)
    if not user: return response(401, {'msg': 'Token inválido'})

    if p == '/users' and m == 'GET':
        if user['role'] != 'admin': return response(403, {'msg': 'No autorizado'})
        return response(200, USERS_TABLE.scan(ProjectionExpression="email, #r", ExpressionAttributeNames={'#r': 'role'}).get('Items', []))

    if p == '/fees':
        if m == 'GET':
            if user['role'] == 'residente': return response(200, sorted(FEES_TABLE.scan(FilterExpression=Attr('email').eq(user['email'])).get('Items', []), key=lambda x: safe_str(x.get('fecha_creacion')), reverse=True))
            else: return response(200, sorted(FEES_TABLE.scan().get('Items', []), key=lambda x: safe_str(x.get('fecha_creacion')), reverse=True))
        if m == 'POST' and user['role'] == 'admin':
            data = json.loads(event['body'])
            fee = {'id': str(uuid.uuid4()), 'email': data['email'], 'monto': Decimal(str(data['monto'])), 'mes': data['mes'], 'estado': 'Pendiente', 'fecha_creacion': datetime.datetime.utcnow().isoformat(), 'detalles': 'Cuota Manual Administrativa'}
            FEES_TABLE.put_item(Item=fee)
            notify_clients({'action': 'REFRESH_FEES'})
            return response(201, fee)
        if m == 'PATCH' and user['role'] == 'residente':
            data = json.loads(event['body'])
            FEES_TABLE.update_item(Key={'id': data['id']}, UpdateExpression="SET estado = :s, fecha_pago = :f", ExpressionAttributeValues={':s': 'Pagado', ':f': datetime.datetime.utcnow().isoformat()})
            notify_clients({'action': 'REFRESH_FEES'})
            return response(200, {'msg': 'Cuota pagada'})

    if p == '/incidents':
        if m == 'POST' and user['role'] == 'residente':
            data = json.loads(event['body'])
            incident_id = str(uuid.uuid4())
            incident = {'id': incident_id, 'residente': user['email'], 'unit_id': data['unit_id'], 'descripcion': data['descripcion'], 'estado': 'Pendiente', 'fecha': datetime.datetime.utcnow().isoformat()}
            INCIDENTS_TABLE.put_item(Item=incident)
            
            techs = [u['email'] for u in USERS_TABLE.scan(ProjectionExpression="email, #r", ExpressionAttributeNames={'#r': 'role'}).get('Items', []) if u.get('role') == 'mantenimiento']
            assigned_tech = 'Sin asignar'
            if techs:
                tech_loads = {tech: 0 for tech in techs}
                active_tasks = MAINT_TABLE.scan().get('Items', [])
                for t in active_tasks:
                    if t.get('status') in ['Pendiente', 'En Progreso'] and t.get('assigned_to') in tech_loads:
                        tech_loads[t['assigned_to']] += 1
                assigned_tech = min(tech_loads, key=tech_loads.get)
                
            task = {'id': str(uuid.uuid4()), 'unit_id': data['unit_id'], 'incident_id': incident_id, 'assigned_to': assigned_tech, 'descripcion': data['descripcion'], 'status': 'Pendiente', 'fecha': datetime.datetime.utcnow().isoformat()}
            MAINT_TABLE.put_item(Item=task)

            notify_clients({'action': 'REFRESH_INCIDENTS'})
            notify_clients({'action': 'REFRESH_TASKS'})
            return response(201, incident)
            
        if m == 'GET':
            all_incidents = sorted(INCIDENTS_TABLE.scan().get('Items', []), key=lambda x: safe_str(x.get('fecha')), reverse=True)
            if user['role'] == 'admin':
                my_condos = [c['id'] for c in CONDOS_TABLE.scan(FilterExpression=Attr('admin_owner').eq(user['email'])).get('Items', [])]
                my_units = [u['id'] for u in UNITS_TABLE.scan().get('Items', []) if u.get('condo_id') in my_condos]
                my_incidents = [i for i in all_incidents if i.get('unit_id') in my_units]
                return response(200, my_incidents)
            elif user['role'] == 'residente':
                my_incidents = [i for i in all_incidents if i.get('residente') == user['email']]
                return response(200, my_incidents)
            
        if m == 'DELETE':
            data = json.loads(event['body'])
            inc = INCIDENTS_TABLE.get_item(Key={'id': data['id']}).get('Item')
            if not inc: return response(404, {'msg': 'No existe'})
            
            if user['role'] == 'admin' or (user['role'] == 'residente' and inc['residente'] == user['email'] and inc['estado'] in ['Resuelto', 'Completado']):
                INCIDENTS_TABLE.delete_item(Key={'id': data['id']})
                notify_clients({'action': 'REFRESH_INCIDENTS'})
                return response(200, {'msg': 'Incidente borrado'})
            return response(403, {'msg': 'No tienes permiso o el incidente no está completado.'})

    if p == '/admin/token' and m == 'POST':
        if user.get('role') != 'admin': return response(403, {'msg': 'No autorizado'})
        t_type = json.loads(event.get('body', '{}')).get('type', 'admin')
        nuevo_token = ("MAINT-" if t_type == 'mantenimiento' else "ADMIN-") + str(uuid.uuid4())[:8].upper()
        TOKENS_TABLE.put_item(Item={'token': nuevo_token, 'used': False, 'type': t_type})
        return response(201, {'token': nuevo_token})

    if p == '/announcements':
        if m == 'GET': 
            items = sorted(ANN_TABLE.scan().get('Items', []), key=lambda x: safe_str(x.get('fecha')), reverse=True)
            if user['role'] == 'admin': items = [i for i in items if i.get('autor') == user['email']]
            return response(200, items)
        if m == 'POST' and user['role'] == 'admin':
            data = json.loads(event['body'])
            item = {'id': str(uuid.uuid4()), 'titulo': data['titulo'], 'mensaje': data['mensaje'], 'fecha': datetime.datetime.utcnow().isoformat(), 'autor': user['email']}
            ANN_TABLE.put_item(Item=item)
            notify_clients({'action': 'REFRESH_ANNOUNCEMENTS'})
            return response(201, item)
        if m == 'DELETE' and user['role'] == 'admin':
            ANN_TABLE.delete_item(Key={'id': json.loads(event['body'])['id']})
            notify_clients({'action': 'REFRESH_ANNOUNCEMENTS'})
            return response(200, {'msg': 'Borrado'})

    if p == '/maintenance/tasks':
        if m == 'GET': return response(200, sorted(MAINT_TABLE.scan(FilterExpression=Attr('assigned_to').eq(user['email'])).get('Items', []), key=lambda x: safe_str(x.get('fecha')), reverse=True) if user['role'] == 'mantenimiento' else sorted(MAINT_TABLE.scan().get('Items', []), key=lambda x: safe_str(x.get('fecha')), reverse=True))
        
        if m == 'PATCH':
            data = json.loads(event['body'])
            task = MAINT_TABLE.get_item(Key={'id': data['id']}).get('Item', {})
            new_status = data['status']
            MAINT_TABLE.update_item(Key={'id': data['id']}, UpdateExpression="SET #s = :s", ExpressionAttributeNames={'#s': 'status'}, ExpressionAttributeValues={':s': new_status})
            
            if task.get('incident_id'):
                if new_status == 'Completado': 
                    INCIDENTS_TABLE.update_item(Key={'id': task['incident_id']}, UpdateExpression="SET estado = :s, fecha_resolucion = :f", ExpressionAttributeValues={':s': 'Completado', ':f': datetime.datetime.utcnow().isoformat()})
                else: 
                    INCIDENTS_TABLE.update_item(Key={'id': task['incident_id']}, UpdateExpression="SET estado = :s, fecha_resolucion = :empty", ExpressionAttributeValues={':s': new_status, ':empty': ''})
                notify_clients({'action': 'REFRESH_INCIDENTS'})
                
            notify_clients({'action': 'REFRESH_TASKS'})
            return response(200, {'msg': 'OK'})
            
        if m == 'DELETE':
            data = json.loads(event['body'])
            if user['role'] == 'admin':
                MAINT_TABLE.delete_item(Key={'id': data['id']})
                notify_clients({'action': 'REFRESH_TASKS'})
                return response(200, {'msg': 'Tarea borrada'})
            elif user['role'] == 'mantenimiento':
                task = MAINT_TABLE.get_item(Key={'id': data['id']}).get('Item')
                if task and task.get('assigned_to') == user['email'] and task.get('status') == 'Completado':
                    MAINT_TABLE.delete_item(Key={'id': data['id']})
                    notify_clients({'action': 'REFRESH_TASKS'})
                    return response(200, {'msg': 'Tarea borrada'})
                return response(403, {'msg': 'No autorizado para borrar'})
            return response(403, {'msg': 'No autorizado'})

    if p == '/condos':
        if m == 'GET':
            items = CONDOS_TABLE.scan().get('Items', [])
            if user.get('role') == 'residente': return response(200, sorted([c for c in items if c.get('activo', True)], key=lambda x: x.get('popularidad', 0), reverse=True))
            return response(200, [c for c in items if c.get('admin_owner') == user['email']])
        if m == 'POST': 
            data = json.loads(event.get('body', '{}'))
            ctype = data.get('contentType', 'image/png')
            ext = ctype.split('/')[-1] if '/' in ctype else 'png'
            if ext == 'jpeg': ext = 'jpg'
            key = f"uploads/{uuid.uuid4()}.{ext}"
            url = s3_client.generate_presigned_url('put_object', Params={'Bucket': BUCKET_NAME, 'Key': key, 'ContentType': ctype}, ExpiresIn=300)
            return response(200, {'upload_url': url, 'file_key': key})
        if m == 'PUT': 
            data = json.loads(event['body'])
            if CONDOS_TABLE.scan(FilterExpression=Attr('nombre').eq(data['nombre'])).get('Items'): return response(400, {'msg': 'Ya existe un edificio con ese nombre.'})
            item = {'id': str(uuid.uuid4()), 'admin_owner': user['email'], 'nombre': data['nombre'], 'direccion': data['direccion'], 'popularidad': 0, 'activo': True, 'foto_url': f"https://{CDN_DOMAIN}/{data['file_key']}"}
            CONDOS_TABLE.put_item(Item=item)
            notify_clients({'action': 'REFRESH'}) 
            return response(201, item)
        if m == 'PATCH' and user['role'] == 'admin':
            data = json.loads(event['body'])
            if 'activo' in data:
                is_active = data['activo']
                if not is_active:
                    units = UNITS_TABLE.scan(FilterExpression=Attr('condo_id').eq(data['id'])).get('Items', [])
                    active_units = [u for u in units if not u.get('borrado_logico', False)]
                    if active_units: return response(400, {'msg': 'No puedes ocultar el condominio porque tiene unidades activas. Oculta las unidades primero.'})
                CONDOS_TABLE.update_item(Key={'id': data['id']}, UpdateExpression="SET activo = :a", ExpressionAttributeValues={':a': is_active})
            else:
                if CONDOS_TABLE.scan(FilterExpression=Attr('nombre').eq(data['nombre']) & Attr('id').ne(data['id'])).get('Items'): return response(400, {'msg': 'Otro edificio ya usa ese nombre.'})
                CONDOS_TABLE.update_item(Key={'id': data['id']}, UpdateExpression="SET nombre = :n, direccion = :d", ExpressionAttributeValues={':n': data['nombre'], ':d': data['direccion']})
            notify_clients({'action': 'REFRESH'})
            return response(200, {'msg': 'Actualizado'})

    if p == '/units':
        if m == 'GET': return list_units(event, user)
        if m == 'PATCH':
            data = json.loads(event['body'])
            action = data.get('action')
            
            if user['role'] == 'admin':
                if action == 'edit':
                    UNITS_TABLE.update_item(Key={'id': data['id']}, UpdateExpression="SET nombre = :n, precio = :p", ExpressionAttributeValues={':n': data['nombre'], ':p': Decimal(str(data['precio']))})
                
                elif action == 'delete':
                    unit = UNITS_TABLE.get_item(Key={'id': data['id']}).get('Item')
                    if unit and unit.get('estado') == 'Ocupado': return response(400, {'msg': 'No puedes ocultar una unidad que está OCUPADA. Primero debes desocuparla.'})
                    UNITS_TABLE.update_item(Key={'id': data['id']}, UpdateExpression="SET borrado_logico = :b", ExpressionAttributeValues={':b': True})
                
                elif action == 'activate':
                    UNITS_TABLE.update_item(Key={'id': data['id']}, UpdateExpression="SET borrado_logico = :b", ExpressionAttributeValues={':b': False})
                
                elif action == 'start_evict':
                    UNITS_TABLE.update_item(
                        Key={'id': data['id']}, 
                        UpdateExpression="SET estado = :s, motivo_desalojo = :m", 
                        ExpressionAttributeValues={':s': 'En Espera', ':m': data.get('motivo', 'Decisión Administrativa')}
                    )
            
            elif user['role'] == 'residente' and action == 'confirm_evict':
                unit_id = data['id']
                reservations = RESIDENTS_TABLE.scan(FilterExpression=Attr('unit_id').eq(unit_id)).get('Items', [])
                for r in reservations:
                    if r.get('email') == user['email']: RESIDENTS_TABLE.delete_item(Key={'id': r['id']})
                
                UNITS_TABLE.update_item(
                    Key={'id': unit_id}, 
                    UpdateExpression="SET estado = :s, ocupado_por = :empty, fecha_inicio = :empty, fecha_fin = :empty, motivo_desalojo = :empty", 
                    ExpressionAttributeValues={':s': 'Disponible', ':empty': ''}
                )
            
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data.get('condo_id')}) 
            return response(200, {'msg': 'Operación exitosa'})
            
        if m == 'POST' and user['role'] == 'admin':
            data = json.loads(event['body'])
            if UNITS_TABLE.scan(FilterExpression=Attr('nombre').eq(data['nombre']) & Attr('condo_id').eq(data['condo_id'])).get('Items'): 
                return response(400, {'msg': 'Ya existe una unidad con ese nombre en este edificio.'})
            unit = {'id': str(uuid.uuid4()), 'condo_id': data['condo_id'], 'nombre': data['nombre'], 'precio': Decimal(str(data['precio'])), 'estado': 'Disponible', 'borrado_logico': False, 'foto_url': f"https://{CDN_DOMAIN}/{data['file_key']}"}
            UNITS_TABLE.put_item(Item=unit)
            notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data['condo_id']}) 
            return response(201, unit)

    if p == '/units/reserve' and m == 'PUT':
        data = json.loads(event['body'])
        req_start = data['fecha_inicio']
        req_end = data['fecha_fin']
        
        user_res = RESIDENTS_TABLE.scan(FilterExpression=Attr('email').eq(user['email'])).get('Items', [])
        for r in user_res:
            end_date = safe_str(r.get('fecha_fin'))
            start_date = safe_str(r.get('fecha_inicio'))
            if end_date and start_date and end_date > req_start and start_date < req_end:
                return response(400, {'msg': 'No puedes reservar: Ya tienes un contrato activo que choca con estas fechas.'})

        # Almacenamos los datos para generar el historial de cuotas detallado
        unit = UNITS_TABLE.get_item(Key={'id': data['unit_id']}).get('Item', {})
        condo_name = CONDOS_TABLE.get_item(Key={'id': unit.get('condo_id')}).get('Item', {}).get('nombre', 'Condominio')
        detalle_cuota = f"Unidad: {unit.get('nombre')} - {condo_name}"

        RESIDENTS_TABLE.put_item(Item={'id': str(uuid.uuid4()), 'email': user['email'], 'unit_id': data['unit_id'], 'total': Decimal(str(data['total'])), 'fecha_inicio': req_start, 'fecha_fin': req_end, 'fecha': datetime.datetime.utcnow().isoformat()})
        UNITS_TABLE.update_item(Key={'id': data['unit_id']}, UpdateExpression="SET estado = :s, ocupado_por = :u, fecha_inicio = :fi, fecha_fin = :ff", ExpressionAttributeValues={':s': 'Ocupado', ':u': user['email'], ':fi': req_start, ':ff': req_end})
        
        # Guardamos la primera cuota YA PAGADA automáticamente
        FEES_TABLE.put_item(Item={'id': str(uuid.uuid4()), 'email': user['email'], 'monto': Decimal(str(data['total'])), 'mes': 'Pago de Reserva Inicial', 'estado': 'Pagado', 'fecha_creacion': datetime.datetime.utcnow().isoformat(), 'fecha_pago': datetime.datetime.utcnow().isoformat(), 'detalles': detalle_cuota})
        
        notify_clients({'action': 'REFRESH_UNITS', 'condo_id': data.get('condo_id')})
        notify_clients({'action': 'REFRESH_FEES'}) 
        return response(200, {'msg': 'Contrato firmado y pago procesado.'})

    if p == '/units/my-reservations' and m == 'GET':
        now_utc = datetime.datetime.utcnow().isoformat()
        res = RESIDENTS_TABLE.scan(FilterExpression=Attr('email').eq(user['email'])).get('Items', [])
        activas = []
        for r in res:
            unit = UNITS_TABLE.get_item(Key={'id': r['unit_id']}).get('Item', {})
            if unit: 
                unit['condo_name'] = CONDOS_TABLE.get_item(Key={'id': unit['condo_id']}).get('Item', {}).get('nombre', 'Condominio')
                r['unit_details'] = unit
                activas.append(r)
        return response(200, activas)

    return response(404, {'msg': 'No encontrado'})