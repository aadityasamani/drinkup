const tauri = window.__TAURI__;

// ---------- State ----------
const state = {
  intervalMin: 45,
  paused: false,
  nextReminderAt: null, // unix ms timestamp or null
  reminderVisible: false,
  avatarId: 'drippy',
  avatarName: 'Drippy',
  avatars: [],
  theme: 'system', // 'light' | 'dark' | 'system'
  sound: true,
  autostart: false,
  isDev: false,
  isCustomInterval: false,
  customInputVal: 20,
  isRenaming: false,
  isConfirmingDelete: false,
  avatarError: null,
  intervalError: null,
};

// Preset intervals
const PRESET_INTERVALS = [
  { min: 1,  num: '1',  unit: 'min', test: true },
  { min: 15, num: '15', unit: 'min' },
  { min: 30, num: '30', unit: 'min' },
  { min: 45, num: '45', unit: 'min' },
  { min: 60, num: '1',  unit: 'hr' },
  { min: 90, num: '90', unit: 'min' },
];

// DOM Elements
const heroTag = document.getElementById('hero-tag');
const heroSticker = document.getElementById('hero-sticker');
const heroOverline = document.getElementById('hero-overline');
const heroCountdown = document.getElementById('hero-countdown');
const heroSub = document.getElementById('hero-sub');
const heroActions = document.getElementById('hero-actions');
const btnRemindNow = document.getElementById('btn-remind-now');
const btnPause = document.getElementById('btn-pause');
const heroDrippySvg = document.getElementById('hero-drippy-svg');
const heroEyes = document.getElementById('hero-eyes');
const heroSleepingEyes = document.getElementById('hero-sleeping-eyes');
const heroCustomImg = document.getElementById('hero-custom-img');
const heroZzz = document.getElementById('hero-zzz');

const intervalChipGrid = document.getElementById('interval-chip-grid');
const customStepperRow = document.getElementById('custom-stepper-row');
const btnStepMinus = document.getElementById('btn-step-minus');
const btnStepPlus = document.getElementById('btn-step-plus');
const customMinutesInput = document.getElementById('custom-minutes-input');
const intervalError = document.getElementById('interval-error');

const avatarGrid = document.getElementById('avatar-grid');
const avatarCustomActions = document.getElementById('avatar-custom-actions');
const avatarActionsDefault = document.getElementById('avatar-actions-default');
const btnRenameAvatar = document.getElementById('btn-rename-avatar');
const btnRemoveAvatar = document.getElementById('btn-remove-avatar');
const avatarRenameForm = document.getElementById('avatar-rename-form');
const avatarRenameInput = document.getElementById('avatar-rename-input');
const btnRenameSave = document.getElementById('btn-rename-save');
const btnRenameCancel = document.getElementById('btn-rename-cancel');
const avatarRemoveConfirm = document.getElementById('avatar-remove-confirm');
const removeConfirmText = document.getElementById('remove-confirm-text');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const avatarError = document.getElementById('avatar-error');
const avatarFileInput = document.getElementById('avatar-file-input');

const themeRadioLight = document.getElementById('theme-radio-light');
const themeRadioDark = document.getElementById('theme-radio-dark');
const themeRadioSystem = document.getElementById('theme-radio-system');
const soundToggle = document.getElementById('sound-toggle');
const autostartToggle = document.getElementById('autostart-toggle');
const autostartSub = document.getElementById('autostart-sub');
const footerVersion = document.getElementById('footer-version');

// ---------- Helpers ----------
function fmtMin(m) {
  if (m === 1) return 'every minute';
  if (m === 60) return 'every hour';
  if (m === 120) return 'every 2 hours';
  if (m % 60 === 0) return 'every ' + (m / 60) + ' hours';
  return 'every ' + m + ' min';
}

