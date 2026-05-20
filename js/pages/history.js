/** @file Session history and detail modal. */
/* ═══════════════════════════════════════════════════════════════
   HISTORY
═══════════════════════════════════════════════════════════════ */
function renderHistory(filter='all') {
  const body = document.getElementById('historyBody');
  body.innerHTML = '';
  const sessions = state.sessions.filter(s=>s.completed && (filter==='all'||s.day===filter));
  document.getElementById('historyEmpty').style.display = sessions.length?'none':'block';
  sessions.slice().reverse().forEach(s=>{
    // Count only sets that were actually marked done (have weight/reps data)
    const doneSets = s.sets.filter(x => x.weight > 0 || x.reps > 0);
    const totalSets = doneSets.length;
    const bestE1rm = totalSets > 0 ? Math.max(...doneSets.map(x=>x.e1rm||0)) : 0;
    const maxPossible = 20;
    const pct = Math.min(100, Math.round(totalSets/maxPossible*100));
    const realIdx = state.sessions.indexOf(s);
    const tr = document.createElement('tr');
    tr.className = 'history-row';
    tr.setAttribute('role', 'button');
    tr.setAttribute('tabindex', '0');
    tr.setAttribute('aria-label', `View session ${formatDisplayDate(s.date)}, week ${s.week} ${s.day}`);
    tr.onclick = () => openSessionModal(realIdx, false);
    tr.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSessionModal(realIdx, false);
      }
    };
    tr.innerHTML = `
      <td>${formatDisplayDate(s.date)}</td>
      <td><span class="badge badge-${s.day==='Mon'||s.day==='Thu'?'accent':'blue'}">${s.day}</span></td>
      <td>Wk ${s.week}</td>
      <td>${totalSets} sets</td>
      <td>${bestE1rm>0?displayWeight(bestE1rm)+weightUnitLabel():'—'}</td>
      <td>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <span style="font-size:11px;color:var(--text-faint);margin-top:2px;display:block">${pct}%</span>
      </td>
      <td class="history-chevron" aria-hidden="true">›</td>`;
    body.appendChild(tr);
  });
}

function filterHistory(f, btn) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderHistory(f);
}

function reloadSession(idx) {
  const s = state.sessions[idx];
  state.currentWeek = s.week;
  state.currentDay = s.day;
  showPage('log',null);
}

/* ─── SESSION DETAIL / EDIT MODAL ─────────────────────────────────────── */
let modalEditIdx = null;

