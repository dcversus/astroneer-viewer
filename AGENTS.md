# Agent guide

Astroneer Viewer is a client-only web app: it reads an Astroneer `.savegame`
in the browser and draws the worlds in 3D. There is no backend and no network
call with user data; keep it that way.

## Layout

- `src/save/` binary reader, container parser, tagged-property decoder
- `src/model/` world model extraction, categories, friendly names
- `src/scene/` Three.js terrain, miniatures, camera, pins, networks
- `src/ui/` DOM helpers, icons, Journey and raw-data browser
- `src/main.ts` app shell and state
- `tests/` Node test runner suites (`npm test`)
- `scripts/` CLI helpers for inspecting a save
- `docs/` VitePress site published to GitHub Pages

## Rules

- No comments in code. Names and small functions carry the meaning; ESLint
  fails the build on any comment.
- Strict TypeScript and strict ESLint must pass: `npm run check`.
- Format with Prettier (`npm run format`).
- Never commit save files. `*.savegame` is ignored; keep it so.
- Everything the user sees is plain language: no class names, enum tags or
  internal ids outside the "Advanced" sections.
- Verify changes in a real browser before calling them done; the renderer and
  camera cannot be judged from code alone.

## Working with a save

`npm run summary -- path/to/file.savegame` prints planets, counts and links.
`npm run dump -- path/to/file.savegame ClassName 3` prints decoded objects.
