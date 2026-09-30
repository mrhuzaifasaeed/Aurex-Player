use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub const WINDOW_LABEL: &str = "fullscreen-controls";
const HIDE_DELAY_MS: u64 = 3000;
/// How long the bar's own CSS opacity transition takes (see
/// FullscreenControlsWindow.tsx) - the OS-level window isn't actually hidden
/// until this elapses, so the fade has time to finish playing first.
const FADE_MS: u64 = 200;

/// Bumped on every pulse (mouse movement); a pending auto-hide only fires if
/// this hasn't changed since it was scheduled - the same generation-token
/// pattern used for the video-adjust popover's hover coordination.
static GENERATION: AtomicU64 = AtomicU64::new(0);

/// True while an interaction that must keep the bar on-screen is in progress
/// (cursor over the bar itself, or the video-adjust popover is open) - set by
/// `set_fullscreen_controls_suspended`. Checked right before a scheduled
/// auto-hide actually takes effect, so a pulse followed immediately by
/// "start suspending" can't race into hiding the bar out from under the user.
static SUSPENDED: AtomicBool = AtomicBool::new(false);

/// True between `show_fullscreen_controls` (entering fullscreen) and
/// `hide_fullscreen_controls_now` (leaving it). Pulses, suspends and pending
/// auto-hides are all no-ops outside of that span: a mouse-move or hover
/// event that was already in flight when fullscreen ended must never bring
/// the bar back (or hide the cursor) over the normal windowed player. Held
/// as a lock rather than a bare flag so "check active, then show" can't
/// interleave with "mark inactive, then hide".
static ACTIVE: Mutex<bool> = Mutex::new(false);

fn get_or_create_window(app: &AppHandle, x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)))
            .map_err(|e| e.to_string())?;
        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize::new(width, height)))
            .map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title("Aurex Player Controls")
        .decorations(false)
        // The bar renders as a floating rounded panel (see
        // FullscreenControlsWindow.tsx); everything around it must be
        // see-through rather than an opaque strip of app background - that
        // strip is what used to linger as a band along the bottom edge of
        // the screen, and what flashed while the bar faded out.
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .resizable(false)
        // Never take activation away from the fullscreen main window, not
        // even when first created. tao remembers this for every later
        // `show()` too (SW_SHOWNOACTIVATE). Otherwise showing the bar made
        // it the foreground window: Windows then no longer treated the main
        // window as fullscreen and brought the taskbar edge back along the
        // bottom of the screen, and keyboard shortcuts (Space, Esc, arrows)
        // stopped reaching the player until the video was clicked.
        .focused(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;

    // Positioned in physical pixels after creation rather than through the
    // builder's logical position/size, so the bar lines up exactly with the
    // monitor's bottom edge at any display scaling (no 1px rounding gaps).
    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize::new(width, height)))
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())
}

/// Shows the bar and cursor if hidden, and (re)schedules the 3-second
/// auto-hide from now - shared by `show_fullscreen_controls` (entering
/// fullscreen) and `pulse_fullscreen_controls` (mouse movement, keyboard
/// shortcuts, and clicks/wheel-scrolling while already in fullscreen), so "if
/// nothing happens for 3 seconds, hide" holds from the very moment fullscreen
/// begins, not just from the first interaction. A no-op while `SUSPENDED` is
/// set (cursor is over the bar itself, or another overlay - e.g. the
/// video-adjust popover - needs it kept on-screen); resuming from that state
/// re-arms this same countdown.
fn schedule_auto_hide(app: &AppHandle) {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    crate::mpv_window::set_cursor_hidden(false);

    let app_for_task = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(HIDE_DELAY_MS)).await;
        let still_current =
            || GENERATION.load(Ordering::SeqCst) == generation && !SUSPENDED.load(Ordering::SeqCst);
        {
            let active = ACTIVE.lock().unwrap();
            if !*active || !still_current() {
                return;
            }
            crate::mpv_window::set_cursor_hidden(true);
            if let Some(window) = app_for_task.get_webview_window(WINDOW_LABEL) {
                let _ = window.emit("fullscreen-controls-visibility", false);
            }
        }
        tokio::time::sleep(Duration::from_millis(FADE_MS)).await;
        let active = ACTIVE.lock().unwrap();
        if !*active || !still_current() {
            return;
        }
        if let Some(window) = app_for_task.get_webview_window(WINDOW_LABEL) {
            let _ = window.hide();
        }
    });
}

