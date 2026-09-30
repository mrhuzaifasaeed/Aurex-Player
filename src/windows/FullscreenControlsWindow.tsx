import { useEffect, useRef, useState } from "react";
import { TransportControls } from "../components/player/TransportControls";
import { listenToPlayerEvents } from "../services/playbackService";
import { useUiStore } from "../stores/uiStore";
import { focusMainWindow, joinControlsBridge } from "../lib/controlsBridge";
import { adjustVolumeByNotches } from "../lib/volume";
import { pulseFullscreenControls, setFullscreenControlsSuspended } from "../lib/fullscreenControls";

/**
 * The transport bar, rendered in its own always-on-top window while
 * fullscreen (see fullscreen_bar_window.rs). mpv's video renders in a native
 * window that always sits above the main window's webview, so a normal
 * in-page bar could only ever appear "in front of" a fullscreen video by
 * shrinking it out of the way first - the same reason the video-adjustments
 * popover needed its own window. Playback state/position come straight from
 * mpv's events (same as the main window); everything else - playlist,
 * volume, speed, repeat/shuffle - is mirrored from the main window, and
 * actions that change it are sent back there (see controlsBridge.ts).
 *
 * The window itself is transparent: the bar is drawn as a floating rounded
 * panel with a little breathing room around it, so nothing but the panel is
 * ever visible over the video. The OS-level window is only ever shown/hidden
 * outright (no native fade), so the visible/hidden transition is animated
 * here via opacity instead - `fullscreen_bar_window.rs` emits the target
 * state and delays the actual `window.hide()` until the fade finishes.
 *
 * The auto-hide countdown is suspended for as long as the cursor is
 * anywhere over this window (seek bar, buttons, volume slider, etc. all
 * live inside it), so it can never fade out from under an in-progress
 * interaction like dragging the seek bar.
 */
export function FullscreenControlsWindow() {
  const [visible, setVisible] = useState(true);
  // Guards against the same class of bug as mpv_window.rs's own position
  // check: showing/hiding this always-on-top window can make the OS
  // redeliver a "mousemove" at the exact same screen position (no real
  // movement) as part of recomputing what's under the cursor - treating
  // that as real movement would re-pulse, re-show, re-hide, and repeat
  // indefinitely.
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // This window only ever exists while the main window is fullscreen.
    useUiStore.getState().setFullscreen(true);

    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const keep = (fn: () => void) => (cancelled ? fn() : cleanups.push(fn));
    void listenToPlayerEvents().then(keep);
    void joinControlsBridge().then(keep);
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      keep(await listen<boolean>("fullscreen-controls-visibility", (event) => setVisible(event.payload)));
    })();
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div
      className={`flex h-screen w-screen flex-col justify-end px-3 pb-3 transition-[opacity,translate] duration-200 ease-out ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
      onMouseMove={(e) => {
        const { screenX: x, screenY: y } = e;
        if (lastPos.current?.x === x && lastPos.current?.y === y) return;
        lastPos.current = { x, y };
        void pulseFullscreenControls();
      }}
      onMouseEnter={() => void setFullscreenControlsSuspended(true)}
      onMouseLeave={() => void setFullscreenControlsSuspended(false)}
      onWheel={(e) => adjustVolumeByNotches(-Math.sign(e.deltaY))}
      // Clicking in here activates this window; hand focus straight back
      // once the click/drag is done so keyboard shortcuts keep working and
      // Windows keeps treating the player as the fullscreen app.
      onPointerUp={() => void focusMainWindow()}
    >
      <TransportControls variant="floating" />
    </div>
  );
}
