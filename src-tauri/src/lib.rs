use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::image::Image;
use tauri::menu::{Menu, MenuBuilder, MenuEvent, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

// Reminder overlay size in logical pixels, scaled per monitor so it looks the same at any
// display scale. Keep in sync with the "main" window in tauri.conf.json.
const OVERLAY_WIDTH: f64 = 560.0;
const OVERLAY_HEIGHT: f64 = 340.0;
// How long the renderer's exit animation runs before the overlay is hidden.
const EXIT_ANIMATION_MS: u64 = 1800;

#[derive(Serialize, Deserialize, Clone)]
struct Settings {
    #[serde(default = "default_interval")]
    interval_min: u64,
    #[serde(default = "default_true")]
    first_run: bool,
    #[serde(default = "default_avatar")]
    avatar_id: String,
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default = "default_true")]
    sound: bool,
    #[serde(default, skip_serializing)]
    dark_mode: Option<bool>,
}

fn default_interval() -> u64 {
    45
}
fn default_true() -> bool {
    true
}
fn default_avatar() -> String {
    "drippy".to_string()
}
fn default_theme() -> String {
    "system".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            interval_min: 45,
            first_run: true,
            avatar_id: default_avatar(),
            theme: default_theme(),
            sound: true,
            dark_mode: None,
        }
    }
}

struct AppState {
    settings: Mutex<Settings>,
    paused: Mutex<bool>,
    reminder_visible: Mutex<bool>,
    next_reminder_at: Mutex<Option<SystemTime>>,
    // Bumped every time the schedule changes; pending timers check it before firing.
    generation: AtomicU64,
    // Bumped every time a reminder is shown; delayed hides and keep-on-top loops left
    // over from an earlier reminder check it so they leave the current one alone.
    reminder_session: AtomicU64,
}

// ---------- autostart (Windows registry) ----------

#[cfg(target_os = "windows")]
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(target_os = "windows")]
const APP_NAME: &str = "DrinkUp";

fn is_autostart_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey(RUN_KEY) {
            let val: Result<String, _> = key.get_value(APP_NAME);
            return val.is_ok();
        }
    }
    false
}

fn set_autostart_registry(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu.create_subkey(RUN_KEY).map_err(|e| e.to_string())?;
        if enabled {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let cmd = format!("\"{}\" --autostart", exe.to_string_lossy());
            key.set_value(APP_NAME, &cmd).map_err(|e| e.to_string())?;
        } else {
            let _ = key.delete_value(APP_NAME);
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enabled;
        Ok(())
    }
}

// ---------- settings persistence ----------

fn settings_path(app: &AppHandle) -> std::path::PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let _ = std::fs::create_dir_all(&dir);
    dir.join("settings.json")
}

fn avatars_dir(app: &AppHandle) -> std::path::PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let avatars_dir = dir.join("avatars");
    let _ = std::fs::create_dir_all(&avatars_dir);
    avatars_dir
}

fn load_settings(app: &AppHandle) -> Settings {
    let mut s: Settings = std::fs::read_to_string(settings_path(app))
        .ok()
        .and_then(|str| serde_json::from_str(&str).ok())
        .unwrap_or_default();
    if let Some(dm) = s.dark_mode {
        if s.theme == "system" {
            s.theme = if dm { "dark".to_string() } else { "light".to_string() };
        }
        s.dark_mode = None;
    }
    s
}

fn save_settings(app: &AppHandle) {
    let state = app.state::<AppState>();
    let settings = state.settings.lock().unwrap().clone();
    if let Ok(json) = serde_json::to_string_pretty(&settings) {
        let _ = std::fs::write(settings_path(app), json);
    }
}

// ---------- avatar storage ----------

#[derive(Serialize, Deserialize, Clone)]
struct Avatar {
    id: String,
    name: String,
    /// PNG file name inside the avatars dir. `None` for built-in avatars.
    #[serde(default)]
    file: Option<String>,
}

// Built-in avatar
fn drippy_avatar() -> Avatar {
    Avatar {
        id: "drippy".to_string(),
        name: "Drippy".to_string(),
        file: None,
    }
}

