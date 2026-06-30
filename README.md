<p align="center">
  <img src="public/icons/icon128.png" width="96" height="96" alt="Pace logo" />
</p>

# Pace extension

[![CI](https://github.com/pacewell/pace-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/pacewell/pace-extension/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A pomodoro timer for building your working pace.** A minimalist Chrome
extension (Manifest V3).

Most pomodoro timers start the second you press play. Pace starts a step earlier
— with a plan. Set your sessions and breaks, and before you begin it shows the
clock time you'll finish. You start each run knowing when you'll be done.

> **Not a website blocker.** Pace doesn't police your attention or block sites.
> It gives you a finish line, a calm backdrop, and a nudge to rest.

<!-- TODO: screenshots — planning · focus countdown · break mask · settings -->

## Features

- **Plan, then start — see your finishing time.** Pace does the math across every
  short and long break and shows the clock time you'll be done.
- **Ambient sound** — rain, forest, or cafe loops with gentle transition chimes.
  Or work in silence.
- **A gentle full-screen break** — dims the page and pauses media when a break
  begins, then waits for you to move the mouse before the next session.
- **Optional cross-device reminders** — no account; get a buzz on your phone when
  a break begins. Off by default.

## Install

- **Chrome Web Store:**
  [Add to Chrome](https://chromewebstore.google.com/detail/acgkenbhfmpcoelnfihoaicgnepneplj)
- **From source:** run the [build](#development), then load `dist/` unpacked at
  `chrome://extensions` → **Developer mode** → **Load unpacked**.

## Development

```bash
npm install
npm run build      # type-check + bundle into dist/
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end smoke (Playwright; rebuilds first)
npm run lint
```

Built with Vite + TypeScript + vanilla HTML/CSS — no UI or CSS frameworks, no
remote code. The build runs Vite twice on purpose: once for the
popup/background/offscreen ES modules, once for the content script as a single
IIFE (it can't be an ES module). After editing `src/content/`, run a full
`npm run build`.

## Privacy

No account, no analytics, no tracking — your settings and timer stay on your
device. The one exception you control: cross-device reminders send a short,
generic message (no personal data) to a private [ntfy.sh](https://ntfy.sh) topic.
Off by default; turned off, the extension makes no network requests at all. Full
details in [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE). Bundled third-party assets (the Inter font, the qrcodegen
library, and CC0 ambient recordings) retain their own licenses — see
[NOTICE](NOTICE).
