/** @file Application bootstrap and DOM ready handler. */
/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  bindMobileViewport();
  const ph = document.getElementById('passwordHint');
  if (ph) ph.textContent = PASSWORD_HINT;
  const rh = document.getElementById('resetPasswordHint');
  if (rh) rh.textContent = PASSWORD_HINT;
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('forgotPasswordLink')?.addEventListener('click', showResetPanel);
  document.getElementById('backToLoginLink')?.addEventListener('click', showLoginPanel);
  document.getElementById('resetBtn')?.addEventListener('click', handleResetPassword);
  loadPrefs();
  if (typeof initTheme === 'function') initTheme();
  window.addEventListener('auxos-theme-change', () => {
    if (document.getElementById('page-dashboard')?.classList.contains('active') && typeof renderDashboard === 'function') renderDashboard();
    if (document.getElementById('page-progress')?.classList.contains('active') && typeof renderProgressPage === 'function') renderProgressPage();
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  window.addEventListener('online', async () => {
    if (!getIdToken()) return;
    try {
      await apiCall('GET', '/summary');
      apiOnline = true;
      await flushSyncQueue();
      setSyncStatus('connected', 'Synced');
    } catch { /* still offline */ }
  });
  await loadAppConfig();
  const stored = loadAuthTokens();
  if (stored?.idToken) {
    try {
      await ensureIdToken();
      hideAuthGate();
      await bootApp();
      return;
    } catch {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }
  showAuthGate();
});
