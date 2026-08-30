const tauri = window.__TAURI__;

const stage = document.getElementById('stage');
const bubble = document.getElementById('bubble');
const msgEl = document.getElementById('msg');
const doneBtn = document.getElementById('done');
const skipBtn = document.getElementById('skip');
const customImg = document.getElementById('custom-avatar');

const MESSAGES = [
  "Hey! Time to drink water \u{1F4A7}",
  "Hydration o'clock — grab your bottle! \u{1F964}",
  "Psst… your cells called. They want water \u{1F4A6}",
  "Quick glug-glug break? \u{1F4A7}",
  "Water time! Your future self says thanks \u2728",
  "Sip sip hooray! Time for some water \u{1F389}",
  "Focus tip #1: drink water. Go! \u{1F4A7}",
  "Your water bottle misses you \u{1F499}",
  "Ahh… nothing beats a sip of water. Have one! \u{1F60C}",
];

const timers = [];
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }

let customActive = false;
let darkMode = false;

function setState(name) {
  let cls = name ? 'state-' + name : '';
  if (customActive) cls += ' custom';
  if (darkMode) cls += ' dark';
  stage.className = cls;
}

function fmtInterval(m) {
  if (m === 1) return 'every minute';
  if (m === 60) return 'every hour';
  return 'every ' + m + ' minutes';
}

let audioCtx = null;
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const t0 = audioCtx.currentTime;
    [[880, 0], [1318.5, 0.13]].forEach(([freq, dt]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + dt);
      gain.gain.exponentialRampToValueAtTime(0.06, t0 + dt + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.4);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.45);
    });
  } catch (e) { /* a silent reminder is fine too */ }
}

function showReminder(data) {
  clearTimers();
  const avatar = data.avatar || {};
  customActive = Boolean(avatar.url);
  // Always sync theme from payload — this is the authoritative source since
  // the theme-changed boot event fires before JS has loaded.
  darkMode = Boolean(data.darkMode);

  const proceed = () => {
    const who = avatar.name || 'Drippy';
    msgEl.textContent = data.demo
      ? "Hi, I'm " + who + "! \u{1F4A7} I'll swing by " + fmtInterval(data.intervalMin || 45) +
        " to remind you to hydrate. Try clicking \u201CDone\u201D!"
      : MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    bubble.classList.remove('show');
    setState('walk-in');
    chime();
    later(async () => {
      setState('waiting');
      try { await tauri.core.invoke('set_interactive', { interactive: true }); } catch (e) {}
      bubble.classList.add('show');
    }, 2050);
  };

  if (customActive) {
    customImg.onload = proceed;
    customImg.onerror = () => { customActive = false; proceed(); };
    customImg.src = avatar.url;
  } else {
    customImg.src = '';
    proceed();
  }
}

async function respond(kind) {
  bubble.classList.remove('show');
  clearTimers();
  try { await tauri.core.invoke('set_interactive', { interactive: false }); } catch (e) {}
  tauri.core.invoke('reminder_result', { result: kind });
  setState('walk-out');
}

doneBtn.addEventListener('click', () => respond('done'));
skipBtn.addEventListener('click', () => respond('skip'));

tauri.event.listen('show-reminder', (e) => showReminder(e.payload));

tauri.event.listen('theme-changed', (e) => {
  darkMode = Boolean(e.payload);
  const current = stage.className.replace(/ state-\S+/g, '').replace(/ custom/g, '').replace(/ dark/g, '').trim();
  setState(current || null);
});

// Initialize dark mode on load so the variable is correct if the
// reminder fires before a theme-changed event is received.
(async () => {
  try {
    const s = await tauri.core.invoke('get_settings');
    darkMode = Boolean(s.darkMode);
  } catch (e) {}
})();
