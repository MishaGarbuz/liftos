"""
User preferences — pk: USER#{sub}  sk: PREFS#profile
"""
import json
import sys

sys.path.insert(0, '/var/task/shared')
sys.path.insert(0, '../shared')

try:
    from shared.utils import table, resp, now_iso, get_user_pk
except ImportError:
    from utils import table, resp, now_iso, get_user_pk

PREFS_SK = 'PREFS#profile'

DEFAULT_PREFS = {
    'theme': 'auto',
    'palette': 'ember',
    'units': 'kg',
    'timerVibrate': True,
    'timerNotify': True,
}


def sanitize_prefs(raw):
    if not isinstance(raw, dict):
        raw = {}
    theme = raw.get('theme', DEFAULT_PREFS['theme'])
    if theme not in ('auto', 'dark', 'light'):
        theme = DEFAULT_PREFS['theme']
    palette = raw.get('palette', DEFAULT_PREFS['palette'])
    if palette not in ('ember', 'forge'):
        palette = DEFAULT_PREFS['palette']
    units = raw.get('units', DEFAULT_PREFS['units'])
    if units not in ('kg', 'lb'):
        units = DEFAULT_PREFS['units']
    return {
        'theme': theme,
        'palette': palette,
        'units': units,
        'timerVibrate': bool(raw.get('timerVibrate', DEFAULT_PREFS['timerVibrate'])),
        'timerNotify': bool(raw.get('timerNotify', DEFAULT_PREFS['timerNotify'])),
    }


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    user_pk = get_user_pk(event)

    if method == 'OPTIONS':
        return resp(event, 200, {})

    if method == 'GET':
        result = table.get_item(Key={'pk': user_pk, 'sk': PREFS_SK})
        item = result.get('Item') or {}
        prefs = sanitize_prefs(item.get('prefs'))
        return resp(event, 200, {'prefs': prefs, 'updatedAt': item.get('updatedAt')})

    if method == 'PUT':
        body = json.loads(event.get('body') or '{}')
        incoming = sanitize_prefs(body.get('prefs'))
        existing = table.get_item(Key={'pk': user_pk, 'sk': PREFS_SK}).get('Item') or {}
        merged = sanitize_prefs({**existing.get('prefs', {}), **incoming})
        updated_at = now_iso()
        table.put_item(
            Item={
                'pk': user_pk,
                'sk': PREFS_SK,
                'prefs': merged,
                'updatedAt': updated_at,
            }
        )
        return resp(event, 200, {'prefs': merged, 'updatedAt': updated_at})

    return resp(event, 405, {'error': 'Method not allowed'})
