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
  (achievements, bestiary, secrets) with localStorage. The in-progress run
  is persisted too (`mv-run`, saved on every state change, cleared when
  `s.over` lands) and offered back at the gate as "RETURN TO ... UNFINISHED".
- `netlify.toml` 404s `/CLAUDE.md` on the published site; the deploy is
  wired to pushes on `main` (site `hollowsedge` on Netlify).

## How the file is organized (top to bottom)

1. **Boot shim + failure surface** (`#boot`, `__bootFail`).
2. **`Snd`** — all audio, built once in `init()`, never constructed lazily.
3. **DATA** — `LOCS`, `SIGNS` (8 signs; "reflect"/Fogged Mirrors was retired
   — each sign belongs to 5-6 of the 15 base monsters, wail included),
   `SIGN_SENSE(_BODY)`, `METHODS`, `METHOD_KILL_LINES`, `MONSTERS` (16 defs:
   signs, rhythm, attack, reach, method, hunts, lore — the 16th, The
   Hollowed, only enters the draw once all other 15 are in the Black Book;
   `gameMonsters(s)` gates every in-run list by `s.hollowedIn` so it can
   never appear as a suspect in a game it cannot be the answer to; the
   title-screen Black Book always shows all 16 in a 4×4 grid), then dozens
   of text pools (dusk/home/out lines,
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
  **Honest villagers and village events (Tobias's craft clue, the torch-
  search `sweep`) only ever surface signs the *real* monster leaves
  (`m.signs.includes(sg)`), never a planted decoy — plants are found and
  exposed by the player's own searching, never handed over as gospel by an
  innocent.** SIGNS labels: claw/tracks/bite/cold/flora("Blighted Plants")/
  hex/graves("Grave Taint")/wail. Sensory prose may still say "grave dirt"
  descriptively — that's fine, prose need not match the label.
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
- Exams are Falk's (0.65); if he is dead/fled, Greta serves at 0.45, and
  she is the end of the line — lose both and the exam action goes dark.

## Tuning choices (deliberate — don't "fix")

- The mimic is silently excluded from a player's very first game
  (`newGame(veteran)`); every later draw is the full 15. Never surface this.
- `monsterFancies` (the hidden offer/bond system) is 0.40 per game.
- Deduction hints stay whispers: the journal nudges the player to count
  night-gaps and note home-vs-open deaths, but never does the math for
  them. No auto-computed "fits/doesn't fit" indicators.
- Stay-home nights get at most one `HOME_NIGHT_MOMENTS` flavor beat (35%);
  they must never yield information — safe and blind is the bargain.
- When the journal narrows to exactly one creature (`armedGuess`), the day
  screen shows the Wilhelm "you walk armed now" banner; the kill itself
  happens in `applyFollowConsequence` (confront while armed). **Armed +
  right name always wins** — the banner promises "if you are right, this
  ends tonight" and the code keeps that promise (a 25% roll swaps in a
  near-death scare beat, never a loss). Wrong name stays lethal (0.7).
- Secrets are a payoff, not a nightly harvest: a stay-home watch decodes
  one at 0.12 (`rollHomeWatch`); a crossed-paths "wait" vantage and a
  deliberate follow both decode one only when the night's sampled
  `secretCatch[id]` allows (0.5, rolled once in `sampleNight` so the live
  walk and recap agree — a failed catch reads as an ordinary errand, so a
  tail is a good bet, never a harvest). Villagers go out and lie about
  their nights at the same rate regardless (`outP` untouched).
- `Snd.wail("song")` is the succubus's sweeter night-sound, played only on
  its active nights; everything else gets the grief glide.
- **Tell noise is load-bearing**: the monster's person-question tells
  (talk/howare/past) fire only ~45% — otherwise it answers from the borrowed
  villager's own human pools (a fine actor). Innocents give scared/rude
  off-notes ~15% (TALK_OFF/HOWARE_OFF/PAST_OFF). A corrupted mouth (monster
  or thrall) never yields honest craft evidence: it deflects or invents a
  false trail via SIGN_TALK, spoken only, never journal-marked. So an
  answer that "sits wrong" is never proof, and neither is a helpful one.
- Interview-witnessed signs are marked "seen" in the evidence page but
  never auto-ticked: ticks are the player's theory, and both planted marks
  and borrowed mouths can lie.
- The `mvKill-*` rite animations must end on a VISIBLE dimmed corpse
  (opacity ~0.4-0.55), never fade to nothing: players screenshot/arrive
  after the animation ends.
- A neck saved from the mob (`s.mobSpared`, ~3 dawns) cannot be re-marked
  immediately; named strange-rumor dawn cards hold off until night 3 so a
  day-one whisper never invites a lucky coin-flip accusation.
- Outdoor hunters' kills lean 65% toward victims on their own hunting
  ground, so bodies and ground evidence tell one story.

## Player death / monster death

- Player deaths go to `s.deathBeats` (NOT the night beats): the night
  cinematic ends on its cliffhanger line and a separate blood-dark death
  screen ("YOU DO NOT SEE THE DAWN", looming art) plays the three
  `DEATH_SCENES` beats. Never append death scenes to `nightBeats`.
- `MonsterArt`/`MonsterDeath` take a `light` prop (pale backdrop discs) for
  dark-on-dark contexts: home Black Book grid, epilogue, death/offer/win
  screens. The journal/bestiary render on parchment and must NOT use it.
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
