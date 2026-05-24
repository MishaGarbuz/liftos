/** @file Exercise id helpers and plan alt parsing (Phase 1 — no catalog DB yet). */

function exerciseIdFromName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function parseAltExercises(alt) {
  if (!alt || !String(alt).trim()) return [];
  return String(alt)
    .split(/\s*\/\s*|\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Planned exercise + plan `alt` string options for this slot. */
function getSuggestedExercises(ex) {
  const names = [ex.name, ...parseAltExercises(ex.alt)];
  const seen = new Set();
  const out = [];
  names.forEach((name) => {
    const id = exerciseIdFromName(name);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, name });
  });
  return out;
}

function getExerciseSlotId(day, blockIndex, exerciseIndex) {
  return `${day}-${blockIndex}-${exerciseIndex}`;
}

function sidMatchesSlot(sid, slotId) {
  return Boolean(sid && slotId && sid.startsWith(`set-${slotId}-`));
}

/** Superset: no rest until the last exercise in the block (then full rest before next round). */
function getEffectiveExerciseRest(ex, block, exerciseIndex) {
  if (!ex) return 0;
  if (block?.type === 'superset' && (block.exercises?.length || 0) > 1) {
    const last = block.exercises.length - 1;
    if (exerciseIndex < last) return 0;
  }
  return ex.rest ?? 0;
}
