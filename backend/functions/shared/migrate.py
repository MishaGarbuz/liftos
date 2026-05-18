"""One-time copy of legacy USER#michael / PROGRESS#michael data to per-user partition keys."""
import os
from boto3.dynamodb.conditions import Key

LEGACY_USER_PK = os.environ.get('LEGACY_USER_PK', 'USER#michael')
LEGACY_PROGRESS_PK = os.environ.get('LEGACY_PROGRESS_PK', 'PROGRESS#michael')


def maybe_migrate_user_data(table, user_pk, progress_pk):
    if user_pk == LEGACY_USER_PK:
        return

    flag_key = {'pk': user_pk, 'sk': 'META#migrated_from_legacy'}
    if table.get_item(Key=flag_key).get('Item'):
        return

    existing = table.query(
        KeyConditionExpression=Key('pk').eq(user_pk) & Key('sk').begins_with('SESSION#'),
        Limit=1,
    )
    if existing.get('Items'):
        table.put_item(Item={**flag_key, 'done': True, 'skipped': 'already_has_sessions'})
        return

    legacy_sessions = table.query(
        KeyConditionExpression=Key('pk').eq(LEGACY_USER_PK) & Key('sk').begins_with('SESSION#'),
    )
    for item in legacy_sessions.get('Items', []):
        new_item = dict(item)
        new_item['pk'] = user_pk
        table.put_item(Item=new_item)

    legacy_progress = table.query(
        KeyConditionExpression=Key('pk').eq(LEGACY_PROGRESS_PK),
    )
    for item in legacy_progress.get('Items', []):
        new_item = dict(item)
        new_item['pk'] = progress_pk
        table.put_item(Item=new_item)

    table.put_item(Item={**flag_key, 'done': True, 'sessions': len(legacy_sessions.get('Items', []))})
