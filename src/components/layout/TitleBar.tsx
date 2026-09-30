import { useEffect, useState } from "react";
import { CloseIcon, MaximizeIcon, MinimizeIcon, RestoreIcon } from "../icons";
import { AppMenu } from "./AppMenu";
import { usePlayerStore } from "../../stores/playerStore";
import { splitFileName } from "../../lib/format";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getAppWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

interface TitleBarProps {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenEqualizer: () => void;
  onOpenAbout: () => void;
  onOpenUpdates: () => void;
}

export function TitleBar({ onOpenSettings, onOpenShortcuts, onOpenEqualizer, onOpenAbout, onOpenUpdates }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const trackTitle = usePlayerStore((s) => s.currentTrack()?.title);

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const win = await getAppWindow();
      const initial = await win.isMaximized();
      if (cancelled) return;
      setMaximized(initial);
      unlisten = await win.onResized(async () => {
        setMaximized(await win.isMaximized());
      });
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleMinimize = () => isTauri && getAppWindow().then((w) => w.minimize());
  const handleMaximize = () => isTauri && getAppWindow().then((w) => w.toggleMaximize());
  const handleClose = () => isTauri && getAppWindow().then((w) => w.close());

  return (
    // `relative z-50`: .glass-panel's backdrop-filter makes this bar its own
    // stacking context, so the app menu's z-index only counts inside it - on
    // smaller windows the dropdown otherwise rendered underneath the player
    // content below it (the empty-state card, audio view) and was unclickable.
    <div
      data-tauri-drag-region
      className="glass-panel relative z-50 flex h-9 shrink-0 items-center justify-between border-b border-[rgb(var(--border))] text-[13px] select-none"
    >
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center">
        <AppMenu
          onOpenSettings={onOpenSettings}
          onOpenShortcuts={onOpenShortcuts}
          onOpenEqualizer={onOpenEqualizer}
          onOpenAbout={onOpenAbout}
          onOpenUpdates={onOpenUpdates}
        />
        <div data-tauri-drag-region className="flex h-9 min-w-0 flex-1 items-center gap-2 pl-1 pr-3 text-[rgb(var(--text-muted))]">
          <span data-tauri-drag-region className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--accent))]" />
          <span data-tauri-drag-region className="shrink-0 font-medium tracking-wide text-[rgb(var(--text))]">
            Aurex Player
          </span>
          {trackTitle && (
            <>
              <span data-tauri-drag-region className="shrink-0 text-[rgb(var(--border))]" aria-hidden="true">
                /
              </span>
              <span data-tauri-drag-region className="truncate" title={trackTitle}>
                {splitFileName(trackTitle).name}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex h-full shrink-0">
        <button
          onClick={handleMinimize}
          className="flex h-full w-11 items-center justify-center text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
          aria-label="Minimize"
        >
          <MinimizeIcon className="h-[15px] w-[15px]" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex h-full w-11 items-center justify-center text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <RestoreIcon className="h-[13px] w-[13px]" /> : <MaximizeIcon className="h-[13px] w-[13px]" />}
        </button>
        <button
          onClick={handleClose}
          className="flex h-full w-11 items-center justify-center text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-red-600 hover:text-white"
          aria-label="Close"
        >
          <CloseIcon className="h-[15px] w-[15px]" />
        </button>
      </div>
    </div>
  );
}
