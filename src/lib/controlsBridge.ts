import { usePlayerStore } from "../stores/playerStore";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * The fullscreen control bar is its own window (see
 * FullscreenControlsWindow.tsx), which means its own JS context and its own
 * copy of every store. mpv events keep playback state/position in sync in
 * both on their own, but everything else - the playlist, volume, speed,
 * repeat/shuffle - only lives in the main window. Without this bridge the
 * bar's copy stayed empty: Next/Previous did nothing in fullscreen, the
 * video-adjust button stayed disabled, and volume/shuffle/repeat changes
 * made there were lost (or overwritten) on the way back to windowed mode.
 *
 * The main window's playerStore stays the single source of truth: it
 * mirrors its state to the bar, and the bar forwards its actions to the
 * main window instead of mutating its own copy.
 */

const ACTION_EVENT = "controls://action";
const STATE_EVENT = "controls://player-state";
const HELLO_EVENT = "controls://hello";
const MAIN_WINDOW_LABEL = "main";
const CONTROLS_WINDOW_LABEL = "fullscreen-controls";

export type ControlsAction =
  | { type: "next" }
  | { type: "previous" }
  | { type: "toggleShuffle" }
  | { type: "cycleRepeat" }
  | { type: "toggleMute" }
  | { type: "setVolume"; value: number }
  | { type: "setSpeed"; value: number }
  | { type: "toggleFullscreen" };

type PlayerSnapshot = Pick<
  ReturnType<typeof usePlayerStore.getState>,
  "playlist" | "currentIndex" | "state" | "errorMessage" | "volume" | "muted" | "speed" | "repeatMode" | "shuffle"
>;

function snapshot(): PlayerSnapshot {
  const s = usePlayerStore.getState();
  return {
    playlist: s.playlist,
    currentIndex: s.currentIndex,
    state: s.state,
    errorMessage: s.errorMessage,
    volume: s.volume,
    muted: s.muted,
    speed: s.speed,
    repeatMode: s.repeatMode,
    shuffle: s.shuffle,
  };
}

function snapshotChanged(a: PlayerSnapshot, b: PlayerSnapshot): boolean {
  return (Object.keys(a) as (keyof PlayerSnapshot)[]).some((key) => a[key] !== b[key]);
}

/** Whether this JS context is the fullscreen control bar's window. */
export function isControlsWindow(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.window === CONTROLS_WINDOW_LABEL;
}

/**
 * Sends `action` to the main window when called from the fullscreen bar and
 * returns true; returns false everywhere else, meaning "run it locally".
 */
export function forwardToMainWindow(action: ControlsAction): boolean {
  if (!isTauri || !isControlsWindow()) return false;
  void import("@tauri-apps/api/event").then(({ emitTo }) => emitTo(MAIN_WINDOW_LABEL, ACTION_EVENT, action));
  return true;
}

/**
 * Hands keyboard focus back to the main window. Clicking anything in one of
 * the overlay windows (fullscreen bar, video-adjust popover) activates that
 * window, after which keyboard shortcuts - handled only by the main window -
 * would stop working, and in fullscreen Windows would bring the taskbar back
 * because the foreground window is no longer the fullscreen one.
 */
export async function focusMainWindow() {
  if (!isTauri) return;
  try {
    const { Window } = await import("@tauri-apps/api/window");
    const main = await Window.getByLabel(MAIN_WINDOW_LABEL);
    await main?.setFocus();
  } catch (err) {
    console.error("[controlsBridge] failed to refocus the main window:", err);
  }
}

/**
 * Main window side: publishes player state to the bar whenever it changes
 * (and whenever the bar asks for it), and runs the actions the bar forwards.
 * Returns a cleanup function.
 */
export async function hostControlsBridge(runAction: (action: ControlsAction) => void): Promise<() => void> {
  if (!isTauri) return () => {};
  const { emitTo, listen } = await import("@tauri-apps/api/event");

  const publish = () => void emitTo(CONTROLS_WINDOW_LABEL, STATE_EVENT, snapshot()).catch(() => {});

  let last = snapshot();
  const unsubscribeStore = usePlayerStore.subscribe(() => {
    const next = snapshot();
    // Position/duration ticks arrive many times a second and reach the bar
    // straight from mpv anyway - only republish when something mirrored here
    // actually changed.
    if (!snapshotChanged(last, next)) return;
    last = next;
    publish();
  });
  const unlistenHello = await listen(HELLO_EVENT, publish);
  const unlistenAction = await listen<ControlsAction>(ACTION_EVENT, (event) => runAction(event.payload));

  return () => {
    unsubscribeStore();
    unlistenHello();
    unlistenAction();
  };
}

/**
 * Fullscreen bar side: applies the main window's player state to this
 * window's store, and asks for the current state once on startup.
 */
export async function joinControlsBridge(): Promise<() => void> {
  if (!isTauri) return () => {};
  const { emitTo, listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<PlayerSnapshot>(STATE_EVENT, (event) => {
    usePlayerStore.setState(event.payload);
  });
  await emitTo(MAIN_WINDOW_LABEL, HELLO_EVENT);
  return unlisten;
}
