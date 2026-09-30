interface IconProps {
  className?: string;
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.5-6.5a1 1 0 0 0 0-1.7l-10.5-6.5A1 1 0 0 0 7 5.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PreviousIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 5v14" />
      <path d="M18 6.5 8.5 12l9.5 5.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NextIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M18 5v14" />
      <path d="M6 6.5 15.5 12 6 17.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FrameBackIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M15 6.5 8.5 12l6.5 5.5Z" fill="currentColor" stroke="none" />
      <path d="M5 6v12" />
    </svg>
  );
}

export function FrameForwardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 6.5 15.5 12 9 17.5Z" fill="currentColor" stroke="none" />
      <path d="M19 6v12" />
    </svg>
  );
}

export function SkipBackIcon({ className, seconds = 10 }: IconProps & { seconds?: number }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 12a9 9 0 1 1 2.6 6.35" />
      <path d="M3 17v-5h5" />
      <text x="12" y="15.5" fontSize="7.5" fontWeight="600" textAnchor="middle" fill="currentColor" stroke="none">
        {seconds}
      </text>
    </svg>
  );
}

export function SkipForwardIcon({ className, seconds = 10 }: IconProps & { seconds?: number }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M21 12a9 9 0 1 0-2.6 6.35" />
      <path d="M21 17v-5h-5" />
      <text x="12" y="15.5" fontSize="7.5" fontWeight="600" textAnchor="middle" fill="currentColor" stroke="none">
        {seconds}
      </text>
    </svg>
  );
}

export function ShuffleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 6h3.5c1.5 0 2.5.6 3.4 1.9L16 18h5" />
      <path d="M17.5 15 21 18l-3.5 3" />
      <path d="M3 18h3.5c1.5 0 2.5-.6 3.4-1.9l.6-.9" />
      <path d="M17.5 9 21 6l-3.5-3" />
      <path d="M11 8.9 11.6 7.9C12.5 6.6 13.5 6 15 6h5" />
    </svg>
  );
}

export function RepeatIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M17 2 21 6l-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22 3 18l4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function RepeatOneIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M17 2 21 6l-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22 3 18l4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      <path d="M11 10.5h1v3" strokeWidth={1.5} />
    </svg>
  );
}

export function VolumeHighIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 10v4h3.5L12 17.5v-11L7.5 10Z" fill="currentColor" stroke="none" />
      <path d="M15.5 9a4.5 4.5 0 0 1 0 6" />
      <path d="M18 6.5a8 8 0 0 1 0 11" />
    </svg>
  );
}

export function VolumeMutedIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 10v4h3.5L12 17.5v-11L7.5 10Z" fill="currentColor" stroke="none" />
      <path d="m15.5 10 4 4" />
      <path d="m19.5 10-4 4" />
    </svg>
  );
}

export function MinimizeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

export function MaximizeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" />
    </svg>
  );
}

export function RestoreIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="7.5" y="7.5" width="10.5" height="10.5" rx="1.3" />
      <path d="M6.5 14.5h-1a1.3 1.3 0 0 1-1.3-1.3V6.3A1.3 1.3 0 0 1 5.5 5h6.9a1.3 1.3 0 0 1 1.3 1.3v1" />
    </svg>
  );
}

export function FolderOpenIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3Z" />
      <path d="m3 10 1.5 8a2 2 0 0 0 2 1.7h11a2 2 0 0 0 2-1.7L21 10Z" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

export function SlidersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 21V10" />
      <path d="M5 6V3" />
      <circle cx="5" cy="8" r="2" />
      <path d="M12 21v-7" />
      <path d="M12 10V3" />
      <circle cx="12" cy="12" r="2" />
      <path d="M19 21v-3" />
      <path d="M19 14V3" />
      <circle cx="19" cy="16" r="2" />
    </svg>
  );
}

export function KeyboardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M6 9h.01M9.5 9h.01M13 9h.01M16.5 9h.01M6 12.5h.01M9.5 12.5h.01M13 12.5h.01M16.5 12.5h.01" strokeWidth={2.2} />
      <path d="M6.5 15.5h11" />
    </svg>
  );
}

export function EqualizerIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 18v-5" />
      <path d="M9 18V6" />
      <path d="M14 18v-9" />
      <path d="M19 18v-3" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.4-2-3.4-2.3.8a7.7 7.7 0 0 0-1.7-1L15 3.5h-6l-.4 2.5a7.7 7.7 0 0 0-1.7 1l-2.3-.8-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.4 2 3.4 2.3-.8a7.7 7.7 0 0 0 1.7 1l.4 2.5h6l.4-2.5a7.7 7.7 0 0 0 1.7-1l2.3.8 2-3.4Z" />
    </svg>
  );
}

export function FileIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7.5v.01" />
    </svg>
  );
}

export function LogOutIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

export function UpdateAvailableIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function FullscreenIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    </svg>
  );
}

export function ExitFullscreenIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4" />
      <path d="M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4" />
      <path d="M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20" />
      <path d="M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20" />
    </svg>
  );
}

export function MusicIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17.2v.01" strokeWidth={2.2} />
    </svg>
  );
}
