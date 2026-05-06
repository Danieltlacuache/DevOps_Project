import os
import sys
import json
import hashlib
import datetime
import importlib

import pytest
import boto3
from moto import mock_aws

# ---------------------------------------------------------------------------
# 1. Set environment variables BEFORE any import of lambda_function.
#    The module reads env vars and creates DynamoDB table references at
#    import time, so these must be present first.
# ---------------------------------------------------------------------------
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'

# Table names (12 tables)
os.environ['USERS_TABLE'] = 'Users'
os.environ['RESIDENTS_TABLE'] = 'Residents'
os.environ['CONDOS_TABLE'] = 'Condos'
os.environ['UNITS_TABLE'] = 'Units'
os.environ['ADMIN_TOKENS_TABLE'] = 'AdminTokens'
os.environ['CONNECTIONS_TABLE'] = 'Connections'
os.environ['MAINTENANCE_TASKS_TABLE'] = 'MaintenanceTasks'
os.environ['ANNOUNCEMENTS_TABLE'] = 'Announcements'
os.environ['INCIDENTS_TABLE'] = 'Incidents'
os.environ['FEES_TABLE'] = 'Fees'
os.environ['AMENITIES_TABLE'] = 'Amenities'
os.environ['AMENITY_RESERVATIONS_TABLE'] = 'AmenityReservations'

# Other env vars
os.environ['PHOTOS_BUCKET'] = 'test-photos-bucket'
os.environ['SECRET_ID'] = 'CondoManager/JWT_Secret'
os.environ['CDN_DOMAIN'] = 'test.cloudfront.net'
os.environ['WEBSOCKET_URL'] = ''

# Ensure the backend directory is on sys.path so lambda_function can be
# imported as a top-level module.
_backend_dir = os.path.join(os.path.dirname(__file__), '..')
if _backend_dir not in sys.path:
    sys.path.insert(0, os.path.abspath(_backend_dir))

REGION = 'us-east-1'
JWT_TEST_SECRET = 'test_secret_key_for_testing'


