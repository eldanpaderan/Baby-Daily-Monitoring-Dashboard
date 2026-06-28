/* ============================================================
   app.js — Master Application Controller
   BabyLog v1.0 — Production Release
   
   Architecture:
   - App (IIFE) — routing, UI orchestration, CRUD dispatch
   - toast() — global notification helper
   - All data via Storage.*
   - All calculations via Stats.*
   - All charts via Charts.*
   - All reminders via Reminders.*
   ============================================================ */
'use strict';

const App = (() => {

  /* ----------------------------------------------------------
     STATE
  ---------------------------------------------------------- */
  let currentSection  = 'dashboard';
  let editingId       = null;       // null = new record, string = edit mode
  let diaperType      = 'wet';      // tracks active diaper type button
  let analyticsPeriod = 'week';     // current analytics time period
  let searchTimer     = null;       // debounce handle for search
  let pwaPrompt       = null;       // deferred PWA install event

  /* ----------------------------------------------------------
     INIT — called on DOMContentLoaded
  ---------------------------------------------------------- */
  function init() {
    Storage.init();
    applyStoredTheme();
    bindNav();
    bindSearch();
    bindFab();
    bindSidebar();
    bindModalTriggers();
    bindPeriodButtons();
    bindBell();
    bindKeyboard();
    loadSettingsToUI();
    showSection('dashboard');
    startClock();
    Reminders.start();
    registerSW();
    trapPWAPrompt();
  }

  /* ----------------------------------------------------------
     SERVICE WORKER & PWA
  ---------------------------------------------------------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js')
      .then(reg => { console.log('[BabyLog] SW registered', reg.scope); })
      .catch(err => { console.warn('[BabyLog] SW failed:', err); });
  }

  function trapPWAPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      pwaPrompt = e;
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) { btn.style.display = 'inline-flex'; btn.addEventListener('click', installPWA); }
    });
    window.addEventListener('appinstalled', () => {
      pwaPrompt = null;
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) btn.style.display = 'none';
      toast('BabyLog installed! 🎉 Find it on your home screen.', 'success', 4000);
    });
  }

  function installPWA() {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    pwaPrompt.userChoice.then(r => {
      if (r.outcome === 'accepted') toast('Installing BabyLog… 📲', 'info');
      pwaPrompt = null;
    });
  }

  /* ----------------------------------------------------------
     NAVIGATION
  ---------------------------------------------------------- */
  function bindNav() {
    document.querySelectorAll('[data-section]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        showSection(link.dataset.section);
        if (window.innerWidth < 992) closeSidebar();
      });
    });
  }

  function showSection(name) {
    currentSection = name;

    // Show/hide sections
    document.querySelectorAll('.section').forEach(s => {
      const active = s.id === 'section-' + name;
      s.classList.toggle('active', active);
      s.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    // Update nav state
    document.querySelectorAll('[data-section]').forEach(l => {
      const active = l.dataset.section === name;
      l.classList.toggle('active', active);
      l.setAttribute('aria-current', active ? 'page' : 'false');
    });

    // Page title
    const TITLES = {
      dashboard:'Dashboard', feeding:'Feeding Tracker', sleep:'Sleep Tracker',
      diaper:'Diaper Tracker', growth:'Growth Tracker', temperature:'Temperature Tracker',
      medicine:'Medicine & Vitamins', vaccination:'Vaccination Tracker',
      doctor:'Doctor Visits', journal:'Baby Journal', milestones:'Milestones',
      analytics:'Analytics', export:'Export & Import', settings:'Settings',
    };
    const titleEl = document.getElementById('topbarTitle');
    if (titleEl) titleEl.textContent = TITLES[name] || 'BabyLog';
    document.title = `BabyLog — ${TITLES[name] || name}`;

    // Render content
    const RENDER = {
      dashboard: renderDashboard, feeding: renderFeeding, sleep: renderSleep,
      diaper: renderDiaper, growth: renderGrowth, temperature: renderTemperature,
      medicine: renderMedicine, vaccination: renderVaccination, doctor: renderDoctor,
      journal: renderJournal, milestones: renderMilestones, analytics: renderAnalytics,
    };
    if (RENDER[name]) {
      try { RENDER[name](); }
      catch(e) { console.error(`[BabyLog] Render error (${name}):`, e); }
    }
  }

  /* ----------------------------------------------------------
     KEYBOARD ACCESSIBILITY
  ---------------------------------------------------------- */
  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      // Escape: close modals/panels/search
      if (e.key === 'Escape') {
        document.getElementById('searchOverlay').style.display = 'none';
        document.getElementById('remindersPanel').style.display = 'none';
        document.getElementById('fabMenu')?.classList.remove('open');
        document.getElementById('fabBtn')?.classList.remove('open');
      }
      // Alt+N: open quick-add for current section
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        const moduleModals = {
          feeding:'feeding', sleep:'sleep', diaper:'diaper', growth:'growth',
          temperature:'temperature', medicine:'medicine', vaccination:'vaccination',
          doctor:'doctor', journal:'journal', milestones:'milestone',
        };
        if (moduleModals[currentSection]) openModal(moduleModals[currentSection]);
      }
      // Alt+D: go to dashboard
      if (e.altKey && e.key === 'd') { e.preventDefault(); showSection('dashboard'); }
    });

    // FAB keyboard support
    document.getElementById('fabBtn')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        document.getElementById('fabBtn').click();
      }
    });
  }

  /* ----------------------------------------------------------
     CLOCK
  ---------------------------------------------------------- */
  function startClock() {
    const tick = () => {
      const now = new Date();
      setText('heroTime', now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }));
      setText('heroDate', now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }));
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ----------------------------------------------------------
     THEME
  ---------------------------------------------------------- */
  function applyStoredTheme() {
    applyTheme(Storage.getSettings().darkMode !== false);
  }

  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const icon  = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if (icon)  { icon.className = dark ? 'fa fa-sun' : 'fa fa-moon'; icon.setAttribute('aria-hidden','true'); }
    if (label) label.textContent = dark ? 'Light Mode' : 'Dark Mode';
    // Update theme-color meta
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#0f1019' : '#6366f1';
    Charts.refreshAll();
  }

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    Storage.saveSettings({ darkMode: !dark });
    applyTheme(!dark);
  });

  /* ----------------------------------------------------------
     SIDEBAR
  ---------------------------------------------------------- */
  function bindSidebar() {
    document.getElementById('hamburgerBtn')?.addEventListener('click', openSidebar);
    document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
  }

  function openSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebarOverlay')?.classList.add('active');
    document.getElementById('hamburgerBtn')?.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
    document.getElementById('hamburgerBtn')?.setAttribute('aria-expanded', 'false');
  }

  /* ----------------------------------------------------------
     FLOATING ACTION BUTTON
  ---------------------------------------------------------- */
  function bindFab() {
    const btn  = document.getElementById('fabBtn');
    const menu = document.getElementById('fabMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close when clicking outside
    document.addEventListener('click', e => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
        btn.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ----------------------------------------------------------
     GLOBAL SEARCH
  ---------------------------------------------------------- */
  function bindSearch() {
    const input   = document.getElementById('globalSearch');
    const overlay = document.getElementById('searchOverlay');
    if (!input || !overlay) return;

    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if (q.length < 2) { overlay.style.display = 'none'; return; }
      searchTimer = setTimeout(() => {
        renderSearchResults(searchAll(q));
        overlay.style.display = 'flex';
      }, 250);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { overlay.style.display = 'none'; input.value = ''; }
    });

    document.addEventListener('click', e => {
      if (!overlay.contains(e.target) && e.target !== input) overlay.style.display = 'none';
    });
  }

  function searchAll(q) {
    const ql = q.toLowerCase();
    const MODULES = [
      { key:'feeding',     icon:'🍼', label:'Feeding',     fields:['type','notes','medicine'] },
      { key:'sleep',       icon:'😴', label:'Sleep',        fields:['quality','notes'] },
      { key:'diaper',      icon:'🧷', label:'Diaper',       fields:['type','color','notes'] },
      { key:'growth',      icon:'📏', label:'Growth',       fields:['notes','weight','height'] },
      { key:'temperature', icon:'🌡️', label:'Temperature',  fields:['temp','method','notes'] },
      { key:'medicine',    icon:'💊', label:'Medicine',     fields:['name','type','dose','notes'] },
      { key:'vaccination', icon:'💉', label:'Vaccination',  fields:['name','hospital','doctor','notes'] },
      { key:'doctor',      icon:'🏥', label:'Doctor Visit', fields:['doctor','hospital','diagnosis','notes'] },
      { key:'journal',     icon:'📖', label:'Journal',      fields:['mood','notes','milestones'] },
      { key:'milestones',  icon:'⭐', label:'Milestone',    fields:['name','notes'] },
    ];
    const results = [];
    for (const mod of MODULES) {
      for (const r of Storage.getRecords(mod.key)) {
        const hay = mod.fields.map(f => r[f] || '').join(' ').toLowerCase()
                  + ' ' + (r.date || r.sleepStart || '').slice(0,10);
        if (hay.includes(ql)) {
          results.push({ module:mod.key, icon:mod.icon, label:mod.label, record:r });
          if (results.length >= 25) return results;
        }
      }
    }
    return results;
  }

  function renderSearchResults(results) {
    const list = document.getElementById('searchResultsList');
    if (!list) return;
    if (!results.length) {
      list.innerHTML = `<div class="search-no-results" role="status">
        <i class="fa fa-magnifying-glass me-2" aria-hidden="true"></i>No results found</div>`;
      return;
    }
    list.innerHTML = results.map(r => {
      const date    = (r.record.date || r.record.sleepStart || r.record.createdAt || '').slice(0,10);
      const preview = r.record.type || r.record.name || r.record.mood
                   || (r.record.temp ? r.record.temp + '°C' : '') || r.label;
      return `<div class="search-result-item" role="option" tabindex="0"
                   onclick="App.goToRecord('${r.module}')"
                   onkeydown="if(event.key==='Enter')App.goToRecord('${r.module}')">
        <span class="sri-emoji" aria-hidden="true">${r.icon}</span>
        <div class="sri-body">
          <div class="sri-main">${escHtml(preview)}</div>
          <div class="sri-sub">${r.label} · ${date || '—'}</div>
        </div>
        <i class="fa fa-chevron-right sri-arrow" aria-hidden="true"></i>
      </div>`;
    }).join('');
  }

  function goToRecord(module) {
    document.getElementById('searchOverlay').style.display = 'none';
    const input = document.getElementById('globalSearch');
    if (input) input.value = '';
    showSection(module);
  }

  /* ----------------------------------------------------------
     BELL / REMINDERS PANEL
  ---------------------------------------------------------- */
  function bindBell() {
    const bell  = document.getElementById('reminderBell');
    const panel = document.getElementById('remindersPanel');
    if (!bell || !panel) return;

    bell.addEventListener('click', e => {
      e.stopPropagation();
      const visible = panel.style.display === 'block';
      panel.style.display = visible ? 'none' : 'block';
      bell.setAttribute('aria-expanded', visible ? 'false' : 'true');
      if (!visible) Reminders.renderPanel();
    });

    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && !bell.contains(e.target)) {
        panel.style.display = 'none';
        bell.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ----------------------------------------------------------
     PERIOD BUTTONS (Analytics)
  ---------------------------------------------------------- */
  function bindPeriodButtons() {
    document.querySelectorAll('.btn-period').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.btn-period').forEach(x => {
          x.classList.remove('active');
          x.setAttribute('aria-pressed', 'false');
        });
        b.classList.add('active');
        b.setAttribute('aria-pressed', 'true');
        analyticsPeriod = b.dataset.period;
        renderAnalytics();
      });
    });
  }

  /* ----------------------------------------------------------
     MODAL BIND — duration auto-calc, custom milestone field
  ---------------------------------------------------------- */
  function bindModalTriggers() {
    // Feeding duration preview
    ['fStart','fEnd'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        const s = getVal('fStart'), e = getVal('fEnd');
        if (s && e) {
          const m = timeDiffMins(s, e);
          const el = document.getElementById('feedDurationPreview');
          if (el) el.textContent = m > 0 ? `⏱ Duration: ${minsToHM(m)}` : '';
        }
      });
    });

    // Sleep duration preview
    ['sStart','sEnd'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        const s = getVal('sStart'), e = getVal('sEnd');
        if (s && e) {
          const m = Math.round((new Date(e) - new Date(s)) / 60000);
          const el = document.getElementById('sleepDurationPreview');
          if (el) el.textContent = m > 0 ? `⏱ Duration: ${minsToHM(m)}` : '';
        }
      });
    });

    // Milestone custom name toggle
    document.getElementById('msName')?.addEventListener('change', e => {
      const wrap = document.getElementById('msCustomWrap');
      if (wrap) wrap.style.display = e.target.value === 'Other' ? 'block' : 'none';
    });

    // Diaper type buttons
    document.querySelectorAll('.diaper-btn').forEach(btn => {
      btn.addEventListener('click', () => setDiaperType(btn.dataset.type, btn));
    });
  }

  /* ----------------------------------------------------------
     MODAL OPEN / CLOSE
  ---------------------------------------------------------- */
  function openModal(type) {
    editingId = null;
    prefillDefaults(type);
    _showModal(modalIdFor(type), modalTitleFor(type));
    closeFabMenu();
  }

  function _showModal(id, titleHtml) {
    const el = document.getElementById(id);
    if (!el) { console.warn('[BabyLog] Modal not found:', id); return; }
    const h5 = el.querySelector('.modal-header-custom h5');
    if (h5 && titleHtml) h5.innerHTML = titleHtml;
    bootstrap.Modal.getOrCreateInstance(el).show();
  }

  function _hideModal(type) {
    const el = document.getElementById(modalIdFor(type));
    if (el) bootstrap.Modal.getInstance(el)?.hide();
  }

  function closeFabMenu() {
    document.getElementById('fabMenu')?.classList.remove('open');
    document.getElementById('fabBtn')?.classList.remove('open');
    document.getElementById('fabBtn')?.setAttribute('aria-expanded', 'false');
  }

  function modalIdFor(type) {
    const MAP = {
      feeding:'modalFeeding', sleep:'modalSleep', diaper:'modalDiaper',
      growth:'modalGrowth', temperature:'modalTemperature', medicine:'modalMedicine',
      vaccination:'modalVaccination', doctor:'modalDoctor', journal:'modalJournal',
      milestone:'modalMilestone',
    };
    return MAP[type] || 'modal' + type[0].toUpperCase() + type.slice(1);
  }

  function modalTitleFor(type) {
    const MAP = {
      feeding:     '<i class="fa fa-droplet me-2" aria-hidden="true"></i>Log Feeding',
      sleep:       '<i class="fa fa-moon me-2" aria-hidden="true"></i>Log Sleep',
      diaper:      '<i class="fa fa-baby me-2" aria-hidden="true"></i>Log Diaper Change',
      growth:      '<i class="fa fa-chart-line me-2" aria-hidden="true"></i>Log Measurement',
      temperature: '<i class="fa fa-thermometer-half me-2" aria-hidden="true"></i>Log Temperature',
      medicine:    '<i class="fa fa-pills me-2" aria-hidden="true"></i>Log Medicine / Vitamin',
      vaccination: '<i class="fa fa-syringe me-2" aria-hidden="true"></i>Log Vaccine',
      doctor:      '<i class="fa fa-stethoscope me-2" aria-hidden="true"></i>Log Doctor Visit',
      journal:     '<i class="fa fa-book-open me-2" aria-hidden="true"></i>New Journal Entry',
      milestone:   '<i class="fa fa-star me-2" aria-hidden="true"></i>Log Milestone',
    };
    return MAP[type] || type;
  }

  /* ----------------------------------------------------------
     PREFILL MODAL DEFAULTS
  ---------------------------------------------------------- */
  function prefillDefaults(type) {
    const today = todayStr(), now = nowTimeStr(), nowDT = nowDatetimeStr();
    const fp = document.getElementById('feedDurationPreview');
    const sp = document.getElementById('sleepDurationPreview');
    if (fp) fp.textContent = '';
    if (sp) sp.textContent = '';

    switch(type) {
      case 'feeding':
        setVal('fDate', today); setVal('fStart', now); setVal('fEnd','');
        setVal('fType', Storage.getSettings().feedType || 'Left Breast');
        setVal('fAmount',''); setVal('fMedicine',''); setVal('fNotes','');
        setChecked('fBurped',false); setChecked('fSpitUp',false); setChecked('fVomited',false);
        break;
      case 'sleep':
        setVal('sStart',nowDT); setVal('sEnd',''); setVal('sQuality','Good'); setVal('sNotes','');
        break;
      case 'diaper':
        setVal('dDate',today); setVal('dTime',now); setVal('dColor',''); setVal('dConsistency',''); setVal('dNotes','');
        setDiaperType('wet');
        break;
      case 'growth':
        setVal('gDate',today); setVal('gWeight',''); setVal('gHeight',''); setVal('gHead',''); setVal('gNotes','');
        break;
      case 'temperature':
        setVal('tDate',today); setVal('tTime',now); setVal('tTemp',''); setVal('tMethod','Armpit'); setVal('tNotes','');
        break;
      case 'medicine':
        setVal('mDate',today); setVal('mTime',now); setVal('mName',''); setVal('mType','Vitamin');
        setVal('mDose',''); setVal('mNotes',''); setChecked('mCompleted',true);
        break;
      case 'vaccination':
        setVal('vName',''); setVal('vDue',''); setVal('vCompleted','');
        setVal('vHospital',''); setVal('vDoctor',''); setVal('vNotes','');
        break;
      case 'doctor':
        setVal('drDate',today); setVal('drFollowup',''); setVal('drDoctor','');
        setVal('drHospital',''); setVal('drDiagnosis',''); setVal('drPrescription',''); setVal('drNotes','');
        break;
      case 'journal':
        setVal('jDate',today); setVal('jMood','😊 Happy'); setVal('jNotes',''); setVal('jMilestones',''); setVal('jPhoto','');
        break;
      case 'milestone':
        setVal('msName','First Smile'); setVal('msDate',today); setVal('msNotes',''); setVal('msCustom','');
        const msWrap = document.getElementById('msCustomWrap');
        if (msWrap) msWrap.style.display = 'none';
        break;
    }
  }

  /* ----------------------------------------------------------
     SAVE FUNCTIONS
  ---------------------------------------------------------- */
  function saveFeeding() {
    const date = getVal('fDate'), start = getVal('fStart');
    if (!date)  return toast('Date is required', 'warning');
    if (!start) return toast('Start time is required', 'warning');
    const end  = getVal('fEnd');
    const mins = (end && start) ? timeDiffMins(start, end) : 0;
    _persist('feeding', {
      date, startTime:start, endTime:end, durationMins:mins,
      type:getVal('fType'), amount:getVal('fAmount'), medicine:getVal('fMedicine'),
      burped:getChecked('fBurped'), spitUp:getChecked('fSpitUp'), vomited:getChecked('fVomited'),
      notes:getVal('fNotes')
    });
    _hideModal('feeding');
    toast(editingId ? 'Feeding updated ✏️' : 'Feeding logged 🍼', 'success');
    editingId = null;
    renderFeeding(); renderDashboard();
  }

  function saveSleep() {
    const start = getVal('sStart');
    if (!start) return toast('Start time is required', 'warning');
    const end  = getVal('sEnd');
    const mins = end ? Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000)) : 0;
    if (end && new Date(end) <= new Date(start)) return toast('Wake time must be after sleep start', 'warning');
    _persist('sleep', { sleepStart:start, sleepEnd:end, durationMins:mins, quality:getVal('sQuality'), notes:getVal('sNotes') });
    _hideModal('sleep');
    toast(editingId ? 'Sleep updated ✏️' : 'Sleep logged 😴', 'success');
    editingId = null;
    renderSleep(); renderDashboard();
  }

  function saveDiaper() {
    const date = getVal('dDate');
    if (!date) return toast('Date is required', 'warning');
    _persist('diaper', { date, time:getVal('dTime'), type:diaperType, color:getVal('dColor'), consistency:getVal('dConsistency'), notes:getVal('dNotes') });
    _hideModal('diaper');
    toast(editingId ? 'Diaper updated ✏️' : 'Diaper logged 🧷', 'success');
    editingId = null;
    renderDiaper(); renderDashboard();
  }

  function saveGrowth() {
    const date = getVal('gDate');
    if (!date) return toast('Date is required', 'warning');
    if (!getVal('gWeight') && !getVal('gHeight') && !getVal('gHead')) return toast('Enter at least one measurement', 'warning');
    _persist('growth', { date, weight:getVal('gWeight'), height:getVal('gHeight'), headCirc:getVal('gHead'), notes:getVal('gNotes') });
    _hideModal('growth');
    toast(editingId ? 'Growth updated ✏️' : 'Growth recorded 📏', 'success');
    editingId = null;
    renderGrowth(); renderDashboard();
  }

  function saveTemperature() {
    const date = getVal('tDate'), temp = getVal('tTemp');
    if (!date) return toast('Date is required', 'warning');
    if (!temp) return toast('Temperature is required', 'warning');
    const t = parseFloat(temp);
    if (isNaN(t) || t < 30 || t > 45) return toast('Enter a valid temperature between 30–45°C', 'warning');
    _persist('temperature', { date, time:getVal('tTime'), temp, method:getVal('tMethod'), notes:getVal('tNotes') });
    _hideModal('temperature');
    if (t >= 38) toast(`⚠️ Fever detected: ${temp}°C — please consult your doctor`, 'error', 7000);
    else toast(editingId ? 'Temperature updated ✏️' : `Temperature logged: ${temp}°C 🌡️`, 'success');
    editingId = null;
    renderTemperature(); renderDashboard();
  }

  function saveMedicine() {
    const name = getVal('mName').trim();
    if (!name) return toast('Medicine name is required', 'warning');
    _persist('medicine', {
      date:getVal('mDate'), time:getVal('mTime'), name, type:getVal('mType'),
      dose:getVal('mDose'), completed:getChecked('mCompleted'), notes:getVal('mNotes')
    });
    _hideModal('medicine');
    toast(editingId ? 'Updated ✏️' : `${getVal('mType') || 'Medicine'} logged 💊`, 'success');
    editingId = null;
    renderMedicine(); renderDashboard();
  }

  function saveVaccination() {
    const name = getVal('vName').trim();
    if (!name) return toast('Vaccine name is required', 'warning');
    _persist('vaccination', {
      name, dueDate:getVal('vDue'), completedDate:getVal('vCompleted'),
      hospital:getVal('vHospital'), doctor:getVal('vDoctor'), notes:getVal('vNotes')
    });
    _hideModal('vaccination');
    toast(editingId ? 'Updated ✏️' : 'Vaccine logged 💉', 'success');
    editingId = null;
    renderVaccination(); renderDashboard();
  }

  function saveDoctor() {
    const date = getVal('drDate');
    if (!date) return toast('Date is required', 'warning');
    _persist('doctor', {
      date, followupDate:getVal('drFollowup'), doctor:getVal('drDoctor'),
      hospital:getVal('drHospital'), diagnosis:getVal('drDiagnosis'),
      prescription:getVal('drPrescription'), notes:getVal('drNotes')
    });
    _hideModal('doctor');
    toast(editingId ? 'Updated ✏️' : 'Doctor visit logged 🏥', 'success');
    editingId = null;
    renderDoctor();
  }

  function saveJournal() {
    const date = getVal('jDate');
    if (!date) return toast('Date is required', 'warning');
    _persist('journal', { date, mood:getVal('jMood'), notes:getVal('jNotes'), milestones:getVal('jMilestones'), photo:getVal('jPhoto') });
    _hideModal('journal');
    toast(editingId ? 'Updated ✏️' : 'Journal entry saved 📖', 'success');
    editingId = null;
    renderJournal();
  }

  function saveMilestone() {
    let name = getVal('msName');
    if (name === 'Other') name = getVal('msCustom').trim();
    if (!name) return toast('Milestone name is required', 'warning');
    const date = getVal('msDate');
    if (!date) return toast('Date is required', 'warning');
    _persist('milestones', { name, date, notes:getVal('msNotes'), emoji:milestoneEmoji(name) });
    _hideModal('milestone');
    toast(editingId ? 'Updated ✏️' : `🎉 Milestone recorded: ${name}!`, 'success');
    editingId = null;
    renderMilestones();
  }

  // Generic persist — routes to update or save
  function _persist(module, data) {
    if (editingId) Storage.update(module, editingId, data);
    else           Storage.save(module, data);
  }

  /* ----------------------------------------------------------
     EDIT RECORDS
  ---------------------------------------------------------- */
  function editRecord(module, id) {
    const r = Storage.getById(module, id);
    if (!r) return toast('Record not found', 'error');
    editingId = id;

    switch(module) {
      case 'feeding':
        setVal('fDate',r.date||''); setVal('fStart',r.startTime||''); setVal('fEnd',r.endTime||'');
        setVal('fType',r.type||'Left Breast'); setVal('fAmount',r.amount||'');
        setVal('fMedicine',r.medicine||''); setVal('fNotes',r.notes||'');
        setChecked('fBurped',!!r.burped); setChecked('fSpitUp',!!r.spitUp); setChecked('fVomited',!!r.vomited);
        _showModal('modalFeeding','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Feeding');
        break;
      case 'sleep':
        setVal('sStart',r.sleepStart||''); setVal('sEnd',r.sleepEnd||'');
        setVal('sQuality',r.quality||'Good'); setVal('sNotes',r.notes||'');
        _showModal('modalSleep','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Sleep');
        break;
      case 'diaper':
        setVal('dDate',r.date||''); setVal('dTime',r.time||'');
        setVal('dColor',r.color||''); setVal('dConsistency',r.consistency||''); setVal('dNotes',r.notes||'');
        setDiaperType(r.type || 'wet');
        _showModal('modalDiaper','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Diaper');
        break;
      case 'growth':
        setVal('gDate',r.date||''); setVal('gWeight',r.weight||'');
        setVal('gHeight',r.height||''); setVal('gHead',r.headCirc||''); setVal('gNotes',r.notes||'');
        _showModal('modalGrowth','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Measurement');
        break;
      case 'temperature':
        setVal('tDate',r.date||''); setVal('tTime',r.time||'');
        setVal('tTemp',r.temp||''); setVal('tMethod',r.method||'Armpit'); setVal('tNotes',r.notes||'');
        _showModal('modalTemperature','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Temperature');
        break;
      case 'medicine':
        setVal('mDate',r.date||''); setVal('mTime',r.time||'');
        setVal('mName',r.name||''); setVal('mType',r.type||'Medicine');
        setVal('mDose',r.dose||''); setVal('mNotes',r.notes||''); setChecked('mCompleted',!!r.completed);
        _showModal('modalMedicine','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Medicine');
        break;
      case 'vaccination':
        setVal('vName',r.name||''); setVal('vDue',r.dueDate||''); setVal('vCompleted',r.completedDate||'');
        setVal('vHospital',r.hospital||''); setVal('vDoctor',r.doctor||''); setVal('vNotes',r.notes||'');
        _showModal('modalVaccination','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Vaccine');
        break;
      case 'doctor':
        setVal('drDate',r.date||''); setVal('drFollowup',r.followupDate||'');
        setVal('drDoctor',r.doctor||''); setVal('drHospital',r.hospital||'');
        setVal('drDiagnosis',r.diagnosis||''); setVal('drPrescription',r.prescription||''); setVal('drNotes',r.notes||'');
        _showModal('modalDoctor','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Doctor Visit');
        break;
      case 'journal':
        setVal('jDate',r.date||''); setVal('jMood',r.mood||'😊 Happy');
        setVal('jNotes',r.notes||''); setVal('jMilestones',r.milestones||''); setVal('jPhoto',r.photo||'');
        _showModal('modalJournal','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Journal Entry');
        break;
      case 'milestones':
        const KNOWN = ['First Smile','Lift Head','Roll Over','Sit Up','Crawl','Stand','Walk','First Tooth','First Word'];
        if (KNOWN.includes(r.name)) {
          setVal('msName',r.name);
          document.getElementById('msCustomWrap').style.display = 'none';
        } else {
          setVal('msName','Other'); setVal('msCustom',r.name||'');
          document.getElementById('msCustomWrap').style.display = 'block';
        }
        setVal('msDate',r.date||''); setVal('msNotes',r.notes||'');
        _showModal('modalMilestone','<i class="fa fa-pen me-2" aria-hidden="true"></i>Edit Milestone');
        break;
    }
  }

  /* ----------------------------------------------------------
     DELETE RECORDS
  ---------------------------------------------------------- */
  function deleteRecord(module, id) {
    _confirm('Delete Record', 'This record will be permanently deleted. This cannot be undone.', 'Delete', () => {
      Storage.remove(module, id);
      toast('Record deleted', 'info');
      const RENDER = {
        feeding:renderFeeding, sleep:renderSleep, diaper:renderDiaper, growth:renderGrowth,
        temperature:renderTemperature, medicine:renderMedicine, vaccination:renderVaccination,
        doctor:renderDoctor, journal:renderJournal, milestones:renderMilestones,
      };
      RENDER[module]?.();
      renderDashboard();
    });
  }

  /* ----------------------------------------------------------
     CONFIRM DIALOG
  ---------------------------------------------------------- */
  function _confirm(title, msg, okLabel, onYes) {
    document.getElementById('_confirmOverlay')?.remove();
    const el = document.createElement('div');
    el.id = '_confirmOverlay';
    el.className = 'confirm-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', '_confirmTitle');
    el.innerHTML = `
      <div class="confirm-box" role="alertdialog">
        <div class="confirm-icon" aria-hidden="true">⚠️</div>
        <div class="confirm-title" id="_confirmTitle">${escHtml(title)}</div>
        <div class="confirm-msg">${escHtml(msg)}</div>
        <div class="confirm-btns">
          <button class="confirm-cancel" autofocus>Cancel</button>
          <button class="confirm-ok">${escHtml(okLabel || 'Confirm')}</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('.confirm-cancel').onclick = () => el.remove();
    el.querySelector('.confirm-ok').onclick = () => { el.remove(); onYes(); };
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') el.remove(); });
    el.querySelector('.confirm-cancel').focus();
  }

  /* ----------------------------------------------------------
     QUICK ACTIONS
  ---------------------------------------------------------- */
  function setDiaperType(type, btn) {
    diaperType = type || 'wet';
    setVal('dType', diaperType);
    document.querySelectorAll('.diaper-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === diaperType);
      b.setAttribute('aria-pressed', b.dataset.type === diaperType ? 'true' : 'false');
    });
  }

  function toggleMedicine(id) {
    const r = Storage.getById('medicine', id);
    if (!r) return;
    Storage.update('medicine', id, { completed: !r.completed });
    toast(!r.completed ? 'Marked as done ✅' : 'Marked as pending ↩️', 'info');
    renderMedicine(); renderDashboard();
  }

  function markVaccineDone(id) {
    Storage.update('vaccination', id, { completedDate: todayStr() });
    toast('Vaccine marked as done! 💉', 'success');
    renderVaccination(); renderDashboard();
  }

  function clearFilter(module) {
    ['FilterDate','FilterType'].forEach(suffix => {
      const el = document.getElementById(module + suffix);
      if (el) el.value = '';
    });
    const RENDER = { feeding:renderFeeding, sleep:renderSleep, diaper:renderDiaper };
    RENDER[module]?.();
  }

  /* ----------------------------------------------------------
     SETTINGS
  ---------------------------------------------------------- */
  function loadSettingsToUI() {
    const s = Storage.getSettings();
    setVal('settingBabyName',     s.babyName     || '');
    setVal('settingBirthday',     s.birthday     || '');
    setVal('settingWeight',       s.weight       || '');
    setVal('settingFeedInterval', s.feedInterval || 2);
    setVal('settingTempUnit',     s.tempUnit     || 'C');
    setChecked('settingSound',    s.notifSound !== false);
  }

  function saveSettings() {
    const s = {
      babyName:      getVal('settingBabyName').trim(),
      birthday:      getVal('settingBirthday'),
      weight:        getVal('settingWeight'),
      feedInterval:  Math.max(1, Math.min(6, +getVal('settingFeedInterval') || 2)),
      tempUnit:      getVal('settingTempUnit') || 'C',
      notifSound:    getChecked('settingSound'),
      darkMode:      document.documentElement.getAttribute('data-theme') === 'dark',
    };
    if (s.babyName.length > 50) return toast('Baby name is too long', 'warning');
    Storage.saveSettings(s);
    renderDashboard();
    Reminders.renderDashStrip();
    toast('Settings saved ✅', 'success');
  }

  function loadSampleData() {
    _confirm('Load Sample Data', 'Add realistic sample records to explore all features? Your existing data will be kept.',
      'Load Data', () => {
        try {
          SampleData.load();
          toast('Sample data loaded! 🎉', 'success');
          renderDashboard();
        } catch(e) {
          console.error(e);
          toast('Failed to load sample data: ' + e.message, 'error');
        }
      });
  }

  function clearAllData() {
    _confirm('Clear ALL Data',
      '⚠️ Every record and setting will be permanently deleted. This cannot be undone. Are you absolutely sure?',
      '⚠️ Yes, Delete All', () => {
        Storage.clearAll();
        Storage.init(); // re-create empty keys
        toast('All data cleared', 'info');
        loadSettingsToUI();
        showSection('dashboard');
      });
  }

  /* ----------------------------------------------------------
     ============================================================
     RENDER — DASHBOARD
     ============================================================
  ---------------------------------------------------------- */
  function renderDashboard() {
    const s   = Storage.getSettings();
    const age = calcAge(s.birthday);

    // Hero
    setText('heroBabyName', s.babyName || 'Baby');
    setText('heroBabyAge',  age ? age.text : '—');
    setText('heroBirthday', s.birthday ? formatDate(s.birthday) : '—');

    // Sidebar
    setText('navBabyName', s.babyName || 'Baby');
    setText('navBabyAge',  age ? age.text : '—');

    // Summary stats
    const sum   = Stats.dashboardSummary();
    const feedS = sum.feeding, sleepS = sum.sleep, diaperS = sum.diaper;
    const growS = sum.growth, tempS = sum.temperature, medS = sum.medicine, vaxS = sum.vaccination;

    setText('todayFeedings', feedS.count);
    setText('todayMilk',     feedS.totalMl ? feedS.totalMl + ' ml' : '0 ml');
    setText('todayWet',      diaperS.wet);
    setText('todayDirty',    diaperS.dirty);
    setText('todaySleep',    minsToHM(sleepS.totalMins) || '0h 0m');

    // Last feeding
    const lf = feedS.lastFeed;
    setText('lastFeeding', lf ? `${formatTime12(lf.startTime)} (${lf.type || ''})` : '—');

    // Next feeding estimate
    if (feedS.nextFeedingTime) {
      const nf   = feedS.nextFeedingTime;
      const time = formatTime12(`${pad(nf.getHours())}:${pad(nf.getMinutes())}`);
      const diff = feedS.nextFeedingMins;
      setText('nextFeeding', diff > 0 ? `${time} (in ${minsToHM(diff)})` : `${time} (now)`);
    } else {
      setText('nextFeeding', '—');
    }

    // Last sleep
    setText('lastSleep', sleepS.lastSleep ? formatDT(sleepS.lastSleep.sleepStart) : '—');

    // Weight
    setText('currentWeight', growS.latestWeight ? growS.latestWeight + ' kg' : '—');

    // Temperature with color coding
    const tempEl = document.getElementById('currentTemp');
    if (tempEl) {
      if (tempS.latest) {
        const ts = tempStatus(parseFloat(tempS.latest.temp));
        tempEl.textContent = tempS.latest.temp + '°C';
        tempEl.style.color = ts.color;
      } else {
        tempEl.textContent = '—';
        tempEl.style.color = '';
      }
    }

    // Next vaccine
    const nv = vaxS.nextVaccine;
    setText('nextVaccine', nv ? nv.name : (vaxS.done === vaxS.total && vaxS.total > 0 ? '✅ All done' : '—'));

    // Next vitamin
    const nm = medS.nextVit;
    setText('nextVitamin', nm ? nm.name : (medS.completed > 0 ? '✅ All done' : '—'));

    // Reminders
    Reminders.renderDashStrip();

    // Charts
    Charts.renderDashboardCharts();
  }

  /* ----------------------------------------------------------
     RENDER — FEEDING
  ---------------------------------------------------------- */
  function renderFeeding() {
    const filterDate = getVal('feedingFilterDate');
    const filterType = getVal('feedingFilterType');
    let recs = Storage.getRecords('feeding');
    if (filterDate) recs = recs.filter(r => r.date === filterDate);
    if (filterType) recs = recs.filter(r => r.type === filterType);

    const all = Storage.getRecords('feeding');
    const fs  = Stats.feeding({ start:todayStr(), end:todayStr() });
    _renderStatsRow('feedingStats', [
      { val:`${all.filter(r=>r.date===todayStr()).length} feeds`, label:'Today'        },
      { val:`${fs.totalMl} ml`,                                  label:'Milk Today'   },
      { val:minsToHM(fs.avgIntervalMins) || '—',                 label:'Avg Interval' },
      { val:minsToHM(fs.avgDurMins) || '—',                      label:'Avg Duration' },
      { val:all.length,                                           label:'Total Records'},
    ]);

    const el = document.getElementById('feedingList');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('🍼','No feedings logged',"Tap '+ Add Feeding' to log baby's first feed."); return; }

    el.innerHTML = recs.map(r => {
      const dur = r.durationMins ? ` · ${minsToHM(+r.durationMins)}` : '';
      return `<div class="record-card" id="rec-${r.id}">
        <div class="record-icon-col" style="background:rgba(99,102,241,.1)" aria-hidden="true">🍼</div>
        <div class="record-body">
          <div class="record-title">
            ${escHtml(r.type)}
            ${r.amount  ? `<span class="record-chip chip-blue">${r.amount} ml</span>` : ''}
            ${r.burped  ? '<span class="record-chip chip-green">Burped</span>'         : ''}
            ${r.spitUp  ? '<span class="record-chip chip-yellow">Spit Up</span>'       : ''}
            ${r.vomited ? '<span class="record-chip chip-red">Vomited</span>'          : ''}
          </div>
          <div class="record-meta">
            <i class="fa fa-calendar-day" aria-hidden="true"></i> ${formatDate(r.date)}
            &nbsp;·&nbsp;<i class="fa fa-clock" aria-hidden="true"></i> ${formatTime12(r.startTime)}
            ${r.endTime ? ' → ' + formatTime12(r.endTime) : ''}${dur}
            ${r.medicine ? ` · 💊 ${escHtml(r.medicine)}` : ''}
          </div>
          ${r.notes ? `<div class="record-notes">"${escHtml(r.notes)}"</div>` : ''}
        </div>
        <div class="record-actions">
          <button class="btn-rec-edit"   onclick="App.editRecord('feeding','${r.id}')" aria-label="Edit feeding record" title="Edit"><i class="fa fa-pen" aria-hidden="true"></i></button>
          <button class="btn-rec-delete" onclick="App.deleteRecord('feeding','${r.id}')" aria-label="Delete feeding record" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>`;
    }).join('');

    // Bind live filters
    ['feedingFilterDate','feedingFilterType'].forEach(id => {
      const el2 = document.getElementById(id);
      if (el2 && !el2._bound) { el2._bound = true; el2.addEventListener('change', renderFeeding); }
    });
  }

  /* ----------------------------------------------------------
     RENDER — SLEEP
  ---------------------------------------------------------- */
  function renderSleep() {
    const filterDate = getVal('sleepFilterDate');
    let recs = Storage.getRecords('sleep');
    if (filterDate) recs = recs.filter(r => r.sleepStart?.slice(0,10) === filterDate);

    const ss = Stats.sleep(null);
    _renderStatsRow('sleepStats', [
      { val:minsToHM(ss.totalMins) || '0h', label:'Today'       },
      { val:minsToHM(ss.longest)   || '—',  label:'Longest'     },
      { val:minsToHM(ss.avgMins)   || '—',  label:'Avg per Nap' },
      { val:minsToHM(ss.avgDailyMins)||'—', label:'7-Day Avg'   },
      { val:Storage.getRecords('sleep').length, label:'Records'  },
    ]);

    const QCOL = { Excellent:'#22c55e', Good:'#3b82f6', Fair:'#f59e0b', Poor:'#ef4444' };
    const el = document.getElementById('sleepList');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('😴','No sleep logged',"Tap '+ Add Sleep' to start tracking."); return; }
    el.innerHTML = recs.map(r => {
      const qc  = QCOL[r.quality] || 'var(--text-3)';
      const dur = r.durationMins ? minsToHM(+r.durationMins) : '—';
      return `<div class="record-card" id="rec-${r.id}">
        <div class="record-icon-col" style="background:rgba(76,217,192,.1)" aria-hidden="true">😴</div>
        <div class="record-body">
          <div class="record-title">
            ${formatDT(r.sleepStart)} → ${r.sleepEnd ? formatDT(r.sleepEnd) : '<em>ongoing…</em>'}
            ${r.quality ? `<span class="record-chip" style="background:${qc}22;color:${qc}">${r.quality}</span>` : ''}
          </div>
          <div class="record-meta"><i class="fa fa-hourglass-half" aria-hidden="true"></i> ${dur}</div>
          ${r.notes ? `<div class="record-notes">"${escHtml(r.notes)}"</div>` : ''}
        </div>
        <div class="record-actions">
          <button class="btn-rec-edit"   onclick="App.editRecord('sleep','${r.id}')"   aria-label="Edit sleep record"   title="Edit"  ><i class="fa fa-pen"   aria-hidden="true"></i></button>
          <button class="btn-rec-delete" onclick="App.deleteRecord('sleep','${r.id}')" aria-label="Delete sleep record" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>`;
    }).join('');

    const sf = document.getElementById('sleepFilterDate');
    if (sf && !sf._bound) { sf._bound = true; sf.addEventListener('change', renderSleep); }
  }

  /* ----------------------------------------------------------
     RENDER — DIAPER
  ---------------------------------------------------------- */
  function renderDiaper() {
    const filterDate = getVal('diaperFilterDate');
    let recs = Storage.getRecords('diaper');
    if (filterDate) recs = recs.filter(r => r.date === filterDate);

    const ds = Stats.diaper({ start:todayStr(), end:todayStr() });
    _renderStatsRow('diaperStats', [
      { val:ds.count,                             label:'Today Total'  },
      { val:`${ds.wet} 💧`,                       label:'Wet Today'    },
      { val:`${ds.dirty} 💩`,                     label:'Dirty Today'  },
      { val:`${Stats.diaper(null).avgPerDay}/day`,label:'7-Day Avg'   },
      { val:Storage.getRecords('diaper').length,  label:'Total Records'},
    ]);

    const TYPE = {
      wet:   { emoji:'💧', label:'Wet',   bg:'rgba(59,130,246,.1)' },
      dirty: { emoji:'💩', label:'Dirty', bg:'rgba(249,115,22,.1)' },
      both:  { emoji:'🔄', label:'Both',  bg:'rgba(139,92,246,.1)' },
    };
    const el = document.getElementById('diaperList');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('🧷','No diapers logged',"Tap '+ Add Diaper' to start tracking."); return; }
    el.innerHTML = recs.map(r => {
      const tm = TYPE[r.type] || { emoji:'🧷', label:r.type || 'Unknown', bg:'rgba(0,0,0,.06)' };
      return `<div class="record-card" id="rec-${r.id}">
        <div class="record-icon-col" style="background:${tm.bg}" aria-hidden="true">${tm.emoji}</div>
        <div class="record-body">
          <div class="record-title">${tm.label} Diaper
            ${r.color       ? `<span class="record-chip chip-gray">${escHtml(r.color)}</span>`       : ''}
            ${r.consistency ? `<span class="record-chip chip-gray">${escHtml(r.consistency)}</span>` : ''}
          </div>
          <div class="record-meta">
            <i class="fa fa-calendar-day" aria-hidden="true"></i> ${formatDate(r.date)}
            ${r.time ? ` · <i class="fa fa-clock" aria-hidden="true"></i> ${formatTime12(r.time)}` : ''}
          </div>
          ${r.notes ? `<div class="record-notes">"${escHtml(r.notes)}"</div>` : ''}
        </div>
        <div class="record-actions">
          <button class="btn-rec-edit"   onclick="App.editRecord('diaper','${r.id}')"   aria-label="Edit diaper record"   title="Edit"  ><i class="fa fa-pen"   aria-hidden="true"></i></button>
          <button class="btn-rec-delete" onclick="App.deleteRecord('diaper','${r.id}')" aria-label="Delete diaper record" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>`;
    }).join('');

    const df = document.getElementById('diaperFilterDate');
    if (df && !df._bound) { df._bound = true; df.addEventListener('change', renderDiaper); }
  }

  /* ----------------------------------------------------------
     RENDER — GROWTH
  ---------------------------------------------------------- */
  function renderGrowth() {
    Charts.renderGrowthCharts();
    const recs = Storage.getRecords('growth');
    const el   = document.getElementById('growthList');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('📏','No measurements','Track weight, height & head circumference.'); return; }
    el.innerHTML = recs.map(r => `
      <div class="record-card" id="rec-${r.id}">
        <div class="record-icon-col" style="background:rgba(34,197,94,.1)" aria-hidden="true">📏</div>
        <div class="record-body">
          <div class="record-title">${formatDate(r.date)}</div>
          <div class="record-meta">
            ${r.weight   ? `⚖️ <strong>${r.weight} kg</strong>&nbsp; ` : ''}
            ${r.height   ? `📐 <strong>${r.height} cm</strong>&nbsp; ` : ''}
            ${r.headCirc ? `🔵 Head: <strong>${r.headCirc} cm</strong>` : ''}
          </div>
          ${r.notes ? `<div class="record-notes">"${escHtml(r.notes)}"</div>` : ''}
        </div>
        <div class="record-actions">
          <button class="btn-rec-edit"   onclick="App.editRecord('growth','${r.id}')"   aria-label="Edit growth record"   title="Edit"  ><i class="fa fa-pen"   aria-hidden="true"></i></button>
          <button class="btn-rec-delete" onclick="App.deleteRecord('growth','${r.id}')" aria-label="Delete growth record" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>`).join('');
  }

  /* ----------------------------------------------------------
     RENDER — TEMPERATURE
  ---------------------------------------------------------- */
  function renderTemperature() {
    Charts.renderTempTrend('chartTemp');
    const recs = Storage.getRecords('temperature');
    const el   = document.getElementById('temperatureList');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('🌡️','No temperatures logged','Log readings to see trends and fever alerts.'); return; }
    el.innerHTML = recs.map(r => {
      const ts = tempStatus(parseFloat(r.temp));
      return `<div class="record-card" id="rec-${r.id}">
        <div class="record-icon-col" style="background:${ts.bg}" aria-hidden="true">🌡️</div>
        <div class="record-body">
          <div class="record-title" style="color:${ts.color}">
            ${escHtml(r.temp)}°C
            <span class="record-chip" style="background:${ts.bg};color:${ts.color}">${ts.label}</span>
          </div>
          <div class="record-meta">
            <i class="fa fa-calendar-day" aria-hidden="true"></i> ${formatDate(r.date)}
            ${r.time   ? ` · <i class="fa fa-clock" aria-hidden="true"></i> ${formatTime12(r.time)}` : ''}
            ${r.method ? ` · ${escHtml(r.method)}` : ''}
          </div>
          ${r.notes ? `<div class="record-notes">"${escHtml(r.notes)}"</div>` : ''}
        </div>
        <div class="record-actions">
          <button class="btn-rec-edit"   onclick="App.editRecord('temperature','${r.id}')"   aria-label="Edit temperature"        title="Edit"  ><i class="fa fa-pen"   aria-hidden="true"></i></button>
          <button class="btn-rec-delete" onclick="App.deleteRecord('temperature','${r.id}')" aria-label="Delete temperature record" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>`;
    }).join('');
  }

  /* ----------------------------------------------------------
     RENDER — MEDICINE
  ---------------------------------------------------------- */
  function renderMedicine() {
    const recs = Storage.getRecords('medicine');
    const ms   = Stats.medicine(null);
    _renderStatsRow('medicineStats', [
      { val:recs.length,  label:'Total'      },
      { val:ms.completed, label:'✅ Done'     },
      { val:ms.pending,   label:'⏳ Pending'  },
      { val:ms.pct + '%', label:'Compliance' },
    ]);
    const el = document.getElementById('medicineList');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('💊','No medicines logged','Track medicines, vitamins & supplements.'); return; }
    const ICONS = { Vitamin:'🌿', Supplement:'🍃', Medicine:'💊' };
    el.innerHTML = recs.map(r => `
      <div class="record-card ${r.completed ? '' : 'record-pending'}" id="rec-${r.id}">
        <div class="record-icon-col" style="background:rgba(124,58,237,.1)" aria-hidden="true">${ICONS[r.type] || '💊'}</div>
        <div class="record-body">
          <div class="record-title">
            ${escHtml(r.name)}
            <span class="record-chip ${r.completed ? 'chip-green' : 'chip-yellow'}">${r.completed ? 'Done' : 'Pending'}</span>
            <span class="record-chip chip-purple">${escHtml(r.type || '')}</span>
          </div>
          <div class="record-meta">
            ${r.dose ? `💉 ${escHtml(r.dose)} · ` : ''}
            <i class="fa fa-calendar-day" aria-hidden="true"></i> ${formatDate(r.date)}
            ${r.time ? ` · ${formatTime12(r.time)}` : ''}
          </div>
          ${r.notes ? `<div class="record-notes">"${escHtml(r.notes)}"</div>` : ''}
        </div>
        <div class="record-actions">
          <button class="btn-rec-toggle ${r.completed ? 'toggled' : ''}" onclick="App.toggleMedicine('${r.id}')"
            aria-label="${r.completed ? 'Mark as pending' : 'Mark as done'}" title="${r.completed ? 'Undo' : 'Done'}">
            <i class="fa ${r.completed ? 'fa-rotate-left' : 'fa-check'}" aria-hidden="true"></i>
          </button>
          <button class="btn-rec-edit"   onclick="App.editRecord('medicine','${r.id}')"   aria-label="Edit medicine"        title="Edit"  ><i class="fa fa-pen"   aria-hidden="true"></i></button>
          <button class="btn-rec-delete" onclick="App.deleteRecord('medicine','${r.id}')" aria-label="Delete medicine record" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>`).join('');
  }

  /* ----------------------------------------------------------
     RENDER — VACCINATION
  ---------------------------------------------------------- */
  function renderVaccination() {
    const recs  = Storage.getRecords('vaccination');
    const vs    = Stats.vaccination();
    const prog  = document.getElementById('vaccineProgress');
    if (prog) {
      prog.innerHTML = recs.length ? `
        <div class="vaccine-prog-wrap">
          <div class="vp-header">
            <span>Vaccination Progress</span>
            <span class="vp-pct">${vs.done}/${vs.total} complete (${vs.pct}%)</span>
          </div>
          <div class="vp-bar-track" role="progressbar" aria-valuenow="${vs.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Vaccination progress ${vs.pct}%">
            <div class="vp-bar-fill" style="width:${vs.pct}%"></div>
          </div>
          ${vs.overdue > 0 ? `<div class="vp-alert" role="alert"><i class="fa fa-triangle-exclamation me-1" aria-hidden="true"></i>${vs.overdue} overdue vaccine${vs.overdue > 1 ? 's' : ''}!</div>` : ''}
        </div>` : '';
    }
    const today = todayStr();
    const el    = document.getElementById('vaccinationList');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('💉','No vaccinations logged',"Track baby's complete vaccine schedule."); return; }
    el.innerHTML = recs.map(r => {
      const done    = !!r.completedDate;
      const overdue = !done && r.dueDate && r.dueDate < today;
      const daysL   = r.dueDate ? Math.ceil((new Date(r.dueDate) - new Date()) / 86400000) : null;
      const status  = done ? 'Done' : overdue ? 'Overdue' : daysL !== null ? `Due in ${daysL}d` : 'Scheduled';
      const cls     = done ? 'chip-green' : overdue ? 'chip-red' : 'chip-yellow';
      return `<div class="record-card" id="rec-${r.id}">
        <div class="record-icon-col" style="background:rgba(16,185,129,.1)" aria-hidden="true">💉</div>
        <div class="record-body">
          <div class="record-title">${escHtml(r.name)} <span class="record-chip ${cls}">${status}</span></div>
          <div class="record-meta">
            ${r.dueDate       ? `Due: ${formatDate(r.dueDate)}`                       : ''}
            ${r.completedDate ? ` · ✅ ${formatDate(r.completedDate)}`               : ''}
            ${r.hospital      ? ` · <i class="fa fa-hospital" aria-hidden="true"></i> ${escHtml(r.hospital)}` : ''}
            ${r.doctor        ? ` · Dr. ${escHtml(r.doctor)}`                         : ''}
          </div>
          ${r.notes ? `<div class="record-notes">"${escHtml(r.notes)}"</div>` : ''}
        </div>
        <div class="record-actions">
          ${!done ? `<button class="btn-rec-toggle" onclick="App.markVaccineDone('${r.id}')" aria-label="Mark vaccine as done" title="Mark done"><i class="fa fa-check" aria-hidden="true"></i></button>` : ''}
          <button class="btn-rec-edit"   onclick="App.editRecord('vaccination','${r.id}')"   aria-label="Edit vaccine"        title="Edit"  ><i class="fa fa-pen"   aria-hidden="true"></i></button>
          <button class="btn-rec-delete" onclick="App.deleteRecord('vaccination','${r.id}')" aria-label="Delete vaccine record" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>`;
    }).join('');
  }

  /* ----------------------------------------------------------
     RENDER — DOCTOR
  ---------------------------------------------------------- */
  function renderDoctor() {
    const recs  = Storage.getRecords('doctor');
    const today = todayStr();
    const el    = document.getElementById('doctorList');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('🏥','No doctor visits logged','Keep track of all appointments and prescriptions.'); return; }
    el.innerHTML = recs.map(r => {
      const hasF = r.followupDate && r.followupDate >= today;
      const dF   = r.followupDate ? Math.ceil((new Date(r.followupDate) - new Date()) / 86400000) : null;
      return `<div class="record-card" id="rec-${r.id}">
        <div class="record-icon-col" style="background:rgba(6,182,212,.1)" aria-hidden="true">🏥</div>
        <div class="record-body">
          <div class="record-title">
            ${r.doctor ? `Dr. ${escHtml(r.doctor)}` : 'Doctor Visit'}
            ${r.hospital ? `<span class="record-sub"> · ${escHtml(r.hospital)}</span>` : ''}
          </div>
          <div class="record-meta">
            <i class="fa fa-calendar-day" aria-hidden="true"></i> ${formatDate(r.date)}
            ${r.diagnosis ? ` · <strong>${escHtml(r.diagnosis)}</strong>` : ''}
          </div>
          ${r.prescription ? `<div class="record-notes">💊 ${escHtml(r.prescription)}</div>` : ''}
          ${r.followupDate ? `<div class="followup-tag ${hasF ? 'followup-soon' : 'followup-past'}">
            <i class="fa fa-calendar-check" aria-hidden="true"></i>
            Follow-up: ${formatDate(r.followupDate)}
            ${hasF && dF !== null ? ` · in ${dF} day${dF !== 1 ? 's' : ''}` : ''}
          </div>` : ''}
          ${r.notes ? `<div class="record-notes">"${escHtml(r.notes)}"</div>` : ''}
        </div>
        <div class="record-actions">
          <button class="btn-rec-edit"   onclick="App.editRecord('doctor','${r.id}')"   aria-label="Edit doctor visit"         title="Edit"  ><i class="fa fa-pen"   aria-hidden="true"></i></button>
          <button class="btn-rec-delete" onclick="App.deleteRecord('doctor','${r.id}')" aria-label="Delete doctor visit record" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>`;
    }).join('');
  }

  /* ----------------------------------------------------------
     RENDER — JOURNAL
  ---------------------------------------------------------- */
  function renderJournal() {
    const recs = Storage.getRecords('journal');
    const el   = document.getElementById('journalList');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('📖','No journal entries','Document precious memories and daily milestones.'); return; }
    el.innerHTML = recs.map(r => `
      <div class="record-card journal-card" id="rec-${r.id}">
        ${r.photo ? `<img src="${escHtml(r.photo)}" class="journal-photo" alt="Photo for ${formatDate(r.date)}" loading="lazy" onerror="this.remove()" />` : ''}
        <div class="record-body">
          <div class="journal-card-top">
            <span class="journal-mood-big" aria-hidden="true">${r.mood?.split(' ')[0] || '📖'}</span>
            <div class="journal-header-text">
              <div class="record-title">${formatDate(r.date)}</div>
              <div class="record-meta">${r.mood?.slice(2) || ''}</div>
            </div>
            <div class="record-actions ms-auto">
              <button class="btn-rec-edit"   onclick="App.editRecord('journal','${r.id}')"   aria-label="Edit journal entry"  title="Edit"  ><i class="fa fa-pen"   aria-hidden="true"></i></button>
              <button class="btn-rec-delete" onclick="App.deleteRecord('journal','${r.id}')" aria-label="Delete journal entry" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
            </div>
          </div>
          ${r.notes      ? `<div class="journal-body-text">${escHtml(r.notes)}</div>`                       : ''}
          ${r.milestones ? `<div class="journal-milestone-pill">⭐ ${escHtml(r.milestones)}</div>` : ''}
        </div>
      </div>`).join('');
  }

  /* ----------------------------------------------------------
     RENDER — MILESTONES
  ---------------------------------------------------------- */
  function renderMilestones() {
    const recs = Storage.getRecords('milestones');
    const el   = document.getElementById('milestonesGrid');
    if (!el) return;
    if (!recs.length) { el.innerHTML = _emptyState('⭐','No milestones yet','Celebrate every first — smile, step, word, and tooth!'); return; }
    el.innerHTML = recs.map(r => `
      <div class="milestone-card-new" id="rec-${r.id}">
        <div class="ms-card-emoji" aria-hidden="true">${r.emoji || '⭐'}</div>
        <div class="ms-card-body">
          <div class="ms-card-name">${escHtml(r.name)}</div>
          <div class="ms-card-date">${formatDate(r.date)}</div>
          ${r.notes ? `<div class="ms-card-note">${escHtml(r.notes)}</div>` : ''}
        </div>
        <div class="ms-card-actions">
          <button class="btn-rec-edit"   onclick="App.editRecord('milestones','${r.id}')"   aria-label="Edit milestone"         title="Edit"  ><i class="fa fa-pen"   aria-hidden="true"></i></button>
          <button class="btn-rec-delete" onclick="App.deleteRecord('milestones','${r.id}')" aria-label="Delete milestone record" title="Delete"><i class="fa fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>`).join('');
  }

  /* ----------------------------------------------------------
     RENDER — ANALYTICS
  ---------------------------------------------------------- */
  function renderAnalytics() {
    document.querySelectorAll('.btn-period').forEach(b => {
      b.classList.toggle('active', b.dataset.period === analyticsPeriod);
      b.setAttribute('aria-pressed', b.dataset.period === analyticsPeriod ? 'true' : 'false');
    });
    const n = analyticsPeriod === 'week' ? 7 : analyticsPeriod === 'month' ? 30 : 90;
    Charts.renderAnalyticsCharts(n);
    _renderAnalyticsWidgets(n);
  }

  function _renderAnalyticsWidgets(n) {
    const el = document.getElementById('analyticsWidgets');
    if (!el) return;
    const rng = { start:lastNDates(n)[0], end:todayStr() };
    const fs  = Stats.feeding(rng), ss = Stats.sleep(rng), ds = Stats.diaper(rng);
    const ts  = Stats.temperature(rng), vs = Stats.vaccination(), gs = Stats.growth();
    el.innerHTML = `
      <div class="analytics-widget-grid" role="list">
        ${_awCard('🍼','Feedings',fs.count,`${fs.totalMl} ml · ${minsToHM(fs.avgIntervalMins)||'—'} avg interval`)}
        ${_awCard('😴','Sleep',minsToHM(ss.totalMins)||'0h',`Longest: ${minsToHM(ss.longest)||'—'} · Avg/day: ${minsToHM(ss.avgDailyMins)||'—'}`)}
        ${_awCard('🧷','Diapers',ds.count,`${ds.wet} wet · ${ds.dirty} dirty · ${ds.avgPerDay}/day`)}
        ${_awCard('🌡️','Avg Temp',ts.avg ? ts.avg+'°C' : '—',`${ts.fevers} fever episode${ts.fevers!==1?'s':''} · Max: ${ts.max||'—'}°C`)}
        ${_awCard('💉','Vaccines',vs.pct+'%',`${vs.done}/${vs.total} done${vs.overdue ? ` · ${vs.overdue} overdue!` : ''}`)}
        ${_awCard('📏','Weight',gs.latestWeight ? gs.latestWeight+' kg' : '—',`Height: ${gs.latestHeight||'—'} cm · Head: ${gs.latestHead||'—'} cm`)}
      </div>`;
  }

  function _awCard(icon, label, val, sub) {
    return `<div class="aw-card" role="listitem">
      <div class="aw-icon" aria-hidden="true">${icon}</div>
      <div class="aw-body">
        <div class="aw-val">${escHtml(String(val))}</div>
        <div class="aw-label">${label}</div>
        <div class="aw-sub">${escHtml(sub)}</div>
      </div>
    </div>`;
  }

  /* ----------------------------------------------------------
     SHARED UI HELPERS
  ---------------------------------------------------------- */
  function _renderStatsRow(id, items) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map(i => `
      <div class="stat-pill">
        <div class="stat-val">${escHtml(String(i.val))}</div>
        <div class="stat-label">${escHtml(i.label)}</div>
      </div>`).join('');
  }

  function _emptyState(icon, title, sub) {
    return `<div class="empty-state-wrap" role="status">
      <div class="empty-icon" aria-hidden="true">${icon}</div>
      <div class="empty-title">${title}</div>
      <div class="empty-sub">${sub}</div>
    </div>`;
  }

  /* ----------------------------------------------------------
     DOM SHORTCUTS
  ---------------------------------------------------------- */
  const getVal     = id => document.getElementById(id)?.value || '';
  const setVal     = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };
  const getChecked = id => !!document.getElementById(id)?.checked;
  const setChecked = (id, v) => { const e = document.getElementById(id); if (e) e.checked = !!v; };
  const setText    = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v ?? '—'; };

  /* ----------------------------------------------------------
     PUBLIC API
  ---------------------------------------------------------- */
  return {
    init, showSection, goToRecord,
    openModal, editRecord, deleteRecord,
    saveFeeding, saveSleep, saveDiaper, saveGrowth,
    saveTemperature, saveMedicine, saveVaccination,
    saveDoctor, saveJournal, saveMilestone,
    saveSettings, loadSampleData, clearAllData,
    toggleMedicine, markVaccineDone, setDiaperType,
    clearFilter, installPWA,
    // render hooks for external callers
    renderDashboard,
  };
})();

/* ============================================================
   GLOBAL TOAST
   ============================================================ */
function toast(msg, type = 'info', dur = 3500) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const id    = 't' + Date.now() + Math.random().toString(36).slice(2,5);
  const ICON  = { success:'fa-circle-check', error:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info' };
  const COLOR = { success:'#22c55e', error:'#ef4444', warning:'#f59e0b', info:'#6366f1' };
  c.insertAdjacentHTML('beforeend', `
    <div class="toast-item toast-${type}" id="${id}" role="alert" aria-live="assertive" aria-atomic="true">
      <i class="fa ${ICON[type] || ICON.info}" style="color:${COLOR[type] || COLOR.info}" aria-hidden="true"></i>
      <span>${escHtml(msg)}</span>
    </div>`);
  const el = document.getElementById(id);
  el?.addEventListener('click', () => el.remove());
  setTimeout(() => {
    if (!el?.parentNode) return;
    el.classList.add('toast-out');
    setTimeout(() => el?.remove(), 350);
  }, dur);
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => App.init());
