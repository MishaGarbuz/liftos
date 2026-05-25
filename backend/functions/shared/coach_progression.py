"""Build progression-suggestion inputs and deterministic fallbacks for AI Coach."""
import json
import os
import re
from collections import Counter

import boto3
from boto3.dynamodb.conditions import Key

try:
    from shared.utils import table, get_user_pk, now_iso
    from shared.coach_prompts import SHARED_SYSTEM_PROMPT, get_task_prompt, COACH_POLICY_VERSION
except ImportError:
    from utils import table, get_user_pk, now_iso
    from coach_prompts import SHARED_SYSTEM_PROMPT, get_task_prompt, COACH_POLICY_VERSION

BEDROCK_REGION = os.environ.get('BEDROCK_REGION') or os.environ.get('AWS_REGION') or 'ap-southeast-2'
COACH_MODEL_ID = os.environ.get('COACH_MODEL_ID', 'anthropic.claude-sonnet-4-6')
COACH_ENABLE_BEDROCK = os.environ.get('COACH_ENABLE_BEDROCK', 'true').lower() == 'true'

bedrock = boto3.client('bedrock-runtime', region_name=BEDROCK_REGION)


def parse_alt_exercises(alt):
    if not alt:
        return []
    return [s.strip() for s in re.split(r'\s*/\s*|\s*,\s*', str(alt)) if s.strip()]


def get_load_scheme(name):
    n = str(name or '').lower()
    if re.search(r'\b(dumbbell|dumbbells|\bdb\b|d\.b\.)\b', n):
        return 'dumbbell_pair_total'
    if re.search(r'\b(barbell|\bbb\b)\b', n) or (re.search(r'\bbar\b', n) and 'machine' not in n):
        return 'barbell_total'
    if re.search(r'\b(cable|pulley|stack)\b', n):
        return 'cable_stack'
    if re.search(r'\b(machine|smith|leg press|hack squat)\b', n):
        return 'machine_load'
    if re.search(r'\b(bodyweight|body weight|push-up|pull-up|chin-up|dip)\b', n):
        return 'bodyweight'
    if re.search(r'\b(assisted|assistance)\b', n):
        return 'assistance_load'
    if re.search(r'\b\d+\s*s\b', n):
        return 'timed_hold'
    return 'other'


def parse_rpe_value(raw):
    m = re.search(r'(\d+(?:\.\d+)?)', str(raw or ''))
    return float(m.group(1)) if m else 8.0


def parse_rep_range(raw):
    text = str(raw or '').lower()
    nums = [int(n) for n in re.findall(r'\d+', text)]
    if not nums:
        return None, None
    if len(nums) == 1:
        return nums[0], nums[0]
    return nums[0], nums[1]


def round_to_increment(value, step):
    if step <= 0:
        return round(value, 1)
    return round(round(float(value) / step) * step, 2)


def suggested_increment(load_scheme, current_weight):
    if load_scheme == 'barbell_total':
        return 2.5
    if load_scheme == 'dumbbell_pair_total':
        return 2.0
    if load_scheme == 'dumbbell_single':
        return 1.0
    if load_scheme in ('machine_load', 'cable_stack', 'assistance_load'):
        return 2.5 if (current_weight or 0) < 40 else 5.0
    return 1.0


def short_day(value):
    mapping = {'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'}
    v = str(value or '').strip().lower()
    if v in mapping:
        return mapping[v]
    if len(v) >= 3 and v[:3] in mapping:
        return mapping[v[:3]]
    return None


def build_program_slots(program_summary):
    days = (program_summary or {}).get('days') or {}
    gym_days = (program_summary or {}).get('gymDays') or list(days.keys())
    slots = []
    for day_key in gym_days:
        day = days.get(day_key) or {}
        for bi, block in enumerate(day.get('blocks') or []):
            for ei, ex in enumerate(block.get('exercises') or []):
                slot_id = f'{day_key}-{bi}-{ei}'
                slots.append({
                    'slotId': slot_id,
                    'day': day_key,
                    'blockType': block.get('type'),
                    'tier': block.get('tier') or ('core' if block.get('type') == 'core' else 'secondary'),
                    'plannedExerciseName': ex.get('name'),
                    'relatedNames': [ex.get('name'), *parse_alt_exercises(ex.get('alt'))],
                    'exercise': ex,
                })
    return slots


