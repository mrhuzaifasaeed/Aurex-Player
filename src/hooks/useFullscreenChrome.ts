import { useEffect } from "react";
import { useUiStore } from "../stores/uiStore";
import { toggleFullscreen } from "../lib/playbackActions";
import { pulseFullscreenControls } from "../lib/fullscreenControls";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Height (logical px) of the fullscreen control-bar overlay window: the
// floating TransportControls panel (seek row + button row) plus the margin
// around it (see FullscreenControlsWindow.tsx). The window is transparent
// and the panel is pinned to its bottom, so a little spare height is
// invisible - it only has to be enough never to clip the panel.
export const CONTROLS_BAR_HEIGHT = 112;

/**
 * Positions the fullscreen control-bar overlay window (see
 * fullscreen_bar_window.rs) whenever fullscreen is entered, hides it
 * immediately on exit, and lets Escape exit fullscreen (when no other
 * overlay - the menu, Settings - is claiming it first).
 */
export function useFullscreenChrome() {
  const isFullscreen = useUiStore((s) => s.isFullscreen);

  useEffect(() => {
    if (!isTauri) return;

    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");

      if (!isFullscreen) {
        await invoke("hide_fullscreen_controls_now");
        return;
      }

      // Anchored to the monitor rather than to this window's own bounds:
      // right after setFullscreen() resolves the window can still report
      // its pre-fullscreen (maximized) geometry, which used to leave the bar
      // floating above the real bottom of the screen with a strip of video
      // underneath it. Everything is computed in physical pixels, so it
      // lines up exactly at any display scaling.
      const { currentMonitor, getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const monitor = await currentMonitor().catch(() => null);
      const [pos, size, scale] = monitor
        ? [monitor.position, monitor.size, monitor.scaleFactor]
        : await Promise.all([win.outerPosition(), win.outerSize(), win.scaleFactor()]);
      const bounds = { x: pos.x, y: pos.y, width: size.width, height: size.height, scale };
      const height = Math.round(CONTROLS_BAR_HEIGHT * bounds.scale);
      await invoke("show_fullscreen_controls", {
        x: bounds.x,
        y: bounds.y + bounds.height - height,
        width: bounds.width,
        height,
      });
    })().catch((err) => console.error("[useFullscreenChrome] failed to update the fullscreen bar:", err));
  }, [isFullscreen]);

  // Keeps the UI in step with the real window if fullscreen is left some
  // other way than our own toggle (e.g. Win+Down, or a display change) -
  // otherwise the titlebar and transport bar would stay hidden.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const fn = await win.onResized(async () => {
        const actual = await win.isFullscreen();
        if (actual !== useUiStore.getState().isFullscreen) useUiStore.getState().setFullscreen(actual);
      });
      if (cancelled) fn();
      else unlisten = fn;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isFullscreen = useUiStore.getState().isFullscreen;
      // Any keyboard shortcut counts as "something happened" for the
      // auto-hide countdown, not just Escape below - e.g. Space to
      // pause should bring the bar back even if the mouse never moved.
      if (isFullscreen) void pulseFullscreenControls();

      if (e.key !== "Escape") return;
      const { menuOpen, settingsOpen } = useUiStore.getState();
      if (menuOpen || settingsOpen) return; // let those close themselves first
      if (isFullscreen) void toggleFullscreen();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
}
