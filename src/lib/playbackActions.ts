import { usePlayerStore } from "../stores/playerStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useUiStore } from "../stores/uiStore";
import { playbackService } from "../services/playbackService";
import { forwardToMainWindow, type ControlsAction } from "./controlsBridge";
import type { RepeatMode } from "../types/player";

const NEXT_REPEAT_MODE: Record<RepeatMode, RepeatMode> = {
  off: "all",
  all: "one",
  one: "off",
};

export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Actions shared between the transport control bar, keyboard shortcuts, and
 * (for volume) mouse-wheel handling - kept in one place so all three
 * trigger points stay in sync instead of re-implementing the same logic.
 *
 * Anything that changes state owned by the main window's player store
 * (playlist position, volume, speed, repeat/shuffle, fullscreen) is
 * forwarded there when triggered from the fullscreen control bar's window
 * (see controlsBridge.ts) instead of only changing that window's own copy.
 */

export function togglePlayPause() {
  if (usePlayerStore.getState().state === "idle") return;
  void playbackService.togglePlayPause();
}

export function skipBy(deltaSeconds: number) {
  const store = usePlayerStore.getState();
  if (store.state === "idle") return;
  store.setPosition(Math.max(0, Math.min(store.durationSeconds || 0, store.positionSeconds + deltaSeconds)));
  void playbackService.seekRelative(deltaSeconds);
}

export function skipByDefaultInterval(direction: 1 | -1) {
  skipBy(direction * useSettingsStore.getState().skipIntervalSeconds);
}

// Fixed independently of the user-configurable skip interval (which governs
// the transport bar's skip-back/skip-forward buttons) - the arrow keys always
// seek by exactly this much.
const ARROW_SEEK_SECONDS = 5;

export function seekByArrowKey(direction: 1 | -1) {
  skipBy(direction * ARROW_SEEK_SECONDS);
}

export function toggleMute() {
  if (forwardToMainWindow({ type: "toggleMute" })) return;
  const store = usePlayerStore.getState();
  store.toggleMute();
  void playbackService.setMuted(!store.muted);
}

/** Sets the volume (0-1), unmuting unless it's set all the way to zero. */
export function setVolumeLevel(volume: number) {
  // Applied to this window's store first even when forwarded, so a volume
  // slider being dragged in the fullscreen bar follows the pointer instead
  // of snapping back until the main window's update round-trips.
  usePlayerStore.getState().setVolume(volume);
  if (forwardToMainWindow({ type: "setVolume", value: volume })) return;
  void playbackService.setVolume(volume);
  // The store treats "volume > 0" as unmuted - keep mpv's own mute flag in
  // step, otherwise dragging the slider up after muting stayed silent.
  void playbackService.setMuted(volume === 0);
}

export function setPlaybackSpeed(speed: number) {
  if (forwardToMainWindow({ type: "setSpeed", value: speed })) return;
  usePlayerStore.getState().setSpeed(speed);
  void playbackService.setSpeed(speed);
}

export function cyclePlaybackSpeed() {
  const { speed } = usePlayerStore.getState();
  setPlaybackSpeed(PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(speed) + 1) % PLAYBACK_SPEEDS.length] ?? 1);
}

export function cycleRepeatMode() {
  if (forwardToMainWindow({ type: "cycleRepeat" })) return;
  const store = usePlayerStore.getState();
  store.setRepeatMode(NEXT_REPEAT_MODE[store.repeatMode]);
}

export function toggleShuffle() {
  if (forwardToMainWindow({ type: "toggleShuffle" })) return;
  usePlayerStore.getState().toggleShuffle();
}

export function nextTrack() {
  if (forwardToMainWindow({ type: "next" })) return;
  usePlayerStore.getState().next();
}

export function previousTrack() {
  if (forwardToMainWindow({ type: "previous" })) return;
  usePlayerStore.getState().previous();
}

/** Runs an action the fullscreen control bar forwarded to the main window. */
export function runControlsAction(action: ControlsAction) {
  switch (action.type) {
    case "next":
      return nextTrack();
    case "previous":
      return previousTrack();
    case "toggleShuffle":
      return toggleShuffle();
    case "cycleRepeat":
      return cycleRepeatMode();
    case "toggleMute":
      return toggleMute();
    case "setVolume":
      return setVolumeLevel(action.value);
    case "setSpeed":
      return setPlaybackSpeed(action.value);
    case "toggleFullscreen":
      return void toggleFullscreen();
  }
}

// Whether the window was in a restored (non-maximized) state before we
// maximized it to work around the issue below. Module-level rather than
// per-call since it needs to survive from the "enter" call to the later
// "exit" call.
let wasRestoredBeforeFullscreen = false;
let fullscreenTransitionInFlight = false;

export async function toggleFullscreen() {
  if (!isTauri) return;
  if (forwardToMainWindow({ type: "toggleFullscreen" })) return;
  // A double-click and the F key (or two quick presses) landing together
  // would otherwise run two overlapping enter/exit sequences.
  if (fullscreenTransitionInFlight) return;
  fullscreenTransitionInFlight = true;

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  try {
    const nextFullscreen = !(await win.isFullscreen());
    if (nextFullscreen) {
      // With decorations disabled (our custom titlebar), entering fullscreen
      // from a restored/floating window is unreliable on Windows - a known
      // tao/tauri quirk (https://github.com/tauri-apps/tauri/issues/11788)
      // that only reproduces from a non-maximized starting state. Maximizing
      // first gives it a consistent geometry to transition from. Best-effort:
      // fullscreen must still happen even if this step fails.
      wasRestoredBeforeFullscreen = !(await win.isMaximized());
      if (wasRestoredBeforeFullscreen) await win.maximize().catch(() => {});
      await win.setFullscreen(true);
    } else {
      await win.setFullscreen(false);
      if (wasRestoredBeforeFullscreen) await win.unmaximize().catch(() => {});
    }
  } catch (err) {
    console.error("[playbackActions] failed to toggle fullscreen:", err);
  } finally {
    // Mirror what the window actually ended up as rather than what was
    // intended - if any step above failed part-way, the UI (titlebar,
    // transport bar, fullscreen overlay) must still match the real window.
    const actual = await win.isFullscreen().catch(() => useUiStore.getState().isFullscreen);
    useUiStore.getState().setFullscreen(actual);
    fullscreenTransitionInFlight = false;
  }
}