fn default_avatars() -> Vec<Avatar> {
    vec![drippy_avatar()]
}

/// Base64 data URI for a custom avatar's PNG image.
fn avatar_data_uri(app: &AppHandle, avatar: &Avatar) -> Option<String> {
    use base64::Engine;
    let file = avatar.file.as_ref()?;
    let bytes = std::fs::read(avatars_dir(app).join(file)).ok()?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:image/png;base64,{}", b64))
}

fn get_avatar(app: &AppHandle, avatar_id: &str) -> Option<Avatar> {
    if avatar_id == "drippy" {
        return Some(drippy_avatar());
    }
    let dir = avatars_dir(app);
    let content = std::fs::read_to_string(dir.join(format!("{}.json", avatar_id))).ok()?;
    let avatar: Avatar = serde_json::from_str(&content).ok()?;
    // Only report the avatar if its image is still on disk.
    if avatar.file.as_ref().is_some_and(|f| dir.join(f).exists()) {
        Some(avatar)
    } else {
        None
    }
}

/// Create the avatars directory if it doesn't exist.
fn ensure_avatar_dir(app: &AppHandle) -> std::path::PathBuf {
    let dir = avatars_dir(app);
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn save_avatar(app: &AppHandle, avatar: &Avatar) -> Result<(), String> {
    let dir = ensure_avatar_dir(app);
    let avatar_file = dir.join(format!("{}.json", avatar.id));
    let json = serde_json::to_string_pretty(avatar).map_err(|e| e.to_string())?;
    std::fs::write(avatar_file, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn list_avatars(app: &AppHandle) -> Vec<Avatar> {
    let mut result = default_avatars();
    let dir = avatars_dir(app);
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(avatar) = serde_json::from_str::<Avatar>(&content) {
                    if avatar.file.as_ref().is_some_and(|f| dir.join(f).exists()) {
                        result.push(avatar);
                    }
                }
            }
        }
    }
    result
}

// ---------- live status and window theme ----------

#[derive(Serialize, Clone)]
struct StatusDto {
    paused: bool,
    #[serde(rename = "intervalMin")]
    interval_min: u64,
    #[serde(rename = "nextReminderAt")]
    next_reminder_at: Option<u64>,
    #[serde(rename = "reminderVisible")]
    reminder_visible: bool,
    #[serde(rename = "avatarName")]
    avatar_name: String,
}

fn current_status(app: &AppHandle) -> StatusDto {
    let state = app.state::<AppState>();
    let settings = state.settings.lock().unwrap().clone();
    let paused = *state.paused.lock().unwrap();
    let reminder_visible = *state.reminder_visible.lock().unwrap();
    let next_reminder_at = state.next_reminder_at.lock().unwrap().and_then(|t| {
        t.duration_since(UNIX_EPOCH).ok().map(|d| d.as_millis() as u64)
    });
    let avatar = get_avatar(app, &settings.avatar_id).unwrap_or_else(drippy_avatar);
    StatusDto {
        paused,
        interval_min: settings.interval_min,
        next_reminder_at,
        reminder_visible,
        avatar_name: avatar.name,
    }
}

fn emit_status_changed(app: &AppHandle) {
    let status = current_status(app);
    let _ = app.emit("status-changed", status);
}

fn apply_window_theme(app: &AppHandle, theme_str: &str) {
    let theme_opt = match theme_str {
        "light" => Some(tauri::Theme::Light),
        "dark" => Some(tauri::Theme::Dark),
        _ => None,
    };
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.set_theme(theme_opt);
    }
}

// ---------- reminder flow ----------

/// The monitor the user is working on: the one under the mouse, else the primary one.
fn active_monitor(app: &AppHandle) -> Option<tauri::Monitor> {
    app.cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten())
}

