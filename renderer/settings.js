const tauri = window.__TAURI__;

const INTERVALS = [
  { min: 1,  num: '1',   label: 'min',  test: true },
  { min: 15, num: '15',  label: 'min' },
  { min: 30, num: '30',  label: 'min' },
  { min: 45, num: '45',  label: 'min' },
  { min: 60, num: '1',   label: 'hr' },
  { min: 90, num: '90',  label: 'min' },
];

const grid = document.getElementById('interval-grid');
const avatarGrid = document.getElementById('avatar-grid');
const statusLabel = document.getElementById('status-label');
const statusSub   = document.getElementById('status-sub');
const badge       = document.getElementById('status-badge');
const testBtn     = document.getElementById('test-btn');
const pauseBtn    = document.getElementById('pause-btn');
const uploadBtn   = document.getElementById('upload-btn');
const avatarFile  = document.getElementById('avatar-file');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon   = document.getElementById('theme-icon');
const themeLabel  = document.getElementById('theme-label');

let currentInterval = 45;
let currentAvatar = 'drippy';
let currentAvatarName = 'Drippy';
let isPaused = false;
let isDark = false;

/* ---------- helpers ---------- */

function fmtMin(m) {
  if (m === 1) return '1 minute';
  if (m === 60) return '1 hour';
  return m + ' minutes';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function updateStatus() {
  if (isPaused) {
    statusLabel.textContent = 'Reminders paused';
    statusSub.textContent   = 'Tap Resume to get back on track';
    badge.textContent       = 'Paused';
    badge.className         = 'badge badge-paused';
    pauseBtn.innerHTML      = '<span class="btn-icon">&#9654;</span> Resume reminders';
  } else {
    statusLabel.textContent = 'Reminding every ' + fmtMin(currentInterval);
    statusSub.textContent   = currentAvatarName + ' will pop up soon \u{1F4A7}';
    badge.textContent       = 'Active';
    badge.className         = 'badge badge-active';
    pauseBtn.innerHTML      = '<span class="btn-icon">&#10074;&#10074;</span> Pause reminders';
  }
}

function applyTheme() {
  document.body.classList.toggle('dark', isDark);
}

function updateThemeUI() {
  applyTheme();
  if (isDark) {
    themeIcon.textContent = '\u2600';
    themeLabel.textContent = 'Light mode';
  } else {
    themeIcon.textContent = '\u263D';
    themeLabel.textContent = 'Dark mode';
  }
}

/* ---------- build interval chips ---------- */

function buildGrid() {
  grid.innerHTML = '';
  INTERVALS.forEach(({ min, num, label, test }) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (min === currentInterval ? ' selected' : '');
    if (test) chip.classList.add('chip-test');
    chip.dataset.minutes = min;
    chip.innerHTML = '<div class="chip-num">' + num + '</div><div class="chip-label">' + (test ? 'testing' : label) + '</div>';
    chip.addEventListener('click', () => pickInterval(min));
    grid.appendChild(chip);
  });
}

/* ---------- avatar grid ---------- */

async function refreshAvatars() {
  let avatars = [];
  try {
    avatars = await tauri.core.invoke('get_avatar_list');
  } catch (e) { console.error(e); }
  const match = avatars.find(a => a.id === currentAvatar);
  if (!match && currentAvatar !== 'drippy') currentAvatar = 'drippy';
  currentAvatarName = (match && match.name) || 'Drippy';
  renderAvatarGrid(avatars);
}

function renderAvatarGrid(avatars) {
  avatarGrid.innerHTML = '';
  avatars.forEach(avatar => {
    const chip = document.createElement('div');
    chip.className = 'avatar-chip' + (avatar.id === currentAvatar ? ' selected' : '');
    const preview = avatar.url
      ? `<img class="avatar-img" src="${avatar.url}" alt=""
         onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />`
      : '<span style="font-size: 24px;">\u{1F4A7}</span>';
    const fallback = avatar.url ? '<span class="avatar-fallback" style="display:none;">\u{1F5BC}\uFE0F</span>' : '';
    chip.innerHTML =
      '<div class="avatar-preview">' + preview + fallback + '</div>' +
      '<div class="avatar-name">' + escapeHtml(avatar.name) + '</div>';
    chip.addEventListener('click', () => pickAvatar(avatar));
    if (avatar.id !== 'drippy') {
      const rename = document.createElement('button');
      rename.className = 'avatar-rename';
      rename.title = 'Rename';
      rename.textContent = '\u270E';
      rename.addEventListener('click', e => { e.stopPropagation(); startRename(avatar, chip); });
      chip.appendChild(rename);

      const del = document.createElement('button');
      del.className = 'avatar-delete';
      del.title = 'Remove this avatar';
      del.textContent = '\u2715';
      del.addEventListener('click', e => { e.stopPropagation(); removeAvatar(avatar); });
      chip.appendChild(del);
    }
    avatarGrid.appendChild(chip);
  });
}

