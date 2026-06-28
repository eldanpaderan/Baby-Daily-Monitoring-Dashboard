/* ============================================================
   sample-data.js — Realistic sample records for all modules
   ============================================================ */
'use strict';

const SampleData = (() => {

  function daysAgo(n, timeStr) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    if (timeStr) return d.toISOString().slice(0,10) + 'T' + timeStr;
    return d.toISOString().slice(0,10);
  }

  function addHours(isoStr, hrs) {
    const d = new Date(isoStr);
    d.setHours(d.getHours() + hrs);
    return d.toISOString().slice(0,16);
  }

  function load() {
    // ---- SETTINGS ----
    Storage.saveSettings({ babyName:'Sofia', birthday: daysAgo(47), weight:'4.2', feedInterval:2, darkMode:true, notifSound:true });

    // ---- FEEDING ----
    const feedTypes = ['Left Breast','Right Breast','Bottle Breastmilk','Formula'];
    const feedData  = [];
    for (let day = 0; day < 14; day++) {
      const d = daysAgo(day);
      const times = ['02:00','05:30','08:15','11:00','14:30','17:00','20:00','23:00'];
      for (const t of times) {
        const dur = 15 + Math.floor(Math.random()*20);
        const [h,m] = t.split(':').map(Number);
        const endH = Math.floor((h*60+m+dur)/60)%24;
        const endM = (h*60+m+dur)%60;
        feedData.push({
          id: generateId(), date: d,
          startTime: t,
          endTime: `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`,
          durationMins: dur,
          type: feedTypes[Math.floor(Math.random()*feedTypes.length)],
          amount: 60 + Math.floor(Math.random()*80),
          burped: Math.random()>.3,
          spitUp: Math.random()>.8,
          vomited: Math.random()>.95,
          notes: day===0 && t==='08:15' ? 'Very hungry this morning!' : '',
          createdAt: new Date().toISOString()
        });
      }
    }
    Storage.merge('feeding', feedData);

    // ---- SLEEP ----
    const sleepData = [];
    for (let day = 0; day < 14; day++) {
      const d = daysAgo(day);
      const sessions = [
        { start:`${d}T01:00`, dur: 180 },
        { start:`${d}T05:00`, dur: 60  },
        { start:`${d}T09:30`, dur: 90  },
        { start:`${d}T13:00`, dur: 120 },
        { start:`${d}T18:30`, dur: 45  },
        { start:`${d}T21:00`, dur: 240 },
      ];
      for (const ses of sessions) {
        const endMs = new Date(ses.start).getTime() + ses.dur * 60000;
        sleepData.push({
          id: generateId(),
          sleepStart: ses.start,
          sleepEnd: new Date(endMs).toISOString().slice(0,16),
          durationMins: ses.dur,
          quality: ['Excellent','Good','Good','Fair','Poor'][Math.floor(Math.random()*5)],
          notes: '',
          createdAt: new Date().toISOString()
        });
      }
    }
    Storage.merge('sleep', sleepData);

    // ---- DIAPER ----
    const diaperData = [];
    const dTypes = ['wet','wet','wet','dirty','both'];
    const colors  = ['Yellow','Yellow','Green','Brown'];
    const consist = ['Soft','Seedy','Watery','Formed'];
    for (let day = 0; day < 14; day++) {
      const d = daysAgo(day);
      const times = ['04:00','07:30','10:00','13:30','16:00','19:30','22:00'];
      for (const t of times) {
        const typ = dTypes[Math.floor(Math.random()*dTypes.length)];
        diaperData.push({
          id: generateId(), date: d, time: t,
          type: typ,
          color: typ!=='wet' ? colors[Math.floor(Math.random()*colors.length)] : '',
          consistency: typ!=='wet' ? consist[Math.floor(Math.random()*consist.length)] : '',
          notes: '',
          createdAt: new Date().toISOString()
        });
      }
    }
    Storage.merge('diaper', diaperData);

    // ---- GROWTH ----
    const growthData = [
      { id:generateId(), date:daysAgo(0),  weight:'4.50', height:'54.0', headCirc:'37.5', notes:'1-month checkup', createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(14), weight:'4.10', height:'52.5', headCirc:'36.8', notes:'',                 createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(28), weight:'3.80', height:'51.0', headCirc:'36.0', notes:'Birth weight restored', createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(45), weight:'3.40', height:'50.0', headCirc:'34.5', notes:'Birth',            createdAt:new Date().toISOString() },
    ];
    Storage.merge('growth', growthData);

    // ---- TEMPERATURE ----
    const tempData = [];
    for (let i = 0; i < 10; i++) {
      const t = 36.4 + (Math.random()*1.4 - 0.2);
      tempData.push({
        id: generateId(), date: daysAgo(i),
        time: `${String(8+Math.floor(Math.random()*4)).padStart(2,'0')}:00`,
        temp: t.toFixed(1),
        method: ['Armpit','Ear','Armpit'][Math.floor(Math.random()*3)],
        notes: t >= 38 ? 'Felt warm, monitored closely' : '',
        createdAt: new Date().toISOString()
      });
    }
    // Add a fever episode
    tempData.push({ id:generateId(), date:daysAgo(5), time:'14:30', temp:'38.3', method:'Ear', notes:'Doctor consulted by phone', createdAt:new Date().toISOString() });
    Storage.merge('temperature', tempData);

    // ---- MEDICINE ----
    const medData = [
      { id:generateId(), date:daysAgo(0),  time:'08:00', name:'Vitamin D Drops', type:'Vitamin', dose:'0.5ml', completed:true,  notes:'Daily supplement', createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(0),  time:'20:00', name:'Vitamin D Drops', type:'Vitamin', dose:'0.5ml', completed:false, notes:'',                  createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(1),  time:'08:00', name:'Vitamin D Drops', type:'Vitamin', dose:'0.5ml', completed:true,  notes:'',                  createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(5),  time:'14:00', name:'Paracetamol Drops', type:'Medicine', dose:'0.8ml', completed:true, notes:'For fever 38.3°C', createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(5),  time:'20:00', name:'Paracetamol Drops', type:'Medicine', dose:'0.8ml', completed:true, notes:'Second dose',       createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(2),  time:'08:00', name:'Iron Supplement',  type:'Supplement', dose:'1ml',  completed:true, notes:'Prescribed by pedia', createdAt:new Date().toISOString() },
    ];
    Storage.merge('medicine', medData);

    // ---- VACCINATION ----
    const birthDate = new Date(Storage.getSettings().birthday+'T00:00:00');
    const bd = (plusDays) => { const d=new Date(birthDate); d.setDate(d.getDate()+plusDays); return d.toISOString().slice(0,10); };

    const vaxData = [
      { id:generateId(), name:'BCG',        dueDate:bd(0),   completedDate:bd(1),  hospital:'St. Luke\'s Medical Center', doctor:'Dr. Santos', notes:'No adverse reaction', createdAt:new Date().toISOString() },
      { id:generateId(), name:'Hepatitis B (Birth)', dueDate:bd(0), completedDate:bd(0), hospital:'St. Luke\'s Medical Center', doctor:'Dr. Santos', notes:'', createdAt:new Date().toISOString() },
      { id:generateId(), name:'DPT-HiB-HepB (1st)', dueDate:bd(42), completedDate:bd(43), hospital:'Health Center', doctor:'Dr. Reyes', notes:'Mild fever after', createdAt:new Date().toISOString() },
      { id:generateId(), name:'OPV (1st)',   dueDate:bd(42), completedDate:bd(43), hospital:'Health Center', doctor:'Dr. Reyes', notes:'Oral drops given', createdAt:new Date().toISOString() },
      { id:generateId(), name:'PCV (1st)',   dueDate:bd(42), completedDate:bd(43), hospital:'Health Center', doctor:'Dr. Reyes', notes:'', createdAt:new Date().toISOString() },
      { id:generateId(), name:'DPT-HiB-HepB (2nd)', dueDate:bd(70), completedDate:'', hospital:'', doctor:'', notes:'', createdAt:new Date().toISOString() },
      { id:generateId(), name:'OPV (2nd)',   dueDate:bd(70), completedDate:'', hospital:'', doctor:'', notes:'', createdAt:new Date().toISOString() },
      { id:generateId(), name:'PCV (2nd)',   dueDate:bd(70), completedDate:'', hospital:'', doctor:'', notes:'', createdAt:new Date().toISOString() },
      { id:generateId(), name:'MMR',         dueDate:bd(365), completedDate:'', hospital:'', doctor:'', notes:'', createdAt:new Date().toISOString() },
    ];
    Storage.merge('vaccination', vaxData);

    // ---- DOCTOR ----
    const docData = [
      { id:generateId(), date:daysAgo(45), doctor:'Dr. Maria Santos', hospital:'St. Luke\'s Medical Center',
        diagnosis:'Normal newborn', prescription:'Vitamin D 400IU daily', followupDate:daysAgo(-7),
        notes:'Weight and reflexes normal. Breastfeeding going well.', createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(30), doctor:'Dr. Jose Reyes', hospital:'City Health Center',
        diagnosis:'Well-baby visit — 6 weeks', prescription:'Continue Vitamin D, Iron supplement',
        followupDate:daysAgo(-14), notes:'Growth on track. Vaccines given.', createdAt:new Date().toISOString() },
      { id:generateId(), date:daysAgo(5), doctor:'Dr. Maria Santos', hospital:'St. Luke\'s Medical Center',
        diagnosis:'Mild fever — viral', prescription:'Paracetamol drops PRN, increase fluids',
        followupDate:'', notes:'Temp 38.3°C. Advised to monitor. Return if >38.5°C persists.', createdAt:new Date().toISOString() },
    ];
    Storage.merge('doctor', docData);

    // ---- JOURNAL ----
    const moods = ['😊 Happy','😴 Sleepy','😁 Playful','😌 Calm','😢 Fussy'];
    const journalNotes = [
      'Sofia smiled for the first time today! My heart melted completely. She recognized my voice and gave the most precious little grin.',
      'A rough night — up every 2 hours for feeding. But watching her sleep peacefully makes it all worth it.',
      'Tummy time went well today. She lifted her head for almost 10 seconds! Growing so fast.',
      'First outing to the park. She was so alert, looking at all the trees and colors. Absolutely loved it.',
      'We started introducing a bottle today. She was fussy at first but eventually took 60ml. Progress!',
      'Bath time is becoming her favorite. She kicks and splashes — so much personality already.',
      'Noticed her following my face with her eyes. The pediatrician said that\'s great for her age!',
    ];
    const journalData = journalNotes.map((notes, i) => ({
      id: generateId(), date: daysAgo(i),
      mood: moods[Math.floor(Math.random()*moods.length)],
      notes, milestones: i===0 ? 'First smile! 😊' : '',
      photo: '', createdAt: new Date().toISOString()
    }));
    Storage.merge('journal', journalData);

    // ---- MILESTONES ----
    const msData = [
      { id:generateId(), name:'First Smile',  date:daysAgo(0),  emoji:'😊', notes:'Smiled at Mama for the first time!', createdAt:new Date().toISOString() },
      { id:generateId(), name:'Lift Head',     date:daysAgo(7),  emoji:'🙆', notes:'Held head up for 10 seconds during tummy time', createdAt:new Date().toISOString() },
      { id:generateId(), name:'Recognizes Parents', date:daysAgo(14), emoji:'👀', notes:'Clearly follows our voices and faces now', createdAt:new Date().toISOString() },
      { id:generateId(), name:'First Bath',    date:daysAgo(42), emoji:'🛁', notes:'First sponge bath at home — she loved it!', createdAt:new Date().toISOString() },
    ];
    Storage.merge('milestones', msData);
  }

  return { load };
})();
