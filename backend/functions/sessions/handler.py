"""
Sessions Lambda
pk: USER#michael  sk: SESSION#<sessionId>
"""
import json, uuid, sys
sys.path.insert(0, '/var/task/shared')
sys.path.insert(0, '../shared')

try:
    from shared.utils import table, resp, now_iso
except ImportError:
    import os, boto3, decimal
    from datetime import datetime, timezone
    import json as _json
    TABLE_NAME = os.environ.get('TABLE_NAME', 'LiftingTracker')
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(TABLE_NAME)
    class DecimalEncoder(_json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, decimal.Decimal):
                return float(obj) if obj % 1 else int(obj)
            return super().default(obj)
    def resp(status, body):
        return {'statusCode': status,'headers':{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'},'body':_json.dumps(body,cls=DecimalEncoder)}
    def now_iso():
        return datetime.now(timezone.utc).isoformat()

USER_PK = 'USER#michael'

def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path_params = event.get('pathParameters') or {}
    session_id = path_params.get('sessionId')

    if method == 'OPTIONS':
        return resp(200, {})

    # GET /sessions - list all sessions
    if method == 'GET' and not session_id:
        result = table.query(
            KeyConditionExpression='pk = :pk AND begins_with(sk, :prefix)',
            ExpressionAttributeValues={':pk': USER_PK, ':prefix': 'SESSION#'},
            ScanIndexForward=False
        )
        return resp(200, {'sessions': result.get('Items', [])})

    # GET /sessions/{id}
    if method == 'GET' and session_id:
        item = table.get_item(Key={'pk': USER_PK, 'sk': f'SESSION#{session_id}'})
        if 'Item' not in item:
            return resp(404, {'error': 'Session not found'})
        return resp(200, item['Item'])

    # POST /sessions - create/update session
    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        sid = body.get('sessionId') or str(uuid.uuid4())
        item = {
            'pk': USER_PK,
            'sk': f'SESSION#{sid}',
            'sessionId': sid,
            'week': int(body.get('week', 1)),
            'day': body.get('day', 'Monday'),
            'dayKey': body.get('dayKey', 'mon'),
            'date': body.get('date', now_iso()[:10]),
            'status': body.get('status', 'in_progress'),
            'totalSets': int(body.get('totalSets', 0)),
            'completedSets': int(body.get('completedSets', 0)),
            'notes': body.get('notes', ''),
            'createdAt': body.get('createdAt', now_iso()),
            'updatedAt': now_iso()
        }
        table.put_item(Item=item)
        return resp(201, item)

    # DELETE /sessions/{id}
    if method == 'DELETE' and session_id:
        table.delete_item(Key={'pk': USER_PK, 'sk': f'SESSION#{session_id}'})
        return resp(200, {'deleted': session_id})

    return resp(405, {'error': 'Method not allowed'})