function fmtRemaining(ms) {
  if (ms <= 0) return 'any sec now';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return 'any sec now';
  const totalMin = Math.ceil(totalSec / 60);
  if (totalMin < 60) {
    return totalMin + ' min';
  }
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (mins === 0) {
    return hrs === 1 ? '1 hr' : hrs + ' hrs';
  }
  return hrs + ' hr ' + mins + ' min';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---------- Theme Management ----------
function applyEffectiveTheme() {
  let isDark = false;
  if (state.theme === 'dark') {
    isDark = true;
  } else if (state.theme === 'light') {
    isDark = false;
  } else {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') {
    applyEffectiveTheme();
  }
});

function updateThemeRadios() {
  if (state.theme === 'light') themeRadioLight.checked = true;
  else if (state.theme === 'dark') themeRadioDark.checked = true;
  else themeRadioSystem.checked = true;
  applyEffectiveTheme();
}

async function setTheme(theme) {
  state.theme = theme;
  updateThemeRadios();
  try {
    await tauri.core.invoke('set_theme', { theme });
  } catch (e) {
    console.error('Failed to set theme:', e);
  }
}

themeRadioLight.addEventListener('change', () => setTheme('light'));
themeRadioDark.addEventListener('change', () => setTheme('dark'));
themeRadioSystem.addEventListener('change', () => setTheme('system'));

// ---------- Sound & Autostart ----------
soundToggle.addEventListener('change', async () => {
  state.sound = soundToggle.checked;
  try {
    await tauri.core.invoke('set_sound', { sound: state.sound });
  } catch (e) {
    console.error('Failed to set sound:', e);
  }
});

autostartToggle.addEventListener('change', async () => {
  const enable = autostartToggle.checked;
  try {
    await tauri.core.invoke('set_autostart', { enabled: enable });
    state.autostart = enable;
  } catch (e) {
    console.error('Failed to set autostart:', e);
    autostartToggle.checked = !enable;
  }
});

// ---------- Hero Sticker Rendering ----------
function renderHero() {
  const who = state.avatarName || 'Drippy';
  heroTag.textContent = who.toUpperCase() + ' SAYS';

  // Avatar illustration in hero
  const activeAvatar = state.avatars.find(a => a.id === state.avatarId);
  if (activeAvatar && activeAvatar.url) {
    heroDrippySvg.style.display = 'none';
    heroCustomImg.style.display = 'block';
    heroCustomImg.src = activeAvatar.url;
  } else {
    heroDrippySvg.style.display = 'block';
    heroCustomImg.style.display = 'none';
  }

  // Handle paused / reminderVisible / counting down states
  if (state.paused) {
    heroSticker.className = 'hero-sticker is-paused';
    heroOverline.textContent = 'reminders paused';
    heroCountdown.textContent = 'paused';
    heroSub.textContent = 'nothing until you resume';
    btnRemindNow.style.display = 'none';
    btnPause.style.display = 'inline-block';
    btnPause.className = 'btn-primary-fizz';
    btnPause.textContent = 'resume';

    heroEyes.style.display = 'none';
    heroSleepingEyes.style.display = 'block';
    heroZzz.style.display = 'block';
  } else if (state.reminderVisible) {
    heroSticker.className = 'hero-sticker is-onscreen';
    heroOverline.textContent = 'reminder active';
    heroCountdown.textContent = 'on screen';
    heroSub.textContent = 'drink up, then tap “i drank”';
    btnRemindNow.style.display = 'none';
    btnPause.style.display = 'none';

    heroEyes.style.display = 'block';
    heroSleepingEyes.style.display = 'none';
    heroZzz.style.display = 'none';
  } else {
    heroSticker.className = 'hero-sticker';
    heroOverline.textContent = 'next sip in';
    heroSub.textContent = fmtMin(state.intervalMin);
    btnRemindNow.style.display = 'inline-block';
    btnRemindNow.className = 'btn-primary-fizz';
    btnRemindNow.textContent = 'remind me now';
    btnPause.style.display = 'inline-block';
    btnPause.className = 'btn-outline-pill';
    btnPause.textContent = 'pause';

    heroEyes.style.display = 'block';
    heroSleepingEyes.style.display = 'none';
    heroZzz.style.display = 'none';

    // Countdown calculation
    if (state.nextReminderAt) {
      const now = Date.now();
      const diff = state.nextReminderAt - now;
      heroCountdown.textContent = fmtRemaining(diff);
    } else {
      heroCountdown.textContent = state.intervalMin + ' min';
    }
  }
}

