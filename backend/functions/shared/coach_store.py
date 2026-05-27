"""Storage helpers for AI-generated progression suggestions and athlete overrides."""
from copy import deepcopy

try:
    from shared.utils import table, now_iso, to_dynamo_compatible
except ImportError:
    from utils import table, now_iso, to_dynamo_compatible

SUGGESTIONS_PREFIX = 'SUGGESTIONS#WEEK#'


def suggestions_sk(week):
    return f'{SUGGESTIONS_PREFIX}{int(week):02d}'


def get_suggestions_record(user_pk, week):
    return table.get_item(Key={'pk': user_pk, 'sk': suggestions_sk(week)}).get('Item')


def merge_slot_override(slot, override):
    """Overlay athlete changes onto a single slot without losing untouched sets."""
    out = deepcopy(slot or {})
    if not override:
        return out
    for key in ('targetExerciseName', 'note'):
        if override.get(key) is not None:
            out[key] = override[key]
    if override.get('sets'):
        by_num = {int(s.get('setNumber', 0)): deepcopy(s) for s in out.get('sets', [])}
        merged = []
        seen = set()
        for over in override['sets']:
            num = int(over.get('setNumber', 0))
            base = deepcopy(by_num.get(num, {'setNumber': num}))
            base.update({k: v for k, v in over.items() if v is not None})
            base['lockedByAthlete'] = True
            merged.append(base)
            seen.add(num)
        for base in out.get('sets', []):
            num = int(base.get('setNumber', 0))
            if num in seen:
                continue
            merged.append(deepcopy(base))
        out['sets'] = sorted(merged, key=lambda x: int(x.get('setNumber', 0)))
    out['decision'] = 'override_preserved'
    out['reasonCode'] = 'manual_override'
    return out


def merge_suggestions(base_doc, overrides):
    """Apply all slot-scoped overrides onto the generated week document."""
    doc = deepcopy(base_doc or {})
    slots = deepcopy((doc.get('slots') or {}))
    for slot_id, override in (overrides or {}).items():
        slots[slot_id] = merge_slot_override(slots.get(slot_id, {'slotId': slot_id}), override)
    doc['slots'] = slots
    return doc


def get_merged_suggestions(user_pk, week):
    record = get_suggestions_record(user_pk, week)
    if not record:
        return None, None
    merged = merge_suggestions(record.get('baseSuggestions'), record.get('overrides'))
    return merged, record


def put_generated_suggestions(user_pk, week, base_suggestions, source='fallback', prompt_meta=None):
    existing = get_suggestions_record(user_pk, week) or {}
    item = {
        'pk': user_pk,
        'sk': suggestions_sk(week),
        'targetWeek': int(week),
        'task': 'progression_suggestions',
        'baseSuggestions': base_suggestions,
        'overrides': existing.get('overrides', {}),
        'source': source,
        'updatedAt': now_iso(),
    }
    if prompt_meta:
        item['promptMeta'] = prompt_meta
    table.put_item(Item=to_dynamo_compatible(item))
    return item


def put_suggestion_override(user_pk, week, slot_id, override):
    existing = get_suggestions_record(user_pk, week) or {}
    if not existing.get('baseSuggestions'):
        raise ValueError('Generate suggestions for this week before saving overrides')
    overrides = deepcopy(existing.get('overrides', {}))
    overrides[slot_id] = {**override, 'updatedAt': now_iso()}
    item = {
        'pk': user_pk,
        'sk': suggestions_sk(week),
        'targetWeek': int(week),
        'task': 'progression_suggestions',
        'baseSuggestions': existing.get('baseSuggestions'),
        'overrides': overrides,
        'source': existing.get('source', 'override_only'),
        'updatedAt': now_iso(),
    }
    if existing.get('promptMeta'):
        item['promptMeta'] = existing['promptMeta']
    table.put_item(Item=to_dynamo_compatible(item))
    return item
