"""Tests de condominios: listar, crear, inhabilitar con y sin unidades activas."""
import json

import boto3


REGION = 'us-east-1'


# ── Test de listar condominios como residente ─────────────────────────────
def test_list_condos_as_residente(
    aws_mocks, create_test_user, get_auth_token, make_event
):
    """GET /condos como residente → devuelve solo condominios activos."""
    # Seed a condo directly in the Condos table
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    condos_table = dynamodb.Table('Condos')
    condos_table.put_item(Item={
        'id': 'condo-1',
        'nombre': 'Torre Norte',
        'direccion': 'Av. Principal 100',
        'admin_owner': 'admin@test.com',
        'activo': True,
        'popularidad': 5,
        'foto_url': 'https://test.cloudfront.net/uploads/photo.png',
    })

    # Create a residente user and get a token
    create_test_user('residente@test.com', 'Pass1234', 'residente')
    token = get_auth_token('residente@test.com', 'residente')

    event = make_event('GET', '/condos', headers={
        'Authorization': f'Bearer {token}',
    })
    result = aws_mocks.lambda_handler(event, None)

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert isinstance(body, list)
    assert len(body) >= 1
    nombres = [c['nombre'] for c in body]
    assert 'Torre Norte' in nombres


# ── Test de crear condominio como admin ───────────────────────────────────
def test_create_condo_as_admin(
    aws_mocks, create_test_user, get_auth_token, make_event
):
    """PUT /condos como admin con nombre, direccion, file_key → 201."""
    create_test_user('admin@test.com', 'AdminPass1', 'admin')
    token = get_auth_token('admin@test.com', 'admin')

    event = make_event('PUT', '/condos', body={
        'nombre': 'Torre Sur',
        'direccion': 'Calle 50 #200',
        'file_key': 'uploads/foto-torre-sur.png',
    }, headers={
        'Authorization': f'Bearer {token}',
    })
    result = aws_mocks.lambda_handler(event, None)

    assert result['statusCode'] == 201
    body = json.loads(result['body'])
    assert body['nombre'] == 'Torre Sur'
    assert body['direccion'] == 'Calle 50 #200'
    assert 'id' in body
    assert body['activo'] is True


# ── Test de inhabilitar condominio sin unidades activas ───────────────────
def test_disable_condo_without_active_units(
    aws_mocks, create_test_user, get_auth_token, make_event
):
    """PATCH /condos con activo=false sin unidades activas → 200."""
    # Seed a condo
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    condos_table = dynamodb.Table('Condos')
    condos_table.put_item(Item={
        'id': 'condo-disable-ok',
        'nombre': 'Torre Vacía',
        'direccion': 'Calle Desierta 1',
        'admin_owner': 'admin@test.com',
        'activo': True,
        'popularidad': 0,
    })

    create_test_user('admin@test.com', 'AdminPass1', 'admin')
    token = get_auth_token('admin@test.com', 'admin')

    event = make_event('PATCH', '/condos', body={
        'id': 'condo-disable-ok',
        'activo': False,
    }, headers={
        'Authorization': f'Bearer {token}',
    })
    result = aws_mocks.lambda_handler(event, None)

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['msg'] == 'Actualizado'


# ── Test de inhabilitar condominio con unidades activas (debe fallar) ─────
def test_disable_condo_with_active_units_fails(
    aws_mocks, create_test_user, get_auth_token, make_event
):
    """PATCH /condos con activo=false cuando hay unidades activas → 400."""
    dynamodb = boto3.resource('dynamodb', region_name=REGION)

    # Seed a condo
    condos_table = dynamodb.Table('Condos')
    condos_table.put_item(Item={
        'id': 'condo-with-units',
        'nombre': 'Torre Ocupada',
        'direccion': 'Av. Llena 99',
        'admin_owner': 'admin@test.com',
        'activo': True,
        'popularidad': 10,
    })

    # Seed a unit in that condo WITHOUT borrado_logico (active unit)
    units_table = dynamodb.Table('Units')
    units_table.put_item(Item={
        'id': 'unit-1',
        'condo_id': 'condo-with-units',
        'nombre': 'Depto 101',
        'precio': 5000,
        'estado': 'Disponible',
        'borrado_logico': False,
        'modalidad': 'Renta',
    })

    create_test_user('admin@test.com', 'AdminPass1', 'admin')
    token = get_auth_token('admin@test.com', 'admin')

    event = make_event('PATCH', '/condos', body={
        'id': 'condo-with-units',
        'activo': False,
    }, headers={
        'Authorization': f'Bearer {token}',
    })
    result = aws_mocks.lambda_handler(event, None)

    assert result['statusCode'] == 400
    body = json.loads(result['body'])
    assert 'unidades activas' in body['msg']
