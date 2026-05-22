/** @file Application state and storage keys. */
/* ═══════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════ */
let state = {
  currentWeek: 1,
  currentDay: "Mon",
  sessions: [],
  progressChart: null,
  dashVolumeChart: null,
  dashE1rmChart: null,
  planWeek: 1,
  progressLift: "Bench Press",
  prefs: { units: 'kg', timerVibrate: true, timerNotify: true }
};

const REST_PREFS_KEY = 'liftos_rest_v1';
const PREFS_KEY = 'liftos_prefs_v1';

let API_BASE = '';
let apiOnline = false;
let apiReady = false;
let activeApiSessionId = null;
const DAY_KEY_MAP = { Mon: 'mon', Tue: 'tue', Thu: 'thu', Fri: 'fri' };
const DAY_KEY_REV = { mon: 'Mon', tue: 'Tue', thu: 'Thu', fri: 'Fri' };
const LOCAL_STORAGE_KEY = 'liftos_state_v1';
const FALLBACK_API_URL = 'https://pydkmtdqli.execute-api.ap-southeast-2.amazonaws.com/prod';
const AUTH_STORAGE_KEY = 'liftos_auth_v1';
var cognitoConfig = null;

let timerState = { active: false, duration: 90, exercise: '', endAt: 0, interval: null, afterRestSid: null };
let timerPageTimeout = null;

/** Session date for display (dd/mm/yy). Accepts ISO yyyy-mm-dd or existing slash dates. */
function formatDisplayDate(dateStr) {
  if (!dateStr) return '—';
  const raw = String(dateStr).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1].slice(-2)}`;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(raw);
  if (slash) {
    const yy = slash[3].length === 4 ? slash[3].slice(-2) : slash[3];
    return `${String(slash[1]).padStart(2, '0')}/${String(slash[2]).padStart(2, '0')}/${yy}`;
  }
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  }
  return raw;
}

