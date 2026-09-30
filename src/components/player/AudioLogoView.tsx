import type { PlaybackState } from "../../types/player";
import { splitFileName } from "../../lib/format";
import { MusicIcon } from "../icons";

interface AudioLogoViewProps {
  title: string;
  state: PlaybackState;
}

const STATUS_LABELS: Partial<Record<PlaybackState, string>> = {
  loading: "Loading…",
  playing: "Now playing",
  paused: "Paused",
  ended: "Finished",
};

/**
 * Shown instead of the native video surface when the loaded track has no
 * video stream (mp3, flac, etc.) - without this the screen is just flat
 * black with only audio, which reads as broken rather than intentional.
 */
export function AudioLogoView({ title, state }: AudioLogoViewProps) {
  const playing = state === "playing";
  const loading = state === "loading";
  const { name, ext } = splitFileName(title);

  return (
    <div className="relative flex flex-col items-center gap-7 px-6">
      {/* Soft accent glow behind the artwork tile. */}
      <div
        className={`pointer-events-none absolute left-1/2 top-16 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--accent)/0.22)] blur-3xl transition-opacity duration-700 ${
          playing ? "opacity-100" : "opacity-40"
        }`}
        aria-hidden="true"
      />
      <div
        className={`relative flex h-32 w-32 items-center justify-center rounded-[28px] bg-linear-to-br from-[rgb(var(--accent))] to-[rgb(var(--accent)/0.55)] shadow-[0_24px_60px_-18px_rgb(var(--accent)/0.75)] ring-1 ring-white/15 transition-transform duration-500 [@media(max-height:460px)]:h-20 [@media(max-height:460px)]:w-20 [@media(max-height:460px)]:rounded-3xl ${
          playing ? "animate-aurex-breathe" : "scale-95"
        }`}
      >
        {loading ? (
          <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/30 border-t-white" aria-hidden="true" />
        ) : playing ? (
          <div className="flex h-10 items-end gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="animate-aurex-eq h-full w-2 rounded-full bg-white/90"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        ) : (
          <MusicIcon className="h-12 w-12 text-white/90" />
        )}
      </div>
      <div className="relative flex max-w-[min(32rem,calc(100vw-64px))] flex-col items-center gap-1.5 text-center">
        <p className="w-full truncate text-lg font-semibold text-white/95" title={title}>
          {name}
        </p>
        <p className="flex items-center gap-2 text-xs text-white/55" aria-live="polite">
          {ext && (
            <span className="rounded border border-white/15 px-1.5 py-px text-[10px] font-semibold tracking-wide text-white/60">
              {ext}
            </span>
          )}
          <span className={playing ? "text-[rgb(var(--accent))]" : undefined}>{STATUS_LABELS[state] ?? "Audio"}</span>
        </p>
      </div>
    </div>
  );
}