def query_user_sessions_with_sets(user_pk):
    result = table.query(
        KeyConditionExpression=Key('pk').eq(user_pk) & Key('sk').begins_with('SESSION#'),
        ScanIndexForward=False,
    )
    sessions = []
    for item in result.get('Items', []):
        sid = item.get('sessionId')
        if not sid:
            continue
        sets_result = table.query(
            KeyConditionExpression=Key('pk').eq(f'SESSION#{sid}') & Key('sk').begins_with('SET#'),
            ScanIndexForward=True,
        )
        sets = sets_result.get('Items', [])
        sessions.append({
            'sessionId': sid,
            'week': int(item.get('week', 1)),
            'day': short_day(item.get('dayKey') or item.get('day')) or 'Mon',
            'status': item.get('status', 'in_progress'),
            'updatedAt': item.get('updatedAt') or item.get('createdAt') or '',
            'sets': sets,
        })
    return sessions


def latest_completed_session_for_day_week(sessions, day, week):
    matches = [s for s in sessions if s.get('status') == 'completed' and s.get('day') == day and int(s.get('week', 0)) == int(week)]
    matches.sort(key=lambda x: x.get('updatedAt', ''), reverse=True)
    return matches[0] if matches else None


def latest_completed_session_before_week(sessions, day, week):
    matches = [s for s in sessions if s.get('status') == 'completed' and s.get('day') == day and int(s.get('week', 0)) < int(week)]
    matches.sort(key=lambda x: (int(x.get('week', 0)), x.get('updatedAt', '')), reverse=True)
    return matches[0] if matches else None


def set_matches_slot(set_item, slot):
    if set_item.get('slotId') == slot['slotId']:
        return True
    if set_item.get('plannedExerciseName') == slot['plannedExerciseName']:
        return True
    ex = set_item.get('exercise')
    if not ex:
        return False
    return any(ex == name for name in slot['relatedNames'] if name)


def summarize_performed_sets(sets):
    out = []
    for s in sets:
        out.append({
            'setNumber': int(s.get('setNumber', 1)),
            'weightKg': float(s.get('weightKg', 0) or 0),
            'reps': int(s.get('reps', 0) or 0),
            'rpe': float(s.get('rpe', 0) or 0),
            'exercise': s.get('exercise'),
        })
    out.sort(key=lambda x: x['setNumber'])
    return out


def build_slot_summary(slot, target_week, sessions, overrides=None):
    """Compact the latest relevant slot history into a Bedrock-friendly summary."""
    prior = latest_completed_session_for_day_week(sessions, slot['day'], target_week - 1) if int(target_week) > 1 else None
    if not prior and int(target_week) > 1:
        prior = latest_completed_session_before_week(sessions, slot['day'], target_week)
    matched_sets = summarize_performed_sets([s for s in (prior or {}).get('sets', []) if set_matches_slot(s, slot)])
    actual_name = None
    if matched_sets:
        counts = Counter(s.get('exercise') for s in matched_sets if s.get('exercise'))
        actual_name = counts.most_common(1)[0][0] if counts else slot['plannedExerciseName']
    else:
        actual_name = slot['plannedExerciseName']
    min_reps, max_reps = parse_rep_range(slot['exercise'].get('repsTarget'))
    return {
        'slotId': slot['slotId'],
        'day': slot['day'],
        'plannedExerciseName': slot['plannedExerciseName'],
        'actualExerciseName': actual_name,
        'loadScheme': get_load_scheme(actual_name),
        'repRange': slot['exercise'].get('repsTarget'),
        'targetRpe': parse_rpe_value(slot['exercise'].get('rpe')),
        'plannedSets': int(slot['exercise'].get('sets', 1)),
        'performedSets': matched_sets,
        'minReps': min_reps,
        'maxReps': max_reps,
        'completionSignal': 'completed' if len(matched_sets) >= int(slot['exercise'].get('sets', 1)) else ('partial' if matched_sets else 'missing'),
        'suggestionBaseline': {
            'weightKg': float(slot['exercise'].get('weight', 0) or 0),
            'repsTarget': slot['exercise'].get('repsTarget'),
            'rpeTarget': parse_rpe_value(slot['exercise'].get('rpe')),
            'restSec': int(slot['exercise'].get('rest', 0) or 0),
        },
        'athleteOverride': (overrides or {}).get(slot['slotId']),
    }


