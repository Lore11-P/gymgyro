'use strict';

/* ---------------- utilità ---------------- */
const LS_KEY = 'gymgyro_v1';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const makeId = () => (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

const esc = (value = '') => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const clampInt = (value, min, max, fallback = min) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const fmtClock = (totalSeconds) => {
  const secs = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

const fmtDuration = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return h + 'h ' + m + 'm';
  return m + 'm ' + (s % 60) + 's';
};

const fmtDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const dayStamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};

const totalRepsOf = (workout) => ((workout && workout.exercises) || []).reduce((sum, ex) => {
  return sum + ((ex && ex.sets) || []).reduce((s, set) => s + (Number(set.reps) || 0), 0);
}, 0);

const svgIcon = (paths) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';

const I = {
  x: svgIcon('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: svgIcon('<path d="M12 5v14M5 12h14"/>'),
  edit: svgIcon('<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 7.5l3 3"/>'),
  trash: svgIcon('<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12"/><path d="M10 11v5M14 11v5"/>'),
  download: svgIcon('<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19h14"/>'),
  share: svgIcon('<path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>'),
  table: svgIcon('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M10 10v9"/>'),
  chevron: svgIcon('<path d="M9 6l6 6-6 6"/>'),
  check: svgIcon('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  clock: svgIcon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 1.9"/>'),
  plan: svgIcon('<path d="M8 4.5h8A1.5 1.5 0 0 1 17.5 6v13a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V6A1.5 1.5 0 0 1 8 4.5z"/><path d="M9.5 3.5h5v2h-5z"/><path d="M9 10.5h6M9 14.5h4"/>'),
};

/* ---------------- stato ---------------- */
function normalizeExercise(raw) {
  if (!raw || (!raw.name && !raw.title)) return null;
  return {
    id: raw.id || makeId(),
    name: String(raw.name || raw.title).trim().slice(0, 80) || 'Esercizio',
    sets: clampInt(raw.sets, 1, 20, 3),
    reps: clampInt(raw.reps, 1, 100, 10),
    rest: clampInt(raw.rest, 0, 600, 90),
  };
}

function normalizeDay(raw) {
  const day = raw && typeof raw === 'object' ? raw : {};
  const exercises = (Array.isArray(day.exercises) ? day.exercises : []).map(normalizeExercise).filter(Boolean);
  return {
    id: day.id || makeId(),
    name: String(day.name || 'Giorno').trim().slice(0, 60) || 'Giorno',
    exercises,
  };
}

function makeDefaultState(seed) {
  const state = {
    version: 1,
    plan: [],
    history: [],
    settings: { sensitivity: 5, sound: true, vibration: true, keepAwake: true, theme: 'system' },
    ui: { lastTab: 'today', lastDayId: null },
    active: null,
  };
  if (seed) {
    state.plan = [
      normalizeDay({
        name: 'Giorno A - Spinta',
        exercises: [
          { name: 'Panca piana', sets: 4, reps: 8, rest: 90 },
          { name: 'Lento avanti', sets: 3, reps: 10, rest: 75 },
          { name: 'Push-up', sets: 3, reps: 12, rest: 60 },
        ],
      }),
      normalizeDay({
        name: 'Giorno B - Tirata',
        exercises: [
          { name: 'Lat machine', sets: 4, reps: 10, rest: 90 },
          { name: 'Rematore manubri', sets: 3, reps: 10, rest: 75 },
          { name: 'Curl bicipiti', sets: 3, reps: 12, rest: 60 },
        ],
      }),
      normalizeDay({
        name: 'Giorno C - Gambe',
        exercises: [
          { name: 'Squat', sets: 4, reps: 8, rest: 120 },
          { name: 'Affondi', sets: 3, reps: 12, rest: 90 },
          { name: 'Leg curl', sets: 3, reps: 12, rest: 60 },
        ],
      }),
    ];
    state.ui.lastDayId = state.plan[0].id;
  }
  return state;
}

function sanitizeActive(raw) {
  if (!raw || !Array.isArray(raw.exercises) || !raw.exercises.length) return null;
  const active = {
    dayName: String(raw.dayName || 'Allenamento'),
    dayId: raw.dayId || null,
    startedAt: raw.startedAt || new Date().toISOString(),
    exerciseIndex: clampInt(raw.exerciseIndex, 0, raw.exercises.length - 1, 0),
    reps: clampInt(raw.reps, 0, 999, 0),
    restEndsAt: Number.isFinite(Number(raw.restEndsAt)) && raw.restEndsAt != null ? Number(raw.restEndsAt) : null,
    restTotalMs: Number.isFinite(Number(raw.restTotalMs)) && raw.restTotalMs != null ? Number(raw.restTotalMs) : null,
    exercises: raw.exercises.map((ex) => ({
      name: String(ex.name || 'Esercizio'),
      targetSets: clampInt(ex.targetSets, 1, 20, 3),
      targetReps: clampInt(ex.targetReps, 1, 100, 10),
      rest: clampInt(ex.rest, 0, 600, 90),
      sets: Array.isArray(ex.sets) ? ex.sets.map((set) => ({ reps: clampInt(set && set.reps, 0, 999, 0) })) : [],
      skipped: !!ex.skipped,
    })),
  };
  return active;
}

function loadState() {
  let firstRun = false;
  try { firstRun = !localStorage.getItem(LS_KEY); } catch (err) { firstRun = true; }
  let state = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        state = makeDefaultState(false);
        if (Array.isArray(saved.plan)) state.plan = saved.plan.map(normalizeDay).filter(Boolean);
        if (Array.isArray(saved.history)) state.history = saved.history.filter((w) => w && typeof w === 'object');
        if (saved.settings && typeof saved.settings === 'object') Object.assign(state.settings, saved.settings);
        if (saved.ui && typeof saved.ui === 'object') Object.assign(state.ui, saved.ui);
        state.active = sanitizeActive(saved.active);
      }
    }
  } catch (err) { state = null; }
  if (!state) state = makeDefaultState(true);
  state.settings.sensitivity = clampInt(state.settings.sensitivity, 1, 10, 5);
  if (['system', 'light', 'dark'].indexOf(state.settings.theme) === -1) state.settings.theme = 'system';
  if (['today', 'plan', 'history', 'settings'].indexOf(state.ui.lastTab) === -1) state.ui.lastTab = 'today';
  state.firstRun = firstRun;
  return state;
}

let state = loadState();
let activeTab = state.ui.lastTab || 'today';

/* ---------------- tema (chiaro/scuro/sistema) ---------------- */
const THEME_COLOR = { light: '#f2efe4', dark: '#161513' };
const darkSchemeQuery = (window.matchMedia) ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let darkSchemeListener = null;

function resolvedTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') return t;
  return (darkSchemeQuery && darkSchemeQuery.matches) ? 'dark' : 'light';
}

function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
  if (darkSchemeQuery && !darkSchemeListener) {
    darkSchemeListener = () => { if (state.settings.theme === 'system') applyTheme(); };
    if (typeof darkSchemeQuery.addEventListener === 'function') darkSchemeQuery.addEventListener('change', darkSchemeListener);
    else if (typeof darkSchemeQuery.addListener === 'function') darkSchemeQuery.addListener(darkSchemeListener);
  }
}

let persistTimer = null;
let toastTimer = null;
let elapsedTimer = null;
let restTimer = null;
let meterTimer = null;
let lastCountdownSecond = null;
let wakeLock = null;
let audioCtx = null;

function persist() {
  const copy = Object.assign({}, state);
  delete copy.firstRun;
  try { localStorage.setItem(LS_KEY, JSON.stringify(copy)); }
  catch (err) { toast('Impossibile salvare i dati su questo dispositivo'); }
}

function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 250);
}

/* ---------------- toast ---------------- */
function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------------- audio e feedback ---------------- */
function ensureAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (err) { /* ignora */ }
}

function beep(freq, duration, delay, gain, wave) {
  if (!state.settings.sound) return;
  ensureAudio();
  if (!audioCtx) return;
  try {
    const start = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = wave || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain || 0.16, start + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(duration || 0.12, 0.03));
    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + (duration || 0.12) + 0.05);
  } catch (err) { /* ignora */ }
}

function vibrate(pattern) {
  if (!state.settings.vibration) return;
  let native = false;
  if (typeof navigator.vibrate === 'function') {
    try { native = navigator.vibrate(pattern); } catch (err) { native = false; }
  }
  /* iOS Safari non espone navigator.vibrate: escamotage = buzz audio
     (onde quadre basse che fanno vibrare fisicamente lo speaker) */
  if (!native && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0))) buzz(pattern);
}

/* buzz tattile simulato: le onde quadre basse fanno "vibrare" lo speaker */
function buzz(pattern) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const seq = Array.isArray(pattern) ? pattern : [pattern];
    let t = audioCtx.currentTime + 0.02;
    seq.forEach((ms, i) => {
      const dur = Math.max(10, Math.min(600, Number(ms) || 0)) / 1000;
      if (i % 2 === 0 && dur > 0) buzzPulse(t, dur);
      t += dur;
    });
  } catch (err) { /* ignora */ }
}

