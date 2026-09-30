use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub const WINDOW_LABEL: &str = "video-adjust-popover";

/// Bumped on every show/keep-alive call; a pending hide only actually hides
/// the window if this hasn't changed since it was scheduled. This lets the
/// hover state be coordinated across two separate windows (the trigger
/// button in the main window, and the popover's own content) purely through
/// Rust, without either side needing to know about the other's DOM.
static GENERATION: AtomicU64 = AtomicU64::new(0);

fn get_or_create_window(
    app: &AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        window.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)))
            .map_err(|e| e.to_string())?;
        window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
            .map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title("Video Adjustments")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .resizable(false)
        // Shown on hover, so it must not take keyboard focus away from the
        // player: doing so left Space/arrow-key shortcuts dead after merely
        // hovering the button, and in fullscreen made Windows bring the
        // taskbar back over the video. Clicking a slider still activates it
        // normally (and the popover hands focus straight back on release).
        .focused(false)
        .position(x, y)
        .inner_size(width, height)
        .visible(true)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Shown by the main window's trigger button. Positions/resizes the overlay
/// (in logical pixels, main-window-relative math done on the JS side) and
/// cancels any pending hide.
#[tauri::command]
pub async fn show_video_adjust_popover(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    get_or_create_window(&app, x, y, width, height)
}

/// Called by the popover's own content on mouseenter, so moving the pointer
/// from the trigger button into the popover doesn't let a pending hide fire.
#[tauri::command]
pub async fn keep_video_adjust_popover_open() -> Result<(), String> {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    Ok(())
}

/// Schedules a hide after a short grace period, giving the pointer time to
/// travel from the trigger button to the popover (or back) without it
/// flickering shut in between.
#[tauri::command]
pub async fn request_hide_video_adjust_popover(app: AppHandle) -> Result<(), String> {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    tokio::time::sleep(Duration::from_millis(220)).await;
    if GENERATION.load(Ordering::SeqCst) != generation {
        return Ok(());
    }
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
