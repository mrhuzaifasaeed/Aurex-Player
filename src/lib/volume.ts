import { usePlayerStore } from "../stores/playerStore";
import { setVolumeLevel } from "./playbackActions";

const VOLUME_STEP_PER_NOTCH = 0.05;

/** Adjusts volume by `notches` mouse-wheel units (positive = up), clamped to [0, 1]. */
export function adjustVolumeByNotches(notches: number) {
  const store = usePlayerStore.getState();
  if (store.state === "idle") return;
  const delta = notches * VOLUME_STEP_PER_NOTCH;
  setVolumeLevel(Math.min(1, Math.max(0, (store.muted ? 0 : store.volume) + delta)));
}
