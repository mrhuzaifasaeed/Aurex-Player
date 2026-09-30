import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "../../stores/playerStore";
import { VolumeHighIcon, VolumeMutedIcon } from "../icons";

/** Briefly shows the current volume level whenever it changes (slider drag or scroll-wheel). */
export function VolumeHud() {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  // Compared against the previous value rather than skipping "the first
  // effect run" - React StrictMode runs effects twice on mount, which made
  // the HUD flash up on launch even though nothing had changed.
  const previous = useRef({ volume, muted });

  useEffect(() => {
    if (previous.current.volume === volume && previous.current.muted === muted) return;
    previous.current = { volume, muted };
    setVisible(true);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setVisible(false), 1100);
  }, [volume, muted]);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const percent = Math.round((muted ? 0 : volume) * 100);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="volume-hud flex items-center gap-3 rounded-full bg-[rgb(var(--bg-elevated))]/95 py-2 pl-3.5 pr-4 text-sm text-[rgb(var(--text))] shadow-lg"
          >
            {muted || volume === 0 ? (
              <VolumeMutedIcon className="h-4 w-4 shrink-0" />
            ) : (
              <VolumeHighIcon className="h-4 w-4 shrink-0" />
            )}
            <span className="h-1 w-24 overflow-hidden rounded-full bg-[rgb(var(--border))]" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-[rgb(var(--accent))] transition-[width] duration-100"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="w-9 text-right tabular-nums">{percent}%</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