// Tick hero countdown every 1 second
setInterval(() => {
  if (!state.paused && !state.reminderVisible && state.nextReminderAt) {
    const now = Date.now();
    const diff = state.nextReminderAt - now;
    heroCountdown.textContent = fmtRemaining(diff);
  }
}, 1000);

btnRemindNow.addEventListener('click', async () => {
  try {
    await tauri.core.invoke('remind_now');
  } catch (e) {
    console.error('Failed to trigger remind_now:', e);
  }
});

btnPause.addEventListener('click', async () => {
  try {
    const nowPaused = await tauri.core.invoke('toggle_pause');
    state.paused = nowPaused;
    renderHero();
  } catch (e) {
    console.error('Failed to toggle pause:', e);
  }
});

// ---------- Interval Chips & Custom Stepper ----------
function renderIntervals() {
  intervalChipGrid.innerHTML = '';

  // Filter out 1 min testing chip unless in dev mode
  const visiblePresets = PRESET_INTERVALS.filter(p => !p.test || state.isDev);
  const isMatchingPreset = visiblePresets.some(p => p.min === state.intervalMin);
  state.isCustomInterval = !isMatchingPreset;

  visiblePresets.forEach(preset => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (preset.min === state.intervalMin ? ' selected' : '');
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', preset.min === state.intervalMin ? 'true' : 'false');
    chip.setAttribute('aria-label', `${preset.num} ${preset.unit}`);

    let html = `<span class="chip-num">${preset.num}</span><span class="chip-unit">${preset.unit}</span>`;
    if (preset.test) {
      html += '<span class="chip-test-badge">testing</span>';
    }
    chip.innerHTML = html;

    chip.addEventListener('click', () => {
      selectInterval(preset.min);
    });

    intervalChipGrid.appendChild(chip);
  });

  // Custom Chip
  const customChip = document.createElement('button');
  customChip.type = 'button';
  customChip.className = 'chip' + (state.isCustomInterval ? ' selected' : '');
  customChip.setAttribute('role', 'radio');
  customChip.setAttribute('aria-checked', state.isCustomInterval ? 'true' : 'false');
  customChip.setAttribute('aria-label', 'Custom interval');
  customChip.innerHTML = '<span class="chip-num">···</span><span class="chip-unit">custom</span>';

  customChip.addEventListener('click', () => {
    if (!state.isCustomInterval) {
      state.isCustomInterval = true;
      const targetMin = state.customInputVal || 20;
      selectInterval(targetMin);
    }
    customStepperRow.style.display = 'flex';
    customMinutesInput.focus();
  });

  intervalChipGrid.appendChild(customChip);

  // Arrow key navigation within interval chip group
  const allChips = Array.from(intervalChipGrid.querySelectorAll('.chip'));
  allChips.forEach((chip, index) => {
    chip.addEventListener('keydown', (e) => {
      let targetIndex = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        targetIndex = (index + 1) % allChips.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        targetIndex = (index - 1 + allChips.length) % allChips.length;
      }
      if (targetIndex >= 0) {
        e.preventDefault();
        allChips[targetIndex].focus();
        allChips[targetIndex].click();
      }
    });
  });

  if (state.isCustomInterval) {
    customStepperRow.style.display = 'flex';
    customMinutesInput.value = state.intervalMin;
    state.customInputVal = state.intervalMin;
  } else {
    customStepperRow.style.display = 'none';
  }
}

async function selectInterval(min) {
  const clamped = Math.max(1, Math.min(120, min));
  state.intervalMin = clamped;
  intervalError.style.display = 'none';
  renderIntervals();
  renderHero();
  try {
    await tauri.core.invoke('set_interval', { minutes: clamped });
  } catch (e) {
    console.error('Failed to set interval:', e);
  }
}

