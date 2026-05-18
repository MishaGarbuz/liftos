"""
Sets Lambda
pk: SESSION#<sessionId>  sk: SET#<exercise>#<setNum>
"""
import json, uuid, sys, os, boto3, decimal
from datetime import datetime, timezone
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

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def e1rm(weight, reps):
    """Epley formula: weight * (1 + reps/30)"""
    if not weight or not reps:
        return 0
    return round(float(weight) * (1 + float(reps) / 30), 1)

def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path_params = event.get('pathParameters') or {}
    session_id = path_params.get('sessionId')

    if method == 'OPTIONS':
        return resp(200, {})

    if not session_id:
        return resp(400, {'error': 'sessionId required'})

    # GET /sessions/{id}/sets
    if method == 'GET':
        result = table.query(
            KeyConditionExpression=Key('pk').eq(f'SESSION#{session_id}') & Key('sk').begins_with('SET#'),
            ScanIndexForward=True
        )
        return resp(200, {'sets': result.get('Items', [])})

    # POST /sessions/{id}/sets - log one set
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
            'timestamp': now_iso()
        }
        # remove None values
        item = {k: v for k, v in item.items() if v is not None}
        table.put_item(Item=item)

        # also update best E1RM in progress record
        _update_progress(exercise, session_id, body.get('week', 1), item.get('e1rm', 0))

        return resp(201, item)

    return resp(405, {'error': 'Method not allowed'})


def _update_progress(exercise, session_id, week, new_e1rm):
    """Upsert best E1RM for exercise+week in PROGRESS# records"""
    pk = 'PROGRESS#michael'
    sk = f'EXERCISE#{exercise}#WEEK#{int(week):02d}'
    try:
        existing = table.get_item(Key={'pk': pk, 'sk': sk}).get('Item', {})
        best = existing.get('bestE1rm', decimal.Decimal('0'))
        if decimal.Decimal(str(new_e1rm)) > best:
            table.put_item(Item={
                'pk': pk,
                'sk': sk,
                'exercise': exercise,
                'week': int(week),
                'bestE1rm': decimal.Decimal(str(new_e1rm)),
                'sessionId': session_id,
                'updatedAt': now_iso()
            })
    except Exception:
        pass