/// Pin the overlay to the bottom-right corner of the active monitor's work area, so it
/// sits above the taskbar, at the same logical size on every display scale.
fn place_overlay(app: &AppHandle, w: &tauri::WebviewWindow) {
    let Some(m) = active_monitor(app) else {
        return;
    };
    let scale = m.scale_factor();
    let width = (OVERLAY_WIDTH * scale).round() as u32;
    let height = (OVERLAY_HEIGHT * scale).round() as u32;
    let area = m.work_area();
    let pos = tauri::PhysicalPosition::new(
        area.position.x + area.size.width.saturating_sub(width) as i32,
        area.position.y + area.size.height.saturating_sub(height) as i32,
    );
    let _ = w.set_position(pos);
    let _ = w.set_size(tauri::PhysicalSize::new(width, height));
    // If the move crossed onto a monitor with a different scale, the DPI change resizes
    // the window and can shift it, so set the position again once the size is final.
    let _ = w.set_position(pos);
}

/// Raise the overlay to the top of the always-on-top band without activating it.
///
/// `set_always_on_top(true)` can't do this: tao only calls `SetWindowPos(HWND_TOPMOST)`
/// when that flag changes, so on a window that's already always-on-top it's a no-op and
/// never lifts the overlay back above windows that came up since it was last shown.
#[cfg(target_os = "windows")]
fn raise_overlay(w: &tauri::WebviewWindow) {
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE,
    };
    if let Ok(hwnd) = w.hwnd() {
        unsafe {
            let _ = SetWindowPos(
                hwnd,
                Some(HWND_TOPMOST),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn raise_overlay(w: &tauri::WebviewWindow) {
    let _ = w.set_always_on_top(true);
}

/// Raise the overlay from the main thread, after any window changes already queued there
/// (tauri applies `show()` and click-through changes on the main thread too).
fn raise_overlay_soon(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(w) = handle.get_webview_window("main") {
            raise_overlay(&w);
        }
    });
}

/// Keep re-raising the overlay while this reminder is on screen, so an always-on-top app,
/// a taskbar flyout or anything else that comes up afterwards doesn't bury it.
fn keep_on_top(app: &AppHandle, session: u64) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        // A few quick passes while the show and click-through changes land, then a slow heartbeat.
        for delay in [60, 250, 800].into_iter().chain(std::iter::repeat(1000)) {
            tokio::time::sleep(Duration::from_millis(delay)).await;
            let state = app.state::<AppState>();
            if state.reminder_session.load(Ordering::SeqCst) != session
                || !*state.reminder_visible.lock().unwrap()
            {
                break;
            }
            raise_overlay_soon(&app);
        }
    });
}

fn show_reminder(app: &AppHandle, demo: bool) {
    let state = app.state::<AppState>();
    {
        let mut visible = state.reminder_visible.lock().unwrap();
        if *visible {
            return;
        }
        *visible = true;
    }
    *state.next_reminder_at.lock().unwrap() = None;
    emit_status_changed(app);

    let session = state.reminder_session.fetch_add(1, Ordering::SeqCst) + 1;
    let settings = state.settings.lock().unwrap().clone();
    let avatar = get_avatar(app, &settings.avatar_id).unwrap_or_else(drippy_avatar);

    #[derive(Serialize, Clone)]
    struct AvatarInfo {
        name: String,
        url: Option<String>,
    }
    #[derive(Serialize, Clone)]
    struct Payload {
        demo: bool,
        #[serde(rename = "intervalMin")]
        interval_min: u64,
        avatar: AvatarInfo,
        #[serde(rename = "darkMode")]
        dark_mode: bool,
        theme: String,
        sound: bool,
    }
    let url = avatar_data_uri(app, &avatar);
    let is_dark = match settings.theme.as_str() {
        "dark" => true,
        "light" => false,
        _ => {
            app.get_webview_window("settings")
                .and_then(|w| w.theme().ok())
                .map(|t| matches!(t, tauri::Theme::Dark))
                .unwrap_or(false)
        }
    };
    let payload = Payload {
        demo,
        interval_min: settings.interval_min,
        dark_mode: is_dark,
        theme: settings.theme.clone(),
        sound: settings.sound,
        avatar: AvatarInfo {
            name: avatar.name,
            url,
        },
    };

    if let Some(w) = app.get_webview_window("main") {
        place_overlay(app, &w);
        let _ = w.set_ignore_cursor_events(true);
        let _ = w.show();
    }
    raise_overlay_soon(app);
    keep_on_top(app, session);

    // Give the OS one frame (~17 ms) to composite the window at its new
    // position, then fire the event so JS animates into an already-visible,
    // correctly-placed window.
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(20)).await;
        let _ = app2.emit("show-reminder", payload);
    });
}

