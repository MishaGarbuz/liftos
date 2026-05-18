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
  document.getElementById('kpiE1rm').textContent=bestE1rm>0?bestE1rm+'kg':'—';
  document.getElementById('kpiE1rmLabel').textContent=bestLift.toLowerCase();

  // Weekly sets
  const weekSessions=completed.filter(s=>s.week===state.currentWeek);
  const weekSets=weekSessions.reduce((a,s)=>a+s.sets.length,0);
  document.getElementById('kpiSets').textContent=weekSets;

  // Consistency
  const target=state.currentWeek*4;
  const pct=target>0?Math.round((completed.length/target)*100):0;
  document.getElementById('kpiConsistency').textContent=Math.min(100,pct)+'%';

  // Today
  const dayMap={0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'};
  const todayKey=dayMap[new Date().getDay()];
  const todayProgram=PROGRAM[todayKey];
  document.getElementById('todaySessionLabel').textContent=todayProgram?todayProgram.label+' — '+todayProgram.focus:'Rest day — recover well.';

  // Week dots
  const dots=document.getElementById('weekDots');
  dots.innerHTML='';
  const completedDays=new Set(weekSessions.map(s=>s.day));
  DAYS.forEach(d=>{
    const dot=document.createElement('div');
    const isDone=completedDays.has(d);
    const isToday=dayMap[new Date().getDay()]===d;
    dot.className='week-dot'+(isDone?' done':isToday?' today':' upcoming');
    dot.textContent=d.slice(0,1);
    dot.title=d;
    dots.appendChild(dot);
  });

  // Phase badge
  document.getElementById('dashPhase').textContent=state.currentWeek<=6?'Phase 1':'Phase 2';

  // Volume chart
  const volLabels=Array.from({length:12},(_,i)=>'W'+(i+1));
  const volData=volLabels.map((_,i)=>{
    const w=i+1;
    return completed.filter(s=>s.week===w).reduce((a,s)=>a+s.sets.length,0)||([6,12].includes(w)?8:16);
  });
  if(state.dashVolumeChart) state.dashVolumeChart.destroy();
  state.dashVolumeChart=new Chart(document.getElementById('dashVolumeChart'),{
    type:'bar',
    data:{labels:volLabels,datasets:[{data:volData,backgroundColor:volLabels.map((_,i)=>[6,12].includes(i+1)?'rgba(245,158,11,0.4)':'rgba(255,92,53,0.5)'),borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8892a4',font:{size:10}},grid:{display:false}},y:{ticks:{color:'#8892a4',font:{size:10}},grid:{color:'rgba(255,255,255,0.04)'}}}}
  });

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
  state.dashE1rmChart=new Chart(document.getElementById('dashE1rmChart'),{
    type:'line',
    data:{
      labels:Array.from({length:12},(_,i)=>'W'+(i+1)),
      datasets:[
        {label:'Target',data:LIFT_TARGETS['Bench Press'],borderColor:'rgba(255,92,53,0.35)',borderDash:[4,3],borderWidth:1.5,pointRadius:2,tension:0.4},
        {label:'Actual',data:e1rmActual,borderColor:'#ff5c35',backgroundColor:'rgba(255,92,53,0.1)',borderWidth:2,pointRadius:3,pointBackgroundColor:'#ff5c35',tension:0.4,fill:true}
      ]
    },
    options:chartOptions('kg')
  });
}
