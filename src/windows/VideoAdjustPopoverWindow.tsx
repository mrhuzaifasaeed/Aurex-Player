import { useEffect, useState } from "react";
import { VIDEO_ADJUST_FIELDS, VideoAdjustSliders } from "../components/player/VideoAdjustFields";
import { playbackService } from "../services/playbackService";
import { useVideoEqStore, type VideoEqProperty } from "../stores/videoEqStore";
import { setFullscreenControlsSuspended } from "../lib/fullscreenControls";
import { focusMainWindow } from "../lib/controlsBridge";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke(cmd: string) {
  if (!isTauri) return;
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  await tauriInvoke(cmd);
}

/**
 * The video-adjustments popover, rendered in its own dedicated always-on-top
 * window (see video_adjust_window.rs) instead of as normal DOM content in
 * the main window. mpv's video renders in a native window that always sits
 * above the main webview, so a plain in-page popup could only ever appear
 * "in front of" the video by shrinking it out of the way first. A separate
 * top-level window doesn't have that problem - it layers above everything
 * in the main window, video included, at full size.
 */
export function VideoAdjustPopoverWindow() {
  const values = useVideoEqStore();
  const [ready, setReady] = useState(!isTauri);

  useEffect(() => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme ?? "dark";
    setReady(true);
  }, []);

  const handleChange = (property: VideoEqProperty, value: number) => {
    useVideoEqStore.getState().setValue(property, value);
    void playbackService.setVideoProperty(property, value);
  };

  const handleReset = () => {
    useVideoEqStore.getState().reset();
    for (const { property } of VIDEO_ADJUST_FIELDS) {
      void playbackService.setVideoProperty(property, 0);
    }
  };

  if (!ready) return null;

  return (
    <div
      className="h-screen w-screen bg-transparent p-1"
      onMouseEnter={() => {
        // While in fullscreen, this popover floats just above the transport
        // bar in a separate native window - keep the bar's auto-hide
        // countdown suspended for as long as this one is open too, so it
        // can't fade out from under an in-progress brightness/contrast drag.
        // (A no-op outside fullscreen - see fullscreen_bar_window.rs; this
        // window can't tell on its own whether the player is fullscreen.)
        void setFullscreenControlsSuspended(true);
        void invoke("keep_video_adjust_popover_open");
      }}
      onMouseLeave={() => {
        void setFullscreenControlsSuspended(false);
        void invoke("request_hide_video_adjust_popover");
      }}
      // Dragging a slider activates this window; give keyboard focus back to
      // the player as soon as the drag ends so shortcuts keep working.
      onPointerUp={() => void focusMainWindow()}
    >
      <VideoAdjustSliders values={values} onChange={handleChange} onReset={handleReset} />
    </div>
  );
}
