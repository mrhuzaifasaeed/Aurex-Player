import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "../../stores/playerStore";
import { useTauriFileDrop } from "../../hooks/useTauriFileDrop";
import { useVideoSurfaceSync } from "../../hooks/useVideoSurfaceSync";
import { useVideoSurfaceOverlayExclusion } from "../../hooks/useVideoSurfaceOverlayExclusion";
import { openFilesDialog, openFolderDialog, openPaths } from "../../lib/openMedia";
import { playbackService } from "../../services/playbackService";
import { toggleFullscreen } from "../../lib/playbackActions";
import { consumeSurfaceClickSuppression } from "../../lib/surfaceClickGuard";
import { AlertIcon, FileIcon, FolderOpenIcon } from "../icons";
import { VolumeHud } from "./VolumeHud";
import { AudioLogoView } from "./AudioLogoView";
import { ResumePrompt } from "./ResumePrompt";

// Native DOM double-clicks still dispatch a `click` event for each of the
// two clicks (click, click, dblclick) before `dblclick` fires - toggling
// play/pause immediately on click would flicker it on every double-click.
// Delaying by this long lets a following dblclick cancel the pending toggle
// instead (mirrors the native mpv surface's WM_LBUTTONUP/WM_LBUTTONDBLCLK
// debounce in mpv_window.rs, which handles the same race for video tracks).
const CLICK_DEBOUNCE_MS = 250;

const fadeScale = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;

export function VideoSurface() {
  const state = usePlayerStore((s) => s.state);
  const currentTrack = usePlayerStore((s) => s.currentTrack());
  const errorMessage = usePlayerStore((s) => s.errorMessage);
  const [isDragOver, setIsDragOver] = useState(false);
  const pendingClickRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasTrack = Boolean(currentTrack);
  const isAudioOnly = hasTrack && currentTrack!.isVideo === false;
  // The native mpv window only needs to be shown (and only then does it sit
  // above the webview, intercepting input) when there's an actual video
  // stream to render. For audio-only tracks it stays fully hidden, same as
  // when idle - which also means the app menu and every other click target
  // stay reachable during audio playback exactly as they do when nothing is
  // loaded at all.
  //
  // It otherwise stays fully active - including while the app menu or
  // settings dialog is open. Those overlays are excluded from the surface's
  // paintable/hit-testable region instead (see useVideoSurfaceOverlayExclusion)
  // rather than hiding or zero-sizing the whole window: that used to stop
  // mpv's swapchain from presenting, and on at least one tested GPU/driver
  // combination that stalled playback and audio too, not just the picture.
  const surfaceActive = hasTrack && !isAudioOnly && state !== "error";
  const surfaceRef = useVideoSurfaceSync<HTMLDivElement>(surfaceActive);
  useVideoSurfaceOverlayExclusion(surfaceRef);

  useTauriFileDrop(
    useCallback((paths) => {
      setIsDragOver(false);
      openPaths(paths);
    }, []),
  );

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Real paths are resolved via useTauriFileDrop; this just prevents the
    // browser from navigating to the dropped file.
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <div
      ref={surfaceRef}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => {
        // Video tracks: the native mpv window covers this area and forwards
        // its own click event (see useSurfaceInput). Audio tracks: no native
        // window is shown here at all, so handle the click directly - delayed
        // so a following double-click can cancel it (see CLICK_DEBOUNCE_MS).
        if (consumeSurfaceClickSuppression()) return;
        if (!isAudioOnly) return;
        if (pendingClickRef.current) clearTimeout(pendingClickRef.current);
        pendingClickRef.current = setTimeout(() => {
          pendingClickRef.current = null;
          void playbackService.togglePlayPause();
        }, CLICK_DEBOUNCE_MS);
      }}
      onDoubleClick={() => {
        if (!isAudioOnly || !hasTrack) return;
        if (pendingClickRef.current) {
          clearTimeout(pendingClickRef.current);
          pendingClickRef.current = null;
        }
        void toggleFullscreen();
      }}
      className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black shadow-[inset_0_0_0_0px_rgb(var(--accent)/0)] transition-shadow duration-200 ease-out ${
        isDragOver ? "shadow-[inset_0_0_0_2px_rgb(var(--accent))]" : ""
      }`}
    >
      {/* The native mpv render surface is embedded here by the Tauri backend
          (video tracks only - see surfaceActive above). */}
      <AnimatePresence mode="wait">
        {state === "error" ? (
          <motion.div key="error" {...fadeScale}>
            <ErrorState message={errorMessage} />
          </motion.div>
        ) : !currentTrack ? (
          <motion.div key="prompt" {...fadeScale}>
            <EmptyState isDragOver={isDragOver} />
          </motion.div>
        ) : isAudioOnly ? (
          // Loading is shown inside the audio view itself - a separate
          // "Loading <file>..." line used to be layered on top of it here,
          // right across the middle of the screen, and could get stuck there.
          <motion.div key="audio-logo" {...fadeScale}>
            <AudioLogoView title={currentTrack.title} state={state} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <VolumeHud />
      <ResumePrompt />
    </div>
  );
}

function EmptyState({ isDragOver }: { isDragOver: boolean }) {
  return (
    <div
      className={`flex w-[min(420px,calc(100vw-48px))] flex-col items-center gap-5 rounded-2xl border border-dashed px-8 py-9 text-center transition-colors duration-200 [@media(max-height:460px)]:gap-3 [@media(max-height:460px)]:py-5 ${
        isDragOver
          ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-200 [@media(max-height:460px)]:hidden ${
          isDragOver ? "bg-[rgb(var(--accent))] text-white" : "bg-white/[0.06] text-white/70"
        }`}
      >
        <FolderOpenIcon className="h-7 w-7" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-white/90">
          {isDragOver ? "Drop to start playing" : "Drop a video or song here"}
        </p>
        <p className="text-xs leading-relaxed text-white/45 [@media(max-height:460px)]:hidden">
          MP4, MKV, AVI, MOV, WebM, MP3, FLAC, WAV and more
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <motion.button
          onClick={() => void openFilesDialog()}
          whileTap={{ scale: 0.97 }}
          className="glass-btn flex items-center gap-2 rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-medium text-white shadow-[0_6px_18px_-8px_rgb(var(--accent))] transition-[filter] duration-150 hover:brightness-110"
        >
          <FileIcon className="h-4 w-4" />
          Open File
        </motion.button>
        <motion.button
          onClick={() => void openFolderDialog()}
          whileTap={{ scale: 0.97 }}
          className="glass-btn flex items-center gap-2 rounded-lg bg-white/[0.08] px-4 py-2 text-sm font-medium text-white/85 transition-colors duration-150 hover:bg-white/[0.14]"
        >
          <FolderOpenIcon className="h-4 w-4" />
          Open Folder
        </motion.button>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex w-[min(420px,calc(100vw-48px))] flex-col items-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--danger)/0.14)] text-[rgb(var(--danger))]">
        <AlertIcon className="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-white/90">Couldn't play this file</p>
        <p className="text-xs leading-relaxed text-white/55">{message ?? "Something went wrong during playback."}</p>
      </div>
      <motion.button
        onClick={() => void openFilesDialog()}
        whileTap={{ scale: 0.97 }}
        className="glass-btn flex items-center gap-2 rounded-lg bg-white/[0.08] px-4 py-2 text-sm font-medium text-white/85 transition-colors duration-150 hover:bg-white/[0.14]"
      >
        <FileIcon className="h-4 w-4" />
        Open Another File
      </motion.button>
    </div>
  );
}
