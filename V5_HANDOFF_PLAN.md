# Hollow's Edge — Version 5 Handoff Plan

## Current state

- Repository: `jacobstrong3357/Hollow-edge`
- Active branch: `codex/v5-immersion`
- Version 4 remains preserved on `main`.
- Game implementation: one self-contained React/Babel application in `index.html`.
- Current V5 work has been visually checked at `http://127.0.0.1:4173/` with `python3 -m http.server 4173 --bind 127.0.0.1`.

## Visual direction — non-negotiable

The game should feel like premium, dark illustrated mobile horror: hand-inked, candlelit, textured, and animated. Do **not** drift into glossy CGI, photoreal AI art, anime, or generic fantasy art.

The agreed character tier is one step below the supplied Tobias ink portrait: expressive illustrated faces, clear hair, rich ink hatching, and craft-specific backgrounds. Portraits must remain readable at 30–56px.

## Work already completed

| Area | Result | Commit |
| --- | --- | --- |
| V5 baseline | Dedicated V5 branch created from V4; V4 untouched | `9fd024a` |
| Home/save foundation | Animated title gate plus three-slot Run Ledger and autosave continuation | `9fd024a` |
| Character craft context | Original SVG cast gained profession-aware background marks | `b5d999a` |
| SVG fallback polish | Hair and restrained facial ink for death/revealed states | `c51c836`, `f8047f6` |
| Living cast art | Eight illustrated villager portrait assets in `assets/v5-portraits/`; all normal living cards use them | `86b52e7` |
| Home screen polish | Layered moving village scene, lanterns, clearer save/continue gate panel, Run Ledger shortcut | `085b76c` |

## Immediate priorities

1. **Night walks: turn text into scenes.**
   - Build proper animated location backdrops for forest, churchyard, tavern, mill, and graveyard.
   - Use parallax tree layers, drifting fog, moving branches/clouds, candle/torch flicker, and a distant figure where narratively appropriate.
   - Reveal important discoveries as large visual evidence cards or overlays, not buried in prose.

2. **Soundscape: make the village audible.**
   - Expand existing `Snd` work with subtle, state-aware layers: footstep crunches, tree creaks, distant whispers, church bell, glass/bottle noises, wind, wails, and sudden stingers.
   - Respect browser audio rules and retain the existing sound toggle.
   - Sound must support a scene, never loop distractingly or obscure choice text.

3. **Deaths and horror beats.**
   - Improve death/reckoning sequences with staging, animated silhouettes, bloodless-but-brutal implication, dynamic lighting, and reactive visual aftermath.
   - Preserve clarity and the existing game logic. No mechanics or clue truth should change just to service an animation.

4. **Information hierarchy.**
   - Audit long prose moments. Surface signs, findings, contradictions, and new evidence with icon-led plaques/cards before or alongside the prose.
   - Keep prose for atmosphere; do not hide required information inside paragraphs.

5. **Screen-by-screen UI pass.**
   - Apply the title-screen quality bar to village, profiles, interrogation, journal, accusation, night choices, and ending screens.
   - Prefer clear primary actions, stronger hierarchy, and an illustrated focal point on every screen.

## Important implementation rules

- Read `CLAUDE.md` before changing gameplay or clue logic. Deduction fairness is a hard constraint: facts are sampled once, no single clue proves the answer, and the game must remain solvable.
- `Portrait` is near `index.html:5922`. Living characters use raster art; dead or revealed-turned characters deliberately fall back to reactive SVG so state changes remain legible.
- Home scene helpers are around `HomeScene` near `index.html:7660`; home CSS begins near `EXTRA_CSS` around `index.html:8031`.
- Keep new game assets under `assets/` and reference them with paths relative to `index.html` so the local `file://` version works after refresh.
- Use the built-in image generator for any new raster art. Inspect output before adding it to the project. Avoid overwriting selected assets without a new versioned filename.
- Test visual changes in the browser before committing. Prefer `rg` for code search and `apply_patch` for source edits.

## Suggested first task in the new thread

Begin with **Night Walk V5: Dark Forest**. Create one strong reusable animated-scene framework, then adapt it to other locations. This is the highest-impact answer to the original feedback that night walks are “just text with background images.”
