"""
Summary Lambda - Dashboard KPIs
"""
import sys
from boto3.dynamodb.conditions import Key

sys.path.insert(0, '/var/task/shared')
sys.path.insert(0, '../shared')

try:
    from shared.utils import table, resp, get_user_pk, get_progress_pk
except ImportError:
    from utils import table, resp, get_user_pk, get_progress_pk


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return resp(event, 200, {})

    user_pk = get_user_pk(event)
    progress_pk = get_progress_pk(event)

    sessions_result = table.query(
        KeyConditionExpression=Key('pk').eq(user_pk) & Key('sk').begins_with('SESSION#'),
        ScanIndexForward=False,
    )
    sessions = sessions_result.get('Items', [])
    total_sessions = len(sessions)
    completed = [s for s in sessions if s.get('status') == 'completed']
    current_week = max((int(s.get('week', 1)) for s in sessions), default=1)

    weekly_sets = {}
    for s in sessions:
        w = str(s.get('week', 1))
        weekly_sets[w] = weekly_sets.get(w, 0) + int(s.get('completedSets', 0))

    progress_result = table.query(
        KeyConditionExpression=Key('pk').eq(progress_pk),
        ScanIndexForward=False,
    )
    progress_items = progress_result.get('Items', [])

    by_exercise = {}
    for item in progress_items:
        ex = item['exercise']
        val = float(item['bestE1rm'])
        if ex not in by_exercise or val > by_exercise[ex]:
            by_exercise[ex] = val

    top_lifts = sorted(by_exercise.items(), key=lambda x: x[1], reverse=True)[:6]

    return resp(
        event,
        200,
        {
            'totalSessions': total_sessions,
            'completedSessions': len(completed),
            'currentWeek': current_week,
            'weeklySetCounts': weekly_sets,
            'bestE1rms': [{'exercise': k, 'e1rm': v} for k, v in top_lifts],
            'recentSessions': sessions[:5],
        },
    )
