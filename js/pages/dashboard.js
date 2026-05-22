/** @file Dashboard KPIs and charts. */
/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
function renderDashboard() {
  const completed=state.sessions.filter(s=>s.completed);
  document.getElementById('kpiSessions').textContent=completed.length;
  document.getElementById('dashWeekNum').textContent=state.currentWeek;

  // Best E1RM
  let bestE1rm=0, bestLift='bench press';
  completed.forEach(s=>s.sets.forEach(set=>{
    if((set.e1rm||0)>bestE1rm){ bestE1rm=set.e1rm; bestLift=set.exercise||'bench press'; }
  }));
  document.getElementById('kpiE1rm').textContent=bestE1rm>0?formatWeightWithUnit(bestE1rm):'—';
  document.getElementById('kpiE1rmLabel').textContent=bestLift.toLowerCase();

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
  document.getElementById('dashPhase').textContent=state.currentWeek<=6?'Phase 1':'Phase 2';

  const chartC = typeof getChartColors === 'function' ? getChartColors() : { accent: '#ff5c35', accentFill: 'rgba(255,92,53,0.12)', targetLine: 'rgba(255,92,53,0.35)', volumeBar: 'rgba(255,92,53,0.55)' };
  const ui = typeof getChartUiColors === 'function' ? getChartUiColors() : { tick: '#8892a4', grid: 'rgba(255,255,255,0.04)' };

  // Volume chart
  const volLabels=Array.from({length:12},(_,i)=>'W'+(i+1));
  const volData=volLabels.map((_,i)=>{
    const w=i+1;
    return completed.filter(s=>s.week===w).reduce((a,s)=>a+s.sets.length,0)||([6,12].includes(w)?8:16);
  });
  if(state.dashVolumeChart) state.dashVolumeChart.destroy();
  state.dashVolumeChart=new Chart(document.getElementById('dashVolumeChart'),{
    type:'bar',
    data:{labels:volLabels,datasets:[{data:volData,backgroundColor:volLabels.map((_,i)=>[6,12].includes(i+1)?'rgba(245,158,11,0.45)':chartC.volumeBar),borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:ui.tick,font:{size:10}},grid:{display:false}},y:{ticks:{color:ui.tick,font:{size:10}},grid:{color:ui.grid}}}}
  });
  observeChartContainer(state.dashVolumeChart, document.getElementById('dashVolumeChart')?.parentElement);

  // E1RM chart
  const e1rmActual=Array(12).fill(null);
  completed.forEach(s=>{
    const wi=s.week-1;
    if(wi>=0&&wi<12){
      const best=Math.max(...s.sets.map(x=>x.e1rm||0));
      if(best>0) e1rmActual[wi]=Math.max(e1rmActual[wi]||0,best);
    }
  });
  if(state.dashE1rmChart) state.dashE1rmChart.destroy();
  const e1rmDatasets=[
    {label:'Target',data:LIFT_TARGETS['Bench Press'].map(toDisplayUnit),borderColor:chartC.targetLine,borderDash:[4,3],borderWidth:1.5,pointRadius:2,tension:0.4},
    {label:'Actual',data:e1rmActual.map(toDisplayUnit),borderColor:chartC.accent,backgroundColor:chartC.accentFill,borderWidth:2,pointRadius:3,pointBackgroundColor:chartC.accent,tension:0.4,fill:true}
  ];
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
  const dayMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  const today = dayMap[new Date().getDay()];
  if (DAYS.includes(today)) state.currentDay = today;
  const logNav =
    document.querySelector('.bottom-nav-item[data-page="log"]') ||
    document.querySelector('.nav-item[data-page="log"]');
  showPage('log', logNav);
}
