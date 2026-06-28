/* ============================================================
   utils.js — Pure utility functions (no DOM, no state)
   ============================================================ */
'use strict';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}
function todayStr() { return new Date().toISOString().slice(0,10); }
function nowTimeStr() { const d=new Date(); return pad(d.getHours())+':'+pad(d.getMinutes()); }
function nowDatetimeStr() { const d=new Date(); d.setSeconds(0,0); return d.toISOString().slice(0,16); }
function pad(n) { return String(n).padStart(2,'0'); }

function formatDate(s) {
  if (!s) return '—';
  const d = new Date(s + (s.length===10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function formatDT(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
    + ' ' + d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
}
function formatTime12(t) {
  if (!t) return '—';
  const [h,m] = t.split(':').map(Number);
  const ampm = h>=12?'PM':'AM';
  return `${h%12||12}:${pad(m)} ${ampm}`;
}

function timeDiffMins(start, end) {
  if (!start||!end) return 0;
  const [sh,sm]=start.split(':').map(Number), [eh,em]=end.split(':').map(Number);
  let d=(eh*60+em)-(sh*60+sm);
  if (d<0) d+=1440;
  return d;
}
function minsToHM(m) {
  if (!m && m!==0) return '—';
  const h=Math.floor(m/60), min=m%60;
  if (h===0) return `${min}m`;
  if (min===0) return `${h}h`;
  return `${h}h ${min}m`;
}

function calcAge(birthday) {
  if (!birthday) return null;
  const birth = new Date(birthday+'T00:00:00');
  const now   = new Date();
  const days  = Math.floor((now-birth)/86400000);
  if (days<0)  return {text:'Not born yet'};
  if (days<14) return {text:`${days} day${days!==1?'s':''} old`};
  const weeks  = Math.floor(days/7);
  if (days<60) return {text:`${weeks} week${weeks!==1?'s':''} old`};
  const months = Math.floor(days/30.44);
  if (months<24) return {text:`${months} month${months!==1?'s':''} old`};
  const years = Math.floor(days/365.25);
  return {text:`${years} year${years!==1?'s':''} old`};
}

function lastNDates(n) {
  const out=[];
  for(let i=n-1;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); out.push(d.toISOString().slice(0,10)); }
  return out;
}
function shortDay(dateStr) {
  return new Date(dateStr+'T00:00:00').toLocaleDateString('en-US',{weekday:'short'});
}

function tempStatus(t) {
  if (isNaN(t)) return {label:'—',    color:'var(--text-muted)',bg:'rgba(0,0,0,.06)'};
  if (t < 36.0) return {label:'Low',  color:'#3b82f6',bg:'rgba(59,130,246,.1)'};
  if (t <=37.5) return {label:'Normal',color:'#22c55e',bg:'rgba(34,197,94,.1)'};
  if (t <=38.0) return {label:'Slight Fever',color:'#f59e0b',bg:'rgba(245,158,11,.1)'};
  return            {label:'Fever!', color:'#ef4444',bg:'rgba(239,68,68,.1)'};
}

function milestoneEmoji(name) {
  const MAP={'First Smile':'😊','Lift Head':'🙆','Roll Over':'🔄','Sit Up':'🧘',
    'Crawl':'🐛','Stand':'🧍','Walk':'👣','First Tooth':'🦷','First Word':'🗣️'};
  return MAP[name]||'⭐';
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
