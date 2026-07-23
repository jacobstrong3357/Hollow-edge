# Agent context (Codex / others)

This repo's full project context lives in **`CLAUDE.md`** — read it first. It is
the source of truth for how the file is organized and the invariants that must
not break.

For visual/design work specifically, also read **`DESIGN.md`**: it maps the art
components, their props/state contract, and the design rules an outside pass is
most likely to violate.

Quick facts:

- The entire game is **`index.html`** (~9,500 lines). No build step, no
  bundler, no package.json. Serve/open the file to run it.
- The browser loads only `index.html` (+ CDN scripts). These `*.md` files are
  docs; they are never loaded at runtime and do not affect the game.
- Authorship: commit as **Jacob Strong <jacobstrong3357@gmail.com>**. Do NOT
  add AI attribution / co-author trailers to commits, PRs, or code comments.
