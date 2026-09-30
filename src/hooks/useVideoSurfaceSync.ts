import { useEffect, useRef } from "react";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type SurfaceRect = { x: number; y: number; width: number; height: number };
type Invoke = typeof import("@tauri-apps/api/core").invoke;

// Resizes are sent one at a time, always with the most recent rect.
// Entering/leaving fullscreen fires a burst of layout changes (maximize, then
// fullscreen, then the titlebar/transport bar unmounting), and concurrent
// `invoke`s aren't guaranteed to be applied in the order they were sent - a
// stale, smaller rect landing last left a strip of the app background
// visible along the bottom edge of a fullscreen video. Module-level (there is
// only one native surface) so a hide sent right after `active` flips can't be
// overtaken by a resize still queued from before it either.
let resizeInFlight = false;
let pendingRect: SurfaceRect | null = null;

async function sendSurfaceRect(invoke: Invoke, rect: SurfaceRect) {
  pendingRect = rect;
  if (resizeInFlight) return;
  resizeInFlight = true;
  while (pendingRect) {
    const next = pendingRect;
    pendingRect = null;
    await invoke("mpv_resize_surface", next).catch(() => {});
  }
  resizeInFlight = false;
}

/**
 * Keeps the native mpv child window (embedded via --wid) aligned with this
 * element's on-screen bounds. mpv renders outside the webview's control, so
 * its window must be manually resized/repositioned whenever this area does.
 *
 * The native window sits above the webview in z-order (otherwise the video
 * would never be visible), which means it also intercepts clicks and drops
 * over that same screen area. While `active` is false (no media loaded), it
 * is collapsed to zero size so the "Open File" prompt underneath stays
 * clickable and drag-and-drop reaches the webview instead of mpv.
 */
export function useVideoSurfaceSync<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isTauri) return;

    let invoke: Invoke;
    let cancelled = false;
    let frame = 0;

    const sync = () => {
      if (!invoke || cancelled) return;
      if (!active) {
        void sendSurfaceRect(invoke, { x: 0, y: 0, width: 0, height: 0 });
        return;
      }
      const rect = el.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      // Edges are rounded rather than the size itself, so the surface always
      // reaches exactly the element's right/bottom edge.
      const left = Math.round(rect.left * scale);
      const top = Math.round(rect.top * scale);
      void sendSurfaceRect(invoke, {
        x: left,
        y: top,
        width: Math.round(rect.right * scale) - left,
        height: Math.round(rect.bottom * scale) - top,
      });
    };

    const scheduleSync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    import("@tauri-apps/api/core").then((mod) => {
      if (cancelled) return;
      invoke = mod.invoke;
      sync();
    });

    const observer = new ResizeObserver(scheduleSync);
    observer.observe(el);
    window.addEventListener("resize", scheduleSync);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleSync);
    };
  }, [active]);

  return ref;
}
