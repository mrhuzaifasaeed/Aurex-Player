import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TitleBar } from "./components/layout/TitleBar";
import { VideoSurface } from "./components/player/VideoSurface";
import { TransportControls } from "./components/player/TransportControls";
import { Onboarding } from "./components/Onboarding";
import { SettingsDialog, type SettingsTab } from "./components/settings/SettingsDialog";
import { useSettingsStore } from "./stores/settingsStore";
import { useUiStore } from "./stores/uiStore";
import { usePlayerStore } from "./stores/playerStore";
import { listenToPlayerEvents } from "./services/playbackService";
import { usePlaybackAdvance } from "./hooks/usePlaybackAdvance";
import { useOpenFileFromOS } from "./hooks/useOpenFileFromOS";
import { useSurfaceInput } from "./hooks/useSurfaceInput";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useFullscreenChrome } from "./hooks/useFullscreenChrome";
import { useAutoUpdateCheck } from "./hooks/useAutoUpdateCheck";
import { adjustVolumeByNotches } from "./lib/volume";
import { runControlsAction } from "./lib/playbackActions";
import { hostControlsBridge } from "./lib/controlsBridge";
import { splitFileName } from "./lib/format";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function App() {
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const trackTitle = usePlayerStore((s) => s.currentTrack()?.title);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const keep = (fn: () => void) => (cancelled ? fn() : cleanups.push(fn));
    void listenToPlayerEvents().then(keep);
    // Serves the fullscreen control bar's window (see controlsBridge.ts).
    void hostControlsBridge(runControlsAction).then(keep);
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  // Names the window after what's playing, so it's recognizable in the
  // taskbar and Alt+Tab rather than every instance just saying "Aurex Player".
  useEffect(() => {
    const title = trackTitle ? `${splitFileName(trackTitle).name} - Aurex Player` : "Aurex Player";
    document.title = title;
    if (!isTauri) return;
    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle(title))
      .catch(() => {});
  }, [trackTitle]);

  // Fades out and removes the static pre-React splash (see index.html) now
  // that the real UI has actually mounted - runs once, regardless of which
  // branch (Onboarding vs the main player) ends up rendering below.
  useEffect(() => {
    const splash = document.getElementById("aurex-splash");
    if (!splash) return;
    splash.classList.add("aurex-splash-hidden");
    const timeout = setTimeout(() => splash.remove(), 250);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // mpv's video renders in a native window that always sits above the
    // webview, so it would otherwise cover the lower portion of this
    // dialog whenever a video is actively playing (see VideoSurface).
    useUiStore.getState().setSettingsOpen(settingsTab !== null);
  }, [settingsTab]);

  usePlaybackAdvance();
  useOpenFileFromOS();
  useSurfaceInput();
  useFullscreenChrome();
  useAutoUpdateCheck();
  // Suspended while Settings is open so the shortcut-rebind capture there
  // doesn't fight with global shortcuts also reacting to the same keypress.
  useKeyboardShortcuts(settingsTab !== null);

  if (!onboardingComplete) {
    return (
      <div className="flex h-full flex-col">
        <Onboarding />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-col"
      onWheel={(e) => {
        if (settingsTab) return;
        adjustVolumeByNotches(-Math.sign(e.deltaY));
      }}
    >
      {!isFullscreen && (
        <TitleBar
          onOpenSettings={() => setSettingsTab("general")}
          onOpenShortcuts={() => setSettingsTab("shortcuts")}
          onOpenEqualizer={() => setSettingsTab("equalizer")}
          onOpenAbout={() => setSettingsTab("about")}
          onOpenUpdates={() => setSettingsTab("updates")}
        />
      )}
      <VideoSurface />
      {/* In fullscreen, the transport bar renders in its own overlay window
          instead (see FullscreenControlsWindow.tsx / useFullscreenChrome) so
          it can float over the video without shrinking it. */}
      {!isFullscreen && <TransportControls />}
      <AnimatePresence>
        {settingsTab && (
          <SettingsDialog key="settings-dialog" initialTab={settingsTab} onClose={() => setSettingsTab(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
