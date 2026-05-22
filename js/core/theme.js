/**
 * @file Appearance: palette (ember/forge), dark/light/auto, logos, chart accents.
 */
(function (global) {
  const PREFS_KEY = 'liftos_prefs_v1';
  const SCHEDULE_DARK_START = 19;
  const SCHEDULE_DARK_END = 7;
  const DEFAULT_PALETTE = 'ember';

  const PALETTES = {
    ember: {
      logos: {
        dark: '/brand/logos/auxos-05-pulse-ember.svg',
        light: '/brand/logos/auxos-05-pulse-ember-light.svg',
      },
      chart: {
        dark: {
          accent: '#ff5c35',
          accentFill: 'rgba(255,92,53,0.12)',
          targetLine: 'rgba(255,92,53,0.35)',
          volumeBar: 'rgba(255,92,53,0.55)',
        },
        light: {
          accent: '#ff5c35',
          accentFill: 'rgba(255,92,53,0.14)',
          targetLine: 'rgba(255,92,53,0.4)',
          volumeBar: 'rgba(255,92,53,0.5)',
        },
      },
    },
    forge: {
      logos: {
        dark: '/brand/logos/auxos-05-pulse-forge.svg',
        light: '/brand/logos/auxos-05-pulse-forge-light.svg',
      },
      chart: {
        dark: {
          accent: '#f59e0b',
          accentFill: 'rgba(245,158,11,0.12)',
          targetLine: 'rgba(245,158,11,0.35)',
          volumeBar: 'rgba(245,158,11,0.55)',
        },
        light: {
          accent: '#f59e0b',
          accentFill: 'rgba(245,158,11,0.14)',
          targetLine: 'rgba(245,158,11,0.4)',
          volumeBar: 'rgba(245,158,11,0.5)',
        },
      },
    },
  };

  const META_THEME = { dark: '#0b0f1a', light: '#f0f4f8' };

  function readStoredPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function getPaletteId() {
    const id = typeof state !== 'undefined' ? state.prefs?.palette : readStoredPrefs().palette;
    return PALETTES[id] ? id : DEFAULT_PALETTE;
  }

  function resolveTheme(pref) {
    const mode = pref || 'auto';
    if (mode === 'dark' || mode === 'light') return mode;
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    }
    const h = new Date().getHours();
    return h >= SCHEDULE_DARK_START || h < SCHEDULE_DARK_END ? 'dark' : 'light';
  }

  function updateAuthLogo(theme, paletteId) {
    const authLogo = document.getElementById('authLogo');
    if (!authLogo) return;
    const set = PALETTES[paletteId]?.logos || PALETTES[DEFAULT_PALETTE].logos;
    authLogo.src = set[theme] || set.dark;
  }

  function dispatchAppearanceChange(theme, paletteId) {
    global.dispatchEvent(new CustomEvent('auxos-theme-change', {
      detail: { theme, palette: paletteId },
    }));
  }

  function applyPalette(paletteId) {
    const id = PALETTES[paletteId] ? paletteId : DEFAULT_PALETTE;
    document.documentElement.setAttribute('data-palette', id);
    return id;
  }

  function applyTheme(resolved, paletteId) {
    const theme = resolved === 'light' ? 'light' : 'dark';
    const palette = applyPalette(paletteId || getPaletteId());
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', META_THEME[theme]);
    const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (apple) apple.setAttribute('content', theme === 'light' ? 'default' : 'black');
    updateAuthLogo(theme, palette);
    dispatchAppearanceChange(theme, palette);
  }

  function getAppliedTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    return t === 'light' ? 'light' : 'dark';
  }

  function getChartColors() {
    const palette = PALETTES[getPaletteId()] || PALETTES[DEFAULT_PALETTE];
    return palette.chart[getAppliedTheme()];
  }

  function getChartUiColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      tick: style.getPropertyValue('--text-muted').trim() || '#8892a4',
      grid: style.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.05)',
      tooltipBg: style.getPropertyValue('--surface-2').trim() || '#1a2235',
      tooltipTitle: style.getPropertyValue('--text').trim() || '#e8eaf0',
      tooltipBody: style.getPropertyValue('--text-muted').trim() || '#8892a4',
    };
  }

  function applyAppearanceFromPrefs() {
    const stored = readStoredPrefs();
    const themePref = typeof state !== 'undefined' && state.prefs?.theme
      ? state.prefs.theme
      : stored.theme;
    const palettePref = typeof state !== 'undefined' && state.prefs?.palette
      ? state.prefs.palette
      : stored.palette;
    applyTheme(resolveTheme(themePref || 'auto'), palettePref || DEFAULT_PALETTE);
  }

  function syncSettingsUi() {
    const pref = typeof state !== 'undefined' && state.prefs?.theme
      ? state.prefs.theme
      : readStoredPrefs().theme || 'auto';
    const palette = getPaletteId();
    document.querySelectorAll('[data-theme-pref]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.themePref === (pref || 'auto'));
    });
    const ps = document.getElementById('paletteSelect');
    if (ps) ps.value = palette;
    const us = document.getElementById('unitSelect');
    if (us && typeof state !== 'undefined') us.value = state.prefs?.units || 'kg';
    const tv = document.getElementById('timerVibrate');
    if (tv && typeof state !== 'undefined') tv.checked = state.prefs?.timerVibrate !== false;
    const tn = document.getElementById('timerNotify');
    if (tn && typeof state !== 'undefined') tn.checked = state.prefs?.timerNotify !== false;
  }

  function setAppTheme(mode) {
    const themeMode = mode === 'dark' || mode === 'light' ? mode : 'auto';
    if (typeof state !== 'undefined') {
      state.prefs = state.prefs || {};
      state.prefs.theme = themeMode;
      if (typeof savePrefs === 'function') savePrefs();
    } else {
      try {
        const data = readStoredPrefs();
        data.theme = themeMode;
        localStorage.setItem(PREFS_KEY, JSON.stringify(data));
      } catch { /* ignore */ }
    }
    applyTheme(resolveTheme(themeMode), getPaletteId());
    syncSettingsUi();
  }

  function setAppPalette(id) {
    const palette = PALETTES[id] ? id : DEFAULT_PALETTE;
    if (typeof state !== 'undefined') {
      state.prefs = state.prefs || {};
      state.prefs.palette = palette;
      if (typeof savePrefs === 'function') savePrefs();
    } else {
      try {
        const data = readStoredPrefs();
        data.palette = palette;
        localStorage.setItem(PREFS_KEY, JSON.stringify(data));
      } catch { /* ignore */ }
    }
    const themePref = typeof state !== 'undefined' ? state.prefs?.theme : readStoredPrefs().theme;
    applyTheme(resolveTheme(themePref || 'auto'), palette);
    syncSettingsUi();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderProgressPage === 'function') renderProgressPage();
  }

  let scheduleTimer = null;

  function bindThemeListeners() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const pref = typeof state !== 'undefined' ? state.prefs?.theme : readStoredPrefs().theme;
      if ((pref || 'auto') === 'auto') applyAppearanceFromPrefs();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);

    if (scheduleTimer) clearInterval(scheduleTimer);
    scheduleTimer = setInterval(() => {
      const pref = typeof state !== 'undefined' ? state.prefs?.theme : readStoredPrefs().theme;
      if ((pref || 'auto') === 'auto' && !mq.matches && !window.matchMedia('(prefers-color-scheme: light)').matches) {
        applyAppearanceFromPrefs();
      }
    }, 60000);
  }

  function initTheme() {
    applyAppearanceFromPrefs();
    bindThemeListeners();
    syncSettingsUi();
  }

  global.resolveTheme = resolveTheme;
  global.applyTheme = applyTheme;
  global.applyAppearanceFromPrefs = applyAppearanceFromPrefs;
  global.applyThemeFromPrefs = applyAppearanceFromPrefs;
  global.setAppTheme = setAppTheme;
  global.setAppPalette = setAppPalette;
  global.syncSettingsUi = syncSettingsUi;
  global.getChartColors = getChartColors;
  global.getChartUiColors = getChartUiColors;
  global.initTheme = initTheme;
})(typeof window !== 'undefined' ? window : globalThis);
