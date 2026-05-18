"""
Sets Lambda
pk: SESSION#<sessionId>  sk: SET#<exercise>#<setNum>
"""
import json
import os
import sys
import decimal
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key

sys.path.insert(0, '/var/task/shared')
sys.path.insert(0, '../shared')

try:
    from shared.utils import table, resp, now_iso, get_progress_pk, verify_session_owned
except ImportError:
    from utils import table, resp, now_iso, get_progress_pk, verify_session_owned

TABLE_NAME = os.environ.get('TABLE_NAME', 'LiftingTracker')


def e1rm(weight, reps):
    if not weight or not reps:
        return 0
    return round(float(weight) * (1 + float(reps) / 30), 1)


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path_params = event.get('pathParameters') or {}
    session_id = path_params.get('sessionId')

    if method == 'OPTIONS':
        return resp(event, 200, {})

    if not session_id:
        return resp(event, 400, {'error': 'sessionId required'})

    if not verify_session_owned(event, session_id):
        return resp(event, 404, {'error': 'Session not found'})

    if method == 'GET':
        result = table.query(
            KeyConditionExpression=Key('pk').eq(f'SESSION#{session_id}') & Key('sk').begins_with('SET#'),
            ScanIndexForward=True,
        )
        return resp(event, 200, {'sets': result.get('Items', [])})

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        exercise = body.get('exercise', 'Unknown')
        set_num = int(body.get('setNumber', 1))
        weight_kg = body.get('weightKg')
        reps = body.get('reps')
        rpe = body.get('rpe')

        item = {
            'pk': f'SESSION#{session_id}',
            'sk': f'SET#{exercise}#{set_num:03d}',
            'sessionId': session_id,
            'exercise': exercise,
            'setNumber': set_num,
            'weightKg': decimal.Decimal(str(weight_kg)) if weight_kg is not None else None,
            'reps': int(reps) if reps is not None else None,
            'rpe': decimal.Decimal(str(rpe)) if rpe is not None else None,
            'completed': bool(body.get('completed', True)),
            'e1rm': decimal.Decimal(str(e1rm(weight_kg, reps))),
            'timestamp': now_iso(),
        }
        item = {k: v for k, v in item.items() if v is not None}
        table.put_item(Item=item)
        _update_progress(event, exercise, session_id, body.get('week', 1), item.get('e1rm', 0))
        return resp(event, 201, item)

    return resp(event, 405, {'error': 'Method not allowed'})


def _update_progress(event, exercise, session_id, week, new_e1rm):
    pk = get_progress_pk(event)
    sk = f'EXERCISE#{exercise}#WEEK#{int(week):02d}'
    try:
        existing = table.get_item(Key={'pk': pk, 'sk': sk}).get('Item', {})
        best = existing.get('bestE1rm', decimal.Decimal('0'))
        if decimal.Decimal(str(new_e1rm)) > best:
            table.put_item(
                Item={
                    'pk': pk,
                    'sk': sk,
                    'exercise': exercise,
                    'week': int(week),
                    'bestE1rm': decimal.Decimal(str(new_e1rm)),
                    'sessionId': session_id,
                    'updatedAt': now_iso(),
                }
            )
    except Exception:
        pass
