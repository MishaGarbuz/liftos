"""S3-backed program documents (current + version history) for AI Coach path."""
import json
import os
import re
from datetime import datetime, timezone

import boto3

s3 = boto3.client('s3')

SCHEMA_VERSION = 1


def programs_bucket():
    return os.environ.get('PROGRAMS_BUCKET', '')


def _safe_sub(sub):
    return re.sub(r'[^a-zA-Z0-9_-]', '', str(sub or 'unknown'))


def user_current_key(sub):
    return f'users/{_safe_sub(sub)}/current.json'


def user_version_key(sub, ts=None):
    stamp = ts or datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    return f'users/{_safe_sub(sub)}/versions/{stamp}.json'


def template_key(program_id):
    return f'templates/{program_id}.json'


def wrap_document(bundle, source='api', program_id=None):
    """Envelope written to S3 — validates shape at API boundary later."""
    doc = {
        'schemaVersion': SCHEMA_VERSION,
        'source': source,
        'savedAt': datetime.now(timezone.utc).isoformat(),
        'bundle': bundle,
    }
    if program_id:
        doc['programId'] = program_id
    return doc


def save_user_program(sub, bundle, source='api', program_id=None):
    bucket = programs_bucket()
    if not bucket:
        return None, None
    doc = wrap_document(bundle, source=source, program_id=program_id)
    body = json.dumps(doc, default=str)
    current_key = user_current_key(sub)
    version_key = user_version_key(sub)
    s3.put_object(
        Bucket=bucket,
        Key=current_key,
        Body=body.encode('utf-8'),
        ContentType='application/json',
    )
    s3.put_object(
        Bucket=bucket,
        Key=version_key,
        Body=body.encode('utf-8'),
        ContentType='application/json',
    )
    return current_key, version_key


def load_json_key(key):
    bucket = programs_bucket()
    if not bucket or not key:
        return None
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        return json.loads(obj['Body'].read().decode('utf-8'))
    except s3.exceptions.NoSuchKey:
        return None
    except Exception:
        return None


def load_user_program(sub):
    doc = load_json_key(user_current_key(sub))
    if not doc:
        return None, None
    return doc.get('bundle'), doc


def load_template(program_id):
    doc = load_json_key(template_key(program_id))
    if not doc:
        return None
    return doc.get('bundle') or doc
