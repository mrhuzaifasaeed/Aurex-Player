import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "../../stores/playerStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { playbackService } from "../../services/playbackService";
import {
  cyclePlaybackSpeed,
  cycleRepeatMode,
  nextTrack,
  previousTrack,
  setVolumeLevel,
  skipBy,
  toggleFullscreen,
  toggleMute,
  togglePlayPause,
  toggleShuffle,
} from "../../lib/playbackActions";
import { formatTime, splitFileName } from "../../lib/format";
import { VideoAdjustPopover } from "./VideoAdjustPopover";
import {
  ExitFullscreenIcon,
  FrameBackIcon,
  FrameForwardIcon,
  FullscreenIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeHighIcon,
  VolumeMutedIcon,
} from "../icons";

const iconButton =
  "glass-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[rgb(var(--text-muted))]";
const toggleButton = (active: boolean) =>
  `glass-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
    active
      ? "bg-[rgb(var(--accent)/0.14)] text-[rgb(var(--accent))]"
      : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
  }`;
const timeLabel = "min-w-[3.25rem] shrink-0 text-[11px] tabular-nums text-[rgb(var(--text-muted))]";

const REPEAT_LABELS = { off: "Repeat: off", all: "Repeat: all", one: "Repeat: one" } as const;

interface TransportControlsProps {
  /**
   * "docked": the bar along the bottom of the main window. "floating": the
   * rounded panel that hovers over the video in fullscreen (rendered in its
   * own overlay window - see FullscreenControlsWindow.tsx).
   */
  variant?: "docked" | "floating";
}

