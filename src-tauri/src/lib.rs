mod accent_color;
mod advanced;
mod cache;
mod commands;
mod fullscreen_bar_window;
mod media_info;
mod mpv_ipc;
mod mpv_window;
mod repair;
mod update;
mod video_adjust_window;
mod window_state;
mod window_style;

use commands::MpvState;
use mpv_ipc::MpvHandle;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// The file path Windows passes on the command line when a user double-clicks
/// a media file or launches Aurex Player via "Open With" (see the NSIS file
/// association commands). Captured once at startup and handed to the
/// frontend the first time it asks, since the webview isn't ready to receive
/// an event yet at the point this process starts.
struct PendingOpenPath(Mutex<Option<String>>);

/// Windows passes the associated file as the first real argument after the
/// exe path itself.
fn media_path_from_args(mut args: impl Iterator<Item = String>) -> Option<String> {
    args.next();
    args.next()
}

/// The running mpv sidecar. Dropping a `CommandChild` doesn't end the
/// process, so without this mpv.exe outlived the app after every close -
/// which then blocked the next install/update from replacing mpv.exe
/// ("Error opening file for writing: ...\mpv.exe").
struct MpvProcess(Mutex<Option<CommandChild>>);

fn stop_mpv(app: &tauri::AppHandle) {
    if let Some(child) = app.state::<MpvProcess>().0.lock().unwrap().take() {
        let _ = child.kill();
    }
}