function openSessionModal(idx, editMode) {
  const s = state.sessions[idx];
  if(!s) return;
  modalEditIdx = idx;
  const modal = document.getElementById('sessionModal');
  const doneSets = s.sets.filter(x => x.weight > 0 || x.reps > 0);
  const bestE1rm = doneSets.length ? Math.max(...doneSets.map(x=>x.e1rm||0)) : 0;
  const topLift = doneSets.find(x=>x.e1rm===bestE1rm);
  const totalVol = doneSets.reduce((a,x)=>(a + (x.weight||0)*(x.reps||0)),0);

  document.getElementById('modalTitle').textContent = editMode ? 'Edit Session' : 'Session Overview';
  document.getElementById('modalSubtitle').textContent = `${formatDisplayDate(s.date)} · Week ${s.week} · ${s.day} · ${s.completed?'Completed':'In Progress'}`;

  // KPIs
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="modal-kpi-row">
      <div class="modal-kpi">
        <div class="modal-kpi-val">${doneSets.length}</div>
        <div class="modal-kpi-lbl">Sets Logged</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-val">${bestE1rm > 0 ? formatWeightWithUnit(bestE1rm) : '—'}</div>
        <div class="modal-kpi-lbl">Best E1RM${topLift?' · '+topLift.exercise:''}</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-val">${totalVol > 0 ? formatSessionVolume(doneSets) : '—'}</div>
        <div class="modal-kpi-lbl">Total Volume</div>
      </div>
    </div>`;

  // Group sets by exercise
  const byExercise = {};
  doneSets.forEach((set,i)=>{
    const name = set.exercise || 'Unknown';
    if(!byExercise[name]) byExercise[name]=[];
    byExercise[name].push({...set, _origIdx: s.sets.indexOf(set)});
  });

  Object.entries(byExercise).forEach(([exName, sets])=>{
    const div = document.createElement('div');
    div.className = 'modal-ex-group';
    div.innerHTML = `<div class="modal-ex-name">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ${exName}
    </div>
    <table class="modal-sets-table">
      <thead><tr>
        <th>Set</th><th>${weightColumnLabel()}</th><th>Reps</th><th>RPE</th><th>E1RM</th>${editMode?'<th></th>':''}
      </tr></thead>
      <tbody id="modal-ex-${CSS.escape(exName)}"></tbody>
    </table>
    ${editMode ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:11px" onclick="modalAddSet('${exName}')">+ Add set</button>` : ''}`;
    body.appendChild(div);

    const tbody = document.getElementById('modal-ex-'+CSS.escape(exName));
    sets.forEach((set,si)=>{
      const tr = document.createElement('tr');
      if(editMode){
        tr.innerHTML = `
          <td style="color:var(--text-faint)">${si+1}</td>
          <td><input type="number" value="${set.weight ? displayWeight(set.weight) : ''}" placeholder="0" min="0" step="0.5" data-field="weight" data-orig="${set._origIdx}" class="modal-edit-input" onchange="updateSessionSet(${idx},${set._origIdx},this)"></td>
          <td><input type="number" value="${set.reps||''}" placeholder="0" min="0" data-field="reps" data-orig="${set._origIdx}" class="modal-edit-input" onchange="updateSessionSet(${idx},${set._origIdx},this)"></td>
          <td><input type="number" value="${set.rpe||''}" placeholder="7" min="1" max="10" step="0.5" data-field="rpe" data-orig="${set._origIdx}" class="modal-edit-input" onchange="updateSessionSet(${idx},${set._origIdx},this)"></td>
          <td style="color:var(--text-faint)">${set.e1rm>0?formatWeightWithUnit(set.e1rm):'—'}</td>
          <td><button class="set-del-btn" onclick="deleteSessionSet(${idx},${set._origIdx})" title="Remove set">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button></td>`;
      } else {
        tr.innerHTML = `
          <td style="color:var(--text-faint)">${si+1}</td>
          <td>${set.weight?formatWeightWithUnit(set.weight):'—'}</td>
          <td>${set.reps||'—'}</td>
          <td>${set.rpe||'—'}</td>
          <td style="color:${set.e1rm>0?'var(--accent)':'var(--text-faint)'}">${set.e1rm>0?formatWeightWithUnit(set.e1rm):'—'}</td>`;
      }
      tbody.appendChild(tr);
    });
  });

  // Footer buttons
  const footer = document.getElementById('modalFooter');
  if(editMode){
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="closeSessionModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveModalEdits(${idx})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Save Changes
      </button>`;
  } else {
    footer.innerHTML = `
      <button class="btn btn-ghost btn-danger" onclick="deleteSession(${idx})">Delete workout</button>
      <button class="btn btn-ghost" onclick="closeSessionModal()">Close</button>
      <button class="btn btn-ghost" onclick="openSessionModal(${idx},true)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </button>`;
  }

  modal.classList.add('open');
}

function closeSessionModal() {
  document.getElementById('sessionModal').classList.remove('open');
  modalEditIdx = null;
}

function updateSessionSet(sessionIdx, setOrigIdx, input) {
  const s = state.sessions[sessionIdx];
  if(!s || !s.sets[setOrigIdx]) return;
  const field = input.dataset.field;
  let val = parseFloat(input.value) || 0;
  if (field === 'weight') val = toKg(val);
  s.sets[setOrigIdx][field] = val;
  // Recalculate E1RM
  const set = s.sets[setOrigIdx];
  if(set.weight > 0 && set.reps > 0){
    set.e1rm = Math.round(set.weight * (1 + set.reps/30) * 10) / 10;
  }
}

function deleteSessionSet(sessionIdx, setOrigIdx) {
  const s = state.sessions[sessionIdx];
  if(!s) return;
  s.sets.splice(setOrigIdx, 1);
  // Refresh modal in edit mode
  openSessionModal(sessionIdx, true);
}

function modalAddSet(exName) {
  if(modalEditIdx === null) return;
  const s = state.sessions[modalEditIdx];
  s.sets.push({exercise: exName, weight: 0, reps: 0, rpe: 7, e1rm: 0});
  openSessionModal(modalEditIdx, true);
}

async function saveModalEdits(idx) {
  const session = state.sessions[idx];
  if (session) await syncSessionToApi(session, session.completed);
  persistLocalState();
  closeSessionModal();
  renderHistory();
  renderDashboard();
  showSaveToast(apiOnline ? 'Changes saved to cloud' : 'Changes saved');
}