# ---------------------------------------------------------------------------
# 2. Helper: create all 12 DynamoDB tables with their GSIs
# ---------------------------------------------------------------------------
def _create_dynamodb_tables(dynamodb):
    """Create all 12 DynamoDB tables matching the design specification."""

    # --- Simple tables (PK only, no GSIs) ---
    simple_tables = [
        {'name': 'Users', 'pk': 'email'},
        {'name': 'AdminTokens', 'pk': 'token'},
        {'name': 'Connections', 'pk': 'connectionId'},
        {'name': 'Announcements', 'pk': 'id'},
        {'name': 'Amenities', 'pk': 'id'},
    ]
    for t in simple_tables:
        dynamodb.create_table(
            TableName=t['name'],
            KeySchema=[{'AttributeName': t['pk'], 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': t['pk'], 'AttributeType': 'S'}],
            BillingMode='PAY_PER_REQUEST',
        )

    # --- Condos: GSI PopularityIndex on popularidad (N) ---
    dynamodb.create_table(
        TableName='Condos',
        KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        AttributeDefinitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'popularidad', 'AttributeType': 'N'},
        ],
        GlobalSecondaryIndexes=[{
            'IndexName': 'PopularityIndex',
            'KeySchema': [{'AttributeName': 'popularidad', 'KeyType': 'HASH'}],
            'Projection': {'ProjectionType': 'ALL'},
        }],
        BillingMode='PAY_PER_REQUEST',
    )

    # --- Units: GSIs CondoIndex (condo_id:S), EstadoIndex (estado:S) ---
    dynamodb.create_table(
        TableName='Units',
        KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        AttributeDefinitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'condo_id', 'AttributeType': 'S'},
            {'AttributeName': 'estado', 'AttributeType': 'S'},
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'CondoIndex',
                'KeySchema': [{'AttributeName': 'condo_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
            },
            {
                'IndexName': 'EstadoIndex',
                'KeySchema': [{'AttributeName': 'estado', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
            },
        ],
        BillingMode='PAY_PER_REQUEST',
    )

    # --- Residents: GSI EmailIndex (email:S) ---
    dynamodb.create_table(
        TableName='Residents',
        KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        AttributeDefinitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'email', 'AttributeType': 'S'},
        ],
        GlobalSecondaryIndexes=[{
            'IndexName': 'EmailIndex',
            'KeySchema': [{'AttributeName': 'email', 'KeyType': 'HASH'}],
            'Projection': {'ProjectionType': 'ALL'},
        }],
        BillingMode='PAY_PER_REQUEST',
    )

    # --- Fees: GSI EmailIndex (email:S) ---
    dynamodb.create_table(
        TableName='Fees',
        KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        AttributeDefinitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'email', 'AttributeType': 'S'},
        ],
        GlobalSecondaryIndexes=[{
            'IndexName': 'EmailIndex',
            'KeySchema': [{'AttributeName': 'email', 'KeyType': 'HASH'}],
            'Projection': {'ProjectionType': 'ALL'},
        }],
        BillingMode='PAY_PER_REQUEST',
    )

    # --- Incidents: GSI ResidenteIndex (residente:S) ---
    dynamodb.create_table(
        TableName='Incidents',
        KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        AttributeDefinitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'residente', 'AttributeType': 'S'},
        ],
        GlobalSecondaryIndexes=[{
            'IndexName': 'ResidenteIndex',
            'KeySchema': [{'AttributeName': 'residente', 'KeyType': 'HASH'}],
            'Projection': {'ProjectionType': 'ALL'},
        }],
        BillingMode='PAY_PER_REQUEST',
    )

    # --- MaintenanceTasks: GSI AssignedToIndex (assigned_to:S) ---
    dynamodb.create_table(
        TableName='MaintenanceTasks',
        KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        AttributeDefinitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'assigned_to', 'AttributeType': 'S'},
        ],
        GlobalSecondaryIndexes=[{
            'IndexName': 'AssignedToIndex',
            'KeySchema': [{'AttributeName': 'assigned_to', 'KeyType': 'HASH'}],
            'Projection': {'ProjectionType': 'ALL'},
        }],
        BillingMode='PAY_PER_REQUEST',
    )

    # --- AmenityReservations: GSIs AmenityIndex (amenity_id:S), EmailIndex (email:S) ---
    dynamodb.create_table(
        TableName='AmenityReservations',
        KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        AttributeDefinitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'amenity_id', 'AttributeType': 'S'},
            {'AttributeName': 'email', 'AttributeType': 'S'},
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'AmenityIndex',
                'KeySchema': [{'AttributeName': 'amenity_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
            },
            {
                'IndexName': 'EmailIndex',
                'KeySchema': [{'AttributeName': 'email', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
            },
        ],
        BillingMode='PAY_PER_REQUEST',
    )


# ---------------------------------------------------------------------------
# 3. Main autouse fixture: spin up moto mocks for every test automatically
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def aws_mocks():
    """Provide a fully-mocked AWS environment and a freshly-imported
    ``lambda_function`` module.

    This fixture is ``autouse=True`` so that every test automatically runs
    inside a moto mock context.  Each test gets its own mock context so
    table data never leaks between tests.

    The module is reloaded inside the mock so that its module-level boto3
    resources point at the moto fakes.
    """
    with mock_aws():
        # -- DynamoDB tables --
        dynamodb = boto3.resource('dynamodb', region_name=REGION)
        _create_dynamodb_tables(dynamodb)

        # -- S3 bucket --
        s3 = boto3.client('s3', region_name=REGION)
        # us-east-1 does not accept LocationConstraint (AWS quirk)
        if REGION == 'us-east-1':
            s3.create_bucket(Bucket='test-photos-bucket')
        else:
            s3.create_bucket(
                Bucket='test-photos-bucket',
                CreateBucketConfiguration={'LocationConstraint': REGION},
            )

        # -- Secrets Manager secret --
        sm = boto3.client('secretsmanager', region_name=REGION)
        sm.create_secret(
            Name='CondoManager/JWT_Secret',
            SecretString=json.dumps({'JWT_KEY': JWT_TEST_SECRET}),
        )

        # -- Import / reload lambda_function inside the mock context --
        # This is critical because lambda_function.py runs code at import
        # time that connects to AWS services (DynamoDB, S3, Secrets Manager).
        import lambda_function
        importlib.reload(lambda_function)

        yield lambda_function


# ---------------------------------------------------------------------------
# 4. Helper fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def create_test_user(aws_mocks):
    """Factory fixture: insert a user into the mock Users table.

    Usage inside a test::

        create_test_user('admin@test.com', 'pass123', 'admin')
    """
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table('Users')

    def _create(email: str, password: str, role: str = 'residente'):
        table.put_item(Item={
            'email': email.lower().strip(),
            'password': hashlib.sha256(password.encode()).hexdigest(),
            'role': role,
        })

    return _create


@pytest.fixture()
def get_auth_token(aws_mocks):
    """Factory fixture: generate a valid JWT token for testing.

    Usage inside a test::

        token = get_auth_token('admin@test.com', 'admin')
    """
    import jwt as _jwt

    def _token(email: str, role: str = 'residente'):
        payload = {
            'email': email,
            'role': role,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2),
        }
        return _jwt.encode(payload, JWT_TEST_SECRET, algorithm='HS256')

    return _token


@pytest.fixture()
def make_event():
    """Factory fixture: build a mock API Gateway proxy event.

    Usage inside a test::

        event = make_event('POST', '/auth/login',
                           body={'email': 'a@b.com', 'password': 'x'})
    """

    def _event(method, path, body=None, headers=None, query_params=None):
        event = {
            'httpMethod': method,
            'path': path,
            'headers': headers or {},
            'queryStringParameters': query_params or {},
            'body': json.dumps(body) if body else None,
            'requestContext': {},
        }
        return event

    return _event
