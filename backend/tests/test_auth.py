"""Tests de autenticación: registro, login y tokens de admin."""
import json

import boto3


REGION = 'us-east-1'


# ── Test de registro exitoso ──────────────────────────────────────────────
def test_register_success(aws_mocks, make_event):
    """POST /auth/register con email/password válidos → 201, msg 'Registrado', role 'residente'."""
    event = make_event('POST', '/auth/register', body={
        'email': 'nuevo@test.com',
        'password': 'SecurePass1',
    })
    result = aws_mocks.lambda_handler(event, None)

    assert result['statusCode'] == 201
    body = json.loads(result['body'])
    assert body['msg'] == 'Registrado'
    assert body['role'] == 'residente'


# ── Test de registro con email duplicado ──────────────────────────────────
def test_register_duplicate_email(aws_mocks, make_event):
    """Registrar el mismo email dos veces → el segundo intento retorna 400."""
    event = make_event('POST', '/auth/register', body={
        'email': 'dup@test.com',
        'password': 'Pass1234',
    })
    first = aws_mocks.lambda_handler(event, None)
    assert first['statusCode'] == 201

    second = aws_mocks.lambda_handler(event, None)
    assert second['statusCode'] == 400


# ── Test de login exitoso ─────────────────────────────────────────────────
def test_login_success(aws_mocks, make_event):
    """Registrar un usuario y luego POST /auth/login → 200 con JWT válido."""
    # Register first
    reg_event = make_event('POST', '/auth/register', body={
        'email': 'login@test.com',
        'password': 'MyPass99',
    })
    aws_mocks.lambda_handler(reg_event, None)

    # Login
    login_event = make_event('POST', '/auth/login', body={
        'email': 'login@test.com',
        'password': 'MyPass99',
    })
    result = aws_mocks.lambda_handler(login_event, None)

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert 'token' in body
    # Verify the token is a valid JWT string (three dot-separated segments)
    assert len(body['token'].split('.')) == 3


# ── Test de login con contraseña incorrecta ───────────────────────────────
def test_login_wrong_password(aws_mocks, make_event):
    """POST /auth/login con contraseña incorrecta → 401."""
    # Register a user
    reg_event = make_event('POST', '/auth/register', body={
        'email': 'wrong@test.com',
        'password': 'CorrectPass',
    })
    aws_mocks.lambda_handler(reg_event, None)

    # Attempt login with wrong password
    login_event = make_event('POST', '/auth/login', body={
        'email': 'wrong@test.com',
        'password': 'WrongPass',
    })
    result = aws_mocks.lambda_handler(login_event, None)

    assert result['statusCode'] == 401


# ── Test de registro con token de admin ───────────────────────────────────
def test_register_with_admin_token(aws_mocks, make_event):
    """Crear un token en AdminTokens, registrar con ese token → role 'admin'."""
    # Insert an admin token directly into the AdminTokens table
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    tokens_table = dynamodb.Table('AdminTokens')
    tokens_table.put_item(Item={
        'token': 'ADMIN-TEST1234',
        'used': False,
        'type': 'admin',
    })

    # Register using the admin token
    event = make_event('POST', '/auth/register', body={
        'email': 'admin@test.com',
        'password': 'AdminPass1',
        'admin_token': 'ADMIN-TEST1234',
    })
    result = aws_mocks.lambda_handler(event, None)

    assert result['statusCode'] == 201
    body = json.loads(result['body'])
    assert body['role'] == 'admin'