function applyCustomStepperInput() {
  const val = parseInt(customMinutesInput.value, 10);
  if (isNaN(val) || val < 1 || val > 120) {
    intervalError.textContent = 'Please enter an interval between 1 and 120 minutes.';
    intervalError.style.display = 'block';
    return;
  }
  intervalError.style.display = 'none';
  state.customInputVal = val;
  selectInterval(val);
}

btnStepMinus.addEventListener('click', () => {
  const cur = parseInt(customMinutesInput.value, 10) || 20;
  const step = cur > 15 ? 5 : 1;
  const next = Math.max(1, cur - step);
  customMinutesInput.value = next;
  applyCustomStepperInput();
});

btnStepPlus.addEventListener('click', () => {
  const cur = parseInt(customMinutesInput.value, 10) || 20;
  const step = cur >= 15 ? 5 : 1;
  const next = Math.min(120, cur + step);
  customMinutesInput.value = next;
  applyCustomStepperInput();
});

customMinutesInput.addEventListener('change', applyCustomStepperInput);
customMinutesInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyCustomStepperInput();
  }
});

// ---------- Avatars Grid & Management ----------
function renderAvatars() {
  avatarGrid.innerHTML = '';
  avatarError.style.display = 'none';

  state.avatars.forEach(avatar => {
    const isSelected = avatar.id === state.avatarId;
    const tile = document.createElement('div');
    tile.className = 'avatar-tile' + (isSelected ? ' selected' : '');
    tile.setAttribute('role', 'radio');
    tile.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    tile.setAttribute('tabindex', '0');

    let previewHtml = '';
    if (avatar.id === 'drippy') {
      previewHtml = `
        <svg viewBox="0 0 120 140" width="48" height="56">
          <defs>
            <linearGradient id="tileGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#7cc7ff"/>
              <stop offset="1" stop-color="#2f8fe0"/>
            </linearGradient>
          </defs>
          <path d="M60 6 C 52 30, 22 58, 22 88 a38 38 0 0 0 76 0 C 98 58, 68 30, 60 6 Z" fill="url(#tileGrad)"/>
          <ellipse cx="47" cy="88" rx="8" ry="9" fill="#ffffff"/>
          <ellipse cx="73" cy="88" rx="8" ry="9" fill="#ffffff"/>
          <circle cx="49" cy="89" r="4.2" fill="#173a5e"/>
          <circle cx="75" cy="89" r="4.2" fill="#173a5e"/>
          <ellipse cx="38" cy="100" rx="5.5" ry="3.5" fill="#ff9db1" opacity="0.75"/>
          <ellipse cx="82" cy="100" rx="5.5" ry="3.5" fill="#ff9db1" opacity="0.75"/>
          <path d="M52 104 q 8 8 16 0" fill="none" stroke="#173a5e" stroke-width="3" stroke-linecap="round"/>
        </svg>
      `;
    } else {
      previewHtml = `<img class="avatar-tile-img" src="${avatar.url}" alt="${escapeHtml(avatar.name)}" />`;
    }

    let pickedTag = isSelected ? '<span class="avatar-picked-tag">picked ✓</span>' : '';

    tile.innerHTML = `
      ${pickedTag}
      <div class="avatar-preview-box">${previewHtml}</div>
      <span class="avatar-tile-name">${escapeHtml(avatar.name)}</span>
    `;

    tile.addEventListener('click', () => pickAvatar(avatar));
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pickAvatar(avatar);
      }
    });

    avatarGrid.appendChild(tile);
  });

  // Add PNG tile
  const addTile = document.createElement('button');
  addTile.type = 'button';
  addTile.className = 'avatar-tile avatar-add-tile';
  addTile.setAttribute('aria-label', 'Upload a PNG avatar');
  addTile.innerHTML = `
    <span class="avatar-add-icon">+</span>
    <span class="avatar-add-text">add png</span>
  `;
  addTile.addEventListener('click', () => {
    avatarError.style.display = 'none';
    avatarFileInput.click();
  });
  avatarGrid.appendChild(addTile);

  // Custom avatar actions row
  renderCustomAvatarActions();
}

