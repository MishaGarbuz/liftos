/** @file Settings page — appearance, units, timer prefs, account. */
function renderSettingsPage() {
  if (typeof syncSettingsUi === 'function') syncSettingsUi();
}

function initSettingsPage() {
  document.querySelectorAll('[data-theme-pref]').forEach((el) => {
    if (el.dataset.themeBound) return;
    el.dataset.themeBound = '1';
    el.addEventListener('click', () => {
      if (typeof setAppTheme === 'function') setAppTheme(el.dataset.themePref);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettingsPage);
} else {
  initSettingsPage();
}
