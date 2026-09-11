const tauri = window.__TAURI__;

const stage = document.getElementById('stage');
const bubble = document.getElementById('bubble');
const tagEl = document.getElementById('tag');
const headlineEl = document.getElementById('headline');
const subEl = document.getElementById('sub');
const doneBtn = document.getElementById('done');
const skipBtn = document.getElementById('skip');
const customImg = document.getElementById('custom-avatar');
const fx = document.getElementById('fx');
const drop = document.getElementById('drop');

// [headline, follow-up line]
const MESSAGES = [
  ["water break, bestie \u{1F4A7}", "take a sip, then get back to it."],
  ["hydration check ✨", "when did you last drink water? be honest."],
  ["sip sip hooray \u{1F389}", "future you says thanks in advance."],
  ["your brain is ~75% water \u{1F9E0}", "top it up and watch the focus hit different."],
  ["it's giving… thirsty \u{1F440}", "grab your bottle, we're doing a lil sip."],
  ["main character energy = hydrated \u{1F485}", "one glass. go."],
  ["no cap, water hits different rn \u{1F4A6}", "a few big gulps and you're back."],
  ["your plants get water. so should you \u{1FAB4}", "quick refill?"],
  ["bottle check \u{1F964}", "empty? that's your sign to refill."],
  ["hydrate or diedrate \u{1F480}", "jk. but fr, drink some water."],
];

// Intro: the drop falls for DROP_MS and splashes. The CSS spring-up animation is
// delayed to start at that moment, so the buddy pops out of the splash.
const DROP_MS = 380;
const BUBBLE_AT_MS = 980;
// Outro timings, matching the hop and dive-down animations in styles.css.
const HOP_MS = 620;
const DIVE_LANDS_MS = 425;

const timers = [];
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }

let customActive = false;
let darkMode = false;
let reducedMotion = false;
let currentState = null;

function setState(name) {
  currentState = name;
  let cls = name ? 'state-' + name : '';
  if (customActive) cls += ' custom';
  if (darkMode) cls += ' dark';
  stage.className = cls;
}

function fmtInterval(m) {
  if (m === 1) return 'every minute';
  if (m === 60) return 'every hour';
  if (m % 60 === 0) return 'every ' + (m / 60) + ' hours';
  return 'every ' + m + ' min';
}

// ---------- sound ----------

let soundEnabled = true;
let audioCtx = null;
function audio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch (e) { return null; /* a silent reminder is fine too */ }
}

function chime() {
  if (!soundEnabled) return;
  const ctx = audio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [[880, 0], [1318.5, 0.13]].forEach(([freq, dt]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + dt);
    gain.gain.exponentialRampToValueAtTime(0.06, t0 + dt + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + dt);
    osc.stop(t0 + dt + 0.45);
  });
}

// A water-drop "plip": a short sine blip with a fast upward pitch sweep.
function plip() {
  if (!soundEnabled) return;
  const ctx = audio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, t0);
  osc.frequency.exponentialRampToValueAtTime(1250, t0 + 0.07);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.18);
}

// ---------- splash effects ----------

// Effects are positioned relative to #fx, a zero-size anchor at the buddy's feet.

function removeWhenDone(anim, el) {
  anim.finished.then(() => el.remove(), () => el.remove());
}

function clearEffects() {
  fx.getAnimations({ subtree: true }).forEach(a => a.cancel());
  fx.querySelectorAll('.ripple, .spray').forEach(el => el.remove());
}

function fallingDrop() {
  const total = DROP_MS + 80;
  drop.animate([
    // Starts a full window height up, above the top edge; ease-in reads as gravity.
    { transform: 'translateY(-100vh) scale(.8, 1)', opacity: 1, easing: 'cubic-bezier(.55, 0, 1, .45)' },
    { transform: 'translateY(0) scale(.72, 1.35)', opacity: 1, offset: DROP_MS / total, easing: 'ease-out' },
    { transform: 'translateY(0) scale(1.9, .2)', opacity: 0 },
  ], { duration: total, fill: 'forwards' });
}

