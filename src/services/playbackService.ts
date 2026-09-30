import { usePlayerStore } from "../stores/playerStore";
import { saveProgress } from "../lib/watchHistory";

/**
 * Thin wrapper around the Tauri `mpv` command surface. Falls back to a no-op
 * stub when running outside of Tauri (e.g. `vite dev` in a browser) so the UI
 * can still be developed without the native shell.
 */

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    console.debug(`[playbackService:stub] ${cmd}`, args);
    return undefined as T;
  }
  try {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return await tauriInvoke<T>(cmd, args);
  } catch (err) {
    console.error(`[playbackService] ${cmd} failed:`, err);
    usePlayerStore.getState().setError(String(err));
    throw err;
  }
}

export const playbackService = {
  async open(path: string) {
    usePlayerStore.getState().setState("loading");
    await invoke("mpv_open", { path });
  },
  async play() {
    await invoke("mpv_play");
  },
  async pause() {
    await invoke("mpv_pause");
  },
  async togglePlayPause() {
    await invoke("mpv_toggle_play_pause");
  },
  async stop() {
    await invoke("mpv_stop");
  },
  async seek(seconds: number) {
    await invoke("mpv_seek", { seconds });
  },
  async seekRelative(deltaSeconds: number) {
    await invoke("mpv_seek_relative", { deltaSeconds });
  },
  async frameStep(forward: boolean) {
    await invoke("mpv_frame_step", { forward });
  },
  async setVolume(volume: number) {
    await invoke("mpv_set_volume", { volume });
  },
  async setMuted(muted: boolean) {
    await invoke("mpv_set_muted", { muted });
  },
  async setSpeed(speed: number) {
    await invoke("mpv_set_speed", { speed });
  },
  async setVideoProperty(property: string, value: number) {
    await invoke("mpv_set_video_property", { property, value });
  },
  async setEqualizer(bands: number[], enabled: boolean) {
    await invoke("mpv_set_equalizer", { bands, enabled });
  },
};

// How often to persist the current playback position for the "resume where
// you left off" prompt, in wall-clock time between saves rather than on
// every tick - there's no reliable hook for "about to close" on a native
// window close/crash, so this is what keeps the saved position reasonably
// current instead.
const PROGRESS_SAVE_INTERVAL_MS = 5000;
let lastProgressSaveMs = 0;

export async function listenToPlayerEvents() {
  if (!isTauri) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const unlistenTick = await listen<{ position: number; duration: number }>(
    "mpv://tick",
    (event) => {
      const store = usePlayerStore.getState();
      store.setPosition(event.payload.position);
      store.setDuration(event.payload.duration);

      const now = Date.now();
      // Skip saving while a resume prompt is pending: position briefly
      // reports ~0 right after opening, and saving that would clobber the
      // very progress the prompt is about to offer to resume. Only the main
      // window saves at all - the fullscreen bar's window mirrors the
      // playlist too (see controlsBridge.ts) but not the resume prompt.
      const isMainWindow = (document.documentElement.dataset.window ?? "main") === "main";
      if (isMainWindow && !store.resumePrompt && now - lastProgressSaveMs >= PROGRESS_SAVE_INTERVAL_MS) {
        lastProgressSaveMs = now;
        const track = store.currentTrack();
        if (track) saveProgress(track.path, event.payload.position, event.payload.duration);
      }
    },
  );
  const unlistenState = await listen<{ state: string }>("mpv://state", (event) => {
    usePlayerStore.getState().setState(event.payload.state as never);
  });
  const unlistenError = await listen<{ message: string }>("mpv://error", (event) => {
    usePlayerStore.getState().setError(event.payload.message);
  });
  return () => {
    unlistenTick();
    unlistenState();
    unlistenError();
  };
}
