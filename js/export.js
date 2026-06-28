/* ============================================================
   export.js — Full Export Engine
   CSV · Excel (SheetJS) · PDF (jsPDF) · JSON Backup
   ============================================================ */
'use strict';

const ExportManager = (() => {

  const MODULES = ['feeding','sleep','diaper','growth','temperature','medicine','vaccination','doctor','journal','milestones'];

  /* ----------------------------------------------------------
     COLUMN DEFINITIONS — controls CSV headers & Excel columns
  ---------------------------------------------------------- */
  const COLS = {
    feeding:     ['date','startTime','endTime','durationMins','type','amount','medicine','burped','spitUp','vomited','notes'],
    sleep:       ['sleepStart','sleepEnd','durationMins','quality','notes'],
    diaper:      ['date','time','type','color','consistency','notes'],
    growth:      ['date','weight','height','headCirc','notes'],
    temperature: ['date','time','temp','method','notes'],
    medicine:    ['date','time','name','type','dose','completed','notes'],
    vaccination: ['name','dueDate','completedDate','hospital','doctor','notes'],
    doctor:      ['date','followupDate','doctor','hospital','diagnosis','prescription','notes'],
    journal:     ['date','mood','notes','milestones','photo'],
    milestones:  ['name','date','emoji','notes'],
  };

  const MODULE_LABELS = {
    feeding:'Feeding', sleep:'Sleep', diaper:'Diaper', growth:'Growth',
    temperature:'Temperature', medicine:'Medicine', vaccination:'Vaccination',
    doctor:'Doctor Visits', journal:'Journal', milestones:'Milestones',
  };

  /* ----------------------------------------------------------
     HELPERS
  ---------------------------------------------------------- */
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href:url, download:filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadText(text, filename, mime = 'text/plain') {
    download(new Blob([text], { type: mime }), filename);
  }

  function stamp(period = '') {
    const d = new Date();
    const s = d.toISOString().slice(0,10);
    return period ? `${s}_${period}` : s;
  }

  function getSettings() { return Storage.getSettings(); }

  /** Flatten a record to plain strings for export */
  function flatten(rec, cols) {
    const out = {};
    for (const col of cols) {
      let v = rec[col];
      if (v === undefined || v === null) v = '';
      if (typeof v === 'boolean') v = v ? 'Yes' : 'No';
      out[col] = String(v);
    }
    return out;
  }

  /** Escape a single CSV cell */
  function csvCell(val) {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }

  /** Convert array-of-objects to CSV string */
  function toCSV(rows, cols) {
    const header = cols.join(',');
    const lines  = rows.map(r => cols.map(c => csvCell(r[c] ?? '')).join(','));
    return [header, ...lines].join('\n');
  }

  /** Filter records by date range */
  function filterRange(module, range) {
    const recs = Storage.getRecords(module);
    if (!range) return recs;
    return recs.filter(r => {
      const d = (r.date || r.sleepStart || r.createdAt || '').slice(0,10);
      return d >= range.start && d <= range.end;
    });
  }

  /* ----------------------------------------------------------
     1. JSON BACKUP
  ---------------------------------------------------------- */
  function exportJSON() {
    try {
      const data = Storage.exportAll();
      const json = JSON.stringify(data, null, 2);
      const s    = getSettings();
      const name = `${(s.babyName||'baby').toLowerCase().replace(/\s+/g,'_')}_backup_${stamp()}.json`;
      downloadText(json, name, 'application/json');
      toast('JSON backup downloaded ✅', 'success');
    } catch(e) {
      console.error(e);
      toast('Export failed: ' + e.message, 'error');
    }
  }

  /* ----------------------------------------------------------
     2. CSV — individual module
  ---------------------------------------------------------- */
  function exportModuleCSV(module) {
    try {
      const cols = COLS[module];
      const recs = Storage.getRecords(module).map(r => flatten(r, cols));
      if (!recs.length) return toast(`No ${MODULE_LABELS[module]} records to export`, 'warning');
      const csv  = toCSV(recs, cols);
      downloadText(csv, `${module}_${stamp()}.csv`, 'text/csv');
      toast(`${MODULE_LABELS[module]} CSV downloaded ✅`, 'success');
    } catch(e) {
      console.error(e);
      toast('CSV export failed: ' + e.message, 'error');
    }
  }

  /* ----------------------------------------------------------
     3. CSV — all modules (triggers multiple downloads)
  ---------------------------------------------------------- */
  function exportCSVAll() {
    try {
      let count = 0;
      const delay = (ms) => new Promise(r => setTimeout(r, ms));
      (async () => {
        for (const mod of MODULES) {
          const recs = Storage.getRecords(mod);
          if (!recs.length) continue;
          const cols = COLS[mod];
          const csv  = toCSV(recs.map(r => flatten(r, cols)), cols);
          downloadText(csv, `${mod}_${stamp()}.csv`, 'text/csv');
          count++;
          await delay(200); // stagger downloads
        }
        toast(`${count} CSV file${count!==1?'s':''} downloaded ✅`, 'success');
      })();
    } catch(e) {
      console.error(e);
      toast('CSV export failed: ' + e.message, 'error');
    }
  }

  /* ----------------------------------------------------------
     4. EXCEL — full workbook (SheetJS)
  ---------------------------------------------------------- */
  function exportExcel() {
    try {
      if (typeof XLSX === 'undefined') return toast('SheetJS not loaded', 'error');
      const wb = XLSX.utils.book_new();
      const s  = getSettings();
      const now = new Date().toLocaleString();

      /* ---- Dashboard Summary sheet ---- */
      const sum = Stats.dashboardSummary();
      const feedS = sum.feeding, sleepS = sum.sleep, diaperS = sum.diaper;
      const growS = sum.growth, tempS = sum.temperature, medS = sum.medicine, vaxS = sum.vaccination;

      const summaryData = [
        ['BabyLog — Dashboard Summary', '', ''],
        ['Generated', now, ''],
        ['', '', ''],
        ['Baby Name',  s.babyName  || '—', ''],
        ['Birthday',   s.birthday  || '—', ''],
        ['Age',        calcAge(s.birthday)?.text || '—', ''],
        ['Weight',     (s.weight || '—') + ' kg', ''],
        ['', '', ''],
        ['📊 TODAY', '', ''],
        ['Total Feedings',    feedS.count,                        ''],
        ['Total Milk (ml)',   feedS.totalMl,                      ''],
        ['Avg Interval',      minsToHM(feedS.avgIntervalMins)||'—',''],
        ['Avg Duration',      minsToHM(feedS.avgDurMins)||'—',    ''],
        ['Total Sleep',       minsToHM(sleepS.totalMins)||'—',    ''],
        ['Longest Sleep',     minsToHM(sleepS.longest)||'—',      ''],
        ['Wet Diapers',       diaperS.wet,                        ''],
        ['Dirty Diapers',     diaperS.dirty,                      ''],
        ['Latest Weight',     (growS.latestWeight||'—')+' kg',    ''],
        ['Latest Height',     (growS.latestHeight||'—')+' cm',    ''],
        ['Latest Temp',       tempS.latest ? tempS.latest.temp+'°C' : '—', ''],
        ['Medicine Compliance', medS.pct + '%',                   ''],
        ['Vaccines Done',     `${vaxS.done}/${vaxS.total}`,       ''],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{wch:28},{wch:22},{wch:14}];
      styleHeaderRows(wsSummary, [0,8]);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Dashboard Summary');

      /* ---- Module sheets ---- */
      for (const mod of MODULES) {
        const recs = Storage.getRecords(mod);
        const cols = COLS[mod];
        const label = MODULE_LABELS[mod];

        if (!recs.length) {
          const ws = XLSX.utils.aoa_to_sheet([[label + ' — No records yet']]);
          XLSX.utils.book_append_sheet(wb, ws, label.slice(0,31));
          continue;
        }

        const header  = cols.map(c => colLabel(c));
        const rowData = recs.map(r => cols.map(c => {
          let v = r[c];
          if (v === undefined || v === null) return '';
          if (typeof v === 'boolean') return v ? 'Yes' : 'No';
          return v;
        }));

        const ws = XLSX.utils.aoa_to_sheet([header, ...rowData]);
        ws['!cols'] = cols.map(c => ({ wch: colWidth(c) }));
        styleHeaderRows(ws, [0]);
        XLSX.utils.book_append_sheet(wb, ws, label.slice(0,31));
      }

      /* ---- Statistics sheet ---- */
      const statsData = buildStatsSheet();
      const wsStats = XLSX.utils.aoa_to_sheet(statsData);
      wsStats['!cols'] = [{wch:32},{wch:18}];
      styleHeaderRows(wsStats, [0,2,10,17,24]);
      XLSX.utils.book_append_sheet(wb, wsStats, 'Statistics');

      /* ---- Write & download ---- */
      const babySlug = (s.babyName||'baby').toLowerCase().replace(/\s+/g,'_');
      XLSX.writeFile(wb, `${babySlug}_babylog_${stamp()}.xlsx`);
      toast('Excel workbook downloaded ✅', 'success');

    } catch(e) {
      console.error(e);
      toast('Excel export failed: ' + e.message, 'error');
    }
  }

  /** Style specific rows as header (bold + background) */
  function styleHeaderRows(ws, rowIndexes) {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (const ri of rowIndexes) {
      for (let ci = range.s.c; ci <= range.e.c; ci++) {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
        if (!ws[addr]) ws[addr] = { t:'s', v:'' };
        ws[addr].s = {
          font:    { bold: true, color: { rgb: 'FFFFFF' } },
          fill:    { fgColor: { rgb: '6366F1' } },
          alignment: { horizontal: 'left' },
        };
      }
    }
  }

  function colLabel(key) {
    const MAP = {
      date:'Date', startTime:'Start Time', endTime:'End Time', durationMins:'Duration (min)',
      type:'Type', amount:'Amount (ml)', medicine:'Medicine Given', burped:'Burped',
      spitUp:'Spit Up', vomited:'Vomited', notes:'Notes', sleepStart:'Sleep Start',
      sleepEnd:'Wake Time', quality:'Quality', color:'Stool Color', consistency:'Consistency',
      weight:'Weight (kg)', height:'Height (cm)', headCirc:'Head Circ. (cm)',
      temp:'Temperature (°C)', method:'Method', name:'Name', dose:'Dose',
      completed:'Completed', dueDate:'Due Date', completedDate:'Completed Date',
      hospital:'Hospital', doctor:'Doctor', followupDate:'Follow-up Date',
      diagnosis:'Diagnosis', prescription:'Prescription', mood:'Mood',
      milestones:'Milestones', photo:'Photo URL', emoji:'Emoji', time:'Time',
    };
    return MAP[key] || key;
  }

  function colWidth(key) {
    const WIDE = ['notes','diagnosis','prescription','photo','mood','milestones'];
    const MED  = ['name','hospital','doctor','type','quality','color','consistency'];
    if (WIDE.includes(key)) return 40;
    if (MED.includes(key))  return 22;
    return 16;
  }

  function buildStatsSheet() {
    const fs = Stats.feeding(null);
    const ss = Stats.sleep(null);
    const ds = Stats.diaper(null);
    const gs = Stats.growth();
    const ts = Stats.temperature(null);
    const ms = Stats.medicine(null);
    const vs = Stats.vaccination();
    const doc= Stats.doctor();
    const s  = getSettings();

    return [
      ['BabyLog — Statistics Report', new Date().toLocaleString()],
      ['',''],
      ['📊 FEEDING', ''],
      ['Total Records', Storage.getRecords('feeding').length],
      ['Total Milk (all time, ml)', Storage.getRecords('feeding').reduce((a,r)=>a+(+r.amount||0),0)],
      ['Avg Milk per Feed (ml)', fs.avgMlPerFeed],
      ['Avg Interval (mins)', fs.avgIntervalMins],
      ['Avg Duration (mins)', fs.avgDurMins],
      ['Last Feeding', fs.lastFeed ? `${fs.lastFeed.date} ${fs.lastFeed.startTime}` : '—'],
      ['',''],
      ['😴 SLEEP', ''],
      ['Total Records', Storage.getRecords('sleep').length],
      ['Total Sleep (mins, all time)', Storage.getRecords('sleep').reduce((a,r)=>a+(+r.durationMins||0),0)],
      ['Longest Sleep (mins)', ss.longest],
      ['Shortest Sleep (mins)', ss.shortest],
      ['Avg per Nap (mins)', ss.avgMins],
      ['',''],
      ['🧷 DIAPER', ''],
      ['Total Changes', Storage.getRecords('diaper').length],
      ['Wet (all time)', Storage.getRecords('diaper').filter(r=>r.type==='wet'||r.type==='both').length],
      ['Dirty (all time)', Storage.getRecords('diaper').filter(r=>r.type==='dirty'||r.type==='both').length],
      ['7-Day Avg per Day', ds.avgPerDay],
      ['',''],
      ['📏 GROWTH', ''],
      ['Measurements Logged', gs.count],
      ['Latest Weight (kg)', gs.latestWeight || '—'],
      ['Latest Height (cm)', gs.latestHeight || '—'],
      ['Latest Head Circ. (cm)', gs.latestHead || '—'],
      ['Weight Change (last 2)', gs.weightDelta !== null ? (gs.weightDelta > 0 ? '+' : '') + gs.weightDelta + ' kg' : '—'],
      ['',''],
      ['🌡️ TEMPERATURE', ''],
      ['Total Readings', ts.count],
      ['Avg Temperature (°C)', ts.avg || '—'],
      ['Max Temperature (°C)', ts.max || '—'],
      ['Fever Episodes (≥38°C)', ts.fevers],
      ['',''],
      ['💊 MEDICINE', ''],
      ['Total Logged', ms.count],
      ['Completed', ms.completed],
      ['Pending', ms.pending],
      ['Compliance Rate', ms.pct + '%'],
      ['',''],
      ['💉 VACCINATION', ''],
      ['Total Vaccines', vs.total],
      ['Completed', vs.done],
      ['Pending', vs.pending],
      ['Overdue', vs.overdue],
      ['Progress', vs.pct + '%'],
      ['',''],
      ['🏥 DOCTOR VISITS', ''],
      ['Total Visits', doc.count],
      ['Upcoming Follow-up', doc.nextFollowup ? `${doc.nextFollowup.doctor} on ${doc.nextFollowup.followupDate}` : '—'],
    ];
  }

  /* ----------------------------------------------------------
     5. PDF REPORTS (jsPDF, no autotable dependency)
  ---------------------------------------------------------- */
  function exportPDF(period = 'today') {
    try {
      const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
      if (!jsPDF) return toast('jsPDF not loaded', 'error');

      const doc    = new jsPDF({ unit:'mm', format:'a4' });
      const s      = getSettings();
      const now    = new Date();
      const W      = doc.internal.pageSize.getWidth();
      const H      = doc.internal.pageSize.getHeight();
      const MARGIN = 16;
      let   y      = MARGIN;

      const range  = buildRange(period);
      const pLabel = { today:"Today's Report", week:'Weekly Report', month:'Monthly Report' }[period] || 'Report';

      /* ---- Brand colors ---- */
      const C_BRAND  = [99,102,241];   // indigo
      const C_ACCENT = [76,217,192];   // teal
      const C_DARK   = [30,32,50];
      const C_GRAY   = [100,110,130];
      const C_LIGHT  = [240,242,248];

      /* ---- COVER / HEADER ---- */
      doc.setFillColor(...C_BRAND);
      doc.roundedRect(MARGIN, y, W - MARGIN*2, 36, 4, 4, 'F');

      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold');
      doc.setFontSize(20);
      doc.text('BabyLog', MARGIN+8, y+13);

      doc.setFontSize(11);
      doc.setFont('helvetica','normal');
      doc.text(pLabel, MARGIN+8, y+22);

      doc.setFontSize(9);
      doc.text(`${s.babyName || 'Baby'} · Generated ${now.toLocaleString()}`, MARGIN+8, y+30);

      /* Date range */
      if (range) {
        const rLabel = range.start === range.end
          ? formatDate(range.start)
          : `${formatDate(range.start)} – ${formatDate(range.end)}`;
        doc.text(rLabel, W - MARGIN - 2, y+30, { align:'right' });
      }

      y += 44;

      /* ---- Baby Info Row ---- */
      const age = calcAge(s.birthday);
      doc.setFillColor(...C_LIGHT);
      doc.roundedRect(MARGIN, y, W - MARGIN*2, 16, 3, 3, 'F');
      doc.setTextColor(...C_DARK);
      doc.setFont('helvetica','bold');
      doc.setFontSize(10);
      doc.text(s.babyName || 'Baby', MARGIN+6, y+6.5);
      doc.setFont('helvetica','normal');
      doc.setFontSize(9);
      doc.setTextColor(...C_GRAY);
      const infoItems = [
        age ? age.text : '',
        s.birthday ? 'Born: ' + formatDate(s.birthday) : '',
        s.weight   ? s.weight + ' kg' : '',
      ].filter(Boolean).join('   ·   ');
      doc.text(infoItems, MARGIN+6, y+12.5);
      y += 22;

      /* ---- SUMMARY STATS ---- */
      const feedR  = filterRange('feeding', range);
      const sleepR = filterRange('sleep', range);
      const diaperR= filterRange('diaper', range);
      const tempR  = filterRange('temperature', range);
      const medR   = filterRange('medicine', range);
      const vaxRecs= Storage.getRecords('vaccination');

      const totalMilk  = feedR.reduce((a,r)=>a+(+r.amount||0),0);
      const totalSleep = sleepR.reduce((a,r)=>a+(+r.durationMins||0),0);
      const wetCount   = diaperR.filter(r=>r.type==='wet'||r.type==='both').length;
      const dirtyCount = diaperR.filter(r=>r.type==='dirty'||r.type==='both').length;
      const latestTemp = filterRange('temperature', null)[0];
      const vaxDone    = vaxRecs.filter(r=>r.completedDate).length;
      const medDone    = medR.filter(r=>r.completed).length;

      const cards = [
        { icon:'Feedings', val: feedR.length.toString(),                              sub: totalMilk + ' ml total'          },
        { icon:'Sleep',    val: minsToHM(totalSleep)||'—',                            sub: sleepR.length + ' sessions'      },
        { icon:'Diapers',  val: diaperR.length.toString(),                            sub: wetCount+'💧 '+dirtyCount+'💩'   },
        { icon:'Temp',     val: latestTemp ? latestTemp.temp+'°C' : '—',              sub: latestTemp ? latestTemp.date : '' },
        { icon:'Medicine', val: medDone+'/'+medR.length,                              sub: 'completed'                      },
        { icon:'Vaccines', val: vaxDone+'/'+vaxRecs.length,                          sub: Stats.vaccination().pct+'% done' },
      ];

      const cardW  = (W - MARGIN*2 - 10) / 3;
      const cardH  = 20;
      const col0   = MARGIN, col1 = MARGIN + cardW + 5, col2 = MARGIN + (cardW+5)*2;
      const cols3  = [col0, col1, col2];

      y = drawSectionTitle(doc, 'Summary', y, MARGIN, W, C_BRAND);

      for (let i = 0; i < cards.length; i++) {
        const cx = cols3[i % 3];
        const cy = y + Math.floor(i / 3) * (cardH + 4);
        doc.setFillColor(248, 249, 255);
        doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'F');
        doc.setDrawColor(220, 222, 255);
        doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'S');

        doc.setTextColor(...C_GRAY);
        doc.setFont('helvetica','normal');
        doc.setFontSize(8);
        doc.text(cards[i].icon.toUpperCase(), cx+4, cy+6);

        doc.setTextColor(...C_DARK);
        doc.setFont('helvetica','bold');
        doc.setFontSize(13);
        doc.text(cards[i].val, cx+4, cy+14);

        doc.setTextColor(...C_GRAY);
        doc.setFont('helvetica','normal');
        doc.setFontSize(7.5);
        doc.text(cards[i].sub, cx+cardW/2+8, cy+14, { align:'right' });
      }

      y += Math.ceil(cards.length / 3) * (cardH + 4) + 6;

      /* ---- FEEDING TABLE ---- */
      if (feedR.length) {
        checkPageBreak(doc, y, 40, H, MARGIN);
        y = drawSectionTitle(doc, `Feedings (${feedR.length} records)`, y, MARGIN, W, C_BRAND);
        y = drawTable(doc, feedR.slice(0, 30), ['date','startTime','type','amount','burped','notes'], y, MARGIN, W, C_BRAND, C_LIGHT, C_DARK, C_GRAY);
      }

      /* ---- SLEEP TABLE ---- */
      if (sleepR.length) {
        y = checkPageBreak(doc, y, 40, H, MARGIN);
        y = drawSectionTitle(doc, `Sleep (${sleepR.length} sessions)`, y, MARGIN, W, C_BRAND);
        y = drawTable(doc, sleepR.slice(0,20), ['sleepStart','sleepEnd','durationMins','quality','notes'], y, MARGIN, W, C_BRAND, C_LIGHT, C_DARK, C_GRAY);
      }

      /* ---- DIAPER TABLE ---- */
      if (diaperR.length) {
        y = checkPageBreak(doc, y, 40, H, MARGIN);
        y = drawSectionTitle(doc, `Diapers (${diaperR.length} changes)`, y, MARGIN, W, C_BRAND);
        y = drawTable(doc, diaperR.slice(0,20), ['date','time','type','color','consistency','notes'], y, MARGIN, W, C_BRAND, C_LIGHT, C_DARK, C_GRAY);
      }

      /* ---- TEMP TABLE ---- */
      if (tempR.length) {
        y = checkPageBreak(doc, y, 40, H, MARGIN);
        y = drawSectionTitle(doc, `Temperature (${tempR.length} readings)`, y, MARGIN, W, C_BRAND);
        y = drawTable(doc, tempR.slice(0,15), ['date','time','temp','method','notes'], y, MARGIN, W, C_BRAND, C_LIGHT, C_DARK, C_GRAY);
      }

      /* ---- VACCINATION STATUS ---- */
      if (vaxRecs.length) {
        y = checkPageBreak(doc, y, 40, H, MARGIN);
        y = drawSectionTitle(doc, 'Vaccination Status', y, MARGIN, W, C_BRAND);
        y = drawTable(doc, vaxRecs, ['name','dueDate','completedDate','hospital'], y, MARGIN, W, C_BRAND, C_LIGHT, C_DARK, C_GRAY);
      }

      /* ---- FOOTER ---- */
      addFooter(doc, H, W, MARGIN, C_GRAY, s.babyName);

      /* ---- SAVE ---- */
      const slug = (s.babyName||'baby').toLowerCase().replace(/\s+/g,'_');
      doc.save(`${slug}_${period}_report_${stamp()}.pdf`);
      toast('PDF downloaded ✅', 'success');

    } catch(e) {
      console.error('PDF error:', e);
      toast('PDF export failed: ' + e.message, 'error');
    }
  }

  /* ---- PDF Helpers ---- */
  function drawSectionTitle(doc, title, y, margin, W, color) {
    doc.setFillColor(...color);
    doc.rect(margin, y, W - margin*2, 7, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.text(title, margin + 4, y + 5);
    return y + 11;
  }

  function drawTable(doc, rows, cols, y0, margin, W, cBrand, cLight, cDark, cGray) {
    const colW  = (W - margin*2) / cols.length;
    let y = y0;

    /* header row */
    doc.setFillColor(...cLight);
    doc.rect(margin, y, W - margin*2, 6, 'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...cGray);
    cols.forEach((c,i) => doc.text(colLabel(c), margin + i*colW + 2, y + 4.5));
    y += 7;

    /* data rows */
    doc.setFont('helvetica','normal');
    doc.setFontSize(7.5);
    rows.forEach((r, ri) => {
      if (ri % 2 === 0) { doc.setFillColor(248,248,252); doc.rect(margin, y, W-margin*2, 6, 'F'); }
      doc.setTextColor(...cDark);
      cols.forEach((c, i) => {
        let v = r[c];
        if (v === undefined || v === null) v = '';
        if (typeof v === 'boolean') v = v ? 'Yes' : '';
        const str = String(v).slice(0, 28);
        doc.text(str, margin + i*colW + 2, y + 4.5);
      });
      y += 6;
    });
    return y + 4;
  }

  function checkPageBreak(doc, y, needed, H, margin) {
    if (y + needed > H - 20) {
      doc.addPage();
      return margin;
    }
    return y;
  }

  function addFooter(doc, H, W, margin, cGray, babyName) {
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setTextColor(...cGray);
      doc.setFont('helvetica','normal');
      doc.setFontSize(7.5);
      doc.text(`BabyLog · ${babyName || 'Baby'} · For personal use only — not a medical report`, margin, H - 8);
      doc.text(`Page ${i} of ${pages}`, W - margin, H - 8, { align:'right' });
      doc.setDrawColor(220,220,230);
      doc.line(margin, H - 11, W - margin, H - 11);
    }
  }

  function buildRange(period) {
    const today = todayStr();
    if (period === 'today')  return { start: today, end: today };
    if (period === 'week')   { const d = new Date(); d.setDate(d.getDate()-6); return { start:d.toISOString().slice(0,10), end:today }; }
    if (period === 'month')  { const d = new Date(); d.setDate(d.getDate()-29); return { start:d.toISOString().slice(0,10), end:today }; }
    return null;
  }

  function colLabel(key) {
    const MAP = {
      date:'Date', startTime:'Start', endTime:'End', durationMins:'Dur(min)',
      type:'Type', amount:'ml', medicine:'Medicine', burped:'Burped',
      spitUp:'Spit Up', vomited:'Vomited', notes:'Notes', sleepStart:'Start',
      sleepEnd:'End', quality:'Quality', color:'Color', consistency:'Texture',
      weight:'Weight', height:'Height', headCirc:'Head', temp:'Temp',
      method:'Method', name:'Name', dose:'Dose', completed:'Done',
      dueDate:'Due', completedDate:'Done On', hospital:'Hospital',
      doctor:'Doctor', followupDate:'Follow-up', diagnosis:'Diagnosis',
      prescription:'Rx', mood:'Mood', milestones:'Milestones',
      photo:'Photo', emoji:'', time:'Time',
    };
    return MAP[key] || key;
  }

  /* ----------------------------------------------------------
     6. PRINTABLE REPORT (opens in browser print dialog)
  ---------------------------------------------------------- */
  function printReport(period = 'today') {
    const s     = getSettings();
    const range = buildRange(period);
    const feedR  = filterRange('feeding', range);
    const sleepR = filterRange('sleep', range);
    const diaperR= filterRange('diaper', range);
    const totalMilk  = feedR.reduce((a,r)=>a+(+r.amount||0),0);
    const totalSleep = sleepR.reduce((a,r)=>a+(+r.durationMins||0),0);
    const pLabel = { today:"Today's Report", week:'Weekly Report', month:'Monthly Report' }[period] || 'Report';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>BabyLog — ${pLabel}</title>
<style>
  * { box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; margin: 0; padding: 20px; }
  .header { background: #6366f1; color: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 16px; }
  .header h1 { margin:0; font-size:20px; } .header p { margin:4px 0 0; opacity:.85; font-size:11px; }
  .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
  .card { border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; }
  .card-label { font-size:10px; text-transform:uppercase; color:#6b7280; font-weight:700; letter-spacing:.06em; }
  .card-val { font-size:20px; font-weight:900; color:#6366f1; margin:4px 0 2px; }
  .card-sub { font-size:10px; color:#9ca3af; }
  table { width:100%; border-collapse:collapse; margin-bottom:14px; font-size:10.5px; }
  th { background:#6366f1; color:white; text-align:left; padding:5px 7px; font-size:10px; }
  td { border-bottom:1px solid #f0f0f0; padding:4px 7px; }
  tr:nth-child(even) td { background:#f9fafb; }
  h2 { font-size:13px; color:#6366f1; margin:14px 0 6px; border-bottom:2px solid #6366f1; padding-bottom:4px; }
  .disclaimer { margin-top:20px; border-top:1px solid #e5e7eb; padding-top:10px; font-size:9px; color:#9ca3af; }
  @media print { body { padding:0; } }
</style>
</head>
<body>
<div class="header">
  <h1>BabyLog — ${pLabel}</h1>
  <p>${s.babyName || 'Baby'} · ${calcAge(s.birthday)?.text || ''} · Generated ${new Date().toLocaleString()}</p>
</div>
<div class="cards">
  <div class="card"><div class="card-label">Feedings</div><div class="card-val">${feedR.length}</div><div class="card-sub">${totalMilk} ml total</div></div>
  <div class="card"><div class="card-label">Sleep</div><div class="card-val">${minsToHM(totalSleep)||'—'}</div><div class="card-sub">${sleepR.length} sessions</div></div>
  <div class="card"><div class="card-label">Diapers</div><div class="card-val">${diaperR.length}</div>
    <div class="card-sub">${diaperR.filter(r=>r.type==='wet'||r.type==='both').length} wet · ${diaperR.filter(r=>r.type==='dirty'||r.type==='both').length} dirty</div></div>
</div>
${tableHTML('Feedings', feedR.slice(0,25), ['date','startTime','type','amount','burped','notes'])}
${tableHTML('Sleep', sleepR.slice(0,20), ['sleepStart','sleepEnd','durationMins','quality'])}
${tableHTML('Diapers', diaperR.slice(0,25), ['date','time','type','color','consistency'])}
<div class="disclaimer">⚠️ This report is for personal monitoring only and is NOT a medical document. Always consult your pediatrician for medical advice.</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return toast('Allow pop-ups to print reports', 'warning');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }

  function tableHTML(title, rows, cols) {
    if (!rows.length) return '';
    const MAP = {
      date:'Date', startTime:'Start', endTime:'End', durationMins:'Dur(min)',
      type:'Type', amount:'ml', medicine:'Medicine', burped:'Burped', notes:'Notes',
      sleepStart:'Start', sleepEnd:'End', quality:'Quality', color:'Color',
      consistency:'Texture', time:'Time', temp:'Temp', method:'Method',
    };
    const ths  = cols.map(c => `<th>${MAP[c]||c}</th>`).join('');
    const rows_ = rows.map(r => {
      const tds = cols.map(c => {
        let v = r[c];
        if (v === undefined || v === null) v = '';
        if (typeof v === 'boolean') v = v ? 'Yes' : '';
        return `<td>${escHtml(String(v).slice(0,40))}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<h2>${title}</h2><table><thead><tr>${ths}</tr></thead><tbody>${rows_}</tbody></table>`;
  }

  /* ----------------------------------------------------------
     PUBLIC API
  ---------------------------------------------------------- */
  return {
    exportJSON,
    exportModuleCSV,
    exportCSVAll,
    exportExcel,
    exportPDF,
    printReport,
  };
})();