function splash({ rings = 2, beads = 7 } = {}) {
  for (let i = 0; i < rings; i++) {
    const ring = document.createElement('div');
    ring.className = 'ripple';
    fx.appendChild(ring);
    const [w, h] = i === 0 ? [150, 34] : [92, 20];
    removeWhenDone(ring.animate([
      { width: '28px', height: '7px', opacity: 0.9 },
      { width: w + 'px', height: h + 'px', opacity: 0 },
    ], { duration: 520, delay: i * 110, easing: 'cubic-bezier(.1, .7, .3, 1)', fill: 'forwards' }), ring);
  }

  // Beads fly out in a crown and fall back under gravity. Keyframes are sampled
  // from the real trajectory, and each bead's flight ends when it's back at
  // ground level, so nothing drops below the floor.
  const gravity = 1000; // px/s²
  for (let i = 0; i < beads; i++) {
    const bead = document.createElement('div');
    bead.className = 'spray';
    fx.appendChild(bead);
    const spread = beads > 1 ? i / (beads - 1) : 0.5;
    const angle = (-150 + 120 * spread) * Math.PI / 180;
    const speed = 230 + Math.random() * 90;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const flight = Math.min(0.6, (-2 * vy) / gravity);
    const size = 0.6 + Math.random() * 0.5;
    const frames = [];
    for (let k = 0; k <= 10; k++) {
      const t = (k / 10) * flight;
      const x = vx * t;
      const y = -4 + vy * t + gravity * t * t / 2;
      frames.push({
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${size * (1 - k / 20)})`,
        opacity: k < 7 ? 1 : (10 - k) / 3,
      });
    }
    removeWhenDone(bead.animate(frames, { duration: flight * 1000, fill: 'forwards' }), bead);
  }
}

// ---------- reminder flow ----------

function playIntro() {
  void stage.offsetWidth; // commit the reset state so the CSS intro restarts
  setState('enter');
  if (reducedMotion) {
    later(showBubble, 250);
    return;
  }
  fallingDrop();
  later(() => { splash(); plip(); }, DROP_MS);
  later(showBubble, BUBBLE_AT_MS);
}

function showBubble() {
  setState('waiting');
  bubble.classList.add('show');
  chime();
  tauri.core.invoke('set_interactive', { interactive: true }).catch(() => {});
}

function showReminder(data) {
  clearTimers();
  clearEffects();
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (data.sound !== undefined) {
    soundEnabled = Boolean(data.sound);
  }
  const avatar = data.avatar || {};
  customActive = Boolean(avatar.url);
  // Always sync theme from payload — this is the authoritative source since
  // the theme-changed boot event fires before JS has loaded.
  if (data.theme === 'dark') {
    darkMode = true;
  } else if (data.theme === 'light') {
    darkMode = false;
  } else if (data.theme === 'system') {
    darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    darkMode = Boolean(data.darkMode);
  }

  const who = avatar.name || 'Drippy';
  const [headline, sub] = data.demo
    ? ["hiii, i'm " + who + " \u{1F4A7}",
       "i'll pop in " + fmtInterval(data.intervalMin || 45) + " so u stay hydrated. tap “i drank” to try it"]
    : MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  tagEl.textContent = who + ' says';
  headlineEl.textContent = headline;
  subEl.textContent = sub;
  bubble.classList.remove('show', 'peel');
  setState(null);

  // Drop handlers from the previous reminder first: clearing src fires `error`,
  // which would otherwise start a second intro.
  customImg.onload = customImg.onerror = null;
  if (customActive) {
    customImg.onload = playIntro;
    customImg.onerror = () => { customActive = false; setState(null); playIntro(); };
    customImg.src = avatar.url;
  } else {
    customImg.removeAttribute('src');
    playIntro();
  }
}

function respond(kind) {
  if (currentState !== 'waiting') return;
  clearTimers();
  bubble.classList.replace('show', 'peel');
  tauri.core.invoke('set_interactive', { interactive: false }).catch(() => {});
  tauri.core.invoke('reminder_result', { result: kind });
  if (kind === 'done' && !reducedMotion) {
    setState('happy');
    later(diveOut, HOP_MS);
  } else {
    diveOut();
  }
}

function diveOut() {
  setState('exit');
  if (!reducedMotion) later(() => splash({ rings: 1, beads: 4 }), DIVE_LANDS_MS);
}

doneBtn.addEventListener('click', () => respond('done'));
skipBtn.addEventListener('click', () => respond('skip'));

tauri.event.listen('show-reminder', (e) => showReminder(e.payload));

tauri.event.listen('theme-changed', (e) => {
  if (typeof e.payload === 'string') {
    if (e.payload === 'dark') darkMode = true;
    else if (e.payload === 'light') darkMode = false;
    else darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    darkMode = Boolean(e.payload);
  }
  setState(currentState);
});

// Initialize dark mode and sound on load so variables are correct if the
// reminder fires before events are received.
(async () => {
  try {
    const s = await tauri.core.invoke('get_settings');
    if (s.theme === 'dark') darkMode = true;
    else if (s.theme === 'light') darkMode = false;
    else if (s.theme === 'system') darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    else darkMode = Boolean(s.darkMode);
    if (s.sound !== undefined) soundEnabled = Boolean(s.sound);
  } catch (e) {}
})();
