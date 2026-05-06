"""Tests de cuotas financieras: crear, pagar y listar filtradas por rol."""
import json
from decimal import Decimal

import boto3


REGION = 'us-east-1'


# ── Test de crear cuota como admin ────────────────────────────────────────
def test_create_fee_as_admin(
    aws_mocks, create_test_user, get_auth_token, make_event
):
    """POST /fees como admin con email, monto, mes → 201, estado 'Pendiente'."""
    create_test_user('admin@test.com', 'AdminPass1', 'admin')
    token = get_auth_token('admin@test.com', 'admin')

    event = make_event('POST', '/fees', body={
        'email': 'residente@test.com',
        'monto': 1500,
        'mes': 'Junio 2025',
    }, headers={
        'Authorization': f'Bearer {token}',
    })
    result = aws_mocks.lambda_handler(event, None)

    assert result['statusCode'] == 201
    body = json.loads(result['body'])
    assert body['estado'] == 'Pendiente'
    assert body['email'] == 'residente@test.com'
    assert body['mes'] == 'Junio 2025'
    assert 'id' in body
    assert 'fecha_creacion' in body
    # monto is serialized via default=str from Decimal
    assert str(body['monto']) == '1500'


# ── Test de pagar cuota como residente ────────────────────────────────────
def test_pay_fee_as_residente(
    aws_mocks, create_test_user, get_auth_token, make_event
):
    """Crear cuota en Fees, luego PATCH /fees como residente → 200, estado 'Pagado'."""
    # Seed a fee directly in the Fees table
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    fees_table = dynamodb.Table('Fees')
    fee_id = 'fee-pay-test-001'
    fees_table.put_item(Item={
        'id': fee_id,
        'email': 'residente@test.com',
        'monto': Decimal('2000'),
        'mes': 'Julio 2025',
        'estado': 'Pendiente',
        'fecha_creacion': '2025-07-01T00:00:00',
        'detalles': 'Cuota Manual Administrativa',
    })

    # Create the residente user and get a token
    create_test_user('residente@test.com', 'Pass1234', 'residente')
    token = get_auth_token('residente@test.com', 'residente')

    event = make_event('PATCH', '/fees', body={
        'id': fee_id,
    }, headers={
        'Authorization': f'Bearer {token}',
    })
    result = aws_mocks.lambda_handler(event, None)

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['msg'] == 'Cuota pagada'

    # Verify the fee was actually updated in DynamoDB
    updated = fees_table.get_item(Key={'id': fee_id})['Item']
    assert updated['estado'] == 'Pagado'
    assert 'fecha_pago' in updated


# ── Test de listar cuotas filtradas por rol ───────────────────────────────
def test_list_fees_filtered_by_role(
    aws_mocks, create_test_user, get_auth_token, make_event
):
    """GET /fees: residente ve solo sus cuotas; admin ve todas."""
    # Seed fees for two different emails
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    fees_table = dynamodb.Table('Fees')

    fees_table.put_item(Item={
        'id': 'fee-alice-01',
        'email': 'alice@test.com',
        'monto': Decimal('1000'),
        'mes': 'Enero 2025',
        'estado': 'Pendiente',
        'fecha_creacion': '2025-01-01T00:00:00',
        'detalles': 'Cuota Manual Administrativa',
    })
    fees_table.put_item(Item={
        'id': 'fee-bob-01',
        'email': 'bob@test.com',
        'monto': Decimal('1500'),
        'mes': 'Enero 2025',
        'estado': 'Pendiente',
        'fecha_creacion': '2025-01-02T00:00:00',
        'detalles': 'Cuota Manual Administrativa',
    })

    # -- Residente (alice) should only see her own fees --
    create_test_user('alice@test.com', 'AlicePass1', 'residente')
    alice_token = get_auth_token('alice@test.com', 'residente')

    event_alice = make_event('GET', '/fees', headers={
        'Authorization': f'Bearer {alice_token}',
    })
    result_alice = aws_mocks.lambda_handler(event_alice, None)

    assert result_alice['statusCode'] == 200
    alice_fees = json.loads(result_alice['body'])
    assert all(f['email'] == 'alice@test.com' for f in alice_fees)
    assert len(alice_fees) == 1

    # -- Admin should see all fees --
    create_test_user('admin@test.com', 'AdminPass1', 'admin')
    admin_token = get_auth_token('admin@test.com', 'admin')

    event_admin = make_event('GET', '/fees', headers={
        'Authorization': f'Bearer {admin_token}',
    })
    result_admin = aws_mocks.lambda_handler(event_admin, None)

    assert result_admin['statusCode'] == 200
    admin_fees = json.loads(result_admin['body'])
    emails = [f['email'] for f in admin_fees]
    assert 'alice@test.com' in emails
    assert 'bob@test.com' in emails
    assert len(admin_fees) >= 2