def next_weight_from_summary(summary, is_deload=False):
    baseline = float(summary['suggestionBaseline'].get('weightKg', 0) or 0)
    sets = summary.get('performedSets') or []
    if not sets:
        return max(0, round_to_increment(baseline * (0.6 if is_deload else 1.0), 0.5)), 'fallback_baseline', 'insufficient_data', 'Using authored baseline — not enough recent data.'
    max_weight = max(float(s.get('weightKg', 0) or 0) for s in sets)
    best_reps = max(int(s.get('reps', 0) or 0) for s in sets)
    avg_rpe = sum(float(s.get('rpe', 0) or 0) for s in sets if s.get('rpe') is not None) / max(1, len([s for s in sets if s.get('rpe') is not None]))
    min_reps = summary.get('minReps') or 0
    max_reps = summary.get('maxReps') or min_reps
    step = suggested_increment(summary.get('loadScheme'), max_weight)
    if is_deload:
        return max(0, round_to_increment(max_weight * 0.85, 0.5)), 'deload', 'deload_week', 'Deload week — reduce load and keep the movement easy.'
    if best_reps >= max_reps and avg_rpe <= max(8.0, summary.get('targetRpe', 8.0)):
        return round_to_increment(max_weight + step, 0.5), 'increase_load', 'top_of_range_low_rpe', 'Top of range with acceptable effort — small load increase.'
    if best_reps < min_reps or avg_rpe >= summary.get('targetRpe', 8.0) + 1:
        return max(0, round_to_increment(max_weight - step, 0.5)), 'decrease_load', 'high_rpe_hold', 'Recent effort was high — reduce the target slightly.'
    if best_reps < max_reps:
        return max_weight, 'increase_reps', 'completed_at_target', 'Hold load steady and add reps before increasing weight.'
    return max_weight, 'hold', 'completed_at_target', 'Keep the target steady and repeat cleanly.'


def reps_target_from_summary(summary, decision, is_deload=False):
    min_reps = summary.get('minReps') or 0
    max_reps = summary.get('maxReps') or min_reps
    sets = summary.get('performedSets') or []
    if is_deload:
        return summary['suggestionBaseline'].get('repsTarget'), min_reps
    if decision == 'increase_load':
        return summary['suggestionBaseline'].get('repsTarget'), min_reps
    if decision == 'increase_reps':
        best_reps = max((int(s.get('reps', 0) or 0) for s in sets), default=min_reps)
        target = min(max_reps, max(min_reps, best_reps + 1))
        return summary['suggestionBaseline'].get('repsTarget'), target
    if decision == 'decrease_load':
        return summary['suggestionBaseline'].get('repsTarget'), max(min_reps, min(max_reps, min_reps))
    return summary['suggestionBaseline'].get('repsTarget'), max(min_reps, min(max_reps, min_reps))


def build_deterministic_suggestions(program_summary, target_week, athlete_profile_summary=None, overrides=None, phase_label=None):
    """Fallback path when Bedrock is unavailable or returns invalid JSON."""
    slots = build_program_slots(program_summary)
    deload_weeks = set((program_summary or {}).get('deloadWeeks') or [])
    is_deload = int(target_week) in deload_weeks
    user_pk = athlete_profile_summary.get('userPk') if isinstance(athlete_profile_summary, dict) else None
    sessions = query_user_sessions_with_sets(user_pk) if user_pk else []
    slot_map = {}
    conservative_count = 0
    for slot in slots:
        summary = build_slot_summary(slot, target_week, sessions, overrides=overrides)
        weight, decision, reason_code, note = next_weight_from_summary(summary, is_deload=is_deload)
        reps_text, target_reps = reps_target_from_summary(summary, decision, is_deload=is_deload)
        set_count = int(slot['exercise'].get('sets', 1))
        set_rows = []
        for i in range(set_count):
            set_rows.append({
                'setNumber': i + 1,
                'weightKg': weight,
                'repsTarget': reps_text,
                'targetReps': int(target_reps or 0),
                'rpeTarget': float(summary['suggestionBaseline'].get('rpeTarget', 8.0)),
                'restSec': int(summary['suggestionBaseline'].get('restSec', 0)),
            })
        slot_map[slot['slotId']] = {
            'slotId': slot['slotId'],
            'day': slot['day'],
            'plannedExerciseName': slot['plannedExerciseName'],
            'targetExerciseName': summary['actualExerciseName'] or slot['plannedExerciseName'],
            'loadScheme': summary['loadScheme'],
            'decision': decision,
            'reasonCode': reason_code,
            'note': note,
            'sets': set_rows,
        }
        if decision in ('fallback_baseline', 'decrease_load', 'hold', 'deload'):
            conservative_count += 1
    message = f'Week {int(target_week)} targets are ready. '
    if conservative_count:
        message += 'Some slots are intentionally conservative based on recent performance.'
    else:
        message += 'Small progressions were applied where recent performance supported it.'
    return {
        'schemaVersion': 1,
        'task': 'progression_suggestions',
        'coachPolicyVersion': COACH_POLICY_VERSION,
        'targetWeek': int(target_week),
        'phaseLabel': phase_label or '',
        'isDeloadWeek': is_deload,
        'athleteMessage': message.strip(),
        'slots': slot_map,
        '_inputSlotSummaries': [build_slot_summary(slot, target_week, sessions, overrides=overrides) for slot in slots],
    }