function buzzPulse(start, dur) {
  try {
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(58, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(0.42, start + 0.006);
    const hold = Math.max(start + 0.006, start + dur - 0.008);
    amp.gain.setValueAtTime(0.42, hold);
    amp.gain.linearRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  } catch (err) { /* ignora */ }
}

function alertRestEnd() {
  beep(988, 0.14, 0, 0.2);
  beep(1319, 0.18, 0.16, 0.2);
  beep(988, 0.14, 0.38, 0.2);
  vibrate([250, 90, 250, 90, 350]);
}

function alertWorkoutEnd() {
  beep(784, 0.16, 0, 0.18);
  beep(988, 0.16, 0.18, 0.18);
  beep(1319, 0.3, 0.38, 0.2);
  vibrate([300, 100, 300, 100, 500]);
}

function flashWorkout() {
  const screen = $('#workoutScreen');
  if (!screen) return;
  screen.classList.remove('flash');
  void screen.offsetWidth;
  screen.classList.add('flash');
  setTimeout(() => screen.classList.remove('flash'), 900);
}

/* ---------------- sensore (accelerometro + giroscopio) ---------------- */
const sensor = {
  active: false,
  listening: false,
  baseline: null,
  above: false,
  lastRepAt: 0,
  energy: 0,
};

const sensorThreshold = () => 5.5 - (clampInt(state.settings.sensitivity, 1, 10, 5) - 1) * 0.45;

function onMotion(event) {
  if (!sensor.active || !state.active) return;
  if (state.active.restEndsAt) return;
  const acc = event.accelerationIncludingGravity || event.acceleration;
  if (!acc) return;
  const x = acc.x || 0, y = acc.y || 0, z = acc.z || 0;
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (!Number.isFinite(mag) || mag <= 0) return;
  if (sensor.baseline == null) sensor.baseline = mag;
  else sensor.baseline += 0.012 * (mag - sensor.baseline);
  const dynamic = mag - sensor.baseline;
  let rotEnergy = 0;
  if (event.rotationRate) {
    const r = event.rotationRate;
    const rot = Math.sqrt((r.alpha || 0) * (r.alpha || 0) + (r.beta || 0) * (r.beta || 0) + (r.gamma || 0) * (r.gamma || 0));
    rotEnergy = rot * 0.012;
  }
  const threshold = sensorThreshold();
  sensor.energy = Math.max(Math.abs(dynamic), rotEnergy);
  const signal = Math.max(dynamic, rotEnergy);
  const now = performance.now();
  if (signal > threshold) {
    sensor.above = true;
  } else if (sensor.above && signal < threshold * 0.45) {
    sensor.above = false;
    if (now - sensor.lastRepAt > 330) {
      sensor.lastRepAt = now;
      addRep(1, true);
    }
  }
}

async function toggleSensor() {
  if (sensor.active) {
    disableSensor();
    toast('Sensore disattivato');
    return;
  }
  if (typeof DeviceMotionEvent === 'undefined') {
    toast('Sensori non disponibili su questo dispositivo');
    return;
  }
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const response = await DeviceMotionEvent.requestPermission();
      if (response !== 'granted') {
        toast('Permesso ai sensori negato: consenti il movimento in Safari');
        return;
      }
    }
    startSensor();
  } catch (err) {
    toast('Sensori bloccati: servono HTTPS e una pagina aperta in Safari');
  }
}

function startSensor() {
  sensor.active = true;
  sensor.baseline = null;
  sensor.above = false;
  sensor.lastRepAt = 0;
  ensureAudio();
  if (!sensor.listening) {
    window.addEventListener('devicemotion', onMotion, { passive: true });
    sensor.listening = true;
  }
  updateSensorUI();
  startMeterTicker();
  toast('Sensore attivo: muovi il telefono a ogni ripetizione');
}

function disableSensor() {
  sensor.active = false;
  sensor.baseline = null;
  sensor.above = false;
  sensor.energy = 0;
  if (sensor.listening) {
    window.removeEventListener('devicemotion', onMotion);
    sensor.listening = false;
  }
  clearInterval(meterTimer);
  meterTimer = null;
  updateSensorUI();
}

function startMeterTicker() {
  clearInterval(meterTimer);
  if (!sensor.active) return;
  meterTimer = setInterval(() => {
    const bar = $('#sensorMeter');
    const wrap = $('#sensorMeterWrap');
    if (!bar || !wrap) return;
    const pct = Math.min(100, (sensor.energy / sensorThreshold()) * 100);
    bar.style.width = pct + '%';
    wrap.classList.toggle('hot', pct > 80);
  }, 100);
}

function updateSensorUI() {
  const label = $('#sensorLabel');
  const dot = $('#sensorDot');
  const button = $('#sensorBtn');
  if (label) label.textContent = sensor.active ? 'Sensore attivo - muoviti!' : 'Conta in automatico col movimento';
  if (dot) dot.classList.toggle('on', sensor.active);
  if (button) {
    button.textContent = sensor.active ? 'Disattiva sensore' : 'Attiva sensore';
    button.classList.toggle('on', sensor.active);
  }
}

/* ---------------- schermo sempre acceso ---------------- */
async function requestWakeLock() {
  if (!state.settings.keepAwake) return;
  try {
    if ('wakeLock' in navigator && (!wakeLock || wakeLock.released)) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) { /* ignora */ }
}

function releaseWakeLock() {
  try { if (wakeLock) wakeLock.release(); } catch (err) { /* ignora */ }
  wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.active && state.settings.keepAwake) requestWakeLock();
});

/* ---------------- modali ---------------- */
function openModal(html, options) {
  const root = $('#modal-root');
  root.innerHTML = '<div class="modal-backdrop"><div class="modal' + (options && options.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
  document.body.classList.add('lock');
  const backdrop = root.firstElementChild;
  requestAnimationFrame(() => backdrop.classList.add('show'));
  return backdrop;
}

function closeModal() {
  const root = $('#modal-root');
  const backdrop = root.firstElementChild;
  if (!backdrop) return;
  backdrop.classList.remove('show');
  setTimeout(() => {
    if (root.firstElementChild === backdrop) {
      root.innerHTML = '';
      if (!state.active) document.body.classList.remove('lock');
    }
  }, 160);
}

function confirmDialog(options) {
  return new Promise((resolve) => {
    const backdrop = openModal(
      '<form class="dialog">' +
      '<h3>' + esc(options.title) + '</h3>' +
      (options.text ? '<p class="modal-text">' + esc(options.text) + '</p>' : '') +
      '<div class="modal-actions">' +
      '<button type="button" class="btn ghost" data-modal="cancel">' + esc(options.cancelLabel || 'Annulla') + '</button>' +
      '<button type="submit" class="btn ' + (options.danger ? 'danger' : 'primary') + '">' + esc(options.confirmLabel || 'Conferma') + '</button>' +
      '</div>' +
      '</form>'
    );
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(value);
    };
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) done(false); });
    backdrop.querySelector('[data-modal="cancel"]').addEventListener('click', () => done(false));
    backdrop.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      done(true);
    });
  });
}

function promptDialog(options) {
  return new Promise((resolve) => {
    const field = options.multiline
      ? '<textarea rows="5" maxlength="' + (options.maxLength || 4000) + '">' + esc(options.value || '') + '</textarea>'
      : '<input type="text" maxlength="' + (options.maxLength || 60) + '" value="' + esc(options.value || '') + '" placeholder="' + esc(options.placeholder || '') + '" autocomplete="off">';
    const backdrop = openModal(
      '<form class="dialog">' +
      '<h3>' + esc(options.title) + '</h3>' +
      '<label class="field"><span>' + esc(options.label || 'Nome') + '</span>' + field + '</label>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn ghost" data-modal="cancel">Annulla</button>' +
      '<button type="submit" class="btn primary">' + esc(options.confirmLabel || 'Salva') + '</button>' +
      '</div>' +
      '</form>'
    );
    const input = backdrop.querySelector('input,textarea');
    setTimeout(() => {
      try { input.focus(); if (input.select) input.select(); } catch (err) { /* ignora */ }
    }, 120);
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(result);
    };
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) done(null); });
    backdrop.querySelector('[data-modal="cancel"]').addEventListener('click', () => done(null));
    backdrop.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) { try { input.focus(); } catch (err) { /* ignora */ } return; }
      done(text);
    });
  });
}

/* ---------------- esportazione file ---------------- */
async function exportFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'application/json' });
  let shared = false;
  try {
    if (navigator.canShare && window.File) {
      const file = new File([blob], filename, { type: mime || 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        shared = true;
      }
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
  }
  if (!shared) {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast('File pronto: ' + filename);
    } catch (err) {
      toast('Esportazione non riuscita');
    }
  }
}

