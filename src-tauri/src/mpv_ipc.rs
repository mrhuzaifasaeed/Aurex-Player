use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
use tokio::sync::{oneshot, Mutex as AsyncMutex};

#[derive(Default)]
struct TickState {
    position: f64,
    duration: f64,
    /// Last value mpv reported for its `pause` property - see the
    /// `file-loaded` handling in `handle_ipc_line` for why this is tracked.
    paused: bool,
}

/// Oneshot senders awaiting a response to a `get_property` request, keyed by
/// the `request_id` sent alongside it - mpv echoes that id back on its
/// response line, letting `handle_ipc_line` route the answer to whichever
/// `get_property` call is waiting for it. Fire-and-forget commands (seek,
/// set_property, etc. via `command()`) don't use this at all.
type PendingRequests = Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>;

pub struct MpvHandle {
    writer: AsyncMutex<tokio::io::WriteHalf<NamedPipeClient>>,
    pub video_hwnd: isize,
    pending: Arc<PendingRequests>,
    next_request_id: AtomicU64,
}

async fn connect_with_retry(pipe_path: &str) -> std::io::Result<NamedPipeClient> {
    for _ in 0..100 {
        match ClientOptions::new().open(pipe_path) {
            Ok(client) => return Ok(client),
            Err(_) => tokio::time::sleep(Duration::from_millis(50)).await,
        }
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::TimedOut,
        "mpv IPC pipe never became available",
    ))
}

impl MpvHandle {
    pub async fn connect(app: &AppHandle, pipe_path: &str, video_hwnd: isize) -> std::io::Result<Self> {
        let client = connect_with_retry(pipe_path).await?;
        let (read_half, write_half) = tokio::io::split(client);

        let app_for_task = app.clone();
        let tick_state = Arc::new(Mutex::new(TickState::default()));
        let pending: Arc<PendingRequests> = Arc::new(Mutex::new(HashMap::new()));
        let pending_for_task = pending.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(read_half).lines();
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => handle_ipc_line(&app_for_task, &tick_state, &pending_for_task, &line),
                    Ok(None) | Err(_) => break,
                }
            }
        });

        Ok(Self {
            writer: AsyncMutex::new(write_half),
            video_hwnd,
            pending,
            next_request_id: AtomicU64::new(1),
        })
    }

    pub async fn command(&self, args: Vec<Value>) -> std::io::Result<()> {
        let payload = json!({ "command": args });
        let mut line = payload.to_string();
        line.push('\n');
        let mut writer = self.writer.lock().await;
        writer.write_all(line.as_bytes()).await
    }

    /// Sends an arbitrary mpv command and waits for its actual response,
    /// unlike `command()` which is fire-and-forget. Shared by `get_property`
    /// and `screenshot_raw` - both just need "send one command, correlate the
    /// response by request_id" over the same always-open IPC pipe.
    async fn request(&self, args: Vec<Value>, timeout: Duration, timeout_msg: &str) -> Result<Value, String> {
        let id = self.next_request_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().unwrap().insert(id, tx);

        let payload = json!({ "command": args, "request_id": id });
        let mut line = payload.to_string();
        line.push('\n');
        {
            let mut writer = self.writer.lock().await;
            if let Err(err) = writer.write_all(line.as_bytes()).await {
                self.pending.lock().unwrap().remove(&id);
                return Err(err.to_string());
            }
        }

        match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err("mpv IPC channel closed before responding".to_string()),
            Err(_) => {
                self.pending.lock().unwrap().remove(&id);
                Err(timeout_msg.to_string())
            }
        }
    }

    /// Queries an mpv property and waits for its actual value. Used by the
    /// Media Info panel to read things like resolution/codec/bitrate/HDR
    /// metadata that only mpv knows (no ffprobe is bundled), and by the
    /// Dynamic Accent Color sampler to read `vf-metadata/<label>`.
    pub async fn get_property(&self, name: &str) -> Result<Value, String> {
        self.request(
            vec![json!("get_property"), json!(name)],
            Duration::from_secs(2),
            &format!("timed out waiting for mpv property '{name}'"),
        )
        .await
    }

    /// Fire-and-forget property set (volume, speed, filter chains, etc.) -
    /// thin wrapper over `command()` for call sites that only ever set
    /// properties, so they don't have to spell out the two-element command
    /// array themselves.
    pub async fn set_property(&self, name: &str, value: Value) -> std::io::Result<()> {
        self.command(vec![json!("set_property"), json!(name), value]).await
    }

    pub async fn observe_properties(&self) -> std::io::Result<()> {
        for (id, name) in [
            (1, "time-pos"),
            (2, "duration"),
            (3, "pause"),
            (4, "core-idle"),
            (5, "eof-reached"),
        ] {
            self.command(vec![json!("observe_property"), json!(id), json!(name)])
                .await?;
        }
        Ok(())
    }
}

