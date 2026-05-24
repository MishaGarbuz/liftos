"""
AI Coach (stub) — future natural-language program build/update.

POST /coach/program
  Body: { "message": "...", "threadId": "optional" }

Will: load S3 current.json + DDB thread → LLM → validate program-schema.json → save version.
"""
import json
import sys

sys.path.insert(0, '/var/task/shared')
sys.path.insert(0, '../shared')

try:
    from shared.utils import resp, get_user_sub, is_admin_user
except ImportError:
    from utils import resp, get_user_sub, is_admin_user

SCHEMA_REF = 'docs/program-schema.json'


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return resp(event, 200, {})

    if method != 'POST':
        return resp(event, 405, {'error': 'Method not allowed'})

    sub = get_user_sub(event)
    if not sub:
        return resp(event, 401, {'error': 'Unauthorized'})

    body = json.loads(event.get('body') or '{}')
    message = (body.get('message') or '').strip()
    if not message:
        return resp(event, 400, {'error': 'message required'})

    return resp(
        event,
        501,
        {
            'error': 'AI Coach not enabled yet',
            'hint': 'Programs will be stored in S3 (current + versions) with metadata in DynamoDB.',
            'schema': SCHEMA_REF,
            'architecture': 'docs/AI_COACH_PROGRAMS.md',
            'userSub': sub,
            'isAdmin': is_admin_user(event),
        },
    )
