/** @file Dashboard KPIs and charts. */
/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
function renderDashboard() {
  if (typeof updateUserChrome === 'function' && typeof getActiveProgramBundle === 'function') {
    updateUserChrome(getActiveProgramBundle());
  }
  const completed=state.sessions.filter(s=>s.completed);
  document.getElementById('kpiSessions').textContent=completed.length;
  document.getElementById('dashWeekNum').textContent=state.currentWeek;

  // Best set weight across all completed sessions (actual, not estimated).
  let bestWeight = 0, bestLift = 'top set';
  completed.forEach(s => s.sets.forEach(set => {
    const w = parseFloat(set.weight) || 0;
    if (w > bestWeight) { bestWeight = w; bestLift = set.exercise || 'top set'; }
  }));
  document.getElementById('kpiE1rm').textContent = bestWeight > 0 ? formatWeightWithUnit(bestWeight) : '—';
  document.getElementById('kpiE1rmLabel').textContent = bestLift.toLowerCase();

  // Weekly sets + week progress
  const weekProgress=getWeekGymProgress(state.currentWeek);
  const weekSessions=completed.filter(s=>s.week===state.currentWeek);
  const weekSets=weekSessions.reduce((a,s)=>a+s.sets.length,0);
  document.getElementById('kpiSets').textContent=weekSets;
  const kpiSetsSub=document.getElementById('kpiSetsSub');
  if(kpiSetsSub){
    kpiSetsSub.textContent=weekProgress.isComplete
      ? 'week complete'
      : `${weekProgress.completedCount}/${weekProgress.total} sessions`;
  }

  // Consistency (this week's gym days)
  const weekPct=Math.round((weekProgress.completedCount/weekProgress.total)*100);
  document.getElementById('kpiConsistency').textContent=weekPct+'%';
  const kpiConsistencySub=document.getElementById('kpiConsistencySub');
  if(kpiConsistencySub) kpiConsistencySub.textContent='gym days this week';

  // Today
  const dayMap={0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'};
  const todayKey=dayMap[new Date().getDay()];
  const todayProgram=PROGRAM[todayKey];
  document.getElementById('todaySessionLabel').textContent=todayProgram?todayProgram.label+' — '+todayProgram.focus:'Rest day — recover well.';
  const startBtn = document.getElementById('startTodayBtn');
  if (startBtn) {
    if (todayProgram) {
      startBtn.textContent = "Start today's workout";
      startBtn.disabled = false;
    } else {
      startBtn.textContent = 'Rest day';
      startBtn.disabled = true;
    }
  }

  // Week dots
  const dots=document.getElementById('weekDots');
  dots.innerHTML='';
  dots.classList.toggle('week-dots--complete', weekProgress.isComplete);
  const completedDays=weekProgress.completedDays;
  DAYS.forEach(d=>{
    const dot=document.createElement('div');
    const isDone=completedDays.has(d);
    const isToday=dayMap[new Date().getDay()]===d;
    dot.className='week-dot'+(isDone?' done':isToday?' today':' upcoming');
    dot.textContent=d.slice(0,1);
    dot.title=isDone?`${d} — completed`:d;
    dots.appendChild(dot);
  });
  renderWeekCompleteBanner(document.getElementById('weekCompleteBanner'), weekProgress);
  const todayCard=document.querySelector('.today-session-card');
  if(todayCard) todayCard.classList.toggle('today-session-card--week-complete', weekProgress.isComplete);

  // Phase badge
  const phaseLabel = typeof getActiveProgramBundle === 'function'
    ? getActiveProgramBundle().phaseLabel(state.currentWeek)
    : (state.currentWeek <= 6 ? 'Phase 1' : 'Phase 2');
  document.getElementById('dashPhase').textContent = phaseLabel;

  const chartC = typeof getChartColors === 'function' ? getChartColors() : { accent: '#ff5c35', accentFill: 'rgba(255,92,53,0.12)', targetLine: 'rgba(255,92,53,0.35)', volumeBar: 'rgba(255,92,53,0.55)' };
  const ui = typeof getChartUiColors === 'function' ? getChartUiColors() : { tick: '#8892a4', grid: 'rgba(255,255,255,0.04)' };

  // Volume chart
  const volLabels=Array.from({length:12},(_,i)=>'W'+(i+1));
  const volData=volLabels.map((_,i)=>{
    const w=i+1;
    const deload = typeof isDeloadWeek === 'function' ? isDeloadWeek(w) : [6, 12].includes(w);
    const gymCount = (typeof DAYS !== 'undefined' ? DAYS.length : 4) || 4;
    return completed.filter(s=>s.week===w).reduce((a,s)=>a+s.sets.length,0)||(deload ? gymCount * 2 : gymCount * 4);
  });
  if(state.dashVolumeChart) state.dashVolumeChart.destroy();
  state.dashVolumeChart=new Chart(document.getElementById('dashVolumeChart'),{
    type:'bar',
    data:{labels:volLabels,datasets:[{data:volData,backgroundColor:volLabels.map((_,i)=>(typeof isDeloadWeek==='function'?isDeloadWeek(i+1):[6,12].includes(i+1))?'rgba(245,158,11,0.45)':chartC.volumeBar),borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:ui.tick,font:{size:10}},grid:{display:false}},y:{ticks:{color:ui.tick,font:{size:10}},grid:{color:ui.grid}}}}
  });
  observeChartContainer(state.dashVolumeChart, document.getElementById('dashVolumeChart')?.parentElement);

  // Primary lift actual-weight chart (replaces E1RM estimate).
  // Uses the same liftDef helpers from progress.js.
  const primaryDef = typeof getActiveLiftDefs === 'function'
    ? getActiveLiftDefs()[0]
    : { key: 'Bench Press', match: ['bench press'] };
  const primaryActuals = typeof actualWeightsForDef === 'function'
    ? actualWeightsForDef(primaryDef)
    : Array(12).fill(null);
  const e1rmTitle = document.querySelector('#page-dashboard .card-title');
  if (e1rmTitle) e1rmTitle.textContent = `${primaryDef.key} — top-set weight`;
  if(state.dashE1rmChart) state.dashE1rmChart.destroy();
  const e1rmDatasets=[{
    label: 'Best set weight',
    data: primaryActuals.map(v => v == null ? null : toDisplayUnit(v)),
    borderColor: chartC.accent,
    backgroundColor: chartC.accentFill,
    borderWidth: 2,
    pointRadius: primaryActuals.map(v => v != null ? 3 : 0),
    pointBackgroundColor: chartC.accent,
    tension: 0.4,
    fill: true,
    spanGaps: true,
  }];
  state.dashE1rmChart=new Chart(document.getElementById('dashE1rmChart'),{
    type:'line',
    data:{
      labels:Array.from({length:12},(_,i)=>'W'+(i+1)),
      datasets:e1rmDatasets
    },
    options:chartOptions(weightUnitLabel(),getWeightChartScaleBounds(e1rmDatasets))
  });
  observeChartContainer(state.dashE1rmChart, document.querySelector('#page-dashboard .chart-wrap--e1rm'));
}

function startTodaysWorkout() {
  if (typeof applyLogSessionFocus === 'function') applyLogSessionFocus(true);
  const logNav =
    document.querySelector('.bottom-nav-item[data-page="log"]') ||
    document.querySelector('.nav-item[data-page="log"]');
  showPage('log', logNav);
}
