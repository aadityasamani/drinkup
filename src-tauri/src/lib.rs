use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::image::Image;
use tauri::menu::{Menu, MenuBuilder, MenuEvent, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

const WIN_HEIGHT: u32 = 300;
const WIN_WIDTH: u32 = 520;

#[derive(Serialize, Deserialize, Clone)]
struct Settings {
    #[serde(default = "default_interval")]
    interval_min: u64,
    #[serde(default = "default_true")]
    first_run: bool,
    #[serde(default = "default_avatar")]
    avatar_id: String,
    #[serde(default)]
    dark_mode: bool,
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

impl Default for Settings {
    fn default() -> Self {
        Settings {
            interval_min: 45,
            first_run: true,
            avatar_id: default_avatar(),
            dark_mode: false,
        }
    }
}

struct AppState {
    settings: Mutex<Settings>,
    paused: Mutex<bool>,
    reminder_visible: Mutex<bool>,
    // Bumped every time the schedule changes; pending timers check it before firing.
    generation: AtomicU64,
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
    std::fs::read_to_string(settings_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
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

// ---------- reminder flow ----------

// Position the overlay at the bottom-right of the screen, click-through on.
fn set_walk_mode(w: &tauri::WebviewWindow) {
    if let Ok(Some(m)) = w.current_monitor() {
        let size = m.size();
        let pos = m.position();
        let win_w = WIN_WIDTH;
        let x = pos.x + (size.width.saturating_sub(win_w)) as i32;
        let y = pos.y + (size.height.saturating_sub(WIN_HEIGHT)) as i32;
        let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
        let _ = w.set_size(tauri::PhysicalSize::new(win_w, WIN_HEIGHT));
    }
    let _ = w.set_ignore_cursor_events(true);
}

// Just toggle click-through off — window stays in place.
fn set_interactive_mode(w: &tauri::WebviewWindow) {
    let _ = w.set_ignore_cursor_events(false);
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
    }
    let url = avatar_data_uri(app, &avatar);
    let payload = Payload {
        demo,
        interval_min: settings.interval_min,
        dark_mode: settings.dark_mode,
        avatar: AvatarInfo {
            name: avatar.name,
            url,
        },
    };

    if let Some(w) = app.get_webview_window("main") {
        // 1. Position the window off-screen correctly.
        set_walk_mode(&w);
        // 2. Show the window so it is visible when the event fires.
        let _ = w.show();
    }

    // 3. Give the OS one frame (~17 ms) to composite the window at its new
    //    position, then fire the event so JS animates into an already-visible,
    //    correctly-placed window.
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
    // Give the exit animation (happy hop + walk off) time to play before hiding.
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(3900)).await;
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
}

fn schedule(app: &AppHandle) {
    let state = app.state::<AppState>();
    let gen = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    if *state.paused.lock().unwrap() {
        return;
    }
    let interval = state.settings.lock().unwrap().interval_min;
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
    // Force a fresh start: hide first, center, then show.
    let _ = w.hide();
    let _ = w.center();
    let _ = w.show();
    let _ = w.set_focus();
    // Retry once after a short delay — Windows can silently drop the first show().
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(120)).await;
        if let Some(w) = handle.get_webview_window("settings") {
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
        if interactive {
            set_interactive_mode(&w);
        } else {
            set_walk_mode(&w);
        }
    }
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
fn get_settings(app: AppHandle) -> SettingsDto {
    let state = app.state::<AppState>();
    let s = state.settings.lock().unwrap().clone();
    let paused = *state.paused.lock().unwrap();
    SettingsDto {
        interval_min: s.interval_min,
        avatar_id: s.avatar_id,
        paused,
        dark_mode: s.dark_mode,
    }
}

#[tauri::command]
fn set_interval(app: AppHandle, minutes: u64) {
    {
        let state = app.state::<AppState>();
        state.settings.lock().unwrap().interval_min = minutes;
    }
    save_settings(&app);
    refresh_menu(&app);
    schedule(&app);
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
    Ok(())
}

#[tauri::command]
fn set_dark_mode(app: AppHandle, dark: bool) {
    {
        let state = app.state::<AppState>();
        state.settings.lock().unwrap().dark_mode = dark;
    }
    save_settings(&app);
    let _ = app.emit("theme-changed", dark);
}

// ---------- boot ----------

pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            settings: Mutex::new(Settings::default()),
            paused: Mutex::new(false),
            reminder_visible: Mutex::new(false),
            generation: AtomicU64::new(0),
        })
        .setup(|app| {
            let handle = app.handle().clone();

            // Load persisted settings.
            let loaded = load_settings(&handle);
            {
                let state = app.state::<AppState>();
                *state.settings.lock().unwrap() = loaded;
            }

            // (theme is sent as part of each show-reminder payload instead,
            //  since this emit fires before the webview JS has loaded.)

            // Size and hide the overlay window. The webview warms up lazily;
            // the #stage opacity:0 CSS guard ensures nothing flashes on first show.
            if let Some(w) = app.get_webview_window("main") {
                set_walk_mode(&w);
                let _ = w.hide();
            }

            // Create the settings window (hidden by default).
            if let Some(w) = app.get_webview_window("settings") {
                let _ = w.hide();
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
            set_interval,
            toggle_pause,
            remind_now,
            get_avatar_list,
            get_current_avatar,
            set_avatar,
            upload_avatar,
            delete_avatar,
            rename_avatar,
            set_dark_mode
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