function exportPlan() {
  if (!state.plan.length) { toast('Niente da esportare: crea un giorno'); return; }
  const payload = { app: 'GymGyro', type: 'plan', exportedAt: new Date().toISOString(), days: state.plan };
  exportFile('gymgyro-scheda-' + dayStamp() + '.json', JSON.stringify(payload, null, 2));
}

function exportHistoryJSON() {
  if (!state.history.length) { toast('Nessun allenamento da esportare'); return; }
  const payload = { app: 'GymGyro', type: 'history', exportedAt: new Date().toISOString(), workouts: state.history };
  exportFile('gymgyro-storico-' + dayStamp() + '.json', JSON.stringify(payload, null, 2));
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function exportHistoryCSV() {
  if (!state.history.length) { toast('Nessun allenamento da esportare'); return; }
  const rows = [['Data', 'Giorno', 'Esercizio', 'Serie', 'Ripetizioni', 'Saltato', 'Durata allenamento']];
  state.history.forEach((workout) => {
    const date = new Date(workout.date).toLocaleString('it-IT');
    const duration = fmtDuration(workout.durationSec || 0);
    (workout.exercises || []).forEach((ex) => {
      if (!ex.sets || !ex.sets.length) {
        rows.push([date, workout.dayName, ex.name, '', '', ex.skipped ? 'Si' : 'No', duration]);
      } else {
        ex.sets.forEach((set, index) => {
          rows.push([date, workout.dayName, ex.name, index + 1, set.reps, ex.skipped ? 'Si' : 'No', duration]);
        });
      }
    });
  });
  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
  exportFile('gymgyro-storico-' + dayStamp() + '.csv', csv, 'text/csv;charset=utf-8');
}

function exportWorkout(id) {
  const workout = state.history.find((w) => w.id === id);
  if (!workout) return;
  const payload = { app: 'GymGyro', type: 'workout', exportedAt: new Date().toISOString(), workout };
  exportFile('gymgyro-allenamento-' + String(workout.date).slice(0, 10) + '.json', JSON.stringify(payload, null, 2));
}

function exportBackup() {
  const copy = Object.assign({}, state);
  delete copy.firstRun;
  const payload = { app: 'GymGyro', type: 'backup', exportedAt: new Date().toISOString(), data: copy };
  exportFile('gymgyro-backup-' + dayStamp() + '.json', JSON.stringify(payload, null, 2));
}

/* ---------------- import scheda ---------------- */
function normalizeImportedDays(obj) {
  let days = [];
  if (Array.isArray(obj)) days = obj;
  else if (obj && Array.isArray(obj.days)) days = obj.days;
  else if (obj && Array.isArray(obj.plan)) days = obj.plan;
  else if (obj && Array.isArray(obj.exercises)) days = [obj];
  else if (obj && obj.state && Array.isArray(obj.state.plan)) days = obj.state.plan;
  if (obj && obj.type === 'backup' && obj.data && Array.isArray(obj.data.plan)) days = obj.data.plan;
  return days.map(normalizeDay).filter((day) => day.exercises.length > 0);
}

function parsePlanText(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const exercises = [];
  const re = /^(.+?)\s+(\d+)\s*[xxX]\s*(\d+)(?:\s+(?:rec(?:upero)?\s*)?(\d+)\s*s?)?$/i;
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-x*]\s*/, '').replace(/^\d+[.)]\s*/, '');
    if (!line || line.charAt(0) === '#') continue;
    const match = line.match(re);
    if (!match) continue;
    const name = match[1].trim();
    if (!name) continue;
    exercises.push({
      name: name.slice(0, 60),
      sets: clampInt(match[2], 1, 20, 3),
      reps: clampInt(match[3], 1, 100, 10),
      rest: match[4] ? clampInt(match[4], 0, 600, 90) : 90,
    });
  }
  return exercises;
}

function importPlanDialog() {
  const backdrop = openModal(
    '<form class="dialog">' +
    '<h3>Importa scheda</h3>' +
    '<p class="modal-text">Carica un file JSON esportato da GymGyro, oppure scrivi la scheda una riga per esercizio (formato <strong>Nome Serie x Rip Recupero</strong>):</p>' +
    '<pre class="help-code">Panca piana 4x8 90\nCroci 3x12 60\nPush-up 3x15</pre>' +
    '<label class="field"><span>File JSON o di testo</span><input type="file" accept=".json,.txt,application/json,text/plain"></label>' +
    '<label class="field"><span>Oppure incolla qui</span><textarea name="content" rows="5" placeholder="Panca piana 4x8 90&#10;Croci 3x12 60"></textarea></label>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn ghost" data-modal="cancel">Annulla</button>' +
    '<button type="submit" class="btn primary">Importa</button>' +
    '</div>' +
    '</form>',
    { wide: true }
  );
  const form = backdrop.querySelector('form');
  const textarea = form.querySelector('textarea');
  const fileInput = form.querySelector('input[type="file"]');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      textarea.value = String(reader.result || '');
      toast('File caricato: premi Importa');
    };
    reader.onerror = () => toast('Impossibile leggere il file');
    reader.readAsText(file);
  });
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
  form.querySelector('[data-modal="cancel"]').addEventListener('click', () => closeModal());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const content = textarea.value.trim();
    if (!content) { toast('Scegli un file o incolla la scheda'); return; }
    try {
      let imported = [];
      let parsed = null;
      try { parsed = JSON.parse(content); } catch (err) { parsed = null; }
      if (parsed) {
        imported = normalizeImportedDays(parsed);
      } else {
        const exercises = parsePlanText(content);
        if (exercises.length) imported = [{ name: 'Scheda importata', exercises }];
      }
      if (!imported.length) throw new Error('formato non riconosciuto');
      const newDays = imported.map((day) => ({
        id: makeId(),
        name: day.name,
        exercises: day.exercises.map((ex) => ({ ...ex, id: makeId() })),
      }));
      newDays.forEach((day) => state.plan.push(day));
      state.ui.lastDayId = newDays[newDays.length - 1].id;
      persist();
      closeModal();
      activeTab = 'plan';
      render();
      toast(newDays.length === 1 ? 'Giorno importato' : newDays.length + ' giorni importati');
    } catch (err) {
      toast('Formato non riconosciuto. Usa JSON di GymGyro o righe "Nome 4x8 90"');
    }
  });
}

function exerciseDialog(dayId, exerciseId) {
  const day = state.plan.find((d) => d.id === dayId);
  if (!day) return;
  const exercise = exerciseId ? day.exercises.find((ex) => ex.id === exerciseId) : null;
  const backdrop = openModal(
    '<form class="dialog">' +
    '<h3>' + (exercise ? 'Modifica esercizio' : 'Nuovo esercizio') + '</h3>' +
    '<label class="field"><span>Nome esercizio</span><input name="name" type="text" maxlength="60" placeholder="es. Panca piana" value="' + esc(exercise ? exercise.name : '') + '"></label>' +
    '<div class="field-row">' +
    '<label class="field"><span>Serie</span><input name="sets" type="number" inputmode="numeric" min="1" max="20" value="' + (exercise ? exercise.sets : 3) + '"></label>' +
    '<label class="field"><span>Ripetizioni</span><input name="reps" type="number" inputmode="numeric" min="1" max="100" value="' + (exercise ? exercise.reps : 10) + '"></label>' +
    '<label class="field"><span>Recupero (s)</span><input name="rest" type="number" inputmode="numeric" min="0" max="600" value="' + (exercise ? exercise.rest : 90) + '"></label>' +
    '</div>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn ghost" data-modal="cancel">Annulla</button>' +
    '<button type="submit" class="btn primary">' + (exercise ? 'Salva' : 'Aggiungi') + '</button>' +
    '</div>' +
    '</form>',
    { wide: true }
  );
  const form = backdrop.querySelector('form');
  const nameInput = form.querySelector('input[name="name"]');
  setTimeout(() => { try { nameInput.focus(); } catch (err) { /* ignora */ } }, 120);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
  form.querySelector('[data-modal="cancel"]').addEventListener('click', () => closeModal());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const data = {
      name: name.slice(0, 60),
      sets: clampInt(form.querySelector('input[name="sets"]').value, 1, 20, 3),
      reps: clampInt(form.querySelector('input[name="reps"]').value, 1, 100, 10),
      rest: clampInt(form.querySelector('input[name="rest"]').value, 0, 600, 90),
    };
    if (exercise) {
      Object.assign(exercise, data);
      toast('Esercizio aggiornato');
    } else {
      day.exercises.push(Object.assign({ id: makeId() }, data));
      toast('Esercizio aggiunto');
    }
    persist();
    closeModal();
    render();
  });
}

