/* ============================================================
   storage.js — LocalStorage Data Layer
   ============================================================ */
'use strict';

const Storage = (() => {
  const KEYS = {
    settings:'bt_settings', feeding:'bt_feeding', sleep:'bt_sleep',
    diaper:'bt_diaper', growth:'bt_growth', temperature:'bt_temperature',
    medicine:'bt_medicine', vaccination:'bt_vaccination',
    doctor:'bt_doctor', journal:'bt_journal', milestones:'bt_milestones',
  };

  const DEFAULTS = {
    babyName:'Sofia', birthday: (() => { const d=new Date(); d.setDate(d.getDate()-47); return d.toISOString().slice(0,10); })(),
    weight:'4.2', feedInterval:2, tempUnit:'C', notifSound:true, darkMode:true,
  };

  function _get(key) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }
  function _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch { toast('Storage full — data may not save','error'); return false; }
  }

  function init() {
    if (!_get(KEYS.settings)) _set(KEYS.settings, DEFAULTS);
    for (const [k, key] of Object.entries(KEYS)) {
      if (k !== 'settings' && !_get(key)) _set(key, []);
    }
  }

  function getSettings()       { return { ...DEFAULTS, ...(_get(KEYS.settings)||{}) }; }
  function saveSettings(patch) { _set(KEYS.settings, { ...getSettings(), ...patch }); }

  function getRecords(mod)  { return _get(KEYS[mod]) || []; }

  function save(mod, data) {
    const recs = getRecords(mod);
    if (!data.id) data.id = generateId();
    data.createdAt = new Date().toISOString();
    recs.unshift(data);
    _set(KEYS[mod], recs);
    return data;
  }

  function update(mod, id, patch) {
    const recs = getRecords(mod);
    const idx  = recs.findIndex(r => r.id === id);
    if (idx === -1) return false;
    recs[idx] = { ...recs[idx], ...patch, updatedAt: new Date().toISOString() };
    _set(KEYS[mod], recs);
    return recs[idx];
  }

  function remove(mod, id) {
    _set(KEYS[mod], getRecords(mod).filter(r => r.id !== id));
  }

  function getById(mod, id) {
    return getRecords(mod).find(r => r.id === id) || null;
  }

  function merge(mod, incoming) {
    const existing = getRecords(mod);
    const ids = new Set(existing.map(r => r.id));
    let added = 0;
    for (const r of incoming) {
      if (!r.id) r.id = generateId();
      if (!ids.has(r.id)) { existing.push(r); added++; }
    }
    _set(KEYS[mod], existing);
    return added;
  }

  function exportAll() {
    const out = { exportedAt: new Date().toISOString(), version:'1.1' };
    for (const k of Object.keys(KEYS)) out[k] = _get(KEYS[k]) || (k==='settings' ? DEFAULTS : []);
    return out;
  }

  function importAll(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.settings) _set(KEYS.settings, data.settings);
    const mods = ['feeding','sleep','diaper','growth','temperature','medicine','vaccination','doctor','journal','milestones'];
    for (const m of mods) if (Array.isArray(data[m])) _set(KEYS[m], data[m]);
    return true;
  }

  function clearAll() {
    for (const key of Object.values(KEYS)) localStorage.removeItem(key);
  }

  return { init, getSettings, saveSettings, getRecords, save, update, remove, getById, merge, exportAll, importAll, clearAll, KEYS };
})();
