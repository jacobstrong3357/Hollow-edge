# Hollow's Edge — project context

A gothic social-deduction game: one of eight villagers is secretly one of fifteen
monsters. The player investigates by day, chooses how to spend each night, and
must name both WHO and WHAT before the village runs out of people.

## Repo layout

- **Everything is one file: `index.html`** (~7,400 lines). No build step, no
  bundler, no package.json. React 18 + Babel standalone (JSX transpiled in the
  browser) + Tailwind CDN + Tone.js (synthesized audio), all loaded from CDNs
  on first page load. Deploy = serve/open the file.
- `window.storage` shim at the top backs the persistent "Black Book" meta
  (achievements, bestiary, secrets) with localStorage.

## How the file is organized (top to bottom)

1. **Boot shim + failure surface** (`#boot`, `__bootFail`).
2. **`Snd`** — all audio, built once in `init()`, never constructed lazily.
3. **DATA** — `LOCS`, `SIGNS`, `SIGN_SENSE(_BODY)`, `METHODS`,
   `METHOD_KILL_LINES`, `MONSTERS` (15 defs: signs, rhythm, attack, reach,
   method, hunts, lore), then dozens of text pools (dusk/home/out lines,
   screams, gossip, afflictions, mob, `DEATH_SCENES`, `OFFER_SCENES`,
   night-one bespoke scene, walk pools: HIDE_*, TENSION_*, FOLLOW_*, HAIL_*,
   VIGIL_, QUIET_WATCH_, etc.).
4. **NPCs** — `NPC_DEFS`, `PERSONA`, `SECRET_POOL` (one human secret per
   villager per game), `HOME_LOC` (only liesel/ansel; others render the
   generic cottage in `Scene`).
5. **Game setup / night resolution** — `newGame()`, `isActive()`,
   `sampleNight()`, `resolveNight()` (the heart: ~1,000 lines), then day
   actions (`investLook`, `actSearch`, `actAccuse`, interview logic
   `computeAnswer`/`applyAnswer`).
6. **SVG art components** — `Scene` (location silhouettes; unknown loc =
   cottage fallback), `Portrait`, `MonsterArt`, `MonsterDeath` (rite-specific
   kill animation via `METHOD_FX`/`mvKill-*` CSS), `InterviewScene`.
7. **UI helpers** — `Btn`, `SpokenText` (word-by-word typing, click to skip),
   `TensionReveal` (staged suspense before life/death outcomes), `Carousel`,
   `DawnCarousel`, CSS in `EXTRA_CSS`.
8. **`MonsterVillage`** — the single component: title screen, night cinematic
   (`phase === "night"` renders `s.nightBeats`), offer screen, epilogue,
   the interactive night walk (see below), journal, day screen, modals.

## Core invariants (do not break)

- **"Nothing is ever proof."** No single line of narration may uniquely
  identify the monster; signs/sounds/demeanor always overlap several types.
  Every sign a monster leaves is real; decoys are tracked in `s.planted`.
- **Facts are sampled once.** `sampleNight()` decides everything (who is out,
  weather, whether/where it hunts, afflictions) BEFORE the walk begins;
  the walk UI only *reveals* facts and records choices in `mods.*`. The walk
  never rolls an outcome that `resolveNight` re-rolls — anything shown live
  is passed through `mods` (e.g. `searchRoll`, `fateDeath`, `homeWatch`) and
  only "settled" (clues/dawn cards/state) in `resolveNight`.
- **The night walk is a queue state machine** (`startWalk`): nodes
  `depart → affliction? → lane? → event? → sound? → hide? → approach →
  company? → return`, advanced by `nextStage(walk, fromType)`. Side scenes
  (`followed`, `hailed`, `chased`, `listened`, `hidden`, `vigil`, `found`,
  `mingled`) branch off and re-enter via `nextStage`/`goReturn`/
  `advanceAfterSearch`. `commitWalk`/`commitWatch` end the night via
  `nightfall(plan)` → `resolveNight`.
- **Fled villagers are gone**: `sampleNight` skips them (no `outMap` entry),
  they cannot be victims, met, or rumored about. Keep `!x.fled` filters when
  adding new pools of villagers.
- `pickFreshIdx(key, arr)` = anti-repetition picker; use it for any pool that
  can surface twice in a game.
- Text style: second person, present tense, dread over gore, em-dash-free,
  "the ${loc}" phrasing. Beats are full paragraphs; morning dawn cards are
  capped at 5 (ranked by `pri`).

## Daylight search & the exam

- `actSearch` keeps its find odds (0.4 base; frost 0.55 / storm 0.22) —
  never raise them. The *experience* around the roll is where richness
  lives: an optional villager/gossip texture beat before the result, an
  animal-carried presentation of a found sign (`ANIMAL_SIGN`, day-safe
  subset only: bite/claw/tracks/flora/hex), and a rare subtle monster
  trace afterward (`DAY_TRACES`: humming, a giggle, a small message —
  never diagnostic, slightly likelier on its actual hunting ground).
- The day search plays as a staged scene (`runSearchScene`/`daySceneModal`):
  pick an approach (cosmetic — outcome already settled), then beats reveal
  one at a time. Beats are `ev` objects so portraits ride along.
- `runExamine` wraps `actLookOver`: a positive "changed" finding opens the
  interview with the turned villager immediately (free — the exam already
  cost the daylight), opened with a `TURNED_FACED` line; their answers are
  the `TURNED_RAVING` pool.

## Player death / monster death

- Player deaths append `DEATH_SCENES[monsterId](wearerName, where)` to the
  night beats — kept to **three tight beats** on purpose (they used to be 4
  long ones and read 25+ lines; don't let them bloat again).
- The night cinematic shows `MonsterDeath` art on a win and a looming
  `MonsterArt` (`.mvLoom`) on a player death; the walk overlay has a live
  `Scene` panel that pulses red (`.mvDangerPulse`) during dangerous stages.

## Testing (no network to unpkg from CI/sandbox)

The CDNs may be blocked in sandboxes. To test headless:
1. `npm install react@18.3.1 react-dom@18.3.1 @babel/standalone@7.24.7
   tone@14.7.77 @tailwindcss/browser` in a scratch dir, copy the UMD builds,
   and `sed` the `<script src>` URLs in a **copy** of index.html to local
   paths (never commit that copy).
2. Serve with `python3 -m http.server`, drive with Playwright
   (`/opt/pw-browsers/chromium`). Use `page.evaluate` + native `el.click()`
   (Playwright actionability fights the overlay animations).
3. To force rare paths (deaths, offers), override `Math.random` via
   `page.evaluate(() => { Math.random = () => 0.001; })` after starting the
   walk — an active night + event + hunts-crowd usually lands at the Village
   Square.
4. Watch `page.on('pageerror')` — Babel parse errors also surface in
   `#bootErr`.

## Git / authorship preferences (important)

- Commits in this repo are authored as **Jacob Strong
  <jacobstrong3357@gmail.com>**. Do NOT add `Co-Authored-By: Claude`,
  `Claude-Session` trailers, or any AI attribution to commits, PRs, or code
  comments — the owner explicitly requested authorship be theirs alone.
- Work happens on feature branches, pushed with `git push -u origin <branch>`.
