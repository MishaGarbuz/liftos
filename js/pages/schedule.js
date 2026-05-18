/** @file Weekly schedule page. */
/* ═══════════════════════════════════════════════════════════════
   WEEKLY SCHEDULE
═══════════════════════════════════════════════════════════════ */
function renderSchedule() {
  const grid=document.getElementById('scheduleGrid');
  grid.innerHTML='';
  const today=new Date().toLocaleDateString('en-US',{weekday:'short'});
  SCHEDULE_DAYS.forEach(d=>{
    const isToday=d.day===today.slice(0,3)||
      (d.day==='Mon'&&today==='Mon')||(d.day==='Tue'&&today==='Tue')||
      (d.day==='Thu'&&today==='Thu')||(d.day==='Fri'&&today==='Fri')||
      (d.day==='Wed'&&today==='Wed')||(d.day==='Sat'&&today==='Sat')||(d.day==='Sun'&&today==='Sun');
    const div=document.createElement('div');
    div.className=`schedule-day ${d.typeClass}${isToday?' today':''}`;
    div.innerHTML=`
      <div class="schedule-day-name">${d.label}${isToday?' · Today':''}</div>
      <div class="schedule-day-type">${d.session}</div>
      <div class="schedule-day-notes">${d.notes.replace(/\n/g,'<br>')}</div>`;
    grid.appendChild(div);
  });
}