export function TransportControls({ variant = "docked" }: TransportControlsProps) {
  const state = usePlayerStore((s) => s.state);
  const currentTrack = usePlayerStore((s) => s.currentTrack());
  const playlistLength = usePlayerStore((s) => s.playlist.length);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const position = usePlayerStore((s) => s.positionSeconds);
  const duration = usePlayerStore((s) => s.durationSeconds);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const speed = usePlayerStore((s) => s.speed);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const setPosition = usePlayerStore((s) => s.setPosition);
  const skipIntervalSeconds = useSettingsStore((s) => s.skipIntervalSeconds);

  const [hoverPreview, setHoverPreview] = useState<{ x: number; seconds: number } | null>(null);
  const [showRemaining, setShowRemaining] = useState(false);
  const seekRef = useRef<HTMLInputElement>(null);

  const isPlaying = state === "playing";
  const hasMedia = state !== "idle";
  const isPaused = state === "paused";
  const isVideoTrack = Boolean(currentTrack?.isVideo);
  const isFloating = variant === "floating";
  const clampedPosition = Math.min(position, duration || 0);
  const seekPercent = duration > 0 ? (clampedPosition / duration) * 100 : 0;
  const volumePercent = (muted ? 0 : volume) * 100;
  const title = currentTrack ? splitFileName(currentTrack.title) : null;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seconds = Number(e.target.value);
    setPosition(seconds);
    void playbackService.seek(seconds);
  };

  const handleSeekHover = (e: React.MouseEvent<HTMLInputElement>) => {
    const el = seekRef.current;
    if (!el || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverPreview({ x: e.clientX - rect.left, seconds: ratio * duration });
  };

  return (
    <div
      className={`glass-panel flex shrink-0 flex-col gap-1.5 px-4 pb-3 pt-2 ${
        isFloating
          ? "rounded-2xl border border-[rgb(var(--border))] shadow-[0_16px_48px_-12px_rgb(0_0_0/0.6)]"
          : "border-t border-[rgb(var(--border))]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`${timeLabel} text-right`}>{formatTime(clampedPosition)}</span>
        <div className="relative flex-1">
          <AnimatePresence>
            {hoverPreview && hasMedia && (
              <motion.div
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 2 }}
                transition={{ duration: 0.12 }}
                className="pointer-events-none absolute bottom-full mb-1.5 -translate-x-1/2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-2 py-1 text-[11px] font-medium tabular-nums text-[rgb(var(--text))] shadow-md"
                style={{ left: hoverPreview.x }}
              >
                {formatTime(hoverPreview.seconds)}
              </motion.div>
            )}
          </AnimatePresence>
          <input
            ref={seekRef}
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={clampedPosition}
            onChange={handleSeek}
            onMouseMove={handleSeekHover}
            onMouseLeave={() => setHoverPreview(null)}
            disabled={!hasMedia}
            className="aurex-range aurex-range-seek block w-full"
            style={{ ["--progress" as string]: `${seekPercent}%` }}
            aria-label="Seek"
            aria-valuetext={`${formatTime(clampedPosition)} of ${formatTime(duration)}`}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowRemaining((v) => !v)}
          disabled={!hasMedia}
          className={`${timeLabel} rounded text-left transition-colors duration-150 hover:text-[rgb(var(--text))] disabled:hover:text-[rgb(var(--text-muted))]`}
          title={showRemaining ? "Show total duration" : "Show remaining time"}
        >
          {showRemaining && duration > 0 ? `-${formatTime(duration - clampedPosition)}` : formatTime(duration)}
        </button>
      </div>

      <div className="flex items-center gap-3 text-[13px]">
        {/* Now playing - collapses first on narrow windows so the buttons keep their room. */}
        <div className="flex min-w-0 flex-1 items-center">
          {title && (
            <div className="hidden min-w-0 flex-col md:flex" title={currentTrack!.title}>
              <span className="truncate font-medium leading-tight text-[rgb(var(--text))]">{title.name}</span>
              <span className="truncate text-[11px] leading-tight text-[rgb(var(--text-muted))]">
                {[title.ext, playlistLength > 1 ? `${currentIndex + 1} of ${playlistLength}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => skipBy(-skipIntervalSeconds)}
            disabled={!hasMedia}
            className={`${iconButton} hidden sm:flex`}
            aria-label={`Skip back ${skipIntervalSeconds}s`}
            title={`Skip back ${skipIntervalSeconds}s`}
          >
            <SkipBackIcon className="h-[18px] w-[18px]" seconds={skipIntervalSeconds} />
          </button>
          <button onClick={previousTrack} disabled={!hasMedia} className={iconButton} aria-label="Previous" title="Previous">
            <PreviousIcon className="h-[18px] w-[18px]" />
          </button>
          {isPaused && (
            <button
              onClick={() => void playbackService.frameStep(false)}
              className={iconButton}
              aria-label="Previous frame"
              title="Previous frame"
            >
              <FrameBackIcon className="h-[18px] w-[18px]" />
            </button>
          )}
          <motion.button
            onClick={togglePlayPause}
            disabled={!hasMedia}
            whileTap={{ scale: 0.9 }}
            className="glass-btn relative mx-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-white shadow-[0_6px_18px_-6px_rgb(var(--accent)/0.9)] transition-[filter] duration-150 hover:brightness-110 disabled:opacity-30 disabled:shadow-none"
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause" : "Play"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isPlaying ? (
                <motion.span
                  key="pause"
                  initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute flex items-center justify-center"
                >
                  <PauseIcon className="h-[18px] w-[18px]" />
                </motion.span>
              ) : (
                <motion.span
                  key="play"
                  initial={{ opacity: 0, scale: 0.5, rotate: 45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: -45 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute flex translate-x-px items-center justify-center"
                >
                  <PlayIcon className="h-[18px] w-[18px]" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          {isPaused && (
            <button
              onClick={() => void playbackService.frameStep(true)}
              className={iconButton}
              aria-label="Next frame"
              title="Next frame"
            >
              <FrameForwardIcon className="h-[18px] w-[18px]" />
            </button>
          )}
          <button onClick={nextTrack} disabled={!hasMedia} className={iconButton} aria-label="Next" title="Next">
            <NextIcon className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => skipBy(skipIntervalSeconds)}
            disabled={!hasMedia}
            className={`${iconButton} hidden sm:flex`}
            aria-label={`Skip forward ${skipIntervalSeconds}s`}
            title={`Skip forward ${skipIntervalSeconds}s`}
          >
            <SkipForwardIcon className="h-[18px] w-[18px]" seconds={skipIntervalSeconds} />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-end gap-0.5">
          <button
            onClick={toggleShuffle}
            className={toggleButton(shuffle)}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            title={shuffle ? "Shuffle: on" : "Shuffle: off"}
          >
            <ShuffleIcon className="h-4 w-4" />
          </button>
          <button
            onClick={cycleRepeatMode}
            className={toggleButton(repeatMode !== "off")}
            aria-label={REPEAT_LABELS[repeatMode]}
            title={REPEAT_LABELS[repeatMode]}
          >
            {repeatMode === "one" ? <RepeatOneIcon className="h-4 w-4" /> : <RepeatIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={cyclePlaybackSpeed}
            className={`glass-btn h-8 min-w-8 shrink-0 rounded-lg px-1.5 text-xs font-semibold tabular-nums transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))] ${
              speed !== 1 ? "text-[rgb(var(--accent))]" : "text-[rgb(var(--text-muted))]"
            }`}
            aria-label={`Playback speed ${speed}x`}
            title="Playback speed"
          >
            {speed}x
          </button>
          <VideoAdjustPopover disabled={!hasMedia || !isVideoTrack} />
          <span className="mx-1.5 h-5 w-px shrink-0 bg-[rgb(var(--border))]" aria-hidden="true" />
          <button
            onClick={toggleMute}
            className={iconButton}
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? (
              <VolumeMutedIcon className="h-[18px] w-[18px]" />
            ) : (
              <VolumeHighIcon className="h-[18px] w-[18px]" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolumeLevel(Number(e.target.value))}
            className="aurex-range w-16 shrink-0 sm:w-24"
            style={{ ["--progress" as string]: `${volumePercent}%` }}
            aria-label="Volume"
          />
          <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-[rgb(var(--text-muted))] sm:inline">
            {Math.round(volumePercent)}%
          </span>
          <button
            onClick={() => void toggleFullscreen()}
            className={`${iconButton} ml-1`}
            aria-label={isFloating ? "Exit fullscreen" : "Fullscreen"}
            title={isFloating ? "Exit fullscreen (Esc)" : "Fullscreen"}
          >
            {isFloating ? <ExitFullscreenIcon className="h-[18px] w-[18px]" /> : <FullscreenIcon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}
