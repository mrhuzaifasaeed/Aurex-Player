import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "../../stores/playerStore";
import { useUiStore } from "../../stores/uiStore";
import { CONTROLS_BAR_HEIGHT } from "../../hooks/useFullscreenChrome";
import { formatTime } from "../../lib/format";

// Gives the user a comfortable window to notice and react before it defaults
// to resuming on its own - long enough to read, short enough not to block
// playback indefinitely if ignored.
const AUTO_CONFIRM_MS = 5000;

// In windowed/maximized mode the video area is a sibling *above* the
// transport bar, so "bottom-24" already sits just above that bar. In
// fullscreen the video fills the entire window (the transport bar becomes a
// separate always-on-top overlay - see useFullscreenChrome), so the same
// bottom-24 offset alone would land underneath that overlay instead of above
// it. Adding the bar's own height keeps the prompt's on-screen position
// visually consistent between the two modes instead of jumping.
const WINDOWED_BOTTOM_OFFSET_PX = 96; // bottom-24
const FULLSCREEN_BOTTOM_OFFSET_PX = CONTROLS_BAR_HEIGHT + WINDOWED_BOTTOM_OFFSET_PX;

/**
 * "Continue from HH:MM:SS?" banner shown when reopening a file with saved
 * progress (see lib/watchHistory.ts). Playback is paused underneath while
 * this is up - openTrackAtIndex in playerStore.ts pauses immediately after
 * opening whenever it sets resumePrompt. Auto-resumes if left untouched,
 * matching the "Continue Watching" convention most streaming apps use rather
 * than blocking playback indefinitely on an ignored prompt.
 */
export function ResumePrompt() {
  const resumePrompt = usePlayerStore((s) => s.resumePrompt);
  const confirmResume = usePlayerStore((s) => s.confirmResume);
  const dismissResume = usePlayerStore((s) => s.dismissResume);
  const isFullscreen = useUiStore((s) => s.isFullscreen);

  useEffect(() => {
    if (!resumePrompt) return;
    const timer = window.setTimeout(() => {
      usePlayerStore.getState().confirmResume();
    }, AUTO_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [resumePrompt]);

  return (
    <AnimatePresence>
      {resumePrompt && (
        <motion.div
          key="resume-prompt"
          data-overlay="resume-prompt"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="glass-panel absolute left-1/2 z-40 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-5 overflow-hidden rounded-xl border border-[rgb(var(--border))] px-5 py-4 shadow-xl"
          style={{ bottom: isFullscreen ? FULLSCREEN_BOTTOM_OFFSET_PX : WINDOWED_BOTTOM_OFFSET_PX }}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-medium text-[rgb(var(--text))]">Continue where you left off?</p>
            <p className="truncate text-xs text-[rgb(var(--text-muted))]">
              Resumes from{" "}
              <span className="font-semibold tabular-nums text-[rgb(var(--accent))]">
                {formatTime(resumePrompt.resumeSeconds)}
              </span>{" "}
              in a few seconds
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={dismissResume}
              className="glass-btn rounded-lg px-3.5 py-2 text-sm font-medium text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
            >
              Start Over
            </button>
            <button
              onClick={confirmResume}
              className="glass-btn rounded-lg bg-[rgb(var(--accent))] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-[filter] duration-150 hover:brightness-110"
            >
              Continue
            </button>
          </div>
          {/* Counts down to the automatic resume. */}
          <motion.span
            key={resumePrompt.path}
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[rgb(var(--accent))]"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: AUTO_CONFIRM_MS / 1000, ease: "linear" }}
            aria-hidden="true"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