/* ---------------- privacy policy ---------------- */
function openPrivacy() {
  const backdrop = openModal(
    '<div class="dialog">' +
    '<h3>Privacy policy</h3>' +
    '<p class="modal-text">Ultimo aggiornamento: 26 ottobre 2026. GymGyro funziona interamente sul tuo dispositivo.</p>' +
    '<h4 class="pv-h">Nessun dato raccolto</h4>' +
    '<ul class="pv-list"><li>Nessun dato personale raccolto, trasmesso o venduto.</li><li>Niente account, niente cookie di tracciamento, niente analytics, niente pubblicità.</li></ul>' +
    '<h4 class="pv-h">Dati salvati solo sul tuo dispositivo</h4>' +
    '<ul class="pv-list"><li>Scheda, cronologia e impostazioni sono salvate nel <strong>localStorage del browser</strong>, solo sul tuo dispositivo: mai inviate a nessun server.</li><li>Puoi cancellarli da Opzioni - "Cancella tutti i dati", o cancellando i dati del sito dal browser.</li></ul>' +
    '<h4 class="pv-h">Sensori di movimento</h4>' +
    '<ul class="pv-list"><li>Accelerometro e giroscopio vengono letti solo dopo il tuo consenso esplicito ("Attiva sensore" durante l\'allenamento).</li><li>Elaborati <strong>in tempo reale sul dispositivo</strong> per contare le ripetizioni: mai memorizzati, mai inviati.</li><li>Puoi revocare il permesso in qualsiasi momento dalle impostazioni di Safari / iOS.</li></ul>' +
    '<h4 class="pv-h">Servizi di terze parti</h4>' +
    '<ul class="pv-list"><li>Hosting: <strong>GitHub Pages</strong> (GitHub, Inc. / Microsoft), che può trattare dati tecnici di accesso secondo la propria informativa. L\'app non aggiunge cookie né tracker di alcun tipo.</li></ul>' +
    '<h4 class="pv-h">Esportazione dei dati</h4>' +
    '<ul class="pv-list"><li>Esportare scheda, cronologia o backup crea file sul tuo dispositivo o li condivide solo con le app che scegli tu.</li></ul>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn ghost" data-modal="privacyClose">Chiudi</button>' +
    '<a class="btn primary" href="privacy.html" rel="noopener" data-modal="privacyLink">Pagina completa</a>' +
    '</div>' +
    '</div>',
    { wide: true }
  );
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
  backdrop.querySelector('[data-modal="privacyClose"]').addEventListener('click', () => closeModal());
  backdrop.querySelector('[data-modal="privacyLink"]').addEventListener('click', () => closeModal());
}

/* ---------------- azioni scheda ---------------- */
async function addDayFlow() {
  const name = await promptDialog({
    title: 'Nuovo giorno',
    label: 'Nome del giorno',
    placeholder: 'es. Giorno A - Petto e tricipiti',
    confirmLabel: 'Crea',
  });
  if (!name) return;
  const day = { id: makeId(), name: name.slice(0, 60), exercises: [] };
  state.plan.push(day);
  state.ui.lastDayId = day.id;
  persist();
  render();
  toast('Giorno creato');
}

async function editDayFlow(id) {
  const day = state.plan.find((d) => d.id === id);
  if (!day) return;
  const name = await promptDialog({
    title: 'Rinomina giorno',
    label: 'Nome del giorno',
    value: day.name,
  });
  if (!name) return;
  day.name = name.slice(0, 60);
  persist();
  render();
}

async function deleteDayFlow(id) {
  const day = state.plan.find((d) => d.id === id);
  if (!day) return;
  const ok = await confirmDialog({
    title: 'Eliminare il giorno?',
    text: day.name + ' e i suoi ' + day.exercises.length + ' esercizi verranno rimossi dalla scheda.',
    confirmLabel: 'Elimina',
    danger: true,
  });
  if (!ok) return;
  state.plan = state.plan.filter((d) => d.id !== id);
  if (state.ui.lastDayId === id) state.ui.lastDayId = state.plan.length ? state.plan[0].id : null;
  persist();
  render();
  toast('Giorno eliminato');
}

async function deletePlanExercise(dayId, exerciseId) {
  const day = state.plan.find((d) => d.id === dayId);
  if (!day) return;
  const ex = day.exercises.find((e) => e.id === exerciseId);
  if (!ex) return;
  const ok = await confirmDialog({
    title: 'Eliminare esercizio?',
    text: ex.name + ' verrà rimosso dalla scheda.',
    confirmLabel: 'Elimina',
    danger: true,
  });
  if (!ok) return;
  day.exercises = day.exercises.filter((e) => e.id !== exerciseId);
  persist();
  render();
  toast('Esercizio eliminato');
}

/* ---------------- allenamento ---------------- */
function stopWorkoutTimers() {
  clearInterval(elapsedTimer); elapsedTimer = null;
  clearInterval(restTimer); restTimer = null;
  clearInterval(meterTimer); meterTimer = null;
  lastCountdownSecond = null;
}

function activeExercise() {
  const a = state.active;
  if (!a || !a.exercises.length) return null;
  return a.exercises[a.exerciseIndex] || null;
}

async function startWorkout() {
  if (state.active) {
    const ok = await confirmDialog({
      title: 'Allenamento in corso',
      text: 'Vuoi iniziare un nuovo allenamento? Quello in corso verrà scartato.',
      confirmLabel: 'Inizia nuovo',
    });
    if (!ok) return;
    state.active = null;
  }
  const day = state.plan.find((d) => d.id === state.ui.lastDayId) || state.plan[0];
  if (!day) { setTab('plan'); toast('Crea prima un giorno della scheda'); return; }
  if (!day.exercises.length) { setTab('plan'); toast('Aggiungi almeno un esercizio al giorno'); return; }
  state.ui.lastDayId = day.id;
  state.active = {
    dayId: day.id,
    dayName: day.name,
    startedAt: new Date().toISOString(),
    exerciseIndex: 0,
    reps: 0,
    restEndsAt: null,
    restTotalMs: null,
    exercises: day.exercises.map((ex) => ({
      name: ex.name,
      targetSets: ex.sets,
      targetReps: ex.reps,
      rest: ex.rest,
      sets: [],
      skipped: false,
    })),
  };
  persist();
  ensureAudio();
  requestWakeLock();
  renderWorkout();
}

function resumeWorkout() {
  if (!state.active) return;
  const fixed = sanitizeActive(state.active);
  if (!fixed) {
    state.active = null;
    persist();
    render();
    toast('Nessun allenamento valido da riprendere');
    return;
  }
  state.active = fixed;
  ensureAudio();
  requestWakeLock();
  renderWorkout();
}

