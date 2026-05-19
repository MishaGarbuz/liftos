/** @file Static program data: 4-day split, progressions, schedule metadata. */
const PROGRAM = {
  Mon: {
    label: "Monday — Upper A",
    focus: "Push · Chest / Shoulders / Triceps",
    warmup: [
      "5 min incline walk / row machine (elevate HR)",
      "Band pull-aparts × 20 reps",
      "Prone Y-raises × 12 reps",
      "Shoulder CARs — 5 each direction",
      "Push-up to downward dog × 8",
      "Dead bug × 8 each side"
    ],
    blocks: [
      {
        type: "standalone",
        exercises: [{
          name: "Incline Barbell Bench Press",
          sets: 4, repsTarget: "6–10", weight: 60, tempo: "3-1-1-0",
          rpe: "7–8", rest: 120,
          notes: "Brace core, retract scapula, slight arch. Do NOT flare elbows. Control descent 3s.",
          alt: "Incline Smith Machine Press"
        }]
      },
      {
        type: "superset", label: "Superset A",
        exercises: [
          { name: "Cable Lateral Raise", sets: 4, repsTarget: "12–15", weight: 8, tempo: "2-1-2-0", rpe: "8", rest: 60, notes: "Lean slightly away from cable. Lead with elbow, not wrist. No shrugging.", alt: "DB Lateral Raise / Lateral Raise Machine" },
          { name: "Incline DB Fly", sets: 4, repsTarget: "10–14", weight: 16, tempo: "3-1-1-0", rpe: "7–8", rest: 60, notes: "Deep stretch at bottom, squeeze at top. Elbows soft.", alt: "Cable Chest Fly" }
        ]
      },
      {
        type: "superset", label: "Superset B",
        exercises: [
          { name: "Overhead Press (DB or BB)", sets: 3, repsTarget: "8–12", weight: 24, tempo: "3-1-1-0", rpe: "7–8", rest: 90, notes: "Core braced, slight forward lean. Drive through heels.", alt: "Seated DB Shoulder Press" },
          { name: "Chest-Supported DB Row", sets: 3, repsTarget: "10–14", weight: 22, tempo: "3-1-2-0", rpe: "7–8", rest: 90, notes: "Pull elbows to ceiling, squeeze mid-back at top.", alt: "Cable Row" }
        ]
      },
      {
        type: "superset", label: "Superset C",
        exercises: [
          { name: "Tricep Cable Pushdown (rope)", sets: 3, repsTarget: "12–15", weight: 20, tempo: "2-1-2-0", rpe: "8", rest: 45, notes: "Flare rope at bottom, elbows pinned to sides.", alt: "Overhead Tricep Extension" },
          { name: "EZ Bar Curl", sets: 3, repsTarget: "10–14", weight: 30, tempo: "3-1-1-0", rpe: "7–8", rest: 45, notes: "No swinging. Supinate at top.", alt: "DB Curl" }
        ]
      },
      {
        type: "core", label: "Core Block (end of session)",
        exercises: [
          { name: "Cable Crunch", sets: 3, repsTarget: "12–15", weight: 25, tempo: "3-1-1-0", rpe: "8", rest: 60, notes: "Fold at the abs, not the hips. Slow eccentric.", alt: "Decline Weighted Sit-up" },
          { name: "Pallof Press", sets: 3, repsTarget: "12 each", weight: 15, tempo: "2-2-2-0", rpe: "7", rest: 45, notes: "Anti-rotation. Brace hard. Tennis core carry-over.", alt: "Half-kneeling cable anti-rotation" },
          { name: "Hanging Leg Raise", sets: 3, repsTarget: "10–12", weight: 0, tempo: "3-1-2-0", rpe: "8", rest: 60, notes: "No swinging. Posterior pelvic tilt at top.", alt: "Decline leg raise" }
        ]
      }
    ]
  },

  Tue: {
    label: "Tuesday — Lower A",
    focus: "Posterior Chain · RDL / Hip Hinge / Single-Leg  ⚠️ Tennis tonight — no heavy quads",
    warmup: [
      "3 min rowing machine (moderate pace)",
      "Hip 90/90 switches × 8 each side",
      "Glute bridge march × 12",
      "Banded clamshells × 15 each side",
      "Single-leg RDL (bodyweight) × 8 each side",
      "Lateral band walks × 15 each direction"
    ],
    blocks: [
      {
        type: "standalone",
        exercises: [{
          name: "Romanian Deadlift (Barbell)",
          sets: 4, repsTarget: "8–10", weight: 80, tempo: "3-1-1-0",
          rpe: "7–8", rest: 120,
          notes: "Hinge at hip, soft knees. Bar slides down legs. Deep hamstring stretch. NO rounding.",
          alt: "DB Romanian Deadlift"
        }]
      },
      {
        type: "superset", label: "Superset A",
        exercises: [
          { name: "Bulgarian Split Squat (DB)", sets: 3, repsTarget: "10–12 each", weight: 20, tempo: "3-1-1-0", rpe: "7", rest: 75, notes: "Knee tracks toes. Torso upright. Back foot on bench.", alt: "Rear-foot elevated goblet squat" },
          { name: "Glute-Ham Raise / Nordic Curl", sets: 3, repsTarget: "6–10", weight: 0, tempo: "4-0-1-0", rpe: "8–9", rest: 75, notes: "Brutal hamstring eccentric. Use bands if needed. Critical for running.", alt: "Lying Leg Curl machine" }
        ]
      },
      {
        type: "superset", label: "Superset B",
        exercises: [
          { name: "Hip Thrust (Barbell / Machine)", sets: 3, repsTarget: "12–15", weight: 60, tempo: "2-1-2-0", rpe: "8", rest: 75, notes: "Drive through heels. Full hip extension. Squeeze glutes hard at top.", alt: "Cable pull-through" },
          { name: "Seated Leg Curl", sets: 3, repsTarget: "12–15", weight: 40, tempo: "3-1-2-0", rpe: "8", rest: 60, notes: "Full ROM. Don't let hips lift. Plantarflex foot at bottom.", alt: "Lying leg curl" }
        ]
      },
      {
        type: "standalone",
        exercises: [{
          name: "Farmer's Carry",
          sets: 3, repsTarget: "30–40m", weight: 28, tempo: "—",
          rpe: "7", rest: 90,
          notes: "Heavy DBs. Shoulders packed, core braced. Passive core. Tennis stability carry-over.",
          alt: "Suitcase carry (unilateral)"
        }]
      },
      {
        type: "core", label: "Core Block",
        exercises: [
          { name: "Cable Woodchop (high to low)", sets: 3, repsTarget: "12 each", weight: 12, tempo: "2-1-2-0", rpe: "7–8", rest: 45, notes: "Rotational power — direct tennis carry-over. Brace through rotation.", alt: "Med ball slam" },
          { name: "Side Plank Hip Dips", sets: 3, repsTarget: "15 each", weight: 0, tempo: "2-1-2-0", rpe: "7", rest: 45, notes: "Oblique hypertrophy without waist thickening. Full range.", alt: "Copenhagen plank" }
        ]
      }
    ]
  },

  Thu: {
    label: "Thursday — Upper B",
    focus: "Pull · Back Thickness / Lats / Rear Delts / Biceps",
    warmup: [
      "5 min bike or rowing (warm up lats + upper back)",
      "Band pull-aparts × 20",
      "Face pulls (cable) × 15 — light",
      "Scapular pull-ups × 8",
      "Doorframe pec stretch 30s each side",
      "Dead bug × 8 each side"
    ],
    blocks: [
      {
        type: "standalone",
        exercises: [{
          name: "Weighted Pull-Ups",
          sets: 5, repsTarget: "5–8", weight: 0, tempo: "3-1-1-0",
          rpe: "8–9", rest: 150,
          notes: "Full ROM — dead hang to chin over bar. Add weight once you can do 8 clean reps. KEY LIFT.",
          alt: "Lat Pulldown (wide grip)"
        }]
      },
      {
        type: "superset", label: "Superset A",
        exercises: [
          { name: "Pendlay Row / Barbell Row", sets: 4, repsTarget: "6–10", weight: 70, tempo: "2-0-1-0", rpe: "7–8", rest: 90, notes: "Hinge to 45°. Pull bar to sternum. Full dead stop each rep (Pendlay style).", alt: "Seated Cable Row (wide grip)" },
          { name: "Cable Lateral Raise", sets: 4, repsTarget: "12–15", weight: 8, tempo: "2-1-2-0", rpe: "8", rest: 60, notes: "2nd weekly lateral raise for V-taper. Slow and strict.", alt: "DB Lateral Raise" }
        ]
      },
      {
        type: "superset", label: "Superset B",
        exercises: [
          { name: "Single-Arm DB Row", sets: 3, repsTarget: "10–14 each", weight: 32, tempo: "3-1-1-0", rpe: "7–8", rest: 75, notes: "Elbow drives to ceiling. No rotation. Full stretch at bottom.", alt: "Chest-supported machine row" },
          { name: "Face Pull (cable, rope)", sets: 3, repsTarget: "15–20", weight: 15, tempo: "2-1-2-0", rpe: "7", rest: 45, notes: "Pull to forehead. External rotation at end. Rotator cuff prehab.", alt: "Band face pull" }
        ]
      },
      {
        type: "superset", label: "Superset C",
        exercises: [
          { name: "DB Hammer Curl", sets: 3, repsTarget: "10–14", weight: 16, tempo: "3-1-1-0", rpe: "7–8", rest: 45, notes: "Brachialis emphasis. Neutral grip. No swing.", alt: "Cable hammer curl" },
          { name: "Incline DB Curl", sets: 3, repsTarget: "10–14", weight: 14, tempo: "3-1-1-0", rpe: "7–8", rest: 45, notes: "Stretch bicep at bottom. Great long-head emphasis.", alt: "Preacher curl" }
        ]
      },
      {
        type: "core", label: "Core Block",
        exercises: [
          { name: "Cable Crunch", sets: 3, repsTarget: "12–15", weight: 25, tempo: "3-1-1-0", rpe: "8", rest: 60, notes: "Fold at abs. Slow eccentric. Upper ab focus.", alt: "Decline sit-up" },
          { name: "Hollow Hold", sets: 3, repsTarget: "30–45s", weight: 0, tempo: "hold", rpe: "7–8", rest: 60, notes: "Lower back pressed flat. Arms overhead or by hips. Passive core.", alt: "Dead bug" },
          { name: "Pallof Press", sets: 3, repsTarget: "12 each", weight: 15, tempo: "2-2-2-0", rpe: "7", rest: 45, notes: "Anti-rotation. Tennis rotational stability.", alt: "Tall-kneeling anti-rotation" }
        ]
      }
    ]
  },

  Fri: {
    label: "Friday — Lower B",
    focus: "Glutes / Hams / Single-Leg  ⚠️ Sat tennis comp — moderate load only",
    warmup: [
      "5 min walk or light bike",
      "Hip flexor stretch 45s each side",
      "Glute bridge activation × 15",
      "Cossack squat × 6 each side",
      "Banded hip abduction × 15 each",
      "Ankle circles + calf raises × 20"
    ],
    blocks: [
      {
        type: "standalone",
        exercises: [{
          name: "Goblet Squat (DB or KB)",
          sets: 3, repsTarget: "10–12", weight: 32, tempo: "3-1-1-0",
          rpe: "6–7", rest: 90,
          notes: "Moderate load — knee-friendly. Chest tall, heels rooted. Good ankle mobility work.",
          alt: "Leg Press (high foot position)"
        }]
      },
      {
        type: "superset", label: "Superset A",
        exercises: [
          { name: "Romanian Deadlift (DB)", sets: 3, repsTarget: "10–12", weight: 32, tempo: "3-1-1-0", rpe: "7", rest: 75, notes: "Lighter than Tuesday's barbell RDL. Hamstring stimulus without heavy CNS load.", alt: "45° back extension" },
          { name: "Step-Up (DB)", sets: 3, repsTarget: "10–12 each", weight: 18, tempo: "2-1-2-0", rpe: "7", rest: 60, notes: "Drive through heel of front foot. Do NOT push off back foot. Glute dominance.", alt: "Reverse lunge" }
        ]
      },
      {
        type: "superset", label: "Superset B",
        exercises: [
          { name: "Cable Pull-Through", sets: 3, repsTarget: "15–18", weight: 25, tempo: "3-1-2-0", rpe: "7", rest: 60, notes: "Hip hinge pattern. Squeeze glutes hard at top. Running mechanics carry-over.", alt: "KB swing" },
          { name: "Leg Press Calf Raise", sets: 3, repsTarget: "15–20", weight: 80, tempo: "2-1-3-0", rpe: "7–8", rest: 45, notes: "Full plantarflexion + full dorsiflexion. Running / tennis ankle health.", alt: "Standing calf raise" }
        ]
      },
      {
        type: "standalone",
        exercises: [{
          name: "Hip Abduction Machine",
          sets: 3, repsTarget: "15–20", weight: 45, tempo: "2-1-2-0",
          rpe: "7", rest: 60,
          notes: "Glute medius — critical for tennis lateral movement and running gait.",
          alt: "Banded side-lying hip abduction"
        }]
      },
      {
        type: "core", label: "Core Block",
        exercises: [
          { name: "Hanging Leg Raise", sets: 3, repsTarget: "10–12", weight: 0, tempo: "3-1-2-0", rpe: "8", rest: 60, notes: "Hip flexor + ab strength. Running posture benefit.", alt: "Decline leg raise" },
          { name: "Cable Woodchop (low to high)", sets: 3, repsTarget: "12 each", weight: 12, tempo: "2-1-2-0", rpe: "7–8", rest: 45, notes: "Upward diagonal rotation — tennis serve power.", alt: "DB woodchop" }
        ]
      }
    ]
  }
};

