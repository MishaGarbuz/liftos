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

let timerState = { active: false, duration: 90, exercise: '', endAt: 0, interval: null };
let timerPageTimeout = null;