function abandonWorkout(silent) {
  stopWorkoutTimers();
  disableSensor();
  releaseWakeLock();
  state.active = null;
  persist();
  const root = $('#workout-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('lock');
  setTab('today');
  if (!silent) setTab('today');
}

async function discardActiveFlow() {
  if (!state.active) return;
  const ok = await confirmDialog({
    title: 'Abbandonare l\'allenamento?',
    text: 'L\'allenamento in corso verrà perso.',
    confirmLabel: 'Abbandona',
    danger: true,
  });
  if (!ok) return;
  abandonWorkout();
}

function renderWorkout() {
  const root = $('#workout-root');
  const a = state.active;
  if (!a) {
    root.innerHTML = '';
    document.body.classList.remove('lock');
    stopWorkoutTimers();
    disableSensor();
    releaseWakeLock();
    return;
  }
  if (!a.exercises.length || a.exerciseIndex >= a.exercises.length) {
    finishWorkout();
    return;
  }
  const ex = a.exercises[a.exerciseIndex];
  const doneSets = ex.sets.length;
  const setNo = Math.min(doneSets + 1, ex.targetSets);
  const dots = Array.from({ length: ex.targetSets }, (_, i) => {
    const cls = i < doneSets ? 'done' : (i === doneSets ? 'current' : '');
    return '<span class="set-dot ' + cls + '"></span>';
  }).join('');
  document.body.classList.add('lock');
  root.innerHTML =
    '<div class="workout" id="workoutScreen">' +
    '<header class="wk-top">' +
    '<button class="icon-btn" data-wk="close" aria-label="Chiudi allenamento">' + I.x + '</button>' +
    '<div class="wk-meta">' +
    '<span class="wk-day">' + esc(a.dayName) + '</span>' +
    '<span class="wk-elapsed" id="wkElapsed">00:00</span>' +
    '</div>' +
    '<button class="wk-finish" data-wk="finish">Fine</button>' +
    '</header>' +
    '<div class="wk-body">' +
    '<div class="wk-head">' +
    '<p class="wk-step">Esercizio ' + (a.exerciseIndex + 1) + '/' + a.exercises.length + ' - Serie ' + setNo + '/' + ex.targetSets + '</p>' +
    '<h2 class="wk-name">' + esc(ex.name) + '</h2>' +
    '<p class="wk-target">Obiettivo: ' + ex.targetReps + ' ripetizioni</p>' +
    '</div>' +
    '<div class="rep-area">' +
    '<div class="rep-num" id="repNum">' + a.reps + '</div>' +
    '<div class="rep-label">ripetizioni</div>' +
    '<div class="rep-progress"><span id="repBar"></span></div>' +
    '<div class="set-dots">' + dots + '</div>' +
    '</div>' +
    '<div class="sensor-card">' +
    '<div class="sensor-top">' +
    '<span class="status-dot" id="sensorDot"></span>' +
    '<span class="sensor-label" id="sensorLabel"></span>' +
    '<button class="mini-btn" id="sensorBtn" data-wk="sensor">Attiva sensore</button>' +
    '</div>' +
    '<div class="sensor-meter" id="sensorMeterWrap"><span id="sensorMeter"></span></div>' +
    '</div>' +
    '<div class="wk-actions">' +
    '<button class="btn ghost minus" data-wk="minus" aria-label="Togli una ripetizione">-1</button>' +
    '<button class="btn primary plus" data-wk="plus">+1</button>' +
    '<button class="btn accent" data-wk="set">Fine serie</button>' +
    '</div>' +
    '<div class="wk-secondary">' +
    '<button class="text-btn" data-wk="skip">Salta esercizio</button>' +
    '<span class="sep">-</span>' +
    '<button class="text-btn danger" data-wk="delete">Elimina esercizio</button>' +
    '</div>' +
    '</div>' +
    '<div class="rest-overlay" id="restOverlay" hidden>' +
    '<div class="rest-card">' +
    '<p class="rest-kicker">Recupero</p>' +
    '<div class="rest-time" id="restTime">00:00</div>' +
    '<div class="rest-bar"><span id="restBar"></span></div>' +
    '<p class="rest-next" id="restNext"></p>' +
    '<div class="rest-actions">' +
    '<button class="btn ghost" data-wk="add15">+15s</button>' +
    '<button class="btn primary" data-wk="skiprest">Salta recupero</button>' +
    '</div>' +
    '<p class="rest-hint">Alla fine del recupero: bip e vibrazione</p>' +
    '</div>' +
    '</div>' +
    '</div>';
  root.querySelector('#workoutScreen').addEventListener('click', onWorkoutClick);
  updateSensorUI();
  updateRepUI();
  startElapsedTicker();
  if (!a.restEndsAt) {
    clearInterval(restTimer);
    restTimer = null;
  } else if (a.restEndsAt <= Date.now()) {
    a.restEndsAt = null;
    a.restTotalMs = null;
    resumeExpiredRest();
    return;
  } else {
    showRestOverlay();
    startRestTicker();
  }
  if (sensor.active) startMeterTicker();
}

function resumeExpiredRest() {
  const a = state.active;
  if (!a) return;
  const ex = activeExercise();
  const exerciseDone = ex && ex.sets.length >= ex.targetSets;
  if (exerciseDone) {
    a.exerciseIndex += 1;
    a.reps = 0;
    persist();
    if (a.exerciseIndex >= a.exercises.length) {
      finishWorkout();
      return;
    }
    renderWorkout();
  } else {
    a.reps = 0;
    persist();
    renderWorkout();
  }
}

function startElapsedTicker() {
  clearInterval(elapsedTimer);
  const update = () => {
    const el = $('#wkElapsed');
    if (!el || !state.active) return;
    const started = new Date(state.active.startedAt).getTime();
    el.textContent = fmtClock((Date.now() - started) / 1000);
  };
  update();
  elapsedTimer = setInterval(update, 1000);
}

function updateRepUI() {
  const a = state.active;
  if (!a) return;
  const ex = a.exercises[a.exerciseIndex];
  if (!ex) return;
  const num = $('#repNum');
  if (num) {
    num.textContent = a.reps;
    num.classList.toggle('hit', a.reps >= ex.targetReps && a.reps > 0);
  }
  const bar = $('#repBar');
  if (bar) {
    const pct = Math.min(100, (a.reps / Math.max(1, ex.targetReps)) * 100);
    bar.style.width = pct + '%';
  }
}

function addRep(delta, fromSensor) {
  const a = state.active;
  if (!a || !a.exercises.length) return;
  const ex = activeExercise();
  if (!ex) return;
  if (a.restEndsAt) return;
  const previous = a.reps;
  a.reps = Math.max(0, a.reps + delta);
  if (a.reps === previous) return;
  if (fromSensor && delta > 0) {
    beep(1180, 0.045, 0, 0.07, 'triangle');
    vibrate(18);
  }
  if (previous < ex.targetReps && a.reps >= ex.targetReps) {
    beep(988, 0.12, 0, 0.16);
    vibrate([90, 50, 90]);
  }
  updateRepUI();
  persistSoon();
}

function completeSet() {
  const a = state.active;
  if (!a) return;
  const ex = activeExercise();
  if (!ex) return;
  ex.sets.push({ reps: a.reps });
  a.reps = 0;
  persist();
  beep(740, 0.09, 0, 0.14);
  const exerciseDone = ex.sets.length >= ex.targetSets;
  if (ex.rest > 0) {
    a.restEndsAt = Date.now() + ex.rest * 1000;
    a.restTotalMs = ex.rest * 1000;
    lastCountdownSecond = null;
    persist();
    renderWorkout();
  } else if (exerciseDone) {
    advanceExercise();
  } else {
    renderWorkout();
  }
}

function advanceExercise() {
  const a = state.active;
  if (!a) return;
  a.exerciseIndex += 1;
  a.reps = 0;
  a.restEndsAt = null;
  a.restTotalMs = null;
  if (a.exerciseIndex >= a.exercises.length) {
    persist();
    finishWorkout();
    return;
  }
  persist();
  renderWorkout();
  beep(988, 0.1, 0, 0.14);
}

function showRestOverlay() {
  const overlay = $('#restOverlay');
  if (!overlay || !state.active || !state.active.restEndsAt) return;
  overlay.hidden = false;
  lastCountdownSecond = null;
  updateRestUI(state.active.restEndsAt - Date.now());
}

function updateRestUI(leftMs) {
  const a = state.active;
  if (!a) return;
  const left = Math.max(0, leftMs);
  const timeEl = $('#restTime');
  const barEl = $('#restBar');
  const nextEl = $('#restNext');
  if (timeEl) timeEl.textContent = fmtClock(left / 1000);
  if (barEl) {
    const total = a.restTotalMs || 1;
    barEl.style.width = Math.max(0, Math.min(100, (left / total) * 100)) + '%';
  }
  if (nextEl) {
    const ex = a.exercises[a.exerciseIndex];
    if (ex) {
      const exerciseDone = ex.sets.length >= ex.targetSets;
      if (exerciseDone) {
        const next = a.exercises[a.exerciseIndex + 1];
        nextEl.textContent = next ? 'Prossimo: ' + next.name : 'Prossimo: fine allenamento';
      } else {
        nextEl.textContent = 'Prossima serie: ' + ex.name;
      }
    }
  }
  const sec = Math.ceil(left / 1000);
  if (sec !== lastCountdownSecond) {
    lastCountdownSecond = sec;
    if (sec > 0 && sec <= 3) beep(880, 0.06, 0, 0.12);
  }
}

function startRestTicker() {
  clearInterval(restTimer);
  const tick = () => {
    const a = state.active;
    if (!a || !a.restEndsAt) {
      clearInterval(restTimer);
      restTimer = null;
      return;
    }
    const left = a.restEndsAt - Date.now();
    if (left <= 0) {
      clearInterval(restTimer);
      restTimer = null;
      finishRest();
      return;
    }
    updateRestUI(left);
  };
  tick();
  restTimer = setInterval(tick, 200);
}

function finishRest() {
  const a = state.active;
  if (!a) return;
  a.restEndsAt = null;
  a.restTotalMs = null;
  clearInterval(restTimer);
  restTimer = null;
  alertRestEnd();
  flashWorkout();
  const ex = activeExercise();
  const exerciseDone = ex && ex.sets.length >= ex.targetSets;
  if (exerciseDone) {
    advanceExercise();
  } else {
    a.reps = 0;
    persist();
    renderWorkout();
    toast('Recupero finito. Si riparte!');
  }
}

function skipRest() {
  const a = state.active;
  if (!a) return;
  const ex = activeExercise();
  const exerciseDone = ex && ex.sets.length >= ex.targetSets;
  a.restEndsAt = null;
  a.restTotalMs = null;
  clearInterval(restTimer);
  restTimer = null;
  if (exerciseDone) {
    advanceExercise();
  } else {
    a.reps = 0;
    persist();
    renderWorkout();
  }
}

function addRestTime(seconds) {
  const a = state.active;
  if (!a || !a.restEndsAt) return;
  a.restEndsAt += seconds * 1000;
  a.restTotalMs = (a.restTotalMs || 0) + seconds * 1000;
  persist();
  updateRestUI(a.restEndsAt - Date.now());
}

async function skipExerciseFlow() {
  const a = state.active;
  if (!a) return;
  const ex = activeExercise();
  if (!ex) return;
  const ok = await confirmDialog({
    title: 'Saltare questo esercizio?',
    text: ex.name + ' verrà segnato come saltato nella cronologia.',
    confirmLabel: 'Salta',
  });
  if (!ok) return;
  ex.skipped = true;
  a.reps = 0;
  a.restEndsAt = null;
  a.restTotalMs = null;
  clearInterval(restTimer);
  restTimer = null;
  a.exerciseIndex += 1;
  if (a.exerciseIndex >= a.exercises.length) {
    persist();
    finishWorkout();
    return;
  }
  persist();
  renderWorkout();
  toast('Esercizio saltato');
}

async function deleteActiveExerciseFlow() {
  const a = state.active;
  if (!a) return;
  const ex = activeExercise();
  if (!ex) return;
  const ok = await confirmDialog({
    title: 'Eliminare questo esercizio?',
    text: 'Verrà rimosso solo dall\'allenamento in corso, non dalla scheda.',
    confirmLabel: 'Elimina',
    danger: true,
  });
  if (!ok) return;
  a.exercises.splice(a.exerciseIndex, 1);
  a.reps = 0;
  a.restEndsAt = null;
  a.restTotalMs = null;
  clearInterval(restTimer);
  restTimer = null;
  if (!a.exercises.length) {
    persist();
    finishWorkout();
    return;
  }
  persist();
  renderWorkout();
  toast('Esercizio eliminato dall\'allenamento');
}

async function closeWorkoutFlow() {
  if (!state.active) return;
  const ok = await confirmDialog({
    title: 'Uscire dall\'allenamento?',
    text: 'L\'allenamento in corso verrà scartato e non salverà la cronologia.',
    confirmLabel: 'Esci',
    danger: true,
  });
  if (!ok) return;
  abandonWorkout();
}

async function finishWorkoutFlow() {
  if (!state.active) return;
  const ok = await confirmDialog({
    title: 'Terminare l\'allenamento?',
    text: 'Le serie completate verranno salvate nella cronologia.',
    confirmLabel: 'Termina',
  });
  if (!ok) return;
  finishWorkout();
}

function finishWorkout() {
  const a = state.active;
  const root = $('#workout-root');
  if (!root) return;
  if (!a) {
    root.innerHTML = '';
    document.body.classList.remove('lock');
    return;
  }
  stopWorkoutTimers();
  disableSensor();
  releaseWakeLock();
  const end = Date.now();
  const started = new Date(a.startedAt).getTime();
  const entry = {
    id: makeId(),
    date: new Date().toISOString(),
    dayName: a.dayName,
    durationSec: Number.isFinite(started) ? Math.max(1, Math.round((end - started) / 1000)) : 0,
    exercises: a.exercises.map((ex) => ({
      name: ex.name,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      skipped: !!ex.skipped,
      sets: ex.sets.map((set) => ({ reps: set.reps || 0 })),
    })),
  };
  entry.totalReps = totalRepsOf(entry);
  const hasData = entry.totalReps > 0 || entry.exercises.some((ex) => ex.skipped || ex.sets.length > 0);
  state.active = null;
  if (hasData) state.history.unshift(entry);
  persist();
  alertWorkoutEnd();
  showWorkoutSummary(entry, hasData);
}

function showWorkoutSummary(entry, saved) {
  const root = $('#workout-root');
  document.body.classList.remove('lock');
  const doneSets = entry.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  root.innerHTML =
    '<div class="workout summary-screen" id="workoutScreen">' +
    '<div class="wk-summary">' +
    '<div class="summary-badge">' + I.check + '</div>' +
    '<p class="eyebrow">' + (saved ? 'Allenamento salvato' : 'Nessuna serie registrata') + '</p>' +
    '<h2>' + (saved ? 'Bel lavoro!' : 'Sessione vuota') + '</h2>' +
    '<p class="muted">' + esc(entry.dayName) + '</p>' +
    '<div class="summary-stats">' +
    '<div><strong>' + entry.totalReps + '</strong><span>ripetizioni</span></div>' +
    '<div><strong>' + doneSets + '</strong><span>serie</span></div>' +
    '<div><strong>' + fmtDuration(entry.durationSec) + '</strong><span>durata</span></div>' +
    '</div>' +
    '<button class="btn primary wide" data-summary="close">Torna alla home</button>' +
    '<button class="btn ghost wide" data-summary="history">Apri cronologia</button>' +
    '</div>' +
    '</div>';
  root.querySelector('#workoutScreen').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-summary]');
    if (!btn) return;
    root.innerHTML = '';
    setTab(btn.dataset.summary === 'history' ? 'history' : 'today');
  });
}