fn close_reminder(app: &AppHandle) {
    let state = app.state::<AppState>();
    {
        let mut visible = state.reminder_visible.lock().unwrap();
        if !*visible {
            return;
        }
        *visible = false;
    }
    emit_status_changed(app);

    // Let the exit animation play before hiding. Skip the hide if another reminder has
    // been shown in the meantime, or it would vanish as soon as it appears.
    let session = state.reminder_session.load(Ordering::SeqCst);
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(EXIT_ANIMATION_MS)).await;
        if app2.state::<AppState>().reminder_session.load(Ordering::SeqCst) != session {
            return;
        }
        if let Some(w) = app2.get_webview_window("main") {
            let _ = w.set_ignore_cursor_events(true);
            let _ = w.hide();
        }
    });
    schedule(app);
}

fn cancel_pending(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.generation.fetch_add(1, Ordering::SeqCst);
    *state.next_reminder_at.lock().unwrap() = None;
    emit_status_changed(app);
}

fn schedule(app: &AppHandle) {
    let state = app.state::<AppState>();
    let gen = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    if *state.paused.lock().unwrap() {
        *state.next_reminder_at.lock().unwrap() = None;
        emit_status_changed(app);
        return;
    }
    let interval = state.settings.lock().unwrap().interval_min;
    let next = SystemTime::now() + Duration::from_secs(interval * 60);
    *state.next_reminder_at.lock().unwrap() = Some(next);
    emit_status_changed(app);

    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(interval * 60)).await;
        let st = app2.state::<AppState>();
        if st.generation.load(Ordering::SeqCst) == gen
            && !*st.paused.lock().unwrap()
            && !*st.reminder_visible.lock().unwrap()
        {
            show_reminder(&app2, false);
        }
    });
}

// ---------- tray menu ----------

fn interval_label(min: u64) -> String {
    match min {
        1 => "1 minute".to_string(),
        60 => "1 hour".to_string(),
        120 => "2 hours".to_string(),
        n if n % 60 == 0 => format!("{} hours", n / 60),
        n => format!("{n} minutes"),
    }
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let state = app.state::<AppState>();
    let interval = state.settings.lock().unwrap().interval_min;
    let paused = *state.paused.lock().unwrap();

    let header = MenuItemBuilder::with_id(
        "hdr",
        format!("DrinkUp · every {}", interval_label(interval)),
    )
    .enabled(false)
    .build(app)?;

    let open_settings = MenuItemBuilder::with_id("open-settings", "Open Settings…").build(app)?;
    let remind_now = MenuItemBuilder::with_id("remind-now", "Remind now").build(app)?;
    let pause = MenuItemBuilder::with_id(
        "pause",
        if paused {
            "Resume reminders"
        } else {
            "Pause reminders"
        },
    )
    .build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    MenuBuilder::with_id(app, "tray-menu")
        .item(&header)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&open_settings)
        .item(&remind_now)
        .item(&pause)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&quit)
        .build()
}

fn refresh_menu(app: &AppHandle) {
    if let Ok(menu) = build_menu(app) {
        if let Some(tray) = app.tray_by_id("tray") {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

fn open_settings_window(app: &AppHandle) {
    let Some(w) = app.get_webview_window("settings") else {
        return;
    };
    let theme = {
        let state = app.state::<AppState>();
        let t = state.settings.lock().unwrap().theme.clone();
        t
    };
    apply_window_theme(app, &theme);
    emit_status_changed(app);

    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_focus();
    // Retry once after a short delay — Windows can silently drop the first show().
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(120)).await;
        if let Some(w) = handle.get_webview_window("settings") {
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
        }
    });
}