/// Called once when entering fullscreen: creates/positions the overlay
/// spanning the full width at the bottom of the screen, and starts the same
/// 3-second auto-hide countdown a mouse-move pulse would. All values are in
/// physical pixels (the monitor's own coordinate space).
#[tauri::command]
pub async fn show_fullscreen_controls(
    app: AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    {
        let mut active = ACTIVE.lock().unwrap();
        *active = true;
        SUSPENDED.store(false, Ordering::SeqCst);
        get_or_create_window(&app, x, y, width, height)?;
        if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
            let _ = window.emit("fullscreen-controls-visibility", true);
        }
    }
    schedule_auto_hide(&app);
    Ok(())
}

/// Called on every "something happened" signal - mouse movement (forwarded
/// from the native video surface, or from the bar's own window), a keyboard
/// shortcut, a click, or a wheel-scroll. Shows the bar and cursor if hidden
/// and (re)schedules the 3-second auto-hide from now. Both hide back together
/// on the same timer, so they always stay in sync.
///
/// `window.show()` is called unconditionally rather than guarded behind an
/// `is_visible()` check - a `ShowWindow` call on an already-visible window is
/// a cheap no-op, and gating it on `is_visible()` previously meant that if
/// that query ever reported a stale "still visible" result right after a
/// `hide()` (a real risk with a WebView2-hosted window, where the OS-level
/// visibility flag and the webview's own compositor state can momentarily
/// disagree), the bar would stay actually hidden forever despite the
/// frontend believing it was shown again - exactly the "doesn't reappear"
/// symptom this must never produce.
#[tauri::command]
pub async fn pulse_fullscreen_controls(app: AppHandle) -> Result<(), String> {
    {
        let active = ACTIVE.lock().unwrap();
        if !*active {
            return Ok(());
        }
        if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
            window.show().map_err(|e| e.to_string())?;
            let _ = window.emit("fullscreen-controls-visibility", true);
        }
    }
    schedule_auto_hide(&app);
    Ok(())
}

/// Suspends or resumes the auto-hide countdown - called while the cursor is
/// over the bar itself, or while another overlay that must keep it on-screen
/// (e.g. the video-adjust popover) is open. Suspending cancels any pending
/// hide and guarantees the bar is shown; resuming re-arms the 3-second
/// countdown from that moment, exactly like a fresh pulse. Ignored outside
/// fullscreen, so callers don't need to know whether fullscreen is active.
#[tauri::command]
pub async fn set_fullscreen_controls_suspended(app: AppHandle, suspended: bool) -> Result<(), String> {
    {
        let active = ACTIVE.lock().unwrap();
        if !*active {
            SUSPENDED.store(false, Ordering::SeqCst);
            return Ok(());
        }
        SUSPENDED.store(suspended, Ordering::SeqCst);
        if suspended {
            GENERATION.fetch_add(1, Ordering::SeqCst);
            crate::mpv_window::set_cursor_hidden(false);
            if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
                window.show().map_err(|e| e.to_string())?;
                let _ = window.emit("fullscreen-controls-visibility", true);
            }
            return Ok(());
        }
    }
    schedule_auto_hide(&app);
    Ok(())
}

/// Called when exiting fullscreen entirely: hide immediately, no grace
/// period or fade - fullscreen itself is already ending.
#[tauri::command]
pub async fn hide_fullscreen_controls_now(app: AppHandle) -> Result<(), String> {
    let mut active = ACTIVE.lock().unwrap();
    *active = false;
    GENERATION.fetch_add(1, Ordering::SeqCst);
    SUSPENDED.store(false, Ordering::SeqCst);
    crate::mpv_window::set_cursor_hidden(false);
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