/* ---------------- render view ---------------- */
function renderToday() {
  const plan = state.plan;
  const active = state.active;
  let selectedId = plan.some((d) => d.id === state.ui.lastDayId) ? state.ui.lastDayId : null;
  if (!selectedId && plan.length) selectedId = plan[0].id;
  if (selectedId !== state.ui.lastDayId) {
    state.ui.lastDayId = selectedId;
    persistSoon();
  }
  const selectedDay = plan.find((d) => d.id === selectedId);
  const latest = state.history[0];
  const view = $('#view');
  view.innerHTML =
    '<section class="hello">' +
    '<p class="eyebrow">Oggi</p>' +
    '<h2>Cosa alleniamo?</h2>' +
    '<p class="muted">Scegli il giorno, avvia l\'allenamento e lascia fare al sensore.</p>' +
    '</section>' +
    (active
      ? '<section class="card resume-card">' +
        '<div class="resume-top"><span class="pulse-dot"></span><span class="badge">In corso</span></div>' +
        '<h3>' + esc(active.dayName) + '</h3>' +
        '<p class="muted small">Iniziato alle ' + new Date(active.startedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) +
        ' - ' + Math.max(0, active.exercises.length - active.exerciseIndex) + ' esercizi rimasti</p>' +
        '<div class="row gap"><button class="btn primary" data-action="resume">Riprendi</button>' +
        '<button class="btn ghost" data-action="discardActive">Abbandona</button></div>' +
        '</section>'
      : '') +
    (plan.length
      ? '<section class="block">' +
        '<div class="section-head"><h3>I tuoi giorni</h3><button class="link-btn" data-action="gotoPlan">Gestisci scheda</button></div>' +
        '<div class="day-pick">' +
        plan.map((day) =>
          '<button class="day-pill ' + (day.id === selectedId ? 'selected' : '') + '" data-action="pickDay" data-id="' + day.id + '">' +
          '<span class="day-pill-name">' + esc(day.name) + '</span>' +
          '<span class="day-pill-meta">' + day.exercises.length + ' esercizi</span>' +
          '</button>'
        ).join('') +
        '</div>' +
        '</section>' +
        (selectedDay
          ? '<section class="card day-preview">' +
            '<div class="card-head"><h3>' + esc(selectedDay.name) + '</h3><span class="badge">' + selectedDay.exercises.length + ' esercizi</span></div>' +
            (selectedDay.exercises.length
              ? '<ul class="preview-list">' +
                selectedDay.exercises.map((ex) =>
                  '<li><span class="preview-name">' + esc(ex.name) + '</span>' +
                  '<span class="preview-meta">' + ex.sets + 'x' + ex.reps + ' - rec ' + ex.rest + 's</span></li>'
                ).join('') +
                '</ul>'
              : '<p class="muted small empty-line">Nessun esercizio in questo giorno. Aggiungili dalla scheda.</p>') +
            '<button class="btn primary wide" data-action="start">Inizia allenamento</button>' +
            '</section>'
          : '')
      : '<section class="empty card">' +
        '<div class="empty-icon">' + I.plan + '</div>' +
        '<h3>La tua scheda è vuota</h3>' +
        '<p class="muted">Crea un giorno, aggiungi i tuoi esercizi o importa una scheda da file e testo.</p>' +
        '<button class="btn primary wide" data-action="gotoPlan">Crea la scheda</button>' +
        '</section>') +
    (latest
      ? '<section class="last-card">' +
        '<h3>Ultimo allenamento</h3>' +
        '<p class="muted">' + esc(latest.dayName) + ' - ' + fmtDate(latest.date) + '</p>' +
        '<div class="mini-stats">' +
        '<span><strong>' + totalRepsOf(latest) + '</strong> rip</span>' +
        '<span><strong>' + fmtDuration(latest.durationSec || 0) + '</strong></span>' +
        '</div>' +
        '<button class="link-btn" data-action="tab" data-tab="history">Apri cronologia -</button>' +
        '</section>'
      : '');
}