fn toggle_pause_state(app: &AppHandle) -> bool {
    let now_paused = {
        let state = app.state::<AppState>();
        let mut p = state.paused.lock().unwrap();
        *p = !*p;
        *p
    };
    if now_paused {
        cancel_pending(app);
    } else {
        schedule(app);
    }
    refresh_menu(app);
    emit_status_changed(app);
    now_paused
}

fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    let id = event.id().0.clone();
    match id.as_str() {
        "open-settings" => open_settings_window(app),
        "remind-now" => show_reminder(app, false),
        "pause" => {
            toggle_pause_state(app);
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

// ---------- commands from the frontend ----------

#[tauri::command]
fn reminder_result(app: AppHandle, result: String) {
    println!("reminder result: {result}");
    close_reminder(&app);
}

#[tauri::command]
fn set_interactive(app: AppHandle, interactive: bool) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_ignore_cursor_events(!interactive);
    }
    // tao re-shows the window whenever it restyles it, so put our z-order back on top.
    raise_overlay_soon(&app);
}

// ---------- settings commands ----------

#[derive(Serialize)]
struct SettingsDto {
    #[serde(rename = "intervalMin")]
    interval_min: u64,
    #[serde(rename = "avatarId")]
    avatar_id: String,
    paused: bool,
    #[serde(rename = "darkMode")]
    dark_mode: bool,
    theme: String,
    sound: bool,
    autostart: bool,
    #[serde(rename = "isDev")]
    is_dev: bool,
    version: String,
}

#[tauri::command]
fn open_settings(app: AppHandle) {
    open_settings_window(&app);
}

#[tauri::command]
fn close_settings(app: AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.hide();
    }
}

#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn get_status(app: AppHandle) -> StatusDto {
    current_status(&app)
}

#[tauri::command]
fn get_settings(app: AppHandle) -> SettingsDto {
    let state = app.state::<AppState>();
    let s = state.settings.lock().unwrap().clone();
    let paused = *state.paused.lock().unwrap();
    let is_dark = match s.theme.as_str() {
        "dark" => true,
        "light" => false,
        _ => {
            app.get_webview_window("settings")
                .and_then(|w| w.theme().ok())
                .map(|t| matches!(t, tauri::Theme::Dark))
                .unwrap_or(false)
        }
    };
    SettingsDto {
        interval_min: s.interval_min,
        avatar_id: s.avatar_id,
        paused,
        dark_mode: is_dark,
        theme: s.theme,
        sound: s.sound,
        autostart: is_autostart_enabled(),
        is_dev: cfg!(debug_assertions),
        version: app.package_info().version.to_string(),
    }
}

#[tauri::command]
fn set_interval(app: AppHandle, minutes: u64) {
    let minutes = minutes.clamp(1, 120);
    {
        let state = app.state::<AppState>();
        state.settings.lock().unwrap().interval_min = minutes;
    }
    save_settings(&app);
    refresh_menu(&app);
    schedule(&app);
    emit_status_changed(&app);
}

#[tauri::command]
fn set_theme(app: AppHandle, theme: String) {
    {
        let state = app.state::<AppState>();
        state.settings.lock().unwrap().theme = theme.clone();
    }
    save_settings(&app);
    apply_window_theme(&app, &theme);
    let is_dark = match theme.as_str() {
        "dark" => true,
        "light" => false,
        _ => {
            app.get_webview_window("settings")
                .and_then(|w| w.theme().ok())
                .map(|t| matches!(t, tauri::Theme::Dark))
                .unwrap_or(false)
        }
    };
    let _ = app.emit("theme-changed", theme);
    let _ = app.emit("dark-mode-changed", is_dark);
}

#[tauri::command]
fn set_dark_mode(app: AppHandle, dark: bool) {
    set_theme(app, if dark { "dark".to_string() } else { "light".to_string() });
}

#[tauri::command]
fn set_sound(app: AppHandle, sound: bool) {
    {
        let state = app.state::<AppState>();
        state.settings.lock().unwrap().sound = sound;
    }
    save_settings(&app);
}

