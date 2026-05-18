/** @file Progression charts and sparklines. */
/* ═══════════════════════════════════════════════════════════════
   PROGRESSION CHARTS
═══════════════════════════════════════════════════════════════ */
async function renderProgressPage() {
  // Lift chips
  const chips = document.getElementById('liftChips');
  chips.innerHTML = '';
  LIFT_KEYS.forEach(k=>{
    const c = document.createElement('button');
    c.className = 'lift-chip'+(k===state.progressLift?' active':'');
    c.textContent = k;
    c.onclick = ()=>{ state.progressLift=k; renderProgressPage(); };
    chips.appendChild(c);
  });
  document.getElementById('progressChartTitle').textContent = state.progressLift+' — E1RM (kg)';

  const targets = LIFT_TARGETS[state.progressLift];
  const actuals = Array(12).fill(null);

  if (apiOnline) {
    try {
      const data = await apiCall('GET', `/progress/${encodeURIComponent(state.progressLift)}`);
      (data.data || []).forEach(d => {
        if (d.week >= 1 && d.week <= 12) actuals[d.week - 1] = d.bestE1rm;
      });
    } catch (e) { console.warn('progress API failed', e); }
  }

  if (!actuals.some(v => v != null)) {
    state.sessions.filter(s => s.completed).forEach(s => {
      const wi = s.week - 1;
      if (wi >= 0 && wi < 12) {
        const matched = s.sets.filter(set => set.exercise && (
          set.exercise.toLowerCase().includes(state.progressLift.toLowerCase().split(' ')[0]) ||
          state.progressLift.toLowerCase().includes(set.exercise.toLowerCase().split(' ')[0])
        ));
        if (matched.length) {
          const best = Math.max(...matched.map(m => m.e1rm || 0));
          if (best > 0) actuals[wi] = Math.max(actuals[wi] || 0, best);
        }
      }
    });
  }

  const labels = Array.from({length:12},(_,i)=>`W${i+1}`);
  if(state.progressChart) state.progressChart.destroy();
  state.progressChart = new Chart(document.getElementById('progressChart'),{
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'Target E1RM', data:targets, borderColor:'rgba(255,92,53,0.5)', backgroundColor:'rgba(255,92,53,0.05)', borderDash:[4,3], borderWidth:2, pointRadius:3, tension:0.4 },
        { label:'Actual E1RM', data:actuals, borderColor:'#ff5c35', backgroundColor:'rgba(255,92,53,0.12)', borderWidth:2.5, pointRadius:4, pointBackgroundColor:'#ff5c35', tension:0.4 }
      ]
    },
    options: chartOptions('kg')
  });

  // Sparklines
  const sg = document.getElementById('sparklineGrid');
  sg.innerHTML = '';
  LIFT_KEYS.forEach(k=>{
    const tgts = LIFT_TARGETS[k];
    const latest = tgts[Math.min(state.currentWeek-1,11)];
    const prev = tgts[Math.max(state.currentWeek-2,0)];
    const delta = latest - prev;
    const card = document.createElement('div');
    card.className = 'sparkline-card';
    card.innerHTML = `
      <div class="sparkline-label">${k}</div>
      <div class="sparkline-val">${latest}kg</div>
      <div class="sparkline-delta ${delta>0?'up':delta<0?'down':'flat'}">${delta>0?'+':''}${delta.toFixed(1)}kg wk-on-wk</div>
      <div class="sparkline-chart"><canvas id="spark-${k.replace(/\s+/g,'')}"></canvas></div>`;
    sg.appendChild(card);
    setTimeout(()=>{
      const ctx = document.getElementById('spark-'+k.replace(/\s+/g,''));
      if(ctx) new Chart(ctx,{
        type:'line',
        data:{labels:Array.from({length:12},(_,i)=>'W'+(i+1)),datasets:[{data:LIFT_TARGETS[k],borderColor:'#ff5c35',borderWidth:1.5,pointRadius:0,tension:0.4,fill:true,backgroundColor:'rgba(255,92,53,0.08)'}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}}}
      });
    },50);
  });
}

function chartOptions(unit) {
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#8892a4',font:{size:11}}},tooltip:{backgroundColor:'#1a2235',borderColor:'rgba(255,255,255,0.1)',borderWidth:1,titleColor:'#e8eaf0',bodyColor:'#8892a4',padding:10}},
    scales:{
      x:{ticks:{color:'#8892a4',font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'}},
      y:{ticks:{color:'#8892a4',font:{size:11},callback:v=>v+unit},grid:{color:'rgba(255,255,255,0.05)'}}
    }
  };
}