const DAYS = ["Mon","Tue","Thu","Fri"];

const PLAN_PROGRESSIONS = {
  Mon: [
    // wk: 1-12 [incline bench, cable lateral, OHP, row, pull-up equivalent]
    // Format: [bench_w, lateral_w, ohp_w, row_w, pullup_bw]
    [60,8,24,22,0],[62,8,25,23,0],[65,9,26,24,2.5],[67,9,27,25,2.5],[70,10,28,26,5],[42,6,17,15,0],
    [72,10,29,27,5],[75,10,30,28,7.5],[77,11,31,29,7.5],[80,11,32,30,10],[82,12,33,31,10],[50,7,20,18,0]
  ],
  Tue: [
    [80,20,60,28,0],[82,21,62,28,0],[85,22,65,30,0],[87,22,67,30,0],[90,23,70,32,0],[55,14,42,20,0],
    [92,24,72,32,0],[95,24,75,34,0],[97,25,77,34,0],[100,26,80,36,0],[102,26,82,36,0],[62,16,50,22,0]
  ],
  Thu: [
    [70,8,32,15,16],[72,8,34,15,17],[75,9,36,16,18],[77,9,38,16,19],[80,10,40,17,20],[48,6,24,10,12],
    [82,10,40,17,22],[85,10,42,18,24],[87,11,44,18,26],[90,11,46,19,28],[92,12,48,19,30],[56,7,29,11,18]
  ],
  Fri: [
    [32,32,25,18,45],[33,33,26,18,47],[34,34,27,19,49],[35,35,27,19,51],[36,36,28,20,53],[22,22,17,12,32],
    [37,37,29,20,55],[38,38,29,21,57],[40,40,30,21,59],[41,41,31,22,61],[42,42,32,22,63],[25,25,19,13,38]
  ]
};

