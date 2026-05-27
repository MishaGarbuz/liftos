import json
import os
import decimal
import boto3
from datetime import datetime, timezone

TABLE_NAME = os.environ.get('TABLE_NAME', 'LiftingTracker')
LEGACY_USER_PK = os.environ.get('LEGACY_USER_PK', 'USER#michael')
LEGACY_PROGRESS_PK = os.environ.get('LEGACY_PROGRESS_PK', 'PROGRESS#michael')
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        'ALLOWED_ORIGINS',
        'https://www.auxos.app,https://auxos.app,https://www.liftos.net,https://liftos.net,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8765,http://127.0.0.1:8765',
    ).split(',')
    if o.strip()
]

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return float(obj) if obj % 1 else int(obj)
        return super().default(obj)


def to_dynamo_compatible(value):
    """Recursively replace Python floats with Decimals for boto3 DynamoDB writes."""
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, float):
        return decimal.Decimal(str(value))
    if isinstance(value, list):
        return [to_dynamo_compatible(item) for item in value]
    if isinstance(value, tuple):
        return [to_dynamo_compatible(item) for item in value]
    if isinstance(value, dict):
        return {key: to_dynamo_compatible(item) for key, item in value.items()}
    return value


def get_user_sub(event):
    claims = (event.get('requestContext') or {}).get('authorizer', {}).get('claims', {})
    return claims.get('sub') or ''


def get_cognito_groups(event):
    claims = (event.get('requestContext') or {}).get('authorizer', {}).get('claims', {})
    groups = claims.get('cognito:groups')
    if not groups:
        return []
    if isinstance(groups, list):
        return [str(g).strip() for g in groups if g]
    if isinstance(groups, str):
        return [g.strip() for g in groups.split(',') if g.strip()]
    return []


def is_admin_user(event):
    return 'admins' in get_cognito_groups(event)


def get_user_pk(event):
    sub = get_user_sub(event)
    if not sub:
        return LEGACY_USER_PK
    user_pk = f'USER#{sub}'
    try:
        from shared.migrate import maybe_migrate_user_data
    except ImportError:
        from migrate import maybe_migrate_user_data
    progress_pk = f'PROGRESS#{sub}'
    maybe_migrate_user_data(table, user_pk, progress_pk)
    return user_pk


def get_progress_pk(event):
    sub = get_user_sub(event)
    if not sub:
        return LEGACY_PROGRESS_PK
    return f'PROGRESS#{sub}'


def cors_origin(event):
    headers = event.get('headers') or {}
    origin = headers.get('Origin') or headers.get('origin') or ''
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else 'https://www.auxos.app'


def resp(event, status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': cors_origin(event),
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        'body': json.dumps(body, cls=DecimalEncoder),
    }


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def verify_session_owned(event, session_id):
    user_pk = get_user_pk(event)
    item = table.get_item(Key={'pk': user_pk, 'sk': f'SESSION#{session_id}'})
    return 'Item' in item
