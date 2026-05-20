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
