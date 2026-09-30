import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettingsStore, type AccentColor, type ThemeMode } from "../../stores/settingsStore";
import { CheckIcon, CloseIcon } from "../icons";
import { SelectPill } from "../ui/SelectPill";
import { ToggleField } from "../ui/Toggle";

// Lazy-loaded: Settings isn't opened on launch, so none of these need to be
// in the initial bundle - each becomes its own chunk, fetched only the first
// time a user actually opens that tab.
const AboutPanel = lazy(() => import("./AboutPanel").then((m) => ({ default: m.AboutPanel })));
const ShortcutsSettings = lazy(() => import("./ShortcutsSettings").then((m) => ({ default: m.ShortcutsSettings })));
const EqualizerSettings = lazy(() => import("./EqualizerSettings").then((m) => ({ default: m.EqualizerSettings })));
const CacheManagerSettings = lazy(() =>
  import("./CacheManagerSettings").then((m) => ({ default: m.CacheManagerSettings })),
);
const MediaInfoPanel = lazy(() => import("./MediaInfoPanel").then((m) => ({ default: m.MediaInfoPanel })));
const UpdateSettings = lazy(() => import("./UpdateSettings").then((m) => ({ default: m.UpdateSettings })));
const RepairSettings = lazy(() => import("./RepairSettings").then((m) => ({ default: m.RepairSettings })));
const AdvancedSettings = lazy(() => import("./AdvancedSettings").then((m) => ({ default: m.AdvancedSettings })));

export type SettingsTab =
  | "general"
  | "appearance"
  | "playback"
  | "shortcuts"
  | "equalizer"
  | "media-info"
  | "cache"
  | "updates"
  | "repair"
  | "advanced"
  | "about";

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "oled", label: "OLED Black" },
  { value: "glass", label: "Liquid Glass" },
  { value: "midnight", label: "Midnight Blue" },
  { value: "sunset", label: "Sunset" },
];

const ACCENTS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: "blue", label: "Blue", swatch: "#4f7dff" },
  { value: "purple", label: "Purple", swatch: "#9e6eff" },
  { value: "green", label: "Green", swatch: "#37c789" },
  { value: "orange", label: "Orange", swatch: "#ff9540" },
  { value: "red", label: "Red", swatch: "#eb5757" },
];

const SKIP_OPTIONS = [5, 10, 15, 30];

interface SettingsDialogProps {
  initialTab?: SettingsTab;
  onClose: () => void;
}

