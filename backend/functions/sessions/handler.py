"""
Sessions Lambda
pk: USER#michael  sk: SESSION#<sessionId>
"""
import json
import uuid
import sys
from boto3.dynamodb.conditions import Key

sys.path.insert(0, '/var/task/shared')
sys.path.insert(0, '../shared')

try:
    from shared.utils import table, resp, now_iso, get_user_pk, verify_session_owned
except ImportError:
    from utils import table, resp, now_iso, get_user_pk, verify_session_owned


def _delete_session_cascade(event, user_pk, session_id):
    sets_result = table.query(
        KeyConditionExpression=Key('pk').eq(f'SESSION#{session_id}') & Key('sk').begins_with('SET#'),
    )
    for item in sets_result.get('Items', []):
        table.delete_item(Key={'pk': item['pk'], 'sk': item['sk']})
    table.delete_item(Key={'pk': user_pk, 'sk': f'SESSION#{session_id}'})


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path_params = event.get('pathParameters') or {}
    session_id = path_params.get('sessionId')
    user_pk = get_user_pk(event)

    if method == 'OPTIONS':
        return resp(event, 200, {})

    if method == 'GET' and not session_id:
        result = table.query(
            KeyConditionExpression=Key('pk').eq(user_pk) & Key('sk').begins_with('SESSION#'),
            ScanIndexForward=False,
        )
        return resp(event, 200, {'sessions': result.get('Items', [])})

    if method == 'GET' and session_id:
        item = table.get_item(Key={'pk': user_pk, 'sk': f'SESSION#{session_id}'})
        if 'Item' not in item:
            return resp(event, 404, {'error': 'Session not found'})
        return resp(event, 200, item['Item'])

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        sid = body.get('sessionId') or str(uuid.uuid4())
        status = body.get('status', 'in_progress')
        allowed_statuses = {'in_progress', 'completed', 'skipped'}
        if status not in allowed_statuses:
            status = 'in_progress'
        item = {
            'pk': user_pk,
            'sk': f'SESSION#{sid}',
            'sessionId': sid,
            'week': int(body.get('week', 1)),
            'day': body.get('day', 'Monday'),
            'dayKey': body.get('dayKey', 'mon'),
            'date': body.get('date', now_iso()[:10]),
            'status': status,
            'totalSets': int(body.get('totalSets', 0)),
            'completedSets': int(body.get('completedSets', 0)),
            'notes': body.get('notes', ''),
            'skipReason': body.get('skipReason', ''),
            'createdAt': body.get('createdAt', now_iso()),
            'updatedAt': now_iso(),
        }
        table.put_item(Item=item)
        return resp(event, 201, item)

    if method == 'PATCH' and session_id:
        # Lightweight status-only update (e.g. mark skipped).
        if not verify_session_owned(event, session_id):
            return resp(event, 404, {'error': 'Session not found'})
        body = json.loads(event.get('body') or '{}')
        status = body.get('status')
        allowed_statuses = {'in_progress', 'completed', 'skipped'}
        if status not in allowed_statuses:
            return resp(event, 400, {'error': f'status must be one of {sorted(allowed_statuses)}'})
        update_expr = 'SET #st = :st, updatedAt = :ts'
        expr_names = {'#st': 'status'}
        expr_vals = {':st': status, ':ts': now_iso()}
        if 'skipReason' in body:
            update_expr += ', skipReason = :sr'
            expr_vals[':sr'] = str(body['skipReason'])[:200]
        table.update_item(
            Key={'pk': user_pk, 'sk': f'SESSION#{session_id}'},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_vals,
        )
        return resp(event, 200, {'sessionId': session_id, 'status': status})

    if method == 'DELETE' and session_id:
        if not verify_session_owned(event, session_id):
            return resp(event, 404, {'error': 'Session not found'})
        _delete_session_cascade(event, user_pk, session_id)
        return resp(event, 200, {'deleted': session_id})

    return resp(event, 405, {'error': 'Method not allowed'})
