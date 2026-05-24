/** @file Abhi Arunachalam — 12-week 3-day program (Mon / Wed / Fri). */
const ABHI_PROGRAM_DAYS = {
  Mon: {
    label: "Monday — Day A",
    focus: "Horizontal Push + Vertical Pull · Chest / Lats / Triceps / Core",
    warmup: [
      "Arm circles (forward + back) — 10 each direction",
      "Hip circle rotations — 10 each direction",
      "Bodyweight squat (slow, deep) — 10 reps",
      "Band pull-aparts or shoulder dislocations — 15 reps",
      "Cat-cow + thoracic rotation — 8 reps each",
      "90/90 hip stretch — 30 sec each side",
    ],
    blocks: [
      {
        type: "superset", label: "Superset A",
        tier: "primary",
        exercises: [
          {
            name: "Flat Dumbbell Bench Press",
            sets: 3, repsTarget: "8–12", weight: 17.5, tempo: "3-1-1-0", rpe: "7–8", rest: 0,
            notes: "Elbows at 45°, full ROM, touch chest. Don't flare elbows.",
            alt: "Smith Machine Bench Press / Cable Chest Press / Chest Press Machine",
          },
          {
            name: "Lat Pulldown (wide overhand)",
            sets: 3, repsTarget: "10–12", weight: 45, tempo: "3-1-1-0", rpe: "7–8", rest: 55,
            notes: "Pull to upper chest, squeeze lats. Don't lean back excessively.",
            alt: "Seated Cable Row (wide) / Assisted Pull-Up / Single-Arm DB Row",
          },
        ],
      },
      {
        type: "superset", label: "Superset B",
        tier: "secondary",
        exercises: [
          {
            name: "Incline Dumbbell Press",
            sets: 3, repsTarget: "10–12", weight: 14, tempo: "3-1-1-0", rpe: "7", rest: 0,
            notes: "Bench 30–45°. Upper chest focus.",
            alt: "Incline Chest Press Machine / Landmine Press / DB Floor Press",
          },
          {
            name: "Doorway / Cable Chest Stretch",
            sets: 3, repsTarget: "30s", weight: 0, tempo: "hold", rpe: "—", rest: 45,
            notes: "Passive chest opener. Deep inhale, relax into stretch.",
            alt: "Foam roller thoracic extension / Band overhead stretch",
          },
        ],
      },
      {
        type: "superset", label: "Superset C",
        tier: "secondary",
        exercises: [
          {
            name: "Cable Tricep Pushdown (rope)",
            sets: 3, repsTarget: "10–12", weight: 17.5, tempo: "2-1-2-0", rpe: "7", rest: 0,
            notes: "Split hands at bottom, elbows fixed.",
            alt: "DB Overhead Tricep Extension / Skull Crusher / Tricep Dip Machine",
          },
          {
            name: "Face Pull (cable, rope)",
            sets: 3, repsTarget: "12–15", weight: 12, tempo: "2-1-2-0", rpe: "6", rest: 50,
            notes: "Pull to forehead, external rotation at end.",
            alt: "DB rear delt fly / Band pull-aparts / Reverse fly",
          },
        ],
      },
      {
        type: "core", label: "Core Finisher",
        tier: "core",
        exercises: [
          {
            name: "Dead Bug",
            sets: 3, repsTarget: "8 each", weight: 0, tempo: "controlled", rpe: "7", rest: 45,
            notes: "Lower back flat on floor. Anti-extension.",
            alt: "Bird Dog",
          },
          {
            name: "Plank (standard or forearm)",
            sets: 3, repsTarget: "25s", weight: 0, tempo: "hold", rpe: "7", rest: 45,
            notes: "Neutral spine, squeeze glutes + quads. Build toward 45s.",
            alt: "Hollow Body Hold",
          },
        ],
      },
    ],
  },

  Wed: {
    label: "Wednesday — Day B",
    focus: "Squat Pattern + Horizontal Pull · Quads / Glutes / Back / Biceps",
    warmup: [
      "Arm circles — 10 each direction",
      "Hip circle rotations — 10 each direction",
      "Bodyweight squat — 10 reps",
      "Band pull-aparts — 15 reps",
      "Cat-cow + thoracic rotation — 8 each",
      "90/90 hip stretch — 30 sec each side",
    ],
    blocks: [
      {
        type: "superset", label: "Superset A",
        tier: "primary",
        exercises: [
          {
            name: "Goblet Squat",
            sets: 3, repsTarget: "10–12", weight: 18, tempo: "3-1-1-0", rpe: "7–8", rest: 0,
            notes: "DB at chest. Knees track toes. Full depth, control over load.",
            alt: "Leg Press / Hack Squat / DB Split Squat",
          },
          {
            name: "Seated Cable Row (close grip)",
            sets: 3, repsTarget: "10–12", weight: 40, tempo: "3-1-2-0", rpe: "7–8", rest: 55,
            notes: "Drive elbows back, squeeze mid-back. No momentum.",
            alt: "Chest-Supported Row / Single-arm DB row / Bent-over row (light)",
          },
        ],
      },
      {
        type: "superset", label: "Superset B",
        tier: "secondary",
        exercises: [
          {
            name: "Dumbbell Romanian Deadlift",
            sets: 3, repsTarget: "10–12", weight: 12.5, tempo: "3-1-1-0", rpe: "6–7", rest: 0,
            notes: "Hinge at hips, DBs along shins. Form over load — start light.",
            alt: "Single-Leg RDL / Lying Leg Curl / Stability ball curl",
          },
          {
            name: "Kneeling Hip Flexor Stretch",
            sets: 3, repsTarget: "30s each", weight: 0, tempo: "hold", rpe: "—", rest: 45,
            notes: "Lunge position, squeeze glute of rear leg.",
            alt: "Pigeon pose / 90/90 hip stretch / Standing quad stretch",
          },
        ],
      },
      {
        type: "superset", label: "Superset C",
        tier: "secondary",
        exercises: [
          {
            name: "Leg Extension Machine",
            sets: 3, repsTarget: "12–15", weight: 25, tempo: "2-1-2-0", rpe: "6–7", rest: 0,
            notes: "Full extension, controlled eccentric.",
            alt: "Bulgarian Split Squat (light) / Step-Up / Wall Sit",
          },
          {
            name: "Dumbbell Bicep Curl",
            sets: 3, repsTarget: "10–12", weight: 12, tempo: "2-1-2-0", rpe: "7", rest: 50,
            notes: "Supinate at top, no swinging.",
            alt: "Cable Curl / Hammer Curl / Incline DB Curl",
          },
        ],
      },
      {
        type: "core", label: "Core Finisher",
        tier: "core",
        exercises: [
          {
            name: "Hollow Body Hold",
            sets: 3, repsTarget: "18s", weight: 0, tempo: "hold", rpe: "7–8", rest: 45,
            notes: "Lower back pressed flat. Progress toward 30s.",
            alt: "Dead Bug",
          },
          {
            name: "Glute Bridge",
            sets: 3, repsTarget: "12", weight: 0, tempo: "2-1-2-0", rpe: "7", rest: 45,
            notes: "Squeeze glutes at top.",
            alt: "Hip thrust (bodyweight)",
          },
        ],
      },
    ],
  },

  Fri: {
    label: "Friday — Day C",
    focus: "Vertical Push + Hip Hinge + Arms · Shoulders / Posterior chain / Core",
    warmup: [
      "Arm circles — 10 each direction",
      "Hip circle rotations — 10 each direction",
      "Bodyweight squat — 10 reps",
      "Band pull-aparts — 15 reps",
      "Cat-cow + thoracic rotation — 8 each",
      "90/90 hip stretch — 30 sec each side",
    ],
    blocks: [
      {
        type: "superset", label: "Superset A",
        tier: "primary",
        exercises: [
          {
            name: "Dumbbell Shoulder Press (seated)",
            sets: 3, repsTarget: "8–12", weight: 14, tempo: "3-1-1-0", rpe: "7–8", rest: 0,
            notes: "Full extension overhead. Don't arch lower back.",
            alt: "Machine Shoulder Press / Landmine Press",
          },
          {
            name: "Band Pull-Apart",
            sets: 3, repsTarget: "15", weight: 0, tempo: "2-0-2-0", rpe: "6", rest: 55,
            notes: "Arms straight, shoulder health / push-pull balance.",
            alt: "Rear Delt Cable Fly / Face Pull / Prone Y-raise",
          },
        ],
      },
      {
        type: "superset", label: "Superset B",
        tier: "secondary",
        exercises: [
          {
            name: "Dumbbell Lateral Raise",
            sets: 3, repsTarget: "12–15", weight: 7, tempo: "2-1-2-0", rpe: "6–7", rest: 0,
            notes: "Lead with elbows, stop at shoulder height. Light weight.",
            alt: "Cable Lateral Raise / Lateral Raise Machine",
          },
          {
            name: "Child's Pose / Lat Stretch",
            sets: 3, repsTarget: "30s", weight: 0, tempo: "hold", rpe: "—", rest: 45,
            notes: "Breathe into stretch between sets.",
            alt: "Overhead lat stretch / Thread-the-needle",
          },
        ],
      },
      {
        type: "superset", label: "Superset C",
        tier: "secondary",
        exercises: [
          {
            name: "Single-Arm Cable Row",
            sets: 3, repsTarget: "10–12 each", weight: 20, tempo: "3-1-2-0", rpe: "7", rest: 0,
            notes: "Drive elbow back, brief pause at end range.",
            alt: "Seated Cable Row (underhand) / Assisted Pull-Up",
          },
          {
            name: "Push-Up",
            sets: 3, repsTarget: "10–15", weight: 0, tempo: "2-1-1-0", rpe: "7", rest: 50,
            notes: "Elbows 45°. Scale incline on bench if needed.",
            alt: "Assisted Dip / Diamond Push-Up / Cable Chest Press",
          },
        ],
      },
      {
        type: "core", label: "Core Finisher",
        tier: "core",
        exercises: [
          {
            name: "Dead Bug",
            sets: 3, repsTarget: "8 each", weight: 0, tempo: "controlled", rpe: "7", rest: 45,
            notes: "Anti-extension. Lower back stays flat.",
            alt: "Bird Dog",
          },
          {
            name: "Side Plank",
            sets: 2, repsTarget: "20s each", weight: 0, tempo: "hold", rpe: "7", rest: 45,
            notes: "Elbow under shoulder. Don't let hips sag.",
            alt: "Hollow Hold / Plank with hip tap",
          },
        ],
      },
    ],
  },
};