function startRename(avatar, chip) {
  const nameEl = chip.querySelector('.avatar-name');
  const oldName = avatar.name;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'avatar-rename-input';
  input.value = oldName;
  input.maxLength = 30;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    if (newName && newName !== oldName) {
      try {
        await tauri.core.invoke('rename_avatar', { avatarId: avatar.id, name: newName });
      } catch (e) { console.error(e); }
    }
    await refreshAvatars();
    updateStatus();
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = oldName; input.blur(); }
  });
}

async function pickAvatar(avatar) {
  currentAvatar = avatar.id;
  currentAvatarName = avatar.name;
  refreshAvatars();
  updateStatus();
  try {
    await tauri.core.invoke('set_avatar', { avatarId: avatar.id });
  } catch (e) { console.error(e); }
}

async function removeAvatar(avatar) {
  try {
    await tauri.core.invoke('delete_avatar', { avatarId: avatar.id });
    if (currentAvatar === avatar.id) {
      currentAvatar = 'drippy';
      currentAvatarName = 'Drippy';
    }
    await refreshAvatars();
    updateStatus();
  } catch (e) { console.error(e); }
}

/* ---------- upload a PNG avatar ---------- */

uploadBtn.addEventListener('click', () => avatarFile.click());

avatarFile.addEventListener('change', async () => {
  const file = avatarFile.files && avatarFile.files[0];
  avatarFile.value = '';
  if (!file) return;
  if (file.type !== 'image/png') {
    alert('Please pick a PNG image \u2014 a transparent background works best.');
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    alert('That image is a bit too big \u2014 please pick one under 4 MB.');
    return;
  }
  const name = file.name.replace(/\.png$/i, '').replace(/[-_]+/g, ' ').trim() || 'My avatar';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    const avatar = await tauri.core.invoke('upload_avatar', { name, data: btoa(bin) });
    currentAvatar = avatar.id;
    currentAvatarName = avatar.name;
    await tauri.core.invoke('set_avatar', { avatarId: avatar.id });
    await refreshAvatars();
    updateStatus();
  } catch (e) {
    alert('Sorry, that avatar could not be added.\n' + e);
  }
});

/* ---------- intervals ---------- */

async function pickInterval(min) {
  currentInterval = min;
  buildGrid();
  updateStatus();
  try { await tauri.core.invoke('set_interval', { minutes: min }); } catch (e) { console.error(e); }
}

/* ---------- actions ---------- */

testBtn.addEventListener('click', async () => {
  try {
    await tauri.core.invoke('remind_now');
    await tauri.core.invoke('close_settings');
  } catch (e) { console.error(e); }
});

pauseBtn.addEventListener('click', async () => {
  try {
    isPaused = await tauri.core.invoke('toggle_pause');
    updateStatus();
  } catch (e) { console.error(e); }
});

/* ---------- dark mode ---------- */

themeToggle.addEventListener('click', async () => {
  isDark = !isDark;
  updateThemeUI();
  try { await tauri.core.invoke('set_dark_mode', { dark: isDark }); } catch (e) { console.error(e); }
});

/* ---------- init ---------- */

async function init() {
  try {
    const s = await tauri.core.invoke('get_settings');
    currentInterval = s.intervalMin;
    currentAvatar = s.avatarId || 'drippy';
    isPaused = s.paused;
    isDark = s.darkMode;
  } catch (e) { console.error(e); }
  buildGrid();
  await refreshAvatars();
  updateStatus();
  updateThemeUI();
}

init();