function renderCustomAvatarActions() {
  const activeAvatar = state.avatars.find(a => a.id === state.avatarId);
  const isCustom = activeAvatar && activeAvatar.id !== 'drippy';

  if (!isCustom) {
    avatarCustomActions.style.display = 'none';
    state.isRenaming = false;
    state.isConfirmingDelete = false;
    return;
  }

  avatarCustomActions.style.display = 'block';

  if (state.isRenaming) {
    avatarActionsDefault.style.display = 'none';
    avatarRenameForm.style.display = 'flex';
    avatarRemoveConfirm.style.display = 'none';
    avatarRenameInput.value = activeAvatar.name;
    avatarRenameInput.focus();
    avatarRenameInput.select();
  } else if (state.isConfirmingDelete) {
    avatarActionsDefault.style.display = 'none';
    avatarRenameForm.style.display = 'none';
    avatarRemoveConfirm.style.display = 'flex';
    removeConfirmText.textContent = `remove ${activeAvatar.name}?`;
  } else {
    avatarActionsDefault.style.display = 'flex';
    avatarRenameForm.style.display = 'none';
    avatarRemoveConfirm.style.display = 'none';
  }
}

async function pickAvatar(avatar) {
  state.avatarId = avatar.id;
  state.avatarName = avatar.name;
  state.isRenaming = false;
  state.isConfirmingDelete = false;
  renderAvatars();
  renderHero();
  try {
    await tauri.core.invoke('set_avatar', { avatarId: avatar.id });
  } catch (e) {
    console.error('Failed to set avatar:', e);
  }
}

// Rename actions
btnRenameAvatar.addEventListener('click', () => {
  state.isRenaming = true;
  state.isConfirmingDelete = false;
  renderCustomAvatarActions();
});

btnRenameCancel.addEventListener('click', () => {
  state.isRenaming = false;
  renderCustomAvatarActions();
});

async function commitRename() {
  const newName = avatarRenameInput.value.trim();
  if (!newName) {
    avatarError.textContent = 'Please enter an avatar name.';
    avatarError.style.display = 'block';
    return;
  }
  const activeAvatar = state.avatars.find(a => a.id === state.avatarId);
  if (newName !== activeAvatar.name) {
    try {
      await tauri.core.invoke('rename_avatar', { avatarId: activeAvatar.id, name: newName });
      activeAvatar.name = newName;
      state.avatarName = newName;
    } catch (e) {
      avatarError.textContent = 'Could not rename avatar: ' + e;
      avatarError.style.display = 'block';
      return;
    }
  }
  state.isRenaming = false;
  renderAvatars();
  renderHero();
}

btnRenameSave.addEventListener('click', commitRename);
avatarRenameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    commitRename();
  } else if (e.key === 'Escape') {
    state.isRenaming = false;
    renderCustomAvatarActions();
  }
});

// Remove actions
btnRemoveAvatar.addEventListener('click', () => {
  state.isConfirmingDelete = true;
  state.isRenaming = false;
  renderCustomAvatarActions();
});

btnCancelDelete.addEventListener('click', () => {
  state.isConfirmingDelete = false;
  renderCustomAvatarActions();
});

btnConfirmDelete.addEventListener('click', async () => {
  const targetId = state.avatarId;
  try {
    await tauri.core.invoke('delete_avatar', { avatarId: targetId });
    state.avatarId = 'drippy';
    state.avatarName = 'Drippy';
    state.isConfirmingDelete = false;
    await loadAvatars();
    renderAvatars();
    renderHero();
  } catch (e) {
    avatarError.textContent = 'Could not remove avatar: ' + e;
    avatarError.style.display = 'block';
  }
});

