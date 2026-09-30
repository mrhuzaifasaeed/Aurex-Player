import { motion, type Variants } from "framer-motion";
import { useSettingsStore } from "../stores/settingsStore";
import { PlayIcon } from "./icons";

const container: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function Onboarding() {
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="flex flex-1 flex-col items-center justify-center gap-6 bg-[rgb(var(--bg))] text-center"
    >
      <motion.div
        variants={item}
        className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-linear-to-br from-[rgb(var(--accent))] to-[rgb(var(--accent)/0.6)] text-white shadow-[0_18px_40px_-14px_rgb(var(--accent)/0.8)]"
      >
        <PlayIcon className="h-7 w-7 translate-x-0.5" />
      </motion.div>
      <motion.div variants={item}>
        <h1 className="text-2xl font-semibold">Welcome to Aurex Player</h1>
        <p className="mt-2 text-sm text-[rgb(var(--text-muted))]">
          Built for speed. Designed for everyone.
        </p>
      </motion.div>
      <motion.button
        variants={item}
        onClick={completeOnboarding}
        whileTap={{ scale: 0.96 }}
        className="rounded-full bg-[rgb(var(--accent))] px-7 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgb(var(--accent))] transition-[filter] hover:brightness-110"
      >
        Get Started
      </motion.button>
      <motion.p variants={item} className="text-xs text-[rgb(var(--text-muted))]">
        Created by Muhammad Huzaifa Saeed &middot; &copy; 2026
      </motion.p>
    </motion.div>
  );
}