function renderPlan() {
  const view = $('#view');
  view.innerHTML =
    '<section class="hello">' +
    '<p class="eyebrow">Scheda</p>' +
    '<h2>Organizza i tuoi giorni</h2>' +
    '<p class="muted">Crea i giorni, aggiungi esercizi con serie, rip e recupero. Esporta o importa quando vuoi.</p>' +
    '</section>' +
    '<div class="row gap wrap" style="margin-bottom:16px">' +
    '<button class="btn" data-action="importPlan">' + I.download + ' Importa</button>' +
    '<button class="btn" data-action="exportPlan" ' + (state.plan.length ? '' : 'disabled') + '>' + I.share + ' Esporta</button>' +
    '<button class="btn primary" data-action="addDay">' + I.plus + ' Nuovo giorno</button>' +
    '</div>' +
    (state.plan.length
      ? state.plan.map((day) =>
          '<article class="card day-card">' +
          '<div class="card-head">' +
          '<div><h3>' + esc(day.name) + '</h3><p class="muted small" style="margin:3px 0 0">' + day.exercises.length + ' ' + (day.exercises.length === 1 ? 'esercizio' : 'esercizi') + '</p></div>' +
          '<div class="row gap-sm">' +
          '<button class="icon-btn" data-action="editDay" data-id="' + day.id + '" aria-label="Rinomina giorno">' + I.edit + '</button>' +
          '<button class="icon-btn danger" data-action="deleteDay" data-id="' + day.id + '" aria-label="Elimina giorno">' + I.trash + '</button>' +
          '</div>' +
          '</div>' +
          (day.exercises.length
            ? '<ul class="ex-list">' +
              day.exercises.map((ex) =>
                '<li class="ex-row">' +
                '<button class="ex-main" data-action="editExercise" data-day="' + day.id + '" data-id="' + ex.id + '">' +
                '<span class="ex-name">' + esc(ex.name) + '</span>' +
                '<span class="ex-meta">' + ex.sets + 'x' + ex.reps + ' - recupero ' + ex.rest + 's</span>' +
                '</button>' +
                '<button class="icon-btn danger" data-action="deleteExercise" data-day="' + day.id + '" data-id="' + ex.id + '" aria-label="Elimina esercizio">' + I.trash + '</button>' +
                '</li>'
              ).join('') +
              '</ul>'
            : '<p class="muted small empty-line">Nessun esercizio. Aggiungine uno per iniziare.</p>') +
          '<button class="btn ghost wide" data-action="addExercise" data-id="' + day.id + '">' + I.plus + ' Aggiungi esercizio</button>' +
          '</article>'
        ).join('')
      : '<section class="empty card">' +
        '<div class="empty-icon">' + I.plan + '</div>' +
        '<h3>Nessun giorno ancora</h3>' +
        '<p class="muted">Crea il tuo primo giorno e inizia ad aggiungere esercizi.</p>' +
        '<button class="btn primary wide" data-action="addDay">Crea il primo giorno</button>' +
        '</section>');
}

function renderHistory() {
  const hist = state.history;
  const totals = hist.reduce((acc, w) => {
    acc.reps += totalRepsOf(w);
    acc.duration += Number(w.durationSec) || 0;
    return acc;
  }, { reps: 0, duration: 0 });
  const view = $('#view');
  view.innerHTML =
    '<section class="hello">' +
    '<p class="eyebrow">Cronologia</p>' +
    '<h2>I tuoi allenamenti</h2>' +
    '<p class="muted">' + (hist.length ? hist.length + ' allenamenti - ' + totals.reps + ' ripetizioni totali' : 'Qui troverai tutto quello che hai fatto.') + '</p>' +
    '</section>' +
    (hist.length
      ? '<div class="row gap wrap" style="margin-bottom:4px">' +
        '<button class="btn" data-action="exportHistoryJSON">' + I.download + ' Esporta JSON</button>' +
        '<button class="btn" data-action="exportHistoryCSV">' + I.table + ' Esporta CSV</button>' +
        '<button class="btn ghost danger-text" data-action="clearHistory">Svuota</button>' +
        '</div>' +
        '<div class="hist-list">' +
        hist.map((w) => {
          const reps = totalRepsOf(w);
          const sets = (w.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).length, 0);
          return '<details class="card hist-card">' +
            '<summary>' +
            '<div class="hist-main"><span class="hist-day">' + esc(w.dayName) + '</span><span class="hist-date">' + fmtDate(w.date) + '</span></div>' +
            '<div class="hist-right"><span class="hist-reps">' + reps + ' rip</span><span class="chev">' + I.chevron + '</span></div>' +
            '</summary>' +
            '<div class="hist-body">' +
            '<div class="hist-meta"><span>' + fmtDuration(w.durationSec || 0) + '</span><span>' + sets + ' serie</span></div>' +
            (w.exercises || []).map((ex) =>
              '<div class="hist-ex">' +
              '<div class="hist-ex-head"><span class="hist-ex-name">' + esc(ex.name) + '</span>' +
              '<span class="hist-ex-tag ' + (ex.skipped ? 'skipped' : '') + '">' + (ex.skipped ? 'Saltato' : (ex.sets || []).length + '/' + (ex.targetSets || '-') + ' serie') + '</span></div>' +
              '<div class="chips">' +
              ((ex.sets || []).length
                ? ex.sets.map((set, i) => '<span class="chip">Serie ' + (i + 1) + ': ' + set.reps + ' rip</span>').join('')
                : '<span class="chip empty">Nessuna serie</span>') +
              '</div>' +
              '</div>'
            ).join('') +
            '<div class="row gap-sm">' +
            '<button class="btn ghost small" data-action="exportWorkout" data-id="' + w.id + '">Esporta</button>' +
            '<button class="btn ghost small danger-text" data-action="deleteWorkout" data-id="' + w.id + '">Elimina</button>' +
            '</div>' +
            '</div>' +
            '</details>';
        }).join('') +
        '</div>'
      : '<section class="empty card" style="margin-top:16px">' +
        '<div class="empty-icon">' + I.clock + '</div>' +
        '<h3>Ancora nessun allenamento</h3>' +
        '<p class="muted">Quando finisci una sessione la troverai qui, pronta da esportare.</p>' +
        '<button class="btn primary wide" data-action="tab" data-tab="today">Vai ad allenarti</button>' +
        '</section>');
}

function renderSettings() {
  const s = state.settings;
  const view = $('#view');
  view.innerHTML =
    '<section class="hello">' +
    '<p class="eyebrow">Opzioni</p>' +
    '<h2>Taratura e dati</h2>' +
    '<p class="muted">Regola la sensibilità del contatore e gestisci i tuoi dati.</p>' +
    '</section>' +
    '<section class="card">' +
    '<div class="card-head"><h3>Tema</h3><span class="badge">Neobrutal</span></div>' +
    '<div class="theme-seg" id="themeSeg">' +
    '<button class="seg-btn' + (s.theme === 'system' ? ' sel' : '') + '" data-action="setTheme" data-value="system">Auto</button>' +
    '<button class="seg-btn' + (s.theme === 'light' ? ' sel' : '') + '" data-action="setTheme" data-value="light">Chiaro</button>' +
    '<button class="seg-btn' + (s.theme === 'dark' ? ' sel' : '') + '" data-action="setTheme" data-value="dark">Scuro</button>' +
    '</div>' +
    '<p class="seg-hint">Auto: l\'app segue il tema del dispositivo.</p>' +
    '</section>' +
    '<section class="card">' +
    '<div class="card-head"><h3>Sensibilità sensori</h3><span class="badge" id="sensValue">' + s.sensitivity + '/10</span></div>' +
    '<p class="muted small" style="margin:0 0 6px">Più alta = il telefono conta più facilmente. Se conta troppe ripetizioni, abbassala.</p>' +
    '<input id="sensRange" class="range" type="range" min="1" max="10" step="1" value="' + s.sensitivity + '" aria-label="Sensibilità sensori">' +
    '<div class="range-labels"><span>Meno sensibile</span><span>Più sensibile</span></div>' +
    '</section>' +
    '<section class="card">' +
    '<div class="setting-row">' +
    '<div><h3>Suono</h3><p class="muted small">Bip a fine recupero e fine allenamento</p></div>' +
    '<label class="switch"><input id="setSound" type="checkbox" ' + (s.sound ? 'checked' : '') + ' aria-label="Suono"><span></span></label>' +
    '</div>' +
    '<div class="setting-row">' +
    '<div><h3>Vibrazione</h3><p class="muted small">Nativa su Android; su iPhone usa l\'escamotage audio: burst di basse frequenze che fanno vibrare lo speaker (audibile come buzz)</p></div>' +
    '<label class="switch"><input id="setVibration" type="checkbox" ' + (s.vibration ? 'checked' : '') + ' aria-label="Vibrazione"><span></span></label>' +
    '</div>' +
    '<div class="setting-row">' +
    '<div><h3>Schermo sempre acceso</h3><p class="muted small">Durante l\'allenamento, dove supportato</p></div>' +
    '<label class="switch"><input id="setWake" type="checkbox" ' + (s.keepAwake ? 'checked' : '') + ' aria-label="Schermo sempre acceso"><span></span></label>' +
    '</div>' +
    '</section>' +
    '<section class="card">' +
    '<div class="card-head"><h3>Dati</h3><span class="badge">' + state.history.length + ' allenamenti</span></div>' +
    '<div class="stack">' +
    '<button class="btn ghost wide" data-action="backup">' + I.download + ' Scarica backup completo</button>' +
    '<label class="btn ghost wide file-btn">' + I.share + ' Ripristina backup<input id="restoreInput" type="file" accept=".json,application/json"></label>' +
    '<button class="btn danger wide" data-action="clearAll">Cancella tutti i dati</button>' +
    '</div>' +
    '</section>' +
    '<section class="card info-card">' +
    '<h3>Come funziona su iPhone</h3>' +
    '<ul class="info-list">' +
    '<li>Per usare accelerometro e giroscopio l\'app deve essere aperta via <strong>HTTPS</strong> (GitHub Pages, Netlify, ecc.) in Safari o dalla schermata Home.</li>' +
    '<li>Tocca <strong>Attiva sensore</strong> durante l\'allenamento e consenti il movimento quando richiesto.</li>' +
    '<li>Tieni l\'iPhone in tasca o al braccio: ogni oscillazione conta una ripetizione. Regola la sensibilità qui sopra.</li>' +
    '<li>Per installarla: Safari - Condividi - <strong>Aggiungi alla schermata Home</strong>.' +
    '</li>' +
    '</ul>' +
    '<button class="link-btn" data-action="privacy" style="margin-top:12px">Privacy policy</button>' +
    '</section>' +
    '<p class="version">GymGyro - v1.1</p>';
  const range = $('#sensRange');
  range.addEventListener('input', () => {
    state.settings.sensitivity = clampInt(range.value, 1, 10, 5);
    $('#sensValue').textContent = state.settings.sensitivity + '/10';
    persistSoon();
  });
  $('#setSound').addEventListener('change', (event) => {
    state.settings.sound = event.target.checked;
    persist();
    if (event.target.checked) beep(880, 0.1);
  });
  $('#setVibration').addEventListener('change', (event) => {
    state.settings.vibration = event.target.checked;
    persist();
    if (event.target.checked) vibrate([120, 60, 120]);
  });
  $('#setWake').addEventListener('change', (event) => {
    state.settings.keepAwake = event.target.checked;
    persist();
    if (!event.target.checked) releaseWakeLock();
    else if (state.active) requestWakeLock();
  });
  const restoreInput = $('#restoreInput');
  restoreInput.addEventListener('change', () => {
    const file = restoreInput.files && restoreInput.files[0];
    if (file) restoreBackup(file);
    restoreInput.value = '';
  });
}

