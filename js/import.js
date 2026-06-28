/* ============================================================
   import.js — Import Engine
   JSON · Excel (SheetJS) · CSV with validation & dedup
   ============================================================ */
'use strict';

const ImportManager = (() => {

  /* ----------------------------------------------------------
     MODULE FIELD MAPS — maps import column names → storage keys
  ---------------------------------------------------------- */
  const FIELD_MAP = {
    feeding: {
      'date':'date','starttime':'startTime','start time':'startTime','endtime':'endTime','end time':'endTime',
      'durationmins':'durationMins','duration (min)':'durationMins','duration':'durationMins',
      'type':'type','amount':'amount','amount (ml)':'amount','ml':'amount',
      'medicine':'medicine','medicine given':'medicine',
      'burped':'burped','spit up':'spitUp','spitup':'spitUp','vomited':'vomited','notes':'notes',
    },
    sleep: {
      'sleepstart':'sleepStart','start':'sleepStart','sleep start':'sleepStart',
      'sleepend':'sleepEnd','end':'sleepEnd','wake time':'sleepEnd',
      'durationmins':'durationMins','duration (min)':'durationMins','duration':'durationMins',
      'quality':'quality','notes':'notes',
    },
    diaper: {
      'date':'date','time':'time','type':'type','color':'color','stool color':'color',
      'consistency':'consistency','texture':'consistency','notes':'notes',
    },
    growth: {
      'date':'date','weight':'weight','weight (kg)':'weight','height':'height',
      'height (cm)':'height','headcirc':'headCirc','head circ. (cm)':'headCirc',
      'head circumference':'headCirc','notes':'notes',
    },
    temperature: {
      'date':'date','time':'time','temp':'temp','temperature':'temp','temperature (°c)':'temp',
      'method':'method','notes':'notes',
    },
    medicine: {
      'date':'date','time':'time','name':'name','type':'type','dose':'dose',
      'completed':'completed','done':'completed','notes':'notes',
    },
    vaccination: {
      'name':'name','duedate':'dueDate','due date':'dueDate','due':'dueDate',
      'completeddate':'completedDate','done on':'completedDate','completed date':'completedDate',
      'hospital':'hospital','doctor':'doctor','notes':'notes',
    },
    doctor: {
      'date':'date','followupdate':'followupDate','follow-up date':'followupDate','follow-up':'followupDate',
      'doctor':'doctor','hospital':'hospital','diagnosis':'diagnosis',
      'prescription':'prescription','rx':'prescription','notes':'notes',
    },
    journal: {
      'date':'date','mood':'mood','notes':'notes','milestones':'milestones','photo':'photo','photo url':'photo',
    },
    milestones: {
      'name':'name','date':'date','emoji':'emoji','notes':'notes',
    },
  };

  /* ----------------------------------------------------------
     VALIDATORS — return null if OK, string if error
  ---------------------------------------------------------- */
  const VALIDATORS = {
    feeding: r => {
      if (!r.date) return 'Missing date';
      if (!isValidDate(r.date)) return `Invalid date: ${r.date}`;
      if (r.amount && isNaN(+r.amount)) return 'Amount must be a number';
      return null;
    },
    sleep: r => {
      if (!r.sleepStart) return 'Missing sleep start time';
      return null;
    },
    diaper: r => {
      if (!r.date) return 'Missing date';
      if (r.type && !['wet','dirty','both'].includes(r.type.toLowerCase())) return `Unknown diaper type: ${r.type}`;
      return null;
    },
    growth: r => {
      if (!r.date) return 'Missing date';
      if (!r.weight && !r.height && !r.headCirc) return 'Must have at least one measurement';
      if (r.weight && (isNaN(+r.weight) || +r.weight < 0.5 || +r.weight > 30)) return 'Weight seems invalid';
      return null;
    },
    temperature: r => {
      if (!r.temp) return 'Missing temperature value';
      const t = parseFloat(r.temp);
      if (isNaN(t) || t < 30 || t > 45) return `Temperature out of range: ${r.temp}`;
      return null;
    },
    medicine: r => {
      if (!r.name) return 'Missing medicine name';
      return null;
    },
    vaccination: r => {
      if (!r.name) return 'Missing vaccine name';
      return null;
    },
    doctor: r => {
      if (!r.date) return 'Missing date';
      return null;
    },
    journal: r => {
      if (!r.date) return 'Missing date';
      return null;
    },
    milestones: r => {
      if (!r.name) return 'Missing milestone name';
      if (!r.date) return 'Missing date';
      return null;
    },
  };

  /* ----------------------------------------------------------
     HELPERS
  ---------------------------------------------------------- */
  function isValidDate(s) {
    if (!s) return false;
    const d = new Date(s);
    return !isNaN(d.getTime()) && s.length >= 8;
  }

  function normalizeBoolean(v) {
    if (typeof v === 'boolean') return v;
    if (v === undefined || v === null || v === '') return false;
    return ['yes','true','1'].includes(String(v).toLowerCase().trim());
  }

  function mapRow(rawRow, fieldMap) {
    const out = {};
    for (const [rawKey, rawVal] of Object.entries(rawRow)) {
      const mappedKey = fieldMap[rawKey.toLowerCase().trim()];
      if (mappedKey) out[mappedKey] = String(rawVal ?? '').trim();
    }
    return out;
  }

  function normalizeRecord(module, rec) {
    // Type coercions
    if (module === 'feeding') {
      if (rec.burped)  rec.burped  = normalizeBoolean(rec.burped);
      if (rec.spitUp)  rec.spitUp  = normalizeBoolean(rec.spitUp);
      if (rec.vomited) rec.vomited = normalizeBoolean(rec.vomited);
      if (rec.amount)  rec.amount  = String(+rec.amount || 0);
    }
    if (module === 'sleep' && rec.durationMins) rec.durationMins = String(+rec.durationMins || 0);
    if (module === 'medicine') rec.completed = normalizeBoolean(rec.completed);
    if (module === 'temperature') rec.temp = String(parseFloat(rec.temp) || '');
    if (module === 'diaper' && rec.type) rec.type = rec.type.toLowerCase();
    if (!rec.id) rec.id = generateId();
    if (!rec.createdAt) rec.createdAt = new Date().toISOString();
    return rec;
  }

  function deduplicateKey(module, rec) {
    // Build a fingerprint to detect duplicates
    switch(module) {
      case 'feeding':     return `${rec.date}_${rec.startTime}_${rec.type}`;
      case 'sleep':       return `${rec.sleepStart}_${rec.sleepEnd}`;
      case 'diaper':      return `${rec.date}_${rec.time}_${rec.type}`;
      case 'growth':      return `${rec.date}_${rec.weight}_${rec.height}`;
      case 'temperature': return `${rec.date}_${rec.time}_${rec.temp}`;
      case 'medicine':    return `${rec.date}_${rec.time}_${rec.name}`;
      case 'vaccination': return `${rec.name}_${rec.dueDate}`;
      case 'doctor':      return `${rec.date}_${rec.doctor}`;
      case 'journal':     return `${rec.date}_${rec.mood}`;
      case 'milestones':  return `${rec.name}_${rec.date}`;
      default:            return rec.id || generateId();
    }
  }

  /** Show import result modal */
  function showResult(results) {
    const lines = results.map(r =>
      `<div class="import-result-row ${r.added > 0 ? 'ir-success' : r.errors > 0 ? 'ir-error' : 'ir-skip'}">
        <span class="ir-module">${r.module}</span>
        <span class="ir-added">${r.added > 0 ? `+${r.added} added` : '—'}</span>
        <span class="ir-skip">${r.skipped > 0 ? `${r.skipped} dupes skipped` : ''}</span>
        <span class="ir-err">${r.errors > 0 ? `${r.errors} errors` : ''}</span>
       </div>`
    ).join('');

    const totalAdded = results.reduce((a,r) => a + r.added, 0);

    // Show in a clean overlay instead of alert()
    document.getElementById('_confirmOverlay')?.remove();
    const el = document.createElement('div');
    el.id    = '_confirmOverlay';
    el.className = 'confirm-overlay';
    el.innerHTML = `
      <div class="confirm-box" style="max-width:460px;">
        <div class="confirm-icon">${totalAdded > 0 ? '✅' : '⚠️'}</div>
        <div class="confirm-title">Import Complete</div>
        <div class="import-results">${lines}</div>
        <div class="confirm-btns">
          <button class="confirm-ok" onclick="this.closest('#_confirmOverlay').remove()">Done</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    if (totalAdded > 0) {
      toast(`Imported ${totalAdded} record${totalAdded!==1?'s':''} ✅`, 'success');
      App.renderDashboard();
    }
  }

  /* ----------------------------------------------------------
     1. IMPORT JSON BACKUP
  ---------------------------------------------------------- */
  function importJSON(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || typeof data !== 'object') return toast('Invalid JSON file', 'error');

        // Detect format: full backup vs single module
        const MODULES = ['feeding','sleep','diaper','growth','temperature','medicine','vaccination','doctor','journal','milestones'];
        const isFullBackup = MODULES.some(m => Array.isArray(data[m]));

        if (!isFullBackup && !Array.isArray(data)) {
          return toast('JSON format not recognized', 'error');
        }

        const results = [];

        if (Array.isArray(data)) {
          // Single-module array — ask which module (use feeding as default)
          const module = prompt('Which module is this data for?\nOptions: feeding, sleep, diaper, growth, temperature, medicine, vaccination, doctor, journal, milestones') || 'feeding';
          if (!MODULES.includes(module)) return toast('Unknown module: ' + module, 'error');
          results.push(mergeModuleRecords(module, data));
        } else {
          // Full backup
          if (data.settings) Storage.saveSettings(data.settings);
          for (const mod of MODULES) {
            if (Array.isArray(data[mod]) && data[mod].length) {
              results.push(mergeModuleRecords(mod, data[mod]));
            }
          }
        }

        showResult(results);
      } catch(err) {
        toast('Failed to parse JSON: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ----------------------------------------------------------
     2. IMPORT EXCEL (.xlsx via SheetJS)
  ---------------------------------------------------------- */
  function importExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (typeof XLSX === 'undefined') return toast('SheetJS not loaded', 'error');

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type:'array', cellDates:true });
        const MODULES = ['feeding','sleep','diaper','growth','temperature','medicine','vaccination','doctor','journal','milestones'];
        const SHEET_MAP = {
          'Feeding':'feeding','Sleep':'sleep','Diaper':'diaper','Growth':'growth',
          'Temperature':'temperature','Medicine':'medicine','Vaccination':'vaccination',
          'Doctor Visits':'doctor','Journal':'journal','Milestones':'milestones',
          'Dashboard Summary':null,'Statistics':null,
        };

        const results = [];

        for (const sheetName of wb.SheetNames) {
          const module = SHEET_MAP[sheetName] || MODULES.find(m => sheetName.toLowerCase().includes(m));
          if (!module) continue;

          const ws   = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
          if (!rows.length) continue;

          const fmap = FIELD_MAP[module] || {};
          const mapped = rows.map(r => {
            const norm = {};
            for (const [k,v] of Object.entries(r)) {
              const mk = fmap[k.toLowerCase().trim()];
              if (mk) norm[mk] = String(v ?? '').trim();
            }
            return norm;
          });

          results.push(mergeModuleRecords(module, mapped));
        }

        if (!results.length) return toast('No matching sheets found in Excel file', 'warning');
        showResult(results);
      } catch(err) {
        console.error(err);
        toast('Failed to read Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ----------------------------------------------------------
     3. IMPORT CSV (single module)
  ---------------------------------------------------------- */
  function importCSV(event, module) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    if (!FIELD_MAP[module]) return toast('Unknown module: ' + module, 'error');

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const rows = parseCSV(e.target.result);
        if (!rows.length) return toast('CSV is empty', 'warning');

        const fmap  = FIELD_MAP[module];
        const mapped = rows.map(r => mapRow(r, fmap));
        const result = mergeModuleRecords(module, mapped);
        showResult([result]);
      } catch(err) {
        toast('Failed to parse CSV: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ----------------------------------------------------------
     CORE MERGE — validate, dedup, save
  ---------------------------------------------------------- */
  function mergeModuleRecords(module, rawRecords) {
    const result = { module, added:0, skipped:0, errors:0, errorList:[] };
    const validator = VALIDATORS[module];
    const fmap      = FIELD_MAP[module];

    // Build existing fingerprint set
    const existing     = Storage.getRecords(module);
    const existingKeys = new Set(existing.map(r => deduplicateKey(module, r)));
    const existingIds  = new Set(existing.map(r => r.id));

    const toAdd = [];

    for (let i = 0; i < rawRecords.length; i++) {
      let rec = { ...rawRecords[i] };

      // Map fields if coming from raw keys
      if (fmap) {
        const hasMappedKeys = Object.keys(rec).some(k => Object.values(fmap).includes(k));
        if (!hasMappedKeys) rec = mapRow(rec, fmap);
      }

      rec = normalizeRecord(module, rec);

      // Validate
      const err = validator ? validator(rec) : null;
      if (err) { result.errors++; result.errorList.push(`Row ${i+2}: ${err}`); continue; }

      // Dedup by ID
      if (rec.id && existingIds.has(rec.id)) { result.skipped++; continue; }

      // Dedup by fingerprint
      const fp = deduplicateKey(module, rec);
      if (existingKeys.has(fp)) { result.skipped++; continue; }

      existingKeys.add(fp);
      if (rec.id) existingIds.add(rec.id);
      toAdd.push(rec);
    }

    if (toAdd.length) {
      Storage.merge(module, toAdd);
      result.added = toAdd.length;
    }

    return result;
  }

  /* ----------------------------------------------------------
     CSV PARSER (handles quoted fields, newlines)
  ---------------------------------------------------------- */
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = splitCSVLine(lines[0]);
    const rows    = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = splitCSVLine(lines[i]);
      if (vals.every(v => !v.trim())) continue; // skip blank lines
      const row = {};
      headers.forEach((h, j) => { row[h.trim()] = (vals[j] || '').trim(); });
      rows.push(row);
    }
    return rows;
  }

  function splitCSVLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        result.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  /* ----------------------------------------------------------
     PUBLIC API
  ---------------------------------------------------------- */
  return { importJSON, importExcel, importCSV };
})();