#[tauri::command]
fn open_url(url: String) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = url;
    }
}

#[tauri::command]
fn get_autostart() -> bool {
    is_autostart_enabled()
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    set_autostart_registry(enabled)
}

#[tauri::command]
fn toggle_pause(app: AppHandle) -> bool {
    toggle_pause_state(&app)
}

#[tauri::command]
fn remind_now(app: AppHandle) {
    show_reminder(&app, false);
}

// ---------- avatar commands ----------

#[derive(Serialize, Clone)]
struct AvatarDto {
    id: String,
    name: String,
    /// Image URL for custom avatars; `None` for the built-in one.
    url: Option<String>,
}

fn to_dto(app: &AppHandle, avatar: &Avatar) -> AvatarDto {
    AvatarDto {
        id: avatar.id.clone(),
        name: avatar.name.clone(),
        url: avatar_data_uri(app, avatar),
    }
}

#[tauri::command]
fn get_avatar_list(app: AppHandle) -> Vec<AvatarDto> {
    list_avatars(&app).iter().map(|a| to_dto(&app, a)).collect()
}

#[tauri::command]
fn get_current_avatar(app: AppHandle) -> AvatarDto {
    let state = app.state::<AppState>();
    let avatar_id = state.settings.lock().unwrap().avatar_id.clone();
    let avatar = get_avatar(&app, &avatar_id).unwrap_or_else(drippy_avatar);
    to_dto(&app, &avatar)
}

#[tauri::command]
fn set_avatar(app: AppHandle, avatar_id: String) -> Result<(), String> {
    {
        let state = app.state::<AppState>();
        let mut settings = state.settings.lock().unwrap();
        settings.avatar_id = avatar_id;
    }
    save_settings(&app);
    emit_status_changed(&app);
    Ok(())
}

#[tauri::command]
fn upload_avatar(app: AppHandle, name: String, data: String) -> Result<AvatarDto, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|_| "That file could not be read".to_string())?;
    if bytes.len() > 4 * 1024 * 1024 {
        return Err("Image is too large (max 4 MB)".to_string());
    }
    // Make sure it really is a PNG, and keep dimensions sane.
    {
        let decoder = png::Decoder::new(std::io::Cursor::new(&bytes));
        let reader = decoder
            .read_info()
            .map_err(|_| "That file is not a valid PNG image".to_string())?;
        let (w, h) = (reader.info().width, reader.info().height);
        if w > 1024 || h > 1024 {
            return Err("Image is too large (max 1024×1024 pixels)".to_string());
        }
    }
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Please give the avatar a name".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let file_name = format!("{id}.png");
    std::fs::write(avatars_dir(&app).join(&file_name), &bytes)
        .map_err(|e| format!("Could not save the image: {e}"))?;
    let avatar = Avatar {
        id,
        name,
        file: Some(file_name),
    };
    save_avatar(&app, &avatar)?;
    emit_status_changed(&app);
    Ok(to_dto(&app, &avatar))
}

#[tauri::command]
fn delete_avatar(app: AppHandle, avatar_id: String) -> Result<(), String> {
    if avatar_id == "drippy" {
        return Err("Drippy can't be removed".to_string());
    }
    let dir = avatars_dir(&app);
    if let Ok(content) = std::fs::read_to_string(dir.join(format!("{avatar_id}.json"))) {
        if let Ok(avatar) = serde_json::from_str::<Avatar>(&content) {
            if let Some(f) = avatar.file {
                let _ = std::fs::remove_file(dir.join(f));
            }
        }
    }
    let _ = std::fs::remove_file(dir.join(format!("{avatar_id}.json")));
    {
        let state = app.state::<AppState>();
        let mut settings = state.settings.lock().unwrap();
        if settings.avatar_id == avatar_id {
            settings.avatar_id = "drippy".to_string();
        }
    }
    save_settings(&app);
    emit_status_changed(&app);
    Ok(())
}