const LIFT_KEYS = ["Bench Press","Pull-Up (E1RM)","Barbell Row","OHP","RDL","Hip Thrust"];
const LIFT_TARGETS = {
  "Bench Press":     [62,64,67,69,72,43,74,77,79,82,84,51],
  "Pull-Up (E1RM)":  [80,82,84,86,89,55,91,94,96,99,102,61],
  "Barbell Row":     [72,74,77,79,82,49,84,87,89,92,94,57],
  "OHP":             [45,46,48,49,51,31,52,54,55,57,58,35],
  "RDL":             [82,84,87,90,93,57,95,98,101,104,107,64],
  "Hip Thrust":      [62,64,67,69,72,43,74,77,79,82,84,51]
};

const SCHEDULE_DAYS = [
  { day:"Mon", label:"Monday", type:"gym", typeClass:"gym", session:"Upper A", notes:"Push · Chest / Shoulders / Triceps\n60–70 min session" },
  { day:"Tue", label:"Tuesday", type:"gym+tennis", typeClass:"tennis", session:"Lower A + Tennis", notes:"Morning: Lower A (posterior chain)\nEvening: Tennis comp night\n⚠️ NO heavy quads" },
  { day:"Wed", label:"Wednesday", type:"run/rest", typeClass:"run", session:"Zone 2 Run or Rest", notes:"≤140 bpm, 30–50 min\nOr full rest + mobility\nActive recovery" },
  { day:"Thu", label:"Thursday", type:"gym", typeClass:"gym", session:"Upper B", notes:"Pull · Back / Biceps / Rear Delts\n60–70 min session" },
  { day:"Fri", label:"Friday", type:"gym", typeClass:"gym", session:"Lower B", notes:"Moderate load only\n⚠️ Sat tennis comp tomorrow\nGlutes / Hams focus" },
  { day:"Sat", label:"Saturday", type:"tennis", typeClass:"tennis", session:"Tennis Comp Day", notes:"2 × 2-set doubles matches\nNo gym — competition day\nEat well, hydrate" },
  { day:"Sun", label:"Sunday", type:"rest", typeClass:"rest", session:"Rest & Recovery", notes:"Full rest or light walk\nMobility / foam rolling\nMeal prep for the week" }
];