const ABHI_PROGRAM_BUNDLE = {
  id: "abhi",
  displayName: "Abhi Arunachalam",
  email: "abhi.ar@hotmail.com",
  programStartDate: "2026-05-25",
  gymDays: ["Mon", "Wed", "Fri"],
  deloadWeeks: [4, 8],
  gymDayLabel: "Mon · Wed · Fri",
  phaseLabel(week) {
    if ([4, 8].includes(week)) return "Deload";
    if (week <= 4) return "Phase 1";
    if (week <= 8) return "Phase 2";
    return "Phase 3";
  },
  pageCopy: {
    planSubtitle: "12-week plan — Phase 1 (Wks 1–4) · Phase 2 (Wks 5–8) · Phase 3 (Wks 9–12)",
    scheduleSubtitle: "Mon / Wed / Fri gym days · rest and mobility between sessions",
    scheduleNotesHtml: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px;color:var(--text-muted);line-height:1.7">
        <div>
          <div style="font-weight:700;color:var(--text);margin-bottom:6px">Scheduling Rules</div>
          <ul style="list-style:none;padding:0">
            <li>• Monday — Day A (horizontal push + vertical pull)</li>
            <li>• Tuesday — Rest / optional hip mobility + walk</li>
            <li>• Wednesday — Day B (squat pattern + horizontal pull)</li>
            <li>• Thursday — Rest</li>
            <li>• Friday — Day C (vertical push + hinge + arms)</li>
            <li>• Saturday — Rest or light activity</li>
            <li>• Sunday — Rest</li>
            <li>• Any 3 non-consecutive days work; never 3 days in a row</li>
          </ul>
        </div>
        <div>
          <div style="font-weight:700;color:var(--text);margin-bottom:6px">Progression</div>
          <ul style="list-style:none;padding:0">
            <li>• Double progression: add reps, then load (+2.5–5 kg)</li>
            <li>• Week 1 baselines; week 2+ targets use your logged weights</li>
            <li>• Deload weeks 4 and 8: 2 sets, ~10–15% lighter</li>
            <li>• Sessions ~45–50 min (warm-up + 3 supersets + core)</li>
          </ul>
        </div>
      </div>`,
  },
  days: ABHI_PROGRAM_DAYS,
  planProgressions: null,
  scheduleDays: [
    { day: "Mon", label: "Monday", type: "gym", typeClass: "gym", session: "Day A", notes: "Horizontal push + vertical pull\n~45 min session" },
    { day: "Tue", label: "Tuesday", type: "rest", typeClass: "rest", session: "Rest / mobility", notes: "Optional 10-min hip mobility\nWalk if you like" },
    { day: "Wed", label: "Wednesday", type: "gym", typeClass: "gym", session: "Day B", notes: "Squat pattern + horizontal pull\n~45 min session" },
    { day: "Thu", label: "Thursday", type: "rest", typeClass: "rest", session: "Rest", notes: "Recovery day" },
    { day: "Fri", label: "Friday", type: "gym", typeClass: "gym", session: "Day C", notes: "Vertical push + hinge + arms\n~45 min session" },
    { day: "Sat", label: "Saturday", type: "rest", typeClass: "rest", session: "Light activity", notes: "Rest or light walk / sport" },
    { day: "Sun", label: "Sunday", type: "rest", typeClass: "rest", session: "Rest", notes: "Full rest" },
  ],
  liftKeys: [
    "Flat Dumbbell Bench Press",
    "Goblet Squat",
    "Dumbbell Shoulder Press",
    "Lat Pulldown (wide overhand)",
    "Dumbbell Romanian Deadlift",
  ],
  liftTargets: {
    "Flat Dumbbell Bench Press": [17.5, 17.5, 17.5, 12, 20, 20, 20, 12, 22.5, 22.5, 22.5, 12],
    "Goblet Squat": [18, 18, 18, 12, 20, 20, 20, 12, 22, 22, 22, 12],
    "Dumbbell Shoulder Press (seated)": [14, 14, 14, 10, 16, 16, 16, 10, 18, 18, 18, 10],
    "Lat Pulldown (wide overhand)": [45, 45, 45, 30, 50, 50, 50, 30, 55, 55, 55, 30],
    "Dumbbell Romanian Deadlift": [12.5, 12.5, 12.5, 8, 14, 14, 14, 8, 16, 16, 16, 8],
  },
  setsForWeek(tier, week) {
    const deload = [4, 8].includes(week);
    if (deload) return 2;
    if (tier === "core") return week <= 4 ? 3 : 3;
    if (tier === "primary") {
      if (week <= 4) return week === 4 ? 2 : 3;
      if (week <= 8) return week === 8 ? 2 : 4;
      return 4;
    }
    return 3;
  },
};
