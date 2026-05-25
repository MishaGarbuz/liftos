"""
AI Coach (stub) — shared Bedrock coach for program edits and progression advice.

POST /coach/program
  Body: {
    "message": "...",
    "threadId": "optional",
    "task": "program_generation" | "progression_suggestions",
    "targetWeek": 2
  }

Will eventually:
- load S3 current.json + DDB thread / athlete history
- choose prompt by task
- call Bedrock
- validate against the relevant schema
- save program or next-week suggestions
"""
import json
import sys

sys.path.insert(0, '/var/task/shared')
sys.path.insert(0, '../shared')

try:
    from shared.utils import resp, get_user_sub, get_user_pk, is_admin_user
    from shared.coach_prompts import COACH_POLICY_VERSION, get_task_prompt
    from shared.coach_store import (
        get_merged_suggestions,
        get_suggestions_record,
        merge_suggestions,
        put_generated_suggestions,
        put_suggestion_override,
    )
    from shared.coach_progression import generate_progression_suggestions
except ImportError:
    from utils import resp, get_user_sub, get_user_pk, is_admin_user
    from coach_prompts import COACH_POLICY_VERSION, get_task_prompt
    from coach_store import (
        get_merged_suggestions,
        get_suggestions_record,
        merge_suggestions,
        put_generated_suggestions,
        put_suggestion_override,
    )
    from coach_progression import generate_progression_suggestions

SCHEMA_REFS = {
    'program_generation': 'docs/program-schema.json',
    'progression_suggestions': 'docs/progression-suggestions-schema.json',
}


def parse_task(body):
    task = (body.get('task') or 'program_generation').strip()
    if task not in SCHEMA_REFS:
        raise ValueError(f'unsupported task: {task}')
    return task


def suggestion_response(merged, record):
    return {
        'suggestions': merged,
        'source': (record or {}).get('source'),
        'updatedAt': (record or {}).get('updatedAt'),
        'promptMeta': (record or {}).get('promptMeta'),
        'coachPolicyVersion': COACH_POLICY_VERSION,
        'schema': SCHEMA_REFS['progression_suggestions'],
        'promptDoc': 'docs/AI_COACH_PROMPTS.md',
    }


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path = event.get('path') or ''
    params = event.get('queryStringParameters') or {}
    if method == 'OPTIONS':
        return resp(event, 200, {})

    sub = get_user_sub(event)
    if not sub:
        return resp(event, 401, {'error': 'Unauthorized'})
    user_pk = get_user_pk(event)

    if path.endswith('/suggestions'):
        if method == 'GET':
            week = int(params.get('week') or 0)
            if week < 1:
                return resp(event, 400, {'error': 'week required'})
            merged, record = get_merged_suggestions(user_pk, week)
            if not merged:
                return resp(event, 404, {
                    'error': 'Suggestions not found',
                    'week': week,
                    'needsGeneration': True,
                    'schema': SCHEMA_REFS['progression_suggestions'],
                    'promptDoc': 'docs/AI_COACH_PROMPTS.md',
                })
            return resp(event, 200, suggestion_response(merged, record))
        if method == 'PUT':
            body = json.loads(event.get('body') or '{}')
            week = int(body.get('week') or 0)
            slot_id = (body.get('slotId') or '').strip()
            override = body.get('override') or {}
            if week < 1 or not slot_id:
                return resp(event, 400, {'error': 'week and slotId required'})
            try:
                record = put_suggestion_override(user_pk, week, slot_id, override)
            except ValueError as e:
                return resp(event, 409, {'error': str(e), 'week': week, 'slotId': slot_id})
            merged = merge_suggestions(record.get('baseSuggestions'), record.get('overrides'))
            return resp(event, 200, suggestion_response(merged, record))
        return resp(event, 405, {'error': 'Method not allowed'})

    if method != 'POST':
        return resp(event, 405, {'error': 'Method not allowed'})

    body = json.loads(event.get('body') or '{}')
    message = (body.get('message') or '').strip()
    if not message:
        return resp(event, 400, {'error': 'message required'})
    try:
        task = parse_task(body)
    except ValueError as e:
        return resp(event, 400, {'error': str(e), 'supportedTasks': sorted(SCHEMA_REFS)})

    task_prompt = get_task_prompt(task)
    if task == 'progression_suggestions':
        existing = get_suggestions_record(user_pk, int(body.get('targetWeek') or 1)) or {}
        suggestions, source, prompt_meta, _payload = generate_progression_suggestions(
            event,
            body,
            overrides=existing.get('overrides', {}),
        )
        record = put_generated_suggestions(
            user_pk,
            suggestions.get('targetWeek') or body.get('targetWeek') or 1,
            suggestions,
            source=source,
            prompt_meta=prompt_meta,
        )
        merged = merge_suggestions(record.get('baseSuggestions'), record.get('overrides'))
        return resp(event, 200, suggestion_response(merged, record))

    return resp(
        event,
        501,
        {
            'error': 'AI Coach not enabled yet',
            'hint': 'Programs and weekly suggestions will be generated via Bedrock with metadata in DynamoDB and program documents in S3.',
            'task': task,
            'schema': SCHEMA_REFS[task],
            'architecture': 'docs/AI_COACH_PROGRAMS.md',
            'promptDoc': 'docs/AI_COACH_PROMPTS.md',
            'coachPolicyVersion': COACH_POLICY_VERSION,
            'hasTaskPrompt': bool(task_prompt),
            'targetWeek': body.get('targetWeek'),
            'userSub': sub,
            'isAdmin': is_admin_user(event),
        },
    )
