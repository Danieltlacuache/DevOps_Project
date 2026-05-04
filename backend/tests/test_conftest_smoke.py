"""Smoke test to verify conftest fixtures work correctly."""
import json


def test_aws_mocks_loads_lambda(aws_mocks):
    """The aws_mocks fixture should return the lambda_function module."""
    assert hasattr(aws_mocks, 'lambda_handler')
    assert hasattr(aws_mocks, 'response')


def test_create_test_user_and_login(aws_mocks, create_test_user, make_event):
    """Create a user via fixture, then login via the lambda handler."""
    create_test_user('smoke@test.com', 'password123', 'admin')

    event = make_event('POST', '/auth/login', body={
        'email': 'smoke@test.com',
        'password': 'password123',
    })
    result = aws_mocks.lambda_handler(event, None)
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert 'token' in body


def test_get_auth_token_produces_valid_jwt(get_auth_token):
    """get_auth_token should return a decodable JWT string."""
    import jwt
    token = get_auth_token('user@test.com', 'residente')
    payload = jwt.decode(token, 'test-secret-key', algorithms=['HS256'])
    assert payload['email'] == 'user@test.com'
    assert payload['role'] == 'residente'


def test_make_event_structure(make_event):
    """make_event should produce a well-formed API Gateway event dict."""
    event = make_event('GET', '/condos', query_params={'condo_id': '123'})
    assert event['httpMethod'] == 'GET'
    assert event['path'] == '/condos'
    assert event['queryStringParameters'] == {'condo_id': '123'}
    assert event['body'] is None