#[tauri::command]
fn take_pending_open_path(state: tauri::State<PendingOpenPath>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Fires in the already-running instance when the user opens
            // another file while Aurex Player is open - Windows launches a
            // second process, which this plugin detects and hands its
            // arguments to us before exiting itself.
            if let Some(path) = media_path_from_args(argv.into_iter()) {
                let _ = app.emit("open-file", path);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(MpvState::default())
        .manage(accent_color::DynamicAccentFlag::default())
        .manage(PendingOpenPath(Mutex::new(media_path_from_args(std::env::args()))))
        .setup(|app| {
            let advanced_config = advanced::load(app.handle());

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            } else if advanced_config.logging_enabled {
                // Off by default in release builds (see Pro Settings) - only
                // turned on when a user explicitly enables it for
                // troubleshooting, writing to the OS-standard app log
                // directory rather than stdout (release builds have no
                // attached console to see it on anyway).
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                            file_name: None,
                        }))
                        .build(),
                )?;
            }

            let window = app.get_webview_window("main").expect("main window missing");

            // Restored before the window is shown (it's created hidden - see
            // tauri.conf.json) so there's never a visible jump from the
            // default geometry to the user's last remembered one.
            window_state::restore(app.handle(), &window);
            let _ = window.show();

            let parent_hwnd = window.hwnd()?.0 as isize;
            let video_hwnd = mpv_window::create_video_surface(app.handle().clone(), parent_hwnd);

            // The video-adjust popover and fullscreen control bar each live
            // in their own window so they can truly overlay the video (see
            // video_adjust_window.rs / fullscreen_bar_window.rs). They're
            // only ever hidden, never destroyed, between shows - so if the
            // main window closes without them, the process would linger
            // with no visible windows. Close them explicitly alongside main.
            let app_handle_for_close = app.handle().clone();
            let window_for_state = window.clone();
            let app_handle_for_state = app.handle().clone();
            window.on_window_event(move |event| match event {
                tauri::WindowEvent::Destroyed => {
                    // mpv renders into this window - nothing left for it to do.
                    stop_mpv(&app_handle_for_close);
                    for label in [video_adjust_window::WINDOW_LABEL, fullscreen_bar_window::WINDOW_LABEL] {
                        if let Some(popover) = app_handle_for_close.get_webview_window(label) {
                            let _ = popover.close();
                        }
                    }
                }
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                    window_state::note_change(app_handle_for_state.clone(), window_for_state.clone());
                }
                _ => {}
            });

            let pipe_name = format!(r"\\.\pipe\aurex-mpv-{}", std::process::id());
            let sidecar = app
                .shell()
                .sidecar("mpv")
                .expect("mpv sidecar binary not found");

            let sidecar_process = sidecar
                .args([
                    // Ignore the user's own mpv.conf/input.conf (if any is
                    // installed system-wide) so the bundled sidecar behaves
                    // consistently regardless of what's on their machine.
                    "--no-config",
                    "--idle=yes",
                    "--keep-open=yes",
                    "--force-window=no",
                    "--osc=no",
                    "--cursor-autohide=no",
                    "--input-default-bindings=no",
                    "--input-vo-keyboard=no",
                    // Falls back to software decoding automatically if the
                    // GPU/driver doesn't support it, so this is safe on any
                    // hardware by default. Without it, mpv defaults to
                    // CPU-only decoding, which struggles on anything beyond
                    // low bitrate video while audio (much cheaper to decode)
                    // keeps playing smoothly - perceived as "video hangs but
                    // audio is fine". Overridable via Pro Settings.
                    &format!("--hwdec={}", advanced_config.hwdec),
                    &format!("--vo={}", advanced_config.vo),
                    &format!("--demuxer-max-bytes={}", advanced_config.demuxer_max_bytes),
                    // On machines without a working GPU driver, mpv's default
                    // vo (gpu-next/libplacebo) still renders via Direct3D 11,
                    // but that falls back to Microsoft's WARP software
                    // rasterizer - so the fancy color-management/scaling
                    // shader passes it runs by default are paid for on the
                    // CPU, on top of the (also CPU-bound) decode. Measured on
                    // such a machine: this profile roughly halves the vo's
                    // CPU cost and eliminated presentation-side frame drops
                    // in repeated back-to-back tests, at an SDR-imperceptible
                    // quality cost (bilinear scaling, no dithering/HDR peak
                    // detection). On machines with real GPU acceleration
                    // these shader passes are effectively free either way, so
                    // this is safe to apply unconditionally.
                    "--profile=fast",
                    // "Continue Watching" is implemented ourselves (see
                    // lib/watchHistory.ts + playerStore's resumePrompt) so
                    // the app can ask "Continue from HH:MM:SS?" instead of
                    // silently resuming - mpv's own equivalent mechanism is
                    // disabled here to avoid the two fighting over where
                    // playback starts.
                    "--resume-playback=no",
                    &format!("--wid={}", video_hwnd),
                    &format!("--input-ipc-server={}", pipe_name),
                ])
                .spawn()
                .expect("failed to spawn mpv sidecar");
            let (_mpv_events, mpv_child) = sidecar_process;
            app.manage(MpvProcess(Mutex::new(Some(mpv_child))));

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match MpvHandle::connect(&app_handle, &pipe_name, video_hwnd).await {
                    Ok(handle) => {
                        let _ = handle.observe_properties().await;
                        let state = app_handle.state::<MpvState>();
                        *state.lock().await = Some(handle);
                    }
                    Err(err) => {
                        log::error!("failed to connect to mpv IPC pipe: {err}");
                    }
                }
            });

            let accent_flag = app.state::<accent_color::DynamicAccentFlag>().0.clone();
            accent_color::start(app.handle().clone(), accent_flag);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::mpv_open,
            commands::mpv_play,
            commands::mpv_pause,
            commands::mpv_toggle_play_pause,
            commands::mpv_stop,
            commands::mpv_seek,
            commands::mpv_seek_relative,
            commands::mpv_frame_step,
            commands::mpv_set_volume,
            commands::mpv_set_muted,
            commands::mpv_set_speed,
            commands::mpv_set_equalizer,
            commands::mpv_set_video_property,
            commands::mpv_set_pro_property,
            commands::mpv_resize_surface,
            commands::mpv_set_surface_exclusion,
            commands::mpv_set_surface_dim,
            commands::list_media_files,
            media_info::get_media_info,
            video_adjust_window::show_video_adjust_popover,
            video_adjust_window::keep_video_adjust_popover_open,
            video_adjust_window::request_hide_video_adjust_popover,
            fullscreen_bar_window::show_fullscreen_controls,
            fullscreen_bar_window::pulse_fullscreen_controls,
            fullscreen_bar_window::set_fullscreen_controls_suspended,
            fullscreen_bar_window::hide_fullscreen_controls_now,
            cache::get_cache_sizes,
            cache::clear_playback_cache,
            cache::clear_temp_files,
            cache::clear_all_cache,
            window_style::set_window_rounded,
            accent_color::set_dynamic_accent_enabled,
            update::check_for_update,
            update::download_and_install_update,
            repair::reset_window_state,
            advanced::get_advanced_config,
            advanced::set_advanced_config,
            take_pending_open_path,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Covers every way the app ends: closing the window, and the
            // updater's exit right after it launches the installer.
            if let tauri::RunEvent::Exit = event {
                stop_mpv(app);
            }
        });
}
