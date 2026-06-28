/* ============================================================
   reminders.js — Reminder Engine + Bell UI
   ============================================================ */
'use strict';

const Reminders = (() => {

  let _pollTimer = null;

  /* ----------------------------------------------------------
     BUILD REMINDERS from live LocalStorage data
  ---------------------------------------------------------- */
  function build() {
    const items = [];
    const s     = Storage.getSettings();
    const now   = Date.now();
    const today = todayStr();

    /* ---- FEEDING ---- */
    const lastFeed = Storage.getRecords('feeding')[0];
    if (lastFeed?.startTime && lastFeed?.date) {
      const lastMs = new Date(`${lastFeed.date}T${lastFeed.startTime}`).getTime();
      const intMs  = (s.feedInterval || 2) * 3600000;
      const nextMs = lastMs + intMs;
      const diffM  = Math.round((nextMs - now) / 60000);

      if (diffM <= 0 && diffM > -180) {
        items.push({ icon:'🍼', text:'Time to feed baby!', time:'Now', urgency:'urgent', module:'feeding', diffMins: diffM });
      } else if (diffM > 0 && diffM <= 60) {
        items.push({ icon:'🍼', text:`Feeding in ${minsToHM(diffM)}`, time: minsToHM(diffM), urgency:'soon', module:'feeding', diffMins: diffM });
      } else if (diffM > 60) {
        const t = new Date(nextMs);
        items.push({ icon:'🍼', text:`Next feeding est. ${formatTime12(pad(t.getHours())+':'+pad(t.getMinutes()))}`,
          time: minsToHM(diffM), urgency:'ok', module:'feeding', diffMins: diffM });
      }
    } else {
      items.push({ icon:'🍼', text:'No feedings logged yet — add one!', time:'', urgency:'ok', module:'feeding' });
    }

    /* ---- VACCINATION ---- */
    const vaxStats = Stats.vaccination();
    if (vaxStats.overdue > 0) {
      items.push({ icon:'💉', text:`${vaxStats.overdue} overdue vaccine${vaxStats.overdue>1?'s':''}!`, time:'Overdue!', urgency:'urgent', module:'vaccination' });
    } else if (vaxStats.nextVaccine) {
      const v    = vaxStats.nextVaccine;
      const dDue = v.dueDate ? Math.ceil((new Date(v.dueDate) - now) / 86400000) : null;
      const urg  = dDue !== null && dDue <= 7 ? 'soon' : 'ok';
      const time = dDue === null ? '' : dDue <= 0 ? 'Today' : `in ${dDue}d`;
      items.push({ icon:'💉', text:`${v.name} vaccine due`, time, urgency: urg, module:'vaccination' });
    }

    /* ---- MEDICINE / VITAMINS ---- */
    const medStats = Stats.medicine(null);
    if (medStats.pending > 0) {
      const label = medStats.nextVit ? `${medStats.nextVit.name} vitamin` : `${medStats.pending} medicine${medStats.pending>1?'s':''}`;
      items.push({ icon:'💊', text:`${label} pending`, time:'Today', urgency:'soon', module:'medicine' });
    }

    /* ---- DOCTOR FOLLOW-UP ---- */
    const docStats = Stats.doctor();
    if (docStats.nextFollowup) {
      const f    = docStats.nextFollowup;
      const dDue = Math.ceil((new Date(f.followupDate) - now) / 86400000);
      const urg  = dDue <= 1 ? 'urgent' : dDue <= 3 ? 'soon' : 'ok';
      items.push({ icon:'🏥', text:`Follow-up: Dr. ${escHtml(f.doctor || 'Doctor')}`, time: dDue<=0?'Today':`in ${dDue}d`, urgency: urg, module:'doctor' });
    }

    /* ---- TEMPERATURE ALERT ---- */
    const latestTemp = Storage.getRecords('temperature')[0];
    if (latestTemp) {
      const t = parseFloat(latestTemp.temp);
      if (t >= 38) {
        const logged = latestTemp.date === today ? 'today' : latestTemp.date;
        items.push({ icon:'🌡️', text:`Fever recorded: ${latestTemp.temp}°C (${logged})`, time:'Alert', urgency:'urgent', module:'temperature' });
      }
    }

    return items;
  }

  /* ----------------------------------------------------------
     UPDATE BELL BADGE
  ---------------------------------------------------------- */
  function updateBadge(items) {
    const urgent  = items.filter(r => r.urgency === 'urgent' || r.urgency === 'soon').length;
    const badge   = document.getElementById('reminderCount');
    const bell    = document.getElementById('reminderBell');
    if (!badge) return;
    if (urgent > 0) {
      badge.textContent = urgent;
      badge.style.display = 'flex';
      bell?.classList.add('bell-has-alerts');
    } else {
      badge.style.display = 'none';
      bell?.classList.remove('bell-has-alerts');
    }
  }

  /* ----------------------------------------------------------
     RENDER DASHBOARD REMINDER STRIP
  ---------------------------------------------------------- */
  function renderDashStrip() {
    const container = document.getElementById('dashReminders');
    if (!container) return;
    const items = build();
    updateBadge(items);
    if (!items.length) { container.innerHTML = ''; return; }

    container.innerHTML = `
      <div class="reminders-strip">
        <div class="reminders-strip-title"><i class="fa fa-bell-ring me-2"></i>Reminders</div>
        <div class="reminders-strip-list">
          ${items.map(r => `
            <div class="strip-item strip-${r.urgency}" onclick="App.showSection('${r.module}')">
              <span class="strip-emoji">${r.icon}</span>
              <div class="strip-body">
                <div class="strip-text">${escHtml(r.text)}</div>
                ${r.time ? `<div class="strip-time strip-time-${r.urgency}">${r.time}</div>` : ''}
              </div>
              <i class="fa fa-chevron-right strip-arrow"></i>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ----------------------------------------------------------
     RENDER SIDE PANEL
  ---------------------------------------------------------- */
  function renderPanel() {
    const list  = document.getElementById('remindersList');
    if (!list) return;
    const items = build();
    updateBadge(items);

    if (!items.length) {
      list.innerHTML = '<div class="reminder-empty">🎉 All clear! No reminders right now.</div>';
      return;
    }

    list.innerHTML = items.map(r => `
      <div class="reminder-panel-row reminder-panel-${r.urgency}"
           onclick="App.showSection('${r.module}'); closeRemindersPanel()">
        <div class="rpr-left">
          <span class="rpr-emoji">${r.icon}</span>
          <div>
            <div class="rpr-text">${escHtml(r.text)}</div>
            ${r.time ? `<div class="rpr-time">${r.time}</div>` : ''}
          </div>
        </div>
        <i class="fa fa-arrow-right rpr-arrow"></i>
      </div>`).join('');
  }

  /* ----------------------------------------------------------
     BELL BUTTON TOGGLE
  ---------------------------------------------------------- */
  function bindBell() {
    const bell = document.getElementById('reminderBell');
    const panel = document.getElementById('remindersPanel');
    if (!bell || !panel) return;

    bell.addEventListener('click', e => {
      e.stopPropagation();
      const open = panel.style.display !== 'none' && panel.style.display !== '';
      if (open) {
        panel.style.display = 'none';
      } else {
        renderPanel();
        panel.style.display = 'block';
      }
    });

    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && !bell.contains(e.target)) {
        panel.style.display = 'none';
      }
    });
  }

  /* ----------------------------------------------------------
     START POLLING (60s)
  ---------------------------------------------------------- */
  function start() {
    bindBell();
    renderDashStrip();
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(() => {
      renderDashStrip();
      // also refresh panel if open
      const panel = document.getElementById('remindersPanel');
      if (panel && panel.style.display !== 'none') renderPanel();
    }, 60000);
  }

  /* ----------------------------------------------------------
     PUBLIC
  ---------------------------------------------------------- */
  return { build, renderDashStrip, renderPanel, start };
})();

function closeRemindersPanel() {
  const p = document.getElementById('remindersPanel');
  if (p) p.style.display = 'none';
}
