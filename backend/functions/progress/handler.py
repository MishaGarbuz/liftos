"""
Progress Lambda
pk: PROGRESS#michael  sk: EXERCISE#<name>#WEEK#<nn>
Returns charting data: best E1RM per exercise per week
"""
import json, os, boto3, decimal
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get('TABLE_NAME', 'LiftingTracker')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return float(obj) if obj % 1 else int(obj)
        return super().default(obj)

def resp(status, body):
    return {'statusCode': status,'headers':{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'},'body':json.dumps(body,cls=DecimalEncoder)}

def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path_params = event.get('pathParameters') or {}
    exercise = path_params.get('exercise')

    if method == 'OPTIONS':
        return resp(200, {})

    pk = 'PROGRESS#michael'

    # GET /progress/{exercise}
    if exercise:
        exercise_decoded = exercise.replace('%20', ' ').replace('+', ' ')
        result = table.query(
            KeyConditionExpression=Key('pk').eq(pk) & Key('sk').begins_with(f'EXERCISE#{exercise_decoded}#'),
            ScanIndexForward=True
        )
        items = result.get('Items', [])
        data = [{'week': int(i['week']), 'bestE1rm': float(i['bestE1rm']), 'sessionId': i.get('sessionId','')} for i in items]
        return resp(200, {'exercise': exercise_decoded, 'data': data})

    # GET /progress - all exercises summary (latest week best)
    result = table.query(
        KeyConditionExpression=Key('pk').eq(pk),
        ScanIndexForward=False
    )
    items = result.get('Items', [])
    
    # Group by exercise, return latest entry per exercise
    by_exercise = {}
    for item in items:
        ex = item['exercise']
        if ex not in by_exercise or item['week'] > by_exercise[ex]['week']:
            by_exercise[ex] = {
                'exercise': ex,
                'week': int(item['week']),
                'bestE1rm': float(item['bestE1rm'])
            }
    
    return resp(200, {'exercises': list(by_exercise.values())})