export function SettingsDialog({ initialTab = "general", onClose }: SettingsDialogProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const theme = useSettingsStore((s) => s.theme);
  const accent = useSettingsStore((s) => s.accent);
  const skipIntervalSeconds = useSettingsStore((s) => s.skipIntervalSeconds);
  const dynamicAccentEnabled = useSettingsStore((s) => s.dynamicAccentEnabled);
  const showAdvancedSettings = useSettingsStore((s) => s.showAdvancedSettings);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setAccent = useSettingsStore((s) => s.setAccent);
  const setSkipIntervalSeconds = useSettingsStore((s) => s.setSkipIntervalSeconds);
  const setDynamicAccentEnabled = useSettingsStore((s) => s.setDynamicAccentEnabled);
  const setShowAdvancedSettings = useSettingsStore((s) => s.setShowAdvancedSettings);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="glass-panel flex h-[min(460px,calc(100%-32px))] w-[min(620px,calc(100%-32px))] overflow-hidden rounded-2xl border border-[rgb(var(--border))] shadow-2xl"
      >
        <nav className="flex w-40 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2">
          <TabButton label="General" active={tab === "general"} onClick={() => setTab("general")} />
          <TabButton label="Appearance" active={tab === "appearance"} onClick={() => setTab("appearance")} />
          <TabButton label="Playback" active={tab === "playback"} onClick={() => setTab("playback")} />
          <TabButton label="Shortcuts" active={tab === "shortcuts"} onClick={() => setTab("shortcuts")} />
          <TabButton label="Equalizer" active={tab === "equalizer"} onClick={() => setTab("equalizer")} />
          <TabButton label="Media Info" active={tab === "media-info"} onClick={() => setTab("media-info")} />
          <TabButton label="Cache" active={tab === "cache"} onClick={() => setTab("cache")} />
          <TabButton label="Updates" active={tab === "updates"} onClick={() => setTab("updates")} />
          <TabButton label="Repair" active={tab === "repair"} onClick={() => setTab("repair")} />
          {showAdvancedSettings && (
            <TabButton label="Advanced" active={tab === "advanced"} onClick={() => setTab("advanced")} />
          )}
          <TabButton label="About" active={tab === "about"} onClick={() => setTab("about")} />
        </nav>

        <div className="relative flex-1 overflow-y-auto">
          <button
            onClick={onClose}
            className="glass-btn absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
            aria-label="Close settings"
          >
            <CloseIcon className="h-4 w-4" />
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {tab === "general" && (
                <SettingsSection title="General">
                  <p className="text-sm text-[rgb(var(--text-muted))]">
                    Aurex Player is set up and ready to go. More general options will land here
                    over time.
                  </p>
                  <Field label="Advanced">
                    <ToggleField
                      label="Show Advanced Settings"
                      checked={showAdvancedSettings}
                      onChange={setShowAdvancedSettings}
                    />
                  </Field>
                </SettingsSection>
              )}

              {tab === "appearance" && (
                <SettingsSection title="Appearance">
                  <Field label="Theme">
                    <div className="flex flex-wrap gap-2">
                      {THEMES.map((t) => (
                        <SelectPill key={t.value} active={theme === t.value} onClick={() => setTheme(t.value)}>
                          {t.label}
                        </SelectPill>
                      ))}
                    </div>
                  </Field>
                  <Field label="Accent color">
                    <div className="flex gap-2">
                      {ACCENTS.map((a) => (
                        <motion.button
                          key={a.value}
                          onClick={() => setAccent(a.value)}
                          aria-label={a.label}
                          title={a.label}
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.92 }}
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ backgroundColor: a.swatch }}
                        >
                          {accent === a.value && <CheckIcon className="h-4 w-4 text-white" />}
                        </motion.button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Dynamic accent color">
                    <ToggleField
                      label="Tint the accent color to match the currently playing video"
                      checked={dynamicAccentEnabled}
                      onChange={setDynamicAccentEnabled}
                    />
                  </Field>
                </SettingsSection>
              )}

              {tab === "playback" && (
                <SettingsSection title="Playback">
                  <Field label="Skip interval">
                    <div className="flex gap-2">
                      {SKIP_OPTIONS.map((seconds) => (
                        <SelectPill
                          key={seconds}
                          active={skipIntervalSeconds === seconds}
                          onClick={() => setSkipIntervalSeconds(seconds)}
                          tabularNums
                        >
                          {seconds}s
                        </SelectPill>
                      ))}
                    </div>
                  </Field>
                </SettingsSection>
              )}

              <Suspense fallback={null}>
                {tab === "shortcuts" && <ShortcutsSettings />}

                {tab === "equalizer" && <EqualizerSettings />}

                {tab === "media-info" && <MediaInfoPanel />}

                {tab === "cache" && <CacheManagerSettings />}

                {tab === "updates" && <UpdateSettings />}

                {tab === "repair" && <RepairSettings />}

                {tab === "advanced" && showAdvancedSettings && <AdvancedSettings />}

                {tab === "about" && <AboutPanel />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`glass-btn cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ${
        active
          ? "bg-[rgb(var(--bg-hover))] font-medium text-[rgb(var(--text))] shadow-[inset_2px_0_0_rgb(var(--accent))]"
          : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-hover)/0.6)] hover:text-[rgb(var(--text))]"
      }`}
    >
      {label}
    </button>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-[rgb(var(--text-muted))]">{label}</label>
      {children}
    </div>
  );
}
