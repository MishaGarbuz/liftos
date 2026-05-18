"""
Progress Lambda
pk: PROGRESS#michael  sk: EXERCISE#<name>#WEEK#<nn>
"""
import sys
from boto3.dynamodb.conditions import Key

sys.path.insert(0, '/var/task/shared')
sys.path.insert(0, '../shared')

try:
    from shared.utils import table, resp, get_progress_pk
except ImportError:
    from utils import table, resp, get_progress_pk


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path_params = event.get('pathParameters') or {}
    exercise = path_params.get('exercise')

    if method == 'OPTIONS':
        return resp(event, 200, {})

    pk = get_progress_pk(event)

    if exercise:
        exercise_decoded = exercise.replace('%20', ' ').replace('+', ' ')
        result = table.query(
            KeyConditionExpression=Key('pk').eq(pk) & Key('sk').begins_with(f'EXERCISE#{exercise_decoded}#'),
            ScanIndexForward=True,
        )
        items = result.get('Items', [])
        data = [
            {
                'week': int(i['week']),
                'bestE1rm': float(i['bestE1rm']),
                'sessionId': i.get('sessionId', ''),
            }
            for i in items
        ]
        return resp(event, 200, {'exercise': exercise_decoded, 'data': data})

    result = table.query(
        KeyConditionExpression=Key('pk').eq(pk),
        ScanIndexForward=False,
    )
    items = result.get('Items', [])
    by_exercise = {}
    for item in items:
        ex = item['exercise']
        if ex not in by_exercise or item['week'] > by_exercise[ex]['week']:
            by_exercise[ex] = {
                'exercise': ex,
                'week': int(item['week']),
                'bestE1rm': float(item['bestE1rm']),
            }

    return resp(event, 200, {'exercises': list(by_exercise.values())})
