"""
User training programs — DynamoDB-backed assignments (per email + per Cognito sub).

pk: USER#{sub}     sk: PROGRAM#active     → active program for signed-in user
pk: PROGRAM#EMAIL sk: {normalized_email} → pre-login / admin assignment by email

Optional `bundle` map stores full program JSON (no JS functions); otherwise `programId`
points at built-in templates the app still ships (abhi, michael).
"""
import json
import re
import sys

sys.path.insert(0, '/var/task/shared')
sys.path.insert(0, '../shared')

try:
    from shared.utils import table, resp, now_iso, get_user_pk, get_user_sub, is_admin_user
    from shared.program_store import (
        save_user_program as s3_save_user_program,
        load_user_program as s3_load_user_program,
        load_json_key,
    )
except ImportError:
    from utils import table, resp, now_iso, get_user_pk, get_user_sub, is_admin_user
    from program_store import (
        save_user_program as s3_save_user_program,
        load_user_program as s3_load_user_program,
        load_json_key,
    )

PROGRAM_SK = 'PROGRAM#active'
EMAIL_PK = 'PROGRAM#EMAIL'
VALID_PROGRAM_IDS = frozenset({'michael', 'abhi'})

# Default email → template assignments (seeded on first access)
DEFAULT_EMAIL_ASSIGNMENTS = {
    'garbuzmichael@gmail.com': 'michael',
    'abhi.ar@hotmail.com': 'abhi',
}


def normalize_email(email):
    return re.sub(r'\s+', '', str(email or '').strip().lower())


def claims_email(event):
    claims = (event.get('requestContext') or {}).get('authorizer', {}).get('claims', {})
    return normalize_email(
        claims.get('email') or claims.get('cognito:username') or claims.get('preferred_username')
    )


def get_email_assignment(email):
    key = normalize_email(email)
    if not key:
        return None
    result = table.get_item(Key={'pk': EMAIL_PK, 'sk': key})
    return result.get('Item')


def put_email_assignment(email, program_id, bundle=None, updated_by=None):
    key = normalize_email(email)
    if not key:
        raise ValueError('email required')
    if program_id not in VALID_PROGRAM_IDS and not bundle:
        raise ValueError(f'invalid programId: {program_id}')
    item = {
        'pk': EMAIL_PK,
        'sk': key,
        'email': key,
        'programId': program_id,
        'updatedAt': now_iso(),
    }
    if bundle is not None:
        item['bundle'] = bundle
    if updated_by:
        item['updatedBy'] = updated_by
    table.put_item(Item=item)
    return item


def get_user_program(user_pk):
    result = table.get_item(Key={'pk': user_pk, 'sk': PROGRAM_SK})
    return result.get('Item')


def put_user_program(user_pk, program_id, email, bundle=None, sub=None, source='api'):
    item = {
        'pk': user_pk,
        'sk': PROGRAM_SK,
        'programId': program_id,
        'email': normalize_email(email),
        'updatedAt': now_iso(),
        'source': source,
    }
    if bundle is not None and sub:
        current_key, version_key = s3_save_user_program(sub, bundle, source=source, program_id=program_id)
        if current_key:
            item['s3CurrentKey'] = current_key
            item['s3VersionKey'] = version_key
            item['storage'] = 's3'
        else:
            item['bundle'] = bundle
            item['storage'] = 'dynamodb'
    elif bundle is not None:
        item['bundle'] = bundle
        item['storage'] = 'dynamodb'
    table.put_item(Item=item)
    return item


def bundle_for_record(record, sub):
    if not record:
        return None
    s3_key = record.get('s3CurrentKey')
    if s3_key:
        doc = load_json_key(s3_key)
        if doc:
            return doc.get('bundle')
    if sub:
        bundle, _doc = s3_load_user_program(sub)
        if bundle:
            return bundle
    return record.get('bundle')


