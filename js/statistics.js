/* ============================================================
   statistics.js — Statistics Engine
   All calculations generated dynamically from LocalStorage.
   ============================================================ */
'use strict';

const Stats = (() => {

  /* ----------------------------------------------------------
     DATE RANGE HELPERS
  ---------------------------------------------------------- */
  function dateRange(filter) {
    const now   = new Date();
    const today = todayStr();

    switch (filter) {
      case 'today': {
        return { start: today, end: today };
      }
      case 'yesterday': {
        const d = new Date(); d.setDate(d.getDate() - 1);
        const s = d.toISOString().slice(0,10);
        return { start: s, end: s };
      }
      case 'week': {
        const d = new Date(); d.setDate(d.getDate() - 6);
        return { start: d.toISOString().slice(0,10), end: today };
      }
      case 'month': {
        const d = new Date(); d.setDate(d.getDate() - 29);
        return { start: d.toISOString().slice(0,10), end: today };
      }
      case 'custom':
        return null; // handled by caller
      default:
        return { start: today, end: today };
    }
  }

  function inRange(dateStr, range) {
    if (!range) return true;
    const d = (dateStr || '').slice(0,10);
    return d >= range.start && d <= range.end;
  }

  function filterByRange(records, range, dateKey = 'date') {
    if (!range) return records;
    return records.filter(r => {
      const d = (r[dateKey] || '').slice(0,10);
      return d >= range.start && d <= range.end;
    });
  }

  /* ----------------------------------------------------------
     FEEDING STATISTICS
  ---------------------------------------------------------- */
  function feeding(range) {
    const all     = Storage.getRecords('feeding');
    const records = filterByRange(all, range);

    const totalMl    = records.reduce((s, r) => s + (+r.amount || 0), 0);
    const withDur    = records.filter(r => r.durationMins > 0);
    const avgDurMins = withDur.length
      ? Math.round(withDur.reduce((s,r) => s + +r.durationMins, 0) / withDur.length) : 0;

    // Average interval between feedings (sorted by date+time)
    const sorted = [...records].sort((a,b) => {
      const at = (a.date||'') + (a.startTime||'');
      const bt = (b.date||'') + (b.startTime||'');
      return at.localeCompare(bt);
    });
    let totalIntervalMins = 0, intervalCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      try {
        const prev = new Date(`${sorted[i-1].date}T${sorted[i-1].startTime||'00:00'}`);
        const curr = new Date(`${sorted[i].date}T${sorted[i].startTime||'00:00'}`);
        const diff = (curr - prev) / 60000;
        if (diff > 0 && diff < 720) { totalIntervalMins += diff; intervalCount++; }
      } catch {}
    }
    const avgIntervalMins = intervalCount ? Math.round(totalIntervalMins / intervalCount) : 0;

    // Type breakdown
    const byType = {};
    for (const r of records) byType[r.type] = (byType[r.type] || 0) + 1;

    // Next feeding estimate
    const lastFeed = all[0];
    let nextFeedingTime = null;
    let nextFeedingMins = null;
    if (lastFeed?.startTime && lastFeed?.date) {
      const s       = Storage.getSettings();
      const intv    = (s.feedInterval || 2) * 60;
      const lastMs  = new Date(`${lastFeed.date}T${lastFeed.startTime}`).getTime();
      const nextMs  = lastMs + intv * 60000;
      nextFeedingTime = new Date(nextMs);
      nextFeedingMins = Math.round((nextMs - Date.now()) / 60000);
    }

    return {
      count: records.length,
      totalMl,
      avgMlPerFeed: records.length ? Math.round(totalMl / records.length) : 0,
      avgDurMins,
      avgIntervalMins,
      byType,
      lastFeed: all[0] || null,
      nextFeedingTime,
      nextFeedingMins,
    };
  }

  /* ----------------------------------------------------------
     SLEEP STATISTICS
  ---------------------------------------------------------- */
  function sleep(range) {
    const all     = Storage.getRecords('sleep');
    const records = filterByRange(all, range, 'sleepStart');

    const totalMins = records.reduce((s,r) => s + (+r.durationMins || 0), 0);
    const durations = records.map(r => +r.durationMins || 0).filter(Boolean);
    const longest   = durations.length ? Math.max(...durations) : 0;
    const shortest  = durations.length ? Math.min(...durations) : 0;
    const avgMins   = durations.length ? Math.round(durations.reduce((a,b)=>a+b,0) / durations.length) : 0;

    // Daily totals for range
    const days = range ? lastNDates(daysBetween(range.start, range.end) + 1) : lastNDates(7);
    const dailyMins = days.map(d => ({
      date: d,
      mins: all.filter(r => r.sleepStart?.slice(0,10) === d)
                .reduce((s,r) => s + (+r.durationMins||0), 0)
    }));
    const avgDailyMins = dailyMins.reduce((s,d) => s + d.mins, 0) / (dailyMins.length || 1);

    return {
      count: records.length,
      totalMins,
      totalHours: +(totalMins/60).toFixed(1),
      longest,
      shortest,
      avgMins,
      avgDailyMins: Math.round(avgDailyMins),
      dailyMins,
      lastSleep: all[0] || null,
    };
  }

  /* ----------------------------------------------------------
     DIAPER STATISTICS
  ---------------------------------------------------------- */
  function diaper(range) {
    const all     = Storage.getRecords('diaper');
    const records = filterByRange(all, range);

    const wet   = records.filter(r => r.type==='wet'   || r.type==='both').length;
    const dirty = records.filter(r => r.type==='dirty' || r.type==='both').length;

    const days = range ? daysBetween(range.start, range.end) + 1 : 7;
    const avgPerDay = records.length ? +(records.length / days).toFixed(1) : 0;

    // Daily breakdown for last 7 days
    const dates7 = lastNDates(7);
    const daily7 = dates7.map(d => ({
      date: d,
      wet:   all.filter(r => r.date===d && (r.type==='wet'||r.type==='both')).length,
      dirty: all.filter(r => r.date===d && (r.type==='dirty'||r.type==='both')).length,
    }));

    return { count: records.length, wet, dirty, avgPerDay, daily7 };
  }

  /* ----------------------------------------------------------
     GROWTH STATISTICS
  ---------------------------------------------------------- */
  function growth() {
    const records = Storage.getRecords('growth');
    const latest  = records[0];
    const prev    = records[1];

    let weightDelta = null, heightDelta = null;
    if (latest && prev) {
      if (latest.weight && prev.weight) weightDelta = +(parseFloat(latest.weight) - parseFloat(prev.weight)).toFixed(2);
      if (latest.height && prev.height) heightDelta = +(parseFloat(latest.height) - parseFloat(prev.height)).toFixed(1);
    }

    return {
      count:       records.length,
      latestWeight: latest?.weight  || null,
      latestHeight: latest?.height  || null,
      latestHead:   latest?.headCirc || null,
      latestDate:   latest?.date    || null,
      weightDelta,
      heightDelta,
      history: [...records].reverse(),
    };
  }

  /* ----------------------------------------------------------
     TEMPERATURE STATISTICS
  ---------------------------------------------------------- */
  function temperature(range) {
    const all     = Storage.getRecords('temperature');
    const records = filterByRange(all, range);

    const temps  = records.map(r => parseFloat(r.temp)).filter(v => !isNaN(v));
    const avg    = temps.length ? +(temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(1) : null;
    const max    = temps.length ? Math.max(...temps) : null;
    const min    = temps.length ? Math.min(...temps) : null;
    const fevers = records.filter(r => parseFloat(r.temp) >= 38).length;
    const latest = all[0];

    return { count: records.length, avg, max, min, fevers, latest, history: [...records].reverse().slice(-20) };
  }

  /* ----------------------------------------------------------
     MEDICINE STATISTICS
  ---------------------------------------------------------- */
  function medicine(range) {
    const all     = Storage.getRecords('medicine');
    const records = filterByRange(all, range);

    const completed = records.filter(r => r.completed).length;
    const pending   = records.filter(r => !r.completed).length;
    const pct       = records.length ? Math.round((completed/records.length)*100) : 0;

    // Next upcoming (not completed, sorted by date+time)
    const upcoming = all.filter(r => !r.completed)
      .sort((a,b) => ((a.date+a.time)||(a.createdAt||'')).localeCompare((b.date+b.time)||(b.createdAt||'')));
    const nextMed = upcoming[0] || null;
    const nextVit = upcoming.find(r => r.type === 'Vitamin') || null;

    return { count: records.length, completed, pending, pct, nextMed, nextVit, upcoming: upcoming.slice(0,5) };
  }

  /* ----------------------------------------------------------
     VACCINATION STATISTICS
  ---------------------------------------------------------- */
  function vaccination() {
    const all     = Storage.getRecords('vaccination');
    const done    = all.filter(r => !!r.completedDate);
    const pending = all.filter(r => !r.completedDate);
    const today   = todayStr();
    const overdue = pending.filter(r => r.dueDate && r.dueDate < today);
    const upcoming= pending.filter(r => !r.dueDate || r.dueDate >= today)
      .sort((a,b) => (a.dueDate||'9').localeCompare(b.dueDate||'9'));

    return {
      total: all.length, done: done.length, pending: pending.length,
      overdue: overdue.length,
      pct: all.length ? Math.round((done.length/all.length)*100) : 0,
      nextVaccine: upcoming[0] || null,
      upcoming: upcoming.slice(0,3),
    };
  }

  /* ----------------------------------------------------------
     DOCTOR STATISTICS
  ---------------------------------------------------------- */
  function doctor() {
    const all     = Storage.getRecords('doctor');
    const today   = todayStr();
    const upcoming= all.filter(r => r.followupDate && r.followupDate >= today)
      .sort((a,b) => a.followupDate.localeCompare(b.followupDate));

    return { count: all.length, nextFollowup: upcoming[0] || null, upcoming: upcoming.slice(0,3) };
  }

  /* ----------------------------------------------------------
     FULL DASHBOARD SUMMARY
  ---------------------------------------------------------- */
  function dashboardSummary() {
    const range = dateRange('today');
    return {
      feeding:     feeding(range),
      sleep:       sleep(range),
      diaper:      diaper(range),
      growth:      growth(),
      temperature: temperature({ start: lastNDates(7)[0], end: todayStr() }),
      medicine:    medicine(null),
      vaccination: vaccination(),
      doctor:      doctor(),
    };
  }

  /* ----------------------------------------------------------
     CHART DATA GENERATORS
  ---------------------------------------------------------- */

  /** Daily milk intake for last N days */
  function dailyMilkData(n) {
    const dates   = lastNDates(n);
    const feeds   = Storage.getRecords('feeding');
    return {
      labels: dates.map(d => shortDay(d)),
      data:   dates.map(d => feeds.filter(r => r.date===d).reduce((s,r) => s+(+r.amount||0), 0)),
      dates,
    };
  }

  /** Feeding count per day for last N days */
  function dailyFeedingCountData(n) {
    const dates = lastNDates(n);
    const feeds = Storage.getRecords('feeding');
    return {
      labels: dates.map(d => shortDay(d)),
      data:   dates.map(d => feeds.filter(r => r.date===d).length),
      dates,
    };
  }

  /** Sleep hours per day for last N days */
  function dailySleepData(n) {
    const dates  = lastNDates(n);
    const sleeps = Storage.getRecords('sleep');
    return {
      labels: dates.map(d => shortDay(d)),
      data:   dates.map(d => {
        const mins = sleeps.filter(r => r.sleepStart?.slice(0,10)===d)
          .reduce((s,r) => s+(+r.durationMins||0), 0);
        return +(mins/60).toFixed(1);
      }),
      dates,
    };
  }

  /** Wet vs Dirty diapers per day for last N days */
  function diaperData(n) {
    const dates  = lastNDates(n);
    const diaps  = Storage.getRecords('diaper');
    return {
      labels: dates.map(d => shortDay(d)),
      wet:    dates.map(d => diaps.filter(r => r.date===d && (r.type==='wet'||r.type==='both')).length),
      dirty:  dates.map(d => diaps.filter(r => r.date===d && (r.type==='dirty'||r.type==='both')).length),
      dates,
    };
  }

  /** Temperature readings for last N days */
  function temperatureData(n) {
    const recs = Storage.getRecords('temperature').slice(-n).reverse();
    return {
      labels: recs.map(r => `${(r.date||'').slice(5)} ${r.time||''}`),
      data:   recs.map(r => parseFloat(r.temp) || null),
      colors: recs.map(r => {
        const t = parseFloat(r.temp);
        if (t >= 38)   return '#ef4444';
        if (t >= 37.5) return '#f59e0b';
        return '#22c55e';
      }),
    };
  }

  /** Weight/height/head growth history */
  function growthData() {
    const recs = Storage.getRecords('growth').slice().reverse();
    return {
      labels:  recs.map(r => formatDate(r.date)),
      weight:  recs.map(r => parseFloat(r.weight)   || null),
      height:  recs.map(r => parseFloat(r.height)   || null),
      head:    recs.map(r => parseFloat(r.headCirc) || null),
    };
  }

  /** Medicine compliance for last 30 days */
  function medicineCompliance() {
    const recs = Storage.getRecords('medicine');
    const done = recs.filter(r => r.completed).length;
    const pend = recs.filter(r => !r.completed).length;
    return { labels:['Completed','Pending'], data:[done, pend||1] };
  }

  /** Vaccination progress */
  function vaccinationProgress() {
    const recs = Storage.getRecords('vaccination');
    const done = recs.filter(r => r.completedDate).length;
    const pend = recs.length - done;
    return { labels:['Completed','Pending'], data:[done, pend||1], pct: recs.length ? Math.round(done/recs.length*100) : 0 };
  }

  /* ----------------------------------------------------------
     HELPERS
  ---------------------------------------------------------- */
  function daysBetween(start, end) {
    const a = new Date(start+'T00:00:00');
    const b = new Date(end+'T00:00:00');
    return Math.max(0, Math.round((b-a)/86400000));
  }

  /* ----------------------------------------------------------
     PUBLIC API
  ---------------------------------------------------------- */
  return {
    dateRange,
    inRange,
    filterByRange,
    feeding,
    sleep,
    diaper,
    growth,
    temperature,
    medicine,
    vaccination,
    doctor,
    dashboardSummary,
    // Chart data generators
    dailyMilkData,
    dailyFeedingCountData,
    dailySleepData,
    diaperData,
    temperatureData,
    growthData,
    medicineCompliance,
    vaccinationProgress,
  };
})();
