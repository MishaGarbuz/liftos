"""
Summary Lambda - Dashboard KPIs
Returns: total sessions, current week, best E1RMs, weekly set counts
"""
import json, os, boto3, decimal
from boto3.dynamodb.conditions import Key
from datetime import datetime, timezone

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
    if event.get('httpMethod') == 'OPTIONS':
        return resp(200, {})

    user_pk = 'USER#michael'
    progress_pk = 'PROGRESS#michael'

    # Sessions
    sessions_result = table.query(
        KeyConditionExpression=Key('pk').eq(user_pk) & Key('sk').begins_with('SESSION#'),
        ScanIndexForward=False
    )
    sessions = sessions_result.get('Items', [])
    total_sessions = len(sessions)
    completed = [s for s in sessions if s.get('status') == 'completed']
    current_week = max((int(s.get('week', 1)) for s in sessions), default=1)

    # Weekly sets count
    weekly_sets = {}
    for s in sessions:
        w = str(s.get('week', 1))
        weekly_sets[w] = weekly_sets.get(w, 0) + int(s.get('completedSets', 0))

    # Best E1RMs
    progress_result = table.query(
        KeyConditionExpression=Key('pk').eq(progress_pk),
        ScanIndexForward=False
    )
    progress_items = progress_result.get('Items', [])

    by_exercise = {}
    for item in progress_items:
        ex = item['exercise']
        val = float(item['bestE1rm'])
        if ex not in by_exercise or val > by_exercise[ex]:
            by_exercise[ex] = val

    # Top 3 best lifts
    top_lifts = sorted(by_exercise.items(), key=lambda x: x[1], reverse=True)[:6]

    return resp(200, {
        'totalSessions': total_sessions,
        'completedSessions': len(completed),
        'currentWeek': current_week,
        'weeklySetCounts': weekly_sets,
        'bestE1rms': [{'exercise': k, 'e1rm': v} for k, v in top_lifts],
        'recentSessions': sessions[:5]
    })
