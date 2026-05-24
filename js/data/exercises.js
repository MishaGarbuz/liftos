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

/** How logged weight should be interpreted (BB total vs DB pair, etc.). */
function getExerciseLoadScheme(name) {
  const n = String(name || "").toLowerCase();
  if (/\b(dumbbell|dumbbells|\bdb\b|d\.b\.)\b/.test(n)) {
    return {
      id: "dumbbell_pair",
      short: "DB",
      label: "Dumbbell (pair)",
      note: "Log total weight — both dumbbells combined (e.g. 2×20 kg = 40 kg).",
    };
  }
  if (/\b(barbell|\bbb\b)\b/.test(n) || (/\bbar\b/.test(n) && !/\bmachine\b/.test(n))) {
    return {
      id: "barbell",
      short: "BB",
      label: "Barbell",
      note: "Log total on the bar — bar weight plus plates (e.g. 20 kg bar + 20 kg/side = 60 kg).",
    };
  }
  if (/\b(cable|pulley|stack)\b/.test(n)) {
    return {
      id: "cable_stack",
      short: "Cable",
      label: "Cable stack",
      note: "Log stack weight as shown on the machine (usually one number).",
    };
  }
  if (/\b(machine|smith|leg press|hack squat)\b/.test(n)) {
    return {
      id: "machine",
      short: "Machine",
      label: "Machine",
      note: "Log weight as shown on the machine (pin stack or plate-loaded).",
    };
  }
  if (/\b(kettlebell|\bkb\b)\b/.test(n)) {
    return {
      id: "kettlebell",
      short: "KB",
      label: "Kettlebell",
      note: "Log the kettlebell label weight (single bell).",
    };
  }
  return {
    id: "other",
    short: "—",
    label: "Other",
    note: "Use the same load type when comparing to past sessions.",
  };
}

function getLoadSchemeChangeNote(fromName, toName) {
  const from = getExerciseLoadScheme(fromName);
  const to = getExerciseLoadScheme(toName);
  if (from.id === to.id) return null;
  return `${from.label} → ${to.label}: ${from.note} ${to.label}: ${to.note} Do not copy the same number across load types without adjusting.`;
}

function exerciseNamesAreRelated(nameA, nameB, plannedTemplate) {
  if (!nameA || !nameB) return false;
  if (nameA === nameB) return true;
  const template = plannedTemplate || { name: nameA, alt: "" };
  const ids = new Set(getSuggestedExercises(template).map((o) => o.id));
  return ids.has(exerciseIdFromName(nameA)) && ids.has(exerciseIdFromName(nameB));
}

/** Match a logged name to a program slot (planned + alts). */
function findProgramExerciseMeta(dayKey, loggedName) {
  const day = typeof PROGRAM !== "undefined" ? PROGRAM[dayKey] : null;
  if (!day?.blocks || !loggedName) return null;
  const targetId = exerciseIdFromName(loggedName);
  for (let bi = 0; bi < day.blocks.length; bi += 1) {
    const block = day.blocks[bi];
    const exercises = block.exercises || [];
    for (let ei = 0; ei < exercises.length; ei += 1) {
      const ex = exercises[ei];
      const options = getSuggestedExercises(ex);
      if (options.some((o) => o.id === targetId)) {
        return {
          ex,
          slotId: getExerciseSlotId(dayKey, bi, ei),
          plannedName: ex.name,
        };
      }
    }
  }
  return null;
}

function inferSessionSetMetadata(session) {
  if (!session?.sets?.length || !session.day) return;
  session.sets.forEach((set) => {
    if (set.plannedExerciseName && set.slotId) return;
    const meta = findProgramExerciseMeta(session.day, set.exercise);
    if (!meta) return;
    set.plannedExerciseName = set.plannedExerciseName || meta.plannedName;
    set.plannedExerciseId = set.plannedExerciseId || exerciseIdFromName(meta.plannedName);
    set.slotId = set.slotId || meta.slotId;
  });
  if (session.exerciseSwaps) return;
  const swaps = {};
  session.sets.forEach((set) => {
    if (!set.slotId || !set.plannedExerciseName) return;
    if (set.exercise !== set.plannedExerciseName) {
      swaps[set.slotId] = {
        plannedExerciseName: set.plannedExerciseName,
        plannedExerciseId: set.plannedExerciseId,
        exerciseName: set.exercise,
        exerciseId: set.exerciseId || exerciseIdFromName(set.exercise),
      };
    }
  });
  if (Object.keys(swaps).length) session.exerciseSwaps = swaps;
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