// File upload handling
avatarFileInput.addEventListener('change', async () => {
  const file = avatarFileInput.files && avatarFileInput.files[0];
  avatarFileInput.value = '';
  if (!file) return;

  if (file.type !== 'image/png') {
    avatarError.textContent = 'Please pick a PNG image — a transparent background works best.';
    avatarError.style.display = 'block';
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    avatarError.textContent = 'That image is a bit too big — please pick one under 4 MB.';
    avatarError.style.display = 'block';
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
    const uploaded = await tauri.core.invoke('upload_avatar', { name, data: btoa(bin) });
    await loadAvatars();
    await pickAvatar(uploaded);
  } catch (e) {
    avatarError.textContent = 'Could not add avatar: ' + e;
    avatarError.style.display = 'block';
  }
});

async function loadAvatars() {
  try {
    state.avatars = await tauri.core.invoke('get_avatar_list');
    const match = state.avatars.find(a => a.id === state.avatarId);
    if (match) {
      state.avatarName = match.name;
    } else {
      state.avatarId = 'drippy';
      state.avatarName = 'Drippy';
    }
  } catch (e) {
    console.error('Failed to load avatars:', e);
  }
}

// ---------- Live Status Sync ----------
function applyStatus(s) {
  state.paused = s.paused;
  state.intervalMin = s.intervalMin;
  state.nextReminderAt = s.nextReminderAt;
  state.reminderVisible = s.reminderVisible;
  state.avatarName = s.avatarName;

  renderHero();
  renderIntervals();
}

async function refreshStatus() {
  try {
    const s = await tauri.core.invoke('get_status');
    applyStatus(s);
  } catch (e) {
    console.error('Failed to refresh status:', e);
  }
}

// Listen for status changes from Rust (tray pause, timer schedule, avatar change, etc.)
tauri.event.listen('status-changed', (e) => {
  if (e.payload) {
    applyStatus(e.payload);
  } else {
    refreshStatus();
  }
});

// ---------- Initialization ----------
async function init() {
  try {
    const s = await tauri.core.invoke('get_settings');
    state.intervalMin = s.intervalMin;
    state.avatarId = s.avatarId || 'drippy';
    state.paused = s.paused;
    state.theme = s.theme || 'system';
    state.sound = s.sound !== false;
    state.autostart = !!s.autostart;
    state.isDev = !!s.isDev;

    state.version = s.version;
    if (s.version) {
      footerVersion.textContent = `DrinkUp v${s.version}`;
    }

    soundToggle.checked = state.sound;

    if (state.isDev) {
      autostartToggle.disabled = true;
      autostartToggle.checked = false;
      autostartSub.textContent = 'Disabled in dev mode';
    } else {
      autostartToggle.disabled = false;
      autostartToggle.checked = state.autostart;
      autostartSub.textContent = 'Launch DrinkUp on startup';
    }

    updateThemeRadios();
  } catch (e) {
    console.error('Failed to get settings:', e);
  }

  await loadAvatars();
  await refreshStatus();
  renderIntervals();
  renderAvatars();

  // Dynamic version resolution if not already set
  if (!state.version) {
    try {
      if (tauri.app && tauri.app.getVersion) {
        const ver = await tauri.app.getVersion();
        if (ver) footerVersion.textContent = `DrinkUp v${ver}`;
      } else {
        const ver = await tauri.core.invoke('get_app_version');
        if (ver) footerVersion.textContent = `DrinkUp v${ver}`;
      }
    } catch (e) {
      try {
        const ver = await tauri.core.invoke('get_app_version');
        if (ver) footerVersion.textContent = `DrinkUp v${ver}`;
      } catch (err) {}
    }
  }

  // GitHub Link
  const footerGithub = document.getElementById('footer-github');
  if (footerGithub) {
    footerGithub.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await tauri.core.invoke('open_url', { url: 'https://github.com/aadityasamani/drinkup' });
      } catch (err) {
        window.open('https://github.com/aadityasamani/drinkup', '_blank');
      }
    });
  }
}

init();