def program_payload(record, sub, email, extra=None):
    payload = {
        'programId': record.get('programId', 'michael'),
        'bundle': bundle_for_record(record, sub),
        'email': record.get('email') or email,
        'userSub': sub,
        'source': record.get('storage', 'dynamodb'),
        'updatedAt': record.get('updatedAt'),
        's3CurrentKey': record.get('s3CurrentKey'),
        'schemaVersion': 1,
    }
    if extra:
        payload.update(extra)
    return payload


def seed_email_assignment(email):
    key = normalize_email(email)
    program_id = DEFAULT_EMAIL_ASSIGNMENTS.get(key, 'michael')
    return put_email_assignment(key, program_id)


def resolve_program_for_user(event):
    """Return program payload for the authenticated user."""
    user_pk = get_user_pk(event)
    sub = get_user_sub(event)
    email = claims_email(event)

    record = get_user_program(user_pk)
    if not record and email:
        assignment = get_email_assignment(email)
        if not assignment:
            assignment = seed_email_assignment(email)
        program_id = assignment.get('programId', 'michael')
        bundle = assignment.get('bundle')
        record = put_user_program(user_pk, program_id, email, bundle=bundle, sub=sub)
    elif not record:
        record = put_user_program(user_pk, 'michael', email, sub=sub)

    return program_payload(record, sub, email)


def list_assignments():
    result = table.query(
        KeyConditionExpression='pk = :pk',
        ExpressionAttributeValues={':pk': EMAIL_PK},
    )
    items = result.get('Items', [])
    out = []
    for item in items:
        out.append({
            'email': item.get('email') or item.get('sk'),
            'programId': item.get('programId', 'michael'),
            'hasCustomBundle': bool(item.get('bundle') or item.get('s3CurrentKey')),
            'storage': item.get('storage'),
            'updatedAt': item.get('updatedAt'),
        })
    return sorted(out, key=lambda x: x.get('email') or '')


def assignment_response(item):
    return {
        'email': item.get('email') or item.get('sk'),
        'programId': item.get('programId', 'michael'),
        'bundle': item.get('bundle'),
        'updatedAt': item.get('updatedAt'),
    }


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path = event.get('path') or ''
    params = event.get('queryStringParameters') or {}

    if method == 'OPTIONS':
        return resp(event, 200, {})

    if path.endswith('/assignments') and method == 'GET':
        if not is_admin_user(event):
            return resp(event, 403, {'error': 'Admin only'})
        return resp(event, 200, {'assignments': list_assignments()})

    if method == 'GET':
        target_email = normalize_email(params.get('email'))
        if target_email:
            if not is_admin_user(event):
                return resp(event, 403, {'error': 'Admin only'})
            item = get_email_assignment(target_email) or seed_email_assignment(target_email)
            return resp(event, 200, assignment_response(item))
        return resp(event, 200, resolve_program_for_user(event))

    if method == 'PUT':
        if not is_admin_user(event):
            return resp(event, 403, {'error': 'Admin only'})
        body = json.loads(event.get('body') or '{}')
        target_email = normalize_email(body.get('email') or params.get('email'))
        program_id = body.get('programId') or body.get('program_id')
        bundle = body.get('bundle')
        if not target_email:
            return resp(event, 400, {'error': 'email required'})
        if not program_id and not bundle:
            return resp(event, 400, {'error': 'programId or bundle required'})
        if program_id and program_id not in VALID_PROGRAM_IDS and not bundle:
            return resp(event, 400, {'error': f'invalid programId: {program_id}'})
        program_id = program_id or 'custom'
        updated_by = claims_email(event)
        item = put_email_assignment(
            target_email,
            program_id,
            bundle=bundle,
            updated_by=updated_by,
        )
        # Refresh active user record if they already have an account
        user_pk = body.get('userPk')
        if user_pk:
            put_user_program(user_pk, program_id, target_email, bundle=bundle)
        return resp(event, 200, assignment_response(item))

    return resp(event, 405, {'error': 'Method not allowed'})