/** Completed gym-day progress for a program week (Mon / Tue / Thu / Fri). */
function getWeekGymProgress(week) {
  const completedDays = new Set(
    state.sessions
      .filter(s => s.completed && s.week === week && DAYS.includes(s.day))
      .map(s => s.day),
  );
  const missingDays = DAYS.filter(d => !completedDays.has(d));
  return {
    week,
    total: DAYS.length,
    completedCount: completedDays.size,
    isComplete: missingDays.length === 0,
    completedDays,
    missingDays,
  };
}

function renderWeekCompleteBanner(el, progress) {
  if (!el) return;
  if (progress.isComplete) {
    el.classList.remove('hidden');
    el.classList.add('is-complete');
    el.innerHTML = `
      <h3>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Week ${progress.week} complete
      </h3>
      <p>All <strong>${progress.total} gym sessions</strong> logged (Mon · Tue · Thu · Fri). Great consistency.</p>`;
    return;
  }
  el.classList.remove('is-complete');
  if (progress.completedCount > 0) {
    el.classList.remove('hidden');
    el.innerHTML = `
      <p><strong>${progress.completedCount} of ${progress.total}</strong> gym days this week
      · Still to go: <strong>${progress.missingDays.join(', ')}</strong></p>`;
    return;
  }
  el.classList.add('hidden');
  el.innerHTML = '';
}
