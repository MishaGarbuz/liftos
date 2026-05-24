/** @file Settings page — appearance, units, timer prefs, account, admin preview. */
function renderSettingsPage() {
  if (typeof syncSettingsUi === 'function') syncSettingsUi();
  renderAdminProgramPreviewSection();
}

function renderAdminProgramPreviewSection() {
  const host = document.querySelector('#page-settings .settings-stack');
  if (!host) return;

  const jwtEmail = typeof getIdTokenEmail === 'function' ? getIdTokenEmail() : null;
  const isAdmin = typeof isAppAdmin === 'function' && isAppAdmin(jwtEmail);
  let section = document.getElementById('adminPreviewSection');

  if (!isAdmin) {
    section?.remove();
    return;
  }

  if (!section) {
    section = document.createElement('section');
    section.id = 'adminPreviewSection';
    section.className = 'card settings-group';
    const account = host.querySelector('.settings-group:last-of-type');
    if (account) host.insertBefore(section, account);
    else host.appendChild(section);
  }

  const athletes = typeof getPreviewableAthletes === 'function' ? getPreviewableAthletes() : [];
  const activePreview = typeof getPreviewProgramEmail === 'function' ? getPreviewProgramEmail(jwtEmail) : null;
  const options = athletes.map((a) => {
    const selected = activePreview === a.email ? ' selected' : '';
    return `<option value="${a.programId}"${selected}>${a.name}</option>`;
  }).join('');

  section.innerHTML = `
    <h3 class="settings-group-title">Admin — program preview</h3>
    <p class="settings-hint">Requires Cognito <strong>admins</strong> group on your account. Your workout data stays on your account; only the program template changes.</p>
    <div class="settings-field">
      <label class="settings-label" for="adminPreviewSelect">Athlete program</label>
      <select id="adminPreviewSelect" class="settings-select">${options}</select>
    </div>
    <div class="settings-field" style="display:flex;gap:10px;flex-wrap:wrap">
      <button type="button" class="btn btn-primary btn-sm" onclick="startAdminProgramPreview()">Start preview</button>
      ${activePreview ? '<button type="button" class="btn btn-ghost btn-sm" onclick="exitProgramPreview()">Exit preview</button>' : ''}
    </div>`;
}

function startAdminProgramPreview() {
  const jwtEmail = typeof getIdTokenEmail === 'function' ? getIdTokenEmail() : null;
  if (!isAppAdmin(jwtEmail)) return;
  const programId = document.getElementById('adminPreviewSelect')?.value;
  if (!programId || typeof enableProgramPreview !== 'function') return;
  if (!enableProgramPreview(programId, jwtEmail)) return;
  if (typeof showSaveToast === 'function') {
    const name = getActiveProgramBundle()?.displayName || 'Athlete';
    showSaveToast(`Previewing ${name}'s program`);
  }
  if (typeof refreshAllProgramViews === 'function') refreshAllProgramViews();
  renderAdminProgramPreviewSection();
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
