# Contributing

Thanks for helping. The project is GPL-3.0; by contributing you agree your
changes are released under the same license.

## Setup

```bash
npm install
npm run dev
```

Node 22 or newer. The dev server opens the app; drop any `.savegame` onto it.

## Before you open a pull request

```bash
npm run check   # types, lint, formatting, tests
npm run build
```

CI runs the same commands. The lint step rejects comments on purpose: write
code that explains itself with good names and small functions.

## What makes a good change

- Keep the app client-only. No uploads, no telemetry.
- Prefer plain words in the interface over game-internal names.
- If you touch the renderer or camera, check it in a browser on desktop and on
  a phone-sized viewport, and say what you tried in the PR.
- Add or extend a test in `tests/` when you change parsing or extraction.

## Reporting a save that does not open

Open an issue with the game version and the error shown. Do not attach the save
unless you are comfortable sharing it; the first 64 bytes as hex are usually
enough to see the container header.