async function restoreBackup(file) {
  let parsed = null;
  try { parsed = JSON.parse(await file.text()); } catch (err) { parsed = null; }
  const data = parsed && parsed.type === 'backup' && parsed.data ? parsed.data : (parsed && parsed.plan ? parsed : null);
  if (!data || !Array.isArray(data.plan)) { toast('File di backup non valido'); return; }
  const ok = await confirmDialog({
    title: 'Ripristinare il backup?',
    text: 'Scheda, cronologia e impostazioni attuali verranno sostituite.',
    confirmLabel: 'Ripristina',
    danger: true,
  });
  if (!ok) return;
  const fresh = makeDefaultState(false);
  state = {
    ...fresh,
    plan: data.plan.map(normalizeDay),
    history: Array.isArray(data.history) ? data.history.filter((w) => w && typeof w === 'object') : [],
    settings: { ...fresh.settings, ...(data.settings || {}) },
    ui: { ...fresh.ui, ...(data.ui || {}), lastTab: 'today' },
    active: null,
  };
  state.settings.sensitivity = clampInt(state.settings.sensitivity, 1, 10, 5);
  if (['system', 'light', 'dark'].indexOf(state.settings.theme) === -1) state.settings.theme = 'system';
  activeTab = 'today';
  persist();
  render();
  toast('Backup ripristinato');
}

async function clearAllFlow() {
  const ok = await confirmDialog({
    title: 'Cancellare tutti i dati?',
    text: 'Scheda, cronologia e impostazioni verranno eliminate. Esporta prima un backup se ti servono.',
    confirmLabel: 'Cancella tutto',
    danger: true,
  });
  if (!ok) return;
  state = makeDefaultState(false);
  activeTab = 'today';
  state.ui.lastTab = 'today';
  persist();
  render();
  toast('Dati cancellati');
}

async function clearHistoryFlow() {
  if (!state.history.length) return;
  const ok = await confirmDialog({
    title: 'Svuotare la cronologia?',
    text: 'Tutti gli allenamenti salvati verranno eliminati. Esporta prima il file se ti servono.',
    confirmLabel: 'Svuota',
    danger: true,
  });
  if (!ok) return;
  state.history = [];
  persist();
  render();
  toast('Cronologia svuotata');
}

async function deleteWorkoutFlow(id) {
  const workout = state.history.find((w) => w.id === id);
  if (!workout) return;
  const ok = await confirmDialog({
    title: 'Eliminare questo allenamento?',
    text: workout.dayName + ' - ' + fmtDate(workout.date),
    confirmLabel: 'Elimina',
    danger: true,
  });
  if (!ok) return;
  state.history = state.history.filter((w) => w.id !== id);
  persist();
  render();
  toast('Allenamento eliminato');
}

/* ---------------- azioni globali ---------------- */
function pickDay(id) {
  if (!state.plan.some((d) => d.id === id)) return;
  state.ui.lastDayId = id;
  persist();
  render();
}

const actions = {
  tab: (btn) => setTab(btn.dataset.tab),
  pickDay: (btn) => pickDay(btn.dataset.id),
  start: () => startWorkout(),
  resume: () => resumeWorkout(),
  discardActive: () => discardActiveFlow(),
  gotoPlan: () => setTab('plan'),
  addDay: () => addDayFlow(),
  editDay: (btn) => editDayFlow(btn.dataset.id),
  deleteDay: (btn) => deleteDayFlow(btn.dataset.id),
  addExercise: (btn) => exerciseDialog(btn.dataset.id, null),
  editExercise: (btn) => exerciseDialog(btn.dataset.day, btn.dataset.id),
  deleteExercise: (btn) => deletePlanExercise(btn.dataset.day, btn.dataset.id),
  importPlan: () => importPlanDialog(),
  exportPlan: () => exportPlan(),
  exportHistoryJSON: () => exportHistoryJSON(),
  exportHistoryCSV: () => exportHistoryCSV(),
  exportWorkout: (btn) => exportWorkout(btn.dataset.id),
  deleteWorkout: (btn) => deleteWorkoutFlow(btn.dataset.id),
  clearHistory: () => clearHistoryFlow(),
  backup: () => exportBackup(),
  clearAll: () => clearAllFlow(),
  privacy: () => openPrivacy(),
  setTheme: (btn) => {
    const value = btn.dataset.value;
    if (['system', 'light', 'dark'].indexOf(value) === -1) return;
    state.settings.theme = value;
    persist();
    applyTheme();
    $$('#themeSeg .seg-btn').forEach((seg) => seg.classList.toggle('sel', seg.dataset.value === value));
    toast(value === 'system' ? 'Tema: automatico' : (value === 'dark' ? 'Tema: scuro' : 'Tema: chiaro'));
  },
};

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const handler = actions[target.dataset.action];
  if (handler) handler(target);
});

/* ---------------- click schermata allenamento ---------------- */
function onWorkoutClick(event) {
  const btn = event.target.closest('[data-wk]');
  if (!btn) return;
  ensureAudio();
  switch (btn.dataset.wk) {
    case 'plus': addRep(1); break;
    case 'minus': addRep(-1); break;
    case 'set': completeSet(); break;
    case 'sensor': toggleSensor(); break;
    case 'skip': skipExerciseFlow(); break;
    case 'delete': deleteActiveExerciseFlow(); break;
    case 'close': closeWorkoutFlow(); break;
    case 'finish': finishWorkoutFlow(); break;
    case 'add15': addRestTime(15); break;
    case 'skiprest': skipRest(); break;
  }
}

/* ---------------- render shell ---------------- */
const renderers = { today: renderToday, plan: renderPlan, history: renderHistory, settings: renderSettings };

function setTab(tab) {
  if (activeTab === tab) {
    window.scrollTo(0, 0);
    return;
  }
  activeTab = tab;
  state.ui.lastTab = tab;
  persist();
  window.scrollTo(0, 0);
  render();
}

function render() {
  const main = $('#view');
  if (!main) return;
  if (!renderers[activeTab]) activeTab = 'today';
  renderers[activeTab]();
  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === activeTab));
}

/* ---------------- avvio ---------------- */
window.addEventListener('pointerdown', () => ensureAudio(), { once: true, capture: true });

applyTheme();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

render();
persist();

if (state.firstRun && state.plan.length) {
  setTimeout(() => toast('Scheda di esempio pronta: personalizzala dalla scheda «Scheda»'), 900);
}
