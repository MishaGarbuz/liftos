/** @file 12-week plan page. */

/* ═══════════════════════════════════════════════════════════════
   12-WEEK PLAN
═══════════════════════════════════════════════════════════════ */
function renderPlanPage() {
  const grid = document.getElementById('planWeekGrid');
  grid.innerHTML = '';
  for(let w=1;w<=12;w++){
    const isD=[6,12].includes(w);
    const btn=document.createElement('button');
    btn.className='plan-week-btn'+(w===state.planWeek?' active':'')+(isD?' deload':'');
    btn.innerHTML=`<div>W${w}</div><div style="font-size:9px;margin-top:2px">${isD?'DELOAD':w<=6?'Phase 1':'Phase 2'}</div>`;
    btn.onclick=()=>{state.planWeek=w;renderPlanPage();};
    grid.appendChild(btn);
  }

  const deload=[6,12].includes(state.planWeek);
  const wi=state.planWeek-1;
  let html=`<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px">
    <span class="card-title-lg">Week ${state.planWeek}</span>
    <span class="badge ${deload?'badge-warning':'badge-accent'}">${deload?'DELOAD':state.planWeek<=6?'Phase 1':'Phase 2'}</span>
    ${deload?'<span style="font-size:12px;color:var(--warning)">Reduce load 40% · Focus on technique</span>':''}
  </div>
  <div style="overflow-x:auto">
  <table class="plan-table">
    <thead><tr><th>Day</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Target Weight</th><th>Tempo</th><th>RPE</th><th>Rest</th><th>Notes</th></tr></thead>
    <tbody>`;

  DAYS.forEach(dayKey=>{
    const day=PROGRAM[dayKey];
    let first=true;
    day.blocks.forEach(block=>{
      block.exercises.forEach((ex,ei)=>{
        const isSuper=block.type==='superset'||block.type==='core';
        const wArr=PLAN_PROGRESSIONS[dayKey];
        let tw=ex.weight;
        if(wArr&&wArr[wi]) {
          const idx=dayKey==='Mon'?[0,1,2,3,4]:dayKey==='Tue'?[0,1,2,3]:dayKey==='Thu'?[0,1,2,3,4]:dayKey==='Fri'?[0,1,2,3,4]:[0];
          // Just use base progression weight scaled
          tw=Math.round(ex.weight*(deload?0.6:1+(wi*0.025))*2)/2;
        }
        html+=`<tr${first?` class="day-group"`:''}>
          <td style="color:var(--accent);font-weight:700;white-space:nowrap">${first?day.label.split('—')[0].trim():''}</td>
          <td>
            <span style="font-weight:600">${ex.name}</span>
            ${isSuper?`<span class="plan-superset-tag">${block.type==='core'?'Core':block.label}</span>`:''}
          </td>
          <td>${ex.sets}</td>
          <td>${ex.repsTarget}</td>
          <td><strong>${tw}kg</strong></td>
          <td style="color:var(--text-muted)">${ex.tempo}</td>
          <td><span class="badge badge-accent">${ex.rpe}</span></td>
          <td>${ex.rest}s</td>
          <td style="font-size:11px;color:var(--text-faint);max-width:180px">${ex.alt}</td>
        </tr>`;
        first=false;
      });
    });
    html+=`<tr><td colspan="9" style="padding:4px"></td></tr>`;
  });

  html+='</tbody></table></div>';
  document.getElementById('planTableContent').innerHTML=html;
}