#[tauri::command]
fn rename_avatar(app: AppHandle, avatar_id: String, name: String) -> Result<(), String> {
    if avatar_id == "drippy" {
        return Err("Drippy can't be renamed".to_string());
    }
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    let dir = avatars_dir(&app);
    let path = dir.join(format!("{avatar_id}.json"));
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Avatar not found: {e}"))?;
    let mut avatar: Avatar =
        serde_json::from_str(&content).map_err(|e| format!("Corrupt avatar data: {e}"))?;
    avatar.name = name;
    let json = serde_json::to_string_pretty(&avatar).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| format!("Could not save: {e}"))?;
    emit_status_changed(&app);
    Ok(())
}

// ---------- boot ----------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            open_settings_window(app);
        }))
        .manage(AppState {
            settings: Mutex::new(Settings::default()),
            paused: Mutex::new(false),
            reminder_visible: Mutex::new(false),
            next_reminder_at: Mutex::new(None),
            generation: AtomicU64::new(0),
            reminder_session: AtomicU64::new(0),
        })
        .setup(|app| {
            let handle = app.handle().clone();

            // Load persisted settings.
            let loaded = load_settings(&handle);
            apply_window_theme(&handle, &loaded.theme);
            {
                let state = app.state::<AppState>();
                *state.settings.lock().unwrap() = loaded;
            }

            // Hide the overlay until the first reminder; it's placed each time it shows.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_ignore_cursor_events(true);
                let _ = w.hide();
            }

            // Prepare settings window.
            if let Some(w) = app.get_webview_window("settings") {
                let _ = w.hide();
            }

            // Check if app was started with --autostart (e.g. on Windows system boot).
            // If started manually (no --autostart flag), show the settings window so
            // the user sees the application UI immediately upon clicking it!
            let is_autostart = std::env::args().any(|arg| {
                arg == "--autostart" || arg == "--minimized" || arg == "--silent"
            });
            if !is_autostart {
                open_settings_window(&handle);
            }

            // Tray icon.
            let menu = build_menu(&handle)?;
            let png_data = include_bytes!("../icons/icon.png");
            let decoder = png::Decoder::new(std::io::Cursor::new(png_data));
            let mut reader = decoder.read_info().expect("failed to decode PNG");
            let mut buf = vec![0; reader.output_buffer_size()];
            let frame_info = reader.next_frame(&mut buf).expect("failed to read PNG frame");
            let rgba = buf[..frame_info.buffer_size()].to_vec();
            let (w, h) = (frame_info.width, frame_info.height);
            TrayIconBuilder::with_id("tray")
                .icon(Image::new_owned(rgba, w, h))
                .tooltip("DrinkUp — stay hydrated")
                .menu(&menu)
                .on_menu_event(|app, event| handle_menu_event(app, event))
                .on_tray_icon_event(|tray, event| {
                    if matches!(event, TrayIconEvent::DoubleClick { id: _, position: _, rect: _, button: _ }) {
                        open_settings_window(&tray.app_handle());
                    }
                })
                .build(app)?;

            // First run: say hello after a few seconds. Otherwise start the countdown.
            let first_run = {
                let state = app.state::<AppState>();
                let first = state.settings.lock().unwrap().first_run;
                if first {
                    state.settings.lock().unwrap().first_run = false;
                }
                first
            };
            if first_run {
                save_settings(&handle);
                // On first run in release builds, enable autostart by default
                if !cfg!(debug_assertions) {
                    let _ = set_autostart_registry(true);
                }
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(6)).await;
                    show_reminder(&handle, true);
                });
            } else {
                schedule(&handle);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            reminder_result,
            set_interactive,
            open_settings,
            close_settings,
            get_settings,
            get_status,
            set_interval,
            get_autostart,
            set_autostart,
            toggle_pause,
            remind_now,
            get_avatar_list,
            get_current_avatar,
            set_avatar,
            upload_avatar,
            delete_avatar,
            rename_avatar,
            set_theme,
            set_sound,
            set_dark_mode,
            open_url,
            get_app_version
        ])
        // Intercept close requests on all windows: hide instead of destroy.
        // The only way to truly quit is via the tray "Quit" menu item.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Water Reminder");
}

