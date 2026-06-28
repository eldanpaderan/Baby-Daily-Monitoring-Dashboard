/* ============================================================
   charts.js — Chart.js Rendering Engine
   All 10 chart types, theme-aware, fully dynamic
   ============================================================ */
'use strict';

const Charts = (() => {

  const _instances = {};

  /* ----------------------------------------------------------
     THEME TOKENS
  ---------------------------------------------------------- */
  function tk() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      grid:    dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)',
      tick:    dark ? '#64748b' : '#94a3b8',
      bg:      dark ? '#1e1f30' : '#ffffff',
      border:  dark ? '#2d2f45' : '#e2e8f0',
      text:    dark ? '#f1f5f9' : '#0f172a',
    };
  }

  /* ----------------------------------------------------------
     SHARED CONFIGS
  ---------------------------------------------------------- */
  function tooltip() {
    const t = tk();
    return {
      backgroundColor: t.bg,
      borderColor:     t.border,
      borderWidth:     1,
      titleColor:      t.text,
      bodyColor:       t.tick,
      padding:         12,
      cornerRadius:    10,
      titleFont: { family: 'Space Grotesk', weight: '700', size: 13 },
      bodyFont:  { family: 'Nunito', size: 12 },
    };
  }

  function scales(yLabel = '', yMin = null) {
    const t = tk();
    const y = {
      grid:      { color: t.grid, drawTicks: false },
      ticks:     { color: t.tick, font: { size: 11, family: 'Nunito' }, padding: 6 },
      beginAtZero: true,
    };
    if (yLabel) y.title = { display: true, text: yLabel, color: t.tick, font: { size: 11 } };
    if (yMin !== null) y.min = yMin;

    return {
      x: { grid: { color: t.grid, drawTicks: false }, ticks: { color: t.tick, font: { size: 11, family: 'Nunito' }, padding: 6 } },
      y,
    };
  }

  function legend(pos = 'bottom') {
    const t = tk();
    return {
      position: pos,
      labels: { color: t.tick, boxWidth: 12, padding: 14, font: { family: 'Nunito', size: 11 } },
    };
  }

  /* ----------------------------------------------------------
     RENDER HELPER — destroy & recreate
  ---------------------------------------------------------- */
  function render(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (_instances[id]) { _instances[id].destroy(); delete _instances[id]; }
    try {
      Chart.defaults.font.family = 'Nunito';
      _instances[id] = new Chart(canvas.getContext('2d'), config);
    } catch(e) { console.warn('Chart render error:', id, e); }
  }

  /* ----------------------------------------------------------
     GRADIENT HELPER
  ---------------------------------------------------------- */
  function gradient(ctx, color1, color2 = 'transparent') {
    try {
      const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
      g.addColorStop(0,   color1);
      g.addColorStop(1,   color2);
      return g;
    } catch { return color1; }
  }

  /* ----------------------------------------------------------
     1. DAILY FEEDING COUNT (bar — dashboard)
  ---------------------------------------------------------- */
  function renderFeedingToday(canvasId = 'chartFeedingToday') {
    const d = Stats.dailyFeedingCountData(7);
    render(canvasId, {
      type: 'bar',
      data: {
        labels: d.labels,
        datasets: [{
          label: 'Feedings',
          data:  d.data,
          backgroundColor: 'rgba(99,102,241,.75)',
          hoverBackgroundColor: 'rgba(99,102,241,1)',
          borderRadius: 7,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: tooltip() },
        scales: scales(),
      },
    });
  }

  /* ----------------------------------------------------------
     2. SLEEP DURATION (line — dashboard)
  ---------------------------------------------------------- */
  function renderSleepWeek(canvasId = 'chartSleepWeek') {
    const d = Stats.dailySleepData(7);
    const canvas = document.getElementById(canvasId);
    const ctx    = canvas?.getContext('2d');
    const grad   = ctx ? gradient(ctx, 'rgba(76,217,192,.5)', 'rgba(76,217,192,.02)') : 'rgba(76,217,192,.2)';

    render(canvasId, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [{
          label: 'Sleep (hrs)',
          data:  d.data,
          borderColor: '#4cd9c0',
          backgroundColor: grad,
          fill: true,
          tension: 0.45,
          pointBackgroundColor: '#4cd9c0',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          borderWidth: 2.5,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: tooltip() },
        scales: scales('hrs'),
      },
    });
  }

  /* ----------------------------------------------------------
     3. WET vs DIRTY DIAPERS (grouped bar — dashboard)
  ---------------------------------------------------------- */
  function renderDiaperWeek(canvasId = 'chartDiaperWeek') {
    const d = Stats.diaperData(7);
    render(canvasId, {
      type: 'bar',
      data: {
        labels: d.labels,
        datasets: [
          { label: '💧 Wet',   data: d.wet,   backgroundColor: 'rgba(59,130,246,.75)',  borderRadius: 5, borderSkipped: false },
          { label: '💩 Dirty', data: d.dirty, backgroundColor: 'rgba(249,115,22,.75)',  borderRadius: 5, borderSkipped: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: legend('top'), tooltip: tooltip() },
        scales: scales(),
      },
    });
  }

  /* ----------------------------------------------------------
     4. TEMPERATURE TREND (line + point colors)
  ---------------------------------------------------------- */
  function renderTempTrend(canvasId = 'chartTemp') {
    const d = Stats.temperatureData(20);
    render(canvasId, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [{
          label: 'Temp (°C)',
          data:  d.data,
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244,63,94,.08)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: d.colors,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 9,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltip(),
            callbacks: {
              label: ctx => ` ${ctx.raw}°C — ${tempStatusLabel(ctx.raw)}`,
            },
          },
        },
        scales: scales('°C', 35),
        annotation: {
          annotations: {
            feverLine: {
              type: 'line', yMin: 38, yMax: 38,
              borderColor: 'rgba(239,68,68,.5)',
              borderWidth: 1.5,
              borderDash: [6, 4],
              label: { display: true, content: 'Fever 38°C', position: 'end', font: { size: 10 } },
            },
          },
        },
      },
    });
  }

  /* ----------------------------------------------------------
     5. GROWTH — Weight (line)
  ---------------------------------------------------------- */
  function renderGrowthWeight(canvasId = 'chartWeight') {
    const d = Stats.growthData();
    if (!d.weight.some(v=>v)) return;
    const canvas = document.getElementById(canvasId);
    const ctx    = canvas?.getContext('2d');
    const grad   = ctx ? gradient(ctx, 'rgba(99,102,241,.4)', 'rgba(99,102,241,.02)') : 'rgba(99,102,241,.2)';
    render(canvasId, {
      type: 'line',
      data: { labels: d.labels, datasets: [{ label:'Weight (kg)', data:d.weight, borderColor:'#6366f1', backgroundColor:grad, fill:true, tension:.4, pointBackgroundColor:'#6366f1', pointBorderColor:'#fff', pointBorderWidth:2, pointRadius:5, borderWidth:2 }] },
      options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:tooltip() }, scales:scales('kg') },
    });
  }

  /* ----------------------------------------------------------
     6. GROWTH — Height (line)
  ---------------------------------------------------------- */
  function renderGrowthHeight(canvasId = 'chartHeight') {
    const d = Stats.growthData();
    if (!d.height.some(v=>v)) return;
    const canvas = document.getElementById(canvasId);
    const ctx    = canvas?.getContext('2d');
    const grad   = ctx ? gradient(ctx, 'rgba(34,197,94,.4)', 'rgba(34,197,94,.02)') : 'rgba(34,197,94,.2)';
    render(canvasId, {
      type: 'line',
      data: { labels: d.labels, datasets: [{ label:'Height (cm)', data:d.height, borderColor:'#22c55e', backgroundColor:grad, fill:true, tension:.4, pointBackgroundColor:'#22c55e', pointBorderColor:'#fff', pointBorderWidth:2, pointRadius:5, borderWidth:2 }] },
      options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:tooltip() }, scales:scales('cm') },
    });
  }

  /* ----------------------------------------------------------
     7. GROWTH — Head Circumference (line)
  ---------------------------------------------------------- */
  function renderGrowthHead(canvasId = 'chartHead') {
    const d = Stats.growthData();
    if (!d.head.some(v=>v)) return;
    const canvas = document.getElementById(canvasId);
    const ctx    = canvas?.getContext('2d');
    const grad   = ctx ? gradient(ctx, 'rgba(236,72,153,.4)', 'rgba(236,72,153,.02)') : 'rgba(236,72,153,.2)';
    render(canvasId, {
      type: 'line',
      data: { labels: d.labels, datasets: [{ label:'Head Circ. (cm)', data:d.head, borderColor:'#ec4899', backgroundColor:grad, fill:true, tension:.4, pointBackgroundColor:'#ec4899', pointBorderColor:'#fff', pointBorderWidth:2, pointRadius:5, borderWidth:2 }] },
      options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:tooltip() }, scales:scales('cm') },
    });
  }

  /* ----------------------------------------------------------
     8. MEDICINE COMPLIANCE (doughnut)
  ---------------------------------------------------------- */
  function renderMedicineCompliance(canvasId = 'chartAnalyticsMeds') {
    const d = Stats.medicineCompliance();
    render(canvasId, {
      type: 'doughnut',
      data: {
        labels: d.labels,
        datasets: [{
          data: d.data,
          backgroundColor: ['rgba(34,197,94,.85)', 'rgba(245,158,11,.85)'],
          borderColor: [tk().bg, tk().bg],
          borderWidth: 3,
          hoverOffset: 10,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        cutout: '68%',
        plugins: {
          legend: legend('bottom'),
          tooltip: tooltip(),
        },
      },
    });
  }

  /* ----------------------------------------------------------
     9. VACCINATION PROGRESS (doughnut)
  ---------------------------------------------------------- */
  function renderVaccinationProgress(canvasId = 'chartVaccineProgress') {
    const d = Stats.vaccinationProgress();
    render(canvasId, {
      type: 'doughnut',
      data: {
        labels: d.labels,
        datasets: [{
          data: d.data,
          backgroundColor: ['rgba(16,185,129,.85)', 'rgba(148,163,184,.4)'],
          borderColor: [tk().bg, tk().bg],
          borderWidth: 3,
          hoverOffset: 10,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        cutout: '68%',
        plugins: {
          legend: legend('bottom'),
          tooltip: tooltip(),
        },
      },
    });
  }

  /* ----------------------------------------------------------
     10. ANALYTICS — DAILY FEEDING ml (bar, variable days)
  ---------------------------------------------------------- */
  function renderAnalyticsFeeding(n = 7, canvasId = 'chartAnalyticsFeeding') {
    const d = Stats.dailyMilkData(n);
    const labels = n > 14 ? d.dates.map((dt,i) => i%5===0 ? dt.slice(5) : '') : d.labels;
    render(canvasId, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Milk (ml)',
          data:  d.data,
          backgroundColor: 'rgba(99,102,241,.75)',
          borderRadius: 5,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: tooltip() },
        scales: scales('ml'),
      },
    });
  }

  /* Analytics — Sleep */
  function renderAnalyticsSleep(n = 7, canvasId = 'chartAnalyticsSleep') {
    const d = Stats.dailySleepData(n);
    const labels = n > 14 ? d.dates.map((dt,i) => i%5===0 ? dt.slice(5) : '') : d.labels;
    const canvas = document.getElementById(canvasId);
    const ctx    = canvas?.getContext('2d');
    const grad   = ctx ? gradient(ctx, 'rgba(76,217,192,.5)', 'rgba(76,217,192,.02)') : 'rgba(76,217,192,.2)';
    render(canvasId, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label:'Sleep (hrs)', data:d.data, borderColor:'#4cd9c0', backgroundColor:grad, fill:true, tension:.45, pointRadius:3, pointHoverRadius:6, borderWidth:2 }],
      },
      options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:tooltip() }, scales:scales('hrs') },
    });
  }

  /* Analytics — Diaper */
  function renderAnalyticsDiaper(n = 7, canvasId = 'chartAnalyticsDiaper') {
    const d = Stats.diaperData(n);
    const labels = n > 14 ? d.dates.map((dt,i) => i%5===0 ? dt.slice(5) : '') : d.labels;
    render(canvasId, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'💧 Wet',   data:d.wet,   backgroundColor:'rgba(59,130,246,.75)',  borderRadius:4, borderSkipped:false },
          { label:'💩 Dirty', data:d.dirty, backgroundColor:'rgba(249,115,22,.75)',  borderRadius:4, borderSkipped:false },
        ],
      },
      options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:legend('top'), tooltip:tooltip() }, scales:scales() },
    });
  }

  /* Analytics — Temperature */
  function renderAnalyticsTemp(n = 20, canvasId = 'chartAnalyticsTemp') {
    const d = Stats.temperatureData(n);
    render(canvasId, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [{ label:'°C', data:d.data, borderColor:'#f43f5e', backgroundColor:'rgba(244,63,94,.08)', fill:true, tension:.3, pointBackgroundColor:d.colors, pointBorderColor:'#fff', pointBorderWidth:2, pointRadius:5, borderWidth:2 }],
      },
      options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:tooltip() }, scales:scales('°C', 35) },
    });
  }

  /* Analytics — Weight */
  function renderAnalyticsWeight(canvasId = 'chartAnalyticsWeight') {
    renderGrowthWeight(canvasId);
  }

  /* ----------------------------------------------------------
     DASHBOARD CHART GROUP
  ---------------------------------------------------------- */
  function renderDashboardCharts() {
    renderFeedingToday('chartFeedingToday');
    renderSleepWeek('chartSleepWeek');
    renderDiaperWeek('chartDiaperWeek');
  }

  /* ----------------------------------------------------------
     ANALYTICS CHART GROUP
  ---------------------------------------------------------- */
  function renderAnalyticsCharts(n) {
    renderAnalyticsFeeding(n, 'chartAnalyticsFeeding');
    renderAnalyticsSleep(n, 'chartAnalyticsSleep');
    renderAnalyticsDiaper(n, 'chartAnalyticsDiaper');
    renderAnalyticsTemp(Math.min(n, 30), 'chartAnalyticsTemp');
    renderAnalyticsWeight('chartAnalyticsWeight');
    renderMedicineCompliance('chartAnalyticsMeds');
  }

  /* ----------------------------------------------------------
     GROWTH CHART GROUP
  ---------------------------------------------------------- */
  function renderGrowthCharts() {
    renderGrowthWeight('chartWeight');
    renderGrowthHeight('chartHeight');
    renderGrowthHead('chartHead');
  }

  /* ----------------------------------------------------------
     REFRESH ALL (on theme change)
  ---------------------------------------------------------- */
  function refreshAll() {
    const active = document.querySelector('.section.active')?.id?.replace('section-','');
    switch(active) {
      case 'dashboard':  renderDashboardCharts(); break;
      case 'growth':     renderGrowthCharts(); break;
      case 'temperature':renderTempTrend('chartTemp'); break;
      case 'analytics':  renderAnalyticsCharts(7); break;
    }
  }

  /* ----------------------------------------------------------
     UTIL
  ---------------------------------------------------------- */
  function tempStatusLabel(t) {
    if (!t || isNaN(t)) return '—';
    if (t < 36)   return '🥶 Low';
    if (t <= 37.5) return '✅ Normal';
    if (t <= 38)   return '⚠️ Slight Fever';
    return '🔴 Fever!';
  }

  /* ----------------------------------------------------------
     PUBLIC API
  ---------------------------------------------------------- */
  return {
    renderDashboardCharts,
    renderGrowthCharts,
    renderTempTrend,
    renderAnalyticsCharts,
    renderMedicineCompliance,
    renderVaccinationProgress,
    refreshAll,
  };
})();
