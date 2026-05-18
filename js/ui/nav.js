/** @file Page navigation and sidebar. */
/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════ */
function showPage(name, navEl) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  if(navEl) {
    navEl.classList.add('active');
    if (navEl.classList.contains('nav-item')) {
      const bni = document.querySelector(`.bottom-nav-item[data-page="${name}"]`);
      if (bni) bni.classList.add('active');
    }
    if (navEl.classList.contains('bottom-nav-item') && navEl.dataset.page !== 'menu') {
      const ni = document.querySelector(`.nav-item[data-page="${name}"]`);
      if (ni) ni.classList.add('active');
    }
  } else {
    const ni = document.querySelector(`.nav-item[data-page="${name}"]`);
    if (ni) ni.classList.add('active');
    const bni = document.querySelector(`.bottom-nav-item[data-page="${name}"]`);
    if (bni) bni.classList.add('active');
  }
  document.getElementById('topbarPage').textContent =
    {dashboard:'Dashboard',log:'Log Workout',progress:'Progression',history:'History',plan:'12-Week Plan',schedule:'Weekly Schedule'}[name]||name;
  if(name==='log') renderLogPage();
  if(name==='progress') renderProgressPage();
  if(name==='history') renderHistory();
  if(name==='plan') renderPlanPage();
  if(name==='dashboard') renderDashboard();
  if(name==='schedule') renderSchedule();
  closeSidebar();
  const contentEl = document.querySelector('main.main .content');
  if (contentEl) contentEl.scrollTop = 0;
}

function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open'); document.getElementById('mobileOverlay').classList.toggle('open'); }
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('mobileOverlay').classList.remove('open'); }

