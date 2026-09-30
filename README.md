# Aurex Player

A modern, lightweight, high-performance media player for Windows, built with [Tauri](https://tauri.app), React, and [mpv](https://mpv.io). Designed to feel premium on both low-end and high-end PCs.

## Download

Grab the latest installer from the [Releases page](https://github.com/mrhuzaifasaeed/Aurex-Player/releases/latest) — download `Aurex.Player_x.x.x_x64-setup.exe` and run it. No other setup required.

The app checks for updates on its own (Settings → Updates), so you'll always be notified when a new version is available.

## Features

- **Broad format support** — MP4, MKV, AVI, MOV, WMV, FLV, WebM, MPEG/MPG, TS video, and MP3, WAV, FLAC, AAC, OGG, Opus, M4A audio, powered by mpv.
- **Six themes** — Dark, Light, OLED Black, Liquid Glass, Midnight Blue, and Sunset, each with 5 accent colors and optional dynamic accent tinting from the video itself.
- **10-band equalizer** with built-in presets (Flat, Cinema, Music, Podcast, Rock, Pop, Bass Boost, Treble Boost, Vocal Boost) and custom saved presets.
- **Video adjustments** — brightness, contrast, saturation, gamma, and hue, live while playing.
- **Fullscreen playback** with a floating, auto-hiding control bar: it fades out after 3 seconds of inactivity and reappears instantly on mouse movement, clicks, scrolling, or a keyboard shortcut — never while you're actively using the seek bar, volume slider, or any popup. Enter/exit with the fullscreen button, a double-click, `F`, or `Esc`.
- **Resume playback** — picks up where you left off on a file you've already watched.
- **Fully remappable keyboard shortcuts**, cache management, and a repair-mode settings panel to reset any part of the app that misbehaves.
- **File associations** so double-clicking a supported media file in Explorer opens it directly in Aurex Player.

### Default keyboard shortcuts

| Action | Shortcut |
|---|---|
| Play / Pause | `Space` |
| Seek Backward / Forward | `←` / `→` |
| Volume Up / Down | `↑` / `↓` |
| Mute | `M` |
| Fullscreen | `F` |
| Next / Previous Track | `Ctrl + →` / `Ctrl + ←` |
| Cycle Repeat Mode | `R` |
| Shuffle | `S` |

All shortcuts are rebindable from Settings → Shortcuts.

## Tech stack

- [Tauri 2](https://tauri.app) (Rust backend, native Windows window/shell integration)
- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com) + [Framer Motion](https://motion.dev)
- [Zustand](https://github.com/pmndrs/zustand) for state
- [mpv](https://mpv.io) as the playback engine, embedded as a native child window

## Building from source

1. Install [Node.js](https://nodejs.org), [Rust](https://www.rust-lang.org/tools/install), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for Windows.
2. Download an mpv Windows build (e.g. from [shinchiro/mpv-winbuild-cmake](https://github.com/shinchiro/mpv-winbuild-cmake/releases)) and place the executable at `src-tauri/binaries/mpv-x86_64-pc-windows-msvc.exe` (it's excluded from this repo — see `.gitignore` — since it's a 100MB+ third-party binary, not source code).
3. Install dependencies:
   ```
   npm install
   ```
4. Run in development:
   ```
   npm run tauri dev
   ```
5. Build a release installer:
   ```
   npm run tauri build
   ```
   The `.exe` installer is produced at `src-tauri/target/release/bundle/nsis/`.

## License

The compiled app (available on the [Releases page](https://github.com/mrhuzaifasaeed/Aurex-Player/releases/latest)) is free to download and use. The source code in this repository is shared for transparency only - it is **not** open source, and reuse, modification, or redistribution of the code is not permitted without permission. See [LICENSE](LICENSE) for the full terms.

## Author

Created by Muhammad Huzaifa Saeed.