def validate_suggestions_doc(doc):
    if not isinstance(doc, dict):
        return False
    if doc.get('task') != 'progression_suggestions':
        return False
    if not isinstance(doc.get('slots'), dict) or not doc['slots']:
        return False
    for slot in doc['slots'].values():
        if not isinstance(slot, dict):
            return False
        if not slot.get('slotId') or not isinstance(slot.get('sets'), list) or not slot['sets']:
            return False
    return True


def build_progression_request(event, body):
    """Assemble the exact request contract shared by fallback logic and Bedrock."""
    target_week = int(body.get('targetWeek') or 1)
    if target_week < 1:
        raise ValueError('targetWeek must be >= 1')
    active_program = body.get('activeProgramSummary') or {}
    if not active_program.get('days') or not active_program.get('gymDays'):
        raise ValueError('activeProgramSummary with days and gymDays is required')
    athlete_profile = body.get('athleteProfileSummary') or {}
    athlete_profile['userPk'] = get_user_pk(event)
    week_context = body.get('weekContext') or {}
    overrides = body.get('athleteOverrides') or {}
    deterministic = build_deterministic_suggestions(
        active_program,
        target_week,
        athlete_profile_summary=athlete_profile,
        overrides=overrides,
        phase_label=week_context.get('phaseLabel'),
    )
    return {
        'task': 'progression_suggestions',
        'targetWeek': target_week,
        'athleteProfileSummary': athlete_profile,
        'activeProgramSummary': active_program,
        'weekContext': {
            'targetWeek': target_week,
            'phaseLabel': week_context.get('phaseLabel'),
            'isDeloadWeek': deterministic.get('isDeloadWeek', False),
        },
        'slotSummaries': deterministic.pop('_inputSlotSummaries', []),
        'fallbackSuggestions': deterministic,
    }


def invoke_bedrock_progression(payload):
    if not COACH_ENABLE_BEDROCK:
        raise RuntimeError('Bedrock disabled')
    task_prompt = get_task_prompt('progression_suggestions')
    athlete_profile = dict(payload.get('athleteProfileSummary') or {})
    athlete_profile.pop('userPk', None)
    req = {
        'coach_policy_version': COACH_POLICY_VERSION,
        'athlete_profile_summary': athlete_profile,
        'active_program_summary': payload.get('activeProgramSummary') or {},
        'week_context': payload.get('weekContext') or {},
        'slot_summaries': payload.get('slotSummaries') or [],
        'athlete_overrides': payload.get('athleteOverrides') or {},
    }
    # Keep the model call narrow: one task prompt plus compact JSON context.
    response = bedrock.converse(
        modelId=COACH_MODEL_ID,
        system=[{'text': SHARED_SYSTEM_PROMPT}],
        messages=[{
            'role': 'user',
            'content': [{
                'text': task_prompt + '\n\nInput JSON:\n' + json.dumps(req, separators=(',', ':'))
            }],
        }],
        inferenceConfig={
            'maxTokens': 3200,
            'temperature': 0.2,
            'topP': 0.9,
        },
    )
    text = ''.join(
        block.get('text', '')
        for block in response.get('output', {}).get('message', {}).get('content', [])
        if isinstance(block, dict)
    ).strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*|\s*```$', '', text, flags=re.S).strip()
    data = json.loads(text)
    if not validate_suggestions_doc(data):
        raise ValueError('Bedrock returned invalid suggestions payload')
    return data


def generate_progression_suggestions(event, body, overrides=None):
    """Return generated suggestions, metadata, and the request payload used."""
    payload = build_progression_request(event, body)
    payload['athleteOverrides'] = overrides or body.get('athleteOverrides') or {}
    fallback = payload['fallbackSuggestions']
    try:
        generated = invoke_bedrock_progression(payload)
        return generated, 'bedrock', {
            'modelId': COACH_MODEL_ID,
            'region': BEDROCK_REGION,
            'generatedAt': now_iso(),
        }, payload
    except Exception:
        return fallback, 'fallback', {
            'modelId': COACH_MODEL_ID,
            'region': BEDROCK_REGION,
            'generatedAt': now_iso(),
            'usedFallback': True,
        }, payload