fn handle_ipc_line(app: &AppHandle, tick_state: &Arc<Mutex<TickState>>, pending: &Arc<PendingRequests>, line: &str) {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return;
    };

    // A response to a `get_property` call made via that method above - route
    // it to the waiting oneshot instead of falling through to the general
    // event/error handling below, which is only for the observe_property
    // event stream and fire-and-forget command errors.
    if let Some(request_id) = value.get("request_id").and_then(Value::as_u64) {
        if let Some(sender) = pending.lock().unwrap().remove(&request_id) {
            let result = if value.get("error").and_then(Value::as_str) == Some("success") {
                Ok(value.get("data").cloned().unwrap_or(Value::Null))
            } else {
                Err(value
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown mpv error")
                    .to_string())
            };
            let _ = sender.send(result);
        }
        return;
    }

    if let Some(event) = value.get("event").and_then(Value::as_str) {
        match event {
            "property-change" => {
                let Some(name) = value.get("name").and_then(Value::as_str) else {
                    return;
                };
                let data = value.get("data");
                match name {
                    "time-pos" | "duration" => {
                        let mut state = tick_state.lock().unwrap();
                        let value = data.and_then(Value::as_f64).unwrap_or(0.0);
                        if name == "time-pos" {
                            state.position = value;
                        } else {
                            state.duration = value;
                        }
                        let _ = app.emit(
                            "mpv://tick",
                            json!({ "position": state.position, "duration": state.duration }),
                        );
                    }
                    "pause" => {
                        let is_paused = data.and_then(Value::as_bool).unwrap_or(false);
                        tick_state.lock().unwrap().paused = is_paused;
                        let _ = app.emit(
                            "mpv://state",
                            json!({ "state": if is_paused { "paused" } else { "playing" } }),
                        );
                    }
                    "eof-reached" => {
                        if data.and_then(Value::as_bool).unwrap_or(false) {
                            let _ = app.emit("mpv://state", json!({ "state": "ended" }));
                        }
                    }
                    _ => {}
                }
            }
            "file-loaded" => {
                // mpv only reports `pause` when it *changes*. Opening a file
                // while already unpaused (the common case - e.g. the very
                // first file, or the next one after a track that was
                // playing) never produces a pause event at all, which left
                // the frontend stuck in its "loading" state: the audio view
                // kept showing "Loading <file>..." over itself and the
                // play/pause button showed the wrong icon until the user
                // clicked. Report the real state once the file is ready.
                let paused = tick_state.lock().unwrap().paused;
                let _ = app.emit(
                    "mpv://state",
                    json!({ "state": if paused { "paused" } else { "playing" } }),
                );
            }
            "end-file" => {
                if value.get("reason").and_then(Value::as_str) == Some("error") {
                    let _ = app.emit(
                        "mpv://error",
                        json!({ "message": "Playback failed - the file may be corrupted or use an unsupported codec." }),
                    );
                }
            }
            _ => {}
        }
    } else if value.get("error").and_then(Value::as_str) != Some("success") {
        if let Some(err) = value.get("error").and_then(Value::as_str) {
            let _ = app.emit("mpv://error", json!({ "message": err }));
        }
    }
}
