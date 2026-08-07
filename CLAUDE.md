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
  (achievements, bestiary, secrets) with localStorage under key
  `mv-black-book` (the shim prefixes everything with `he:`). The in-progress
  run is persisted too (`mv-run`, saved on every state change, cleared when
  `s.over` lands) and offered back at the gate as **`CONTINUE · DAY N`** /
  **`CONTINUE · NIGHT N`**. A gate with no record shows only HOW TO PLAY and
  ENTER; the Black Book, the tally, Deeds and Secrets appear once `meta`
  has a game in it.
- `netlify.toml` 404s `/CLAUDE.md` and `/design_handoff_hollows_edge_redesign/*`
  on the published site; the deploy is wired to pushes on `main` (site
  `hollowsedge` on Netlify).
- **`design_handoff_hollows_edge_redesign/`** is the mobile redesign handoff:
  `README.md` (design system + a section per screen, naming the repo function
  each replaces) and `Hollow's Edge Redesign.dc.html` (the canvas; find a
  screen by its `id="tNN"` section, options `NNa`/`NNb`/…). The other files
  (`hollow-art.jsx`, `ios-frame.jsx`, `support.js`) are the mock runtime, not
  production code. It is presentation only: where it seems to add, remove or
  reweight a player choice, `index.html` wins.
  **`MIGRATION.md` in that folder is the ledger for this work** — status of all
  17 rows, the order, established conventions, the test recipe, and how to
  resume cold. Read it before touching a redesign screen, and update it in the
  same commit as the screen. **All 17 rows are done** — the ledger records what
  each one changed, and the findings where the mock was innocent but the
  obvious implementation would have changed the game.

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
   cottage fallback), `Portrait` (second-pass faces: profession marks,
   per-villager tint, optional `disp` prop that adds a smile only at
   disp >= 1 — hostility is rings/prose, never a scowl; `dead` renders
   greyscale with a grey ✕ baked into the SVG), `MonsterArt`,
   `MonsterDeath` (rite-specific kill animation via `METHOD_FX`/`mvKill-*`
   CSS), `InterviewScene` (per-villager rooms + afflicted variants),
   `DawnScene` (per-location morning scenes + burned/riot/shut/fouled
   variants, chosen from existing state flags), `DayStrip`, `MvIcon`.
7. **UI helpers** — `Btn`, `SpokenText` (word-by-word typing, click to skip),
   `TensionReveal` (staged suspense before life/death outcomes), `Carousel`,
   `DawnCarousel`, `BeatFlow` (the beat column the night / first-light /
   death / offer screens share — see the layout invariant below), CSS in
   `EXTRA_CSS`.
8. **`MonsterVillage`** — the single component: title screen, night cinematic
   (`phase === "night"` renders `s.nightBeats`), **the first-light screen**
   (`phase === "firstlight"` renders `s.dawnBeats` under `s.dawnTitle`),
   offer screen, epilogue,
   the interactive night walk (see below), journal, the dawn screen (a
   full-screen reveal gated on `dawnDone`; FACE THE DAY drops into the
   day), day screen (morning strip header, action cards, fixed
   ACCUSE/NIGHTFALL bar with the journal tab above it), modals. All of
   this is presentation over the same actions and state as before.

## Core invariants (do not break)

- **A centred column that can overflow must be `safe` centred.** Every
  full-screen beat list (night, first light, death, offer) and the epilogue
  card centre their content in a scrolling box. `justify-content: center`
  (or `flex-end`) pushes the START of an overflowing column out through the
  top edge, where **no scrollbar can reach it** — a seven-beat JUDGMENT lost
  its opening line under the title, and a five-deed epilogue lost its
  heading. Use `.mvSafeCenter` / `.mvSafeEnd` (plain keyword first as the
  fallback, `safe` second), and give a single-child scroll box `shrink-0` so
  it cannot be squeezed instead of scrolled. `BeatFlow` wraps all of this
  and also follows the timed reveal down the column, so a beat dealt below
  the fold is scrolled to on the same clock it fades in on.
- **First light is not the night.** Anything the village does awake, in the
  open, together — so far the mob's ultimatum falling due — goes to
  `firstLight` in `resolveNight`, lands in `s.dawnBeats`/`s.dawnTitle`, and
  plays on its own screen between the night cinematic and the morning's
  cards. Never append it to `beats`: a rope thrown over a beam in front of
  everyone read as a footnote to the small hours. It still owes the dawn a
  card — every death, whoever caused it, gets one (the hanged, and the
  accuser the unmasked thing takes in the square).
- **Never name one of the sixteen in ambient prose.** The mundane
  explanation a villager reaches for ("a wolf, some will say") is a leak the
  moment it coincides with the answer. Say what it sounded like, not what it
  might have been.
- **"Nothing is ever proof."** No single line of narration may uniquely
  identify the monster; signs/sounds/demeanor always overlap several types.
  Every sign a monster leaves is real; decoys are tracked in `s.planted`.
  **Honest villagers and village events (Tobias's craft clue, the torch-
  search `sweep`) only ever surface signs the *real* monster leaves
  (`m.signs.includes(sg)`), never a planted decoy — plants are found and
  exposed by the player's own searching, never handed over as gospel by an
  innocent.** There are **8 signs**, each borne by 4-6 of the 15 base
  monsters, so a found sign always leaves several suspects once the mimic is
  counted. Labels: claw/tracks("Strange Tracks" — deliberately NOT "Beast
  Tracks", because the wraith, revenant and Hollowed leave uncanny prints,
  and the sense prose covers both)/bite/cold/flora("Blighted Plants")/hex/
  graves("Grave Dirt")/wail("Unearthly Wailing"). **wail is the rarest tell
  (4 carriers) and is never found on the ground** — it has no `SIGN_CATS`
  entry and is surfaced only through the `wailTonight` path, so it stays out
  of the search/plant/animal machinery (hence the `sg !== "wail"` filters —
  do not remove them). Sensory prose may say "grave dirt" descriptively —
  fine, prose need not match the label. Every monster's signs are justified
  in its own lore (the Hollowed strides, it does not bite — it has no face;
  the succubus bites the throat).
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
  `brush`, `mingled`) branch off and re-enter via `nextStage`/`goReturn`/
  `advanceAfterSearch`. `commitWalk`/`commitWatch` end the night via
  `nightfall(plan)` → `resolveNight`.
  **Every stage must render at least one button.** Both follow-reveal stages
  end on a catch-all written as "any kind not handled above", never as
  `kind === "plain"`: a `followScene` kind nobody wrote a branch for (this
  is exactly what `"grief"` did in the watch flow) strands the whole run on
  a screen with no way off it, and there is no back button in the dark.
  **A find in the lanes stamps.** When the ground or a dead animal gives up
  a sign, `goReturn` passes it as `walk.foundSign` and the `found` stage
  renders a `StampChip` under the prose; the morning's card for the same
  find is an amber `evPlaque`, so a night find reads exactly like a day one.
  Only ever set from a roll made on that screen — the settle in
  `resolveNight` files it unconditionally, so the chip never lies.
- **The close pass** (`brush`) is the rare shape a survival can take. It is
  only ever reached *after* the night has already decided in your favour, so
  it can never kill: `rollApproachFate` and `startFollowFate` pre-roll the
  outcome (`mods.fateDeath` / `mods.followFate`, both re-used verbatim by
  `resolveNight` instead of re-rolling), and only a survival can route
  through `{ type: "brush" }`. The stage is pure reveal: five escalating
  beats (`BRUSH_NOTICE/NEARER/CLOSE/TAUNT/QUARRY`), then the bolt for home
  (`BRUSH_BOLT`), then the commit. It always sets `s.monsterSawYou`, and a
  brushed night skips the whole ground-search settle in `resolveNight`
  (`!mods.brush`) because the player spent it running.
- **Watching it happen** (`witness` stage) — the only place the player sees a
  kill. Opens from `rollApproachFate` **only after the player's own fate has
  rolled survival**, so it can never be a way to die and never touches
  `outDeathChance`: the thing picks you first at the odds it always had, and
  only if it passes do you get to watch it pick a neighbour. That is also why
  the NPC is the likelier victim, which is the intent, not a separate weight.
  Needs `facts.active && facts.huntLoc === walk.loc` and a living, untainted,
  non-host villager whose `outMap` is that same place (`witnessPool`).
  Everything shown is settled in the walk and passed in `mods.witnessKill`
  (victim, `kind`, `sign`) and re-used verbatim: it **overrides `doomedId`**,
  supplies `victimKind` instead of a second roll, and suppresses the generic
  scream beat, the glimpse block and the whole ground-search settle.
  **No shape is ever described.** The one thing you carry off is the mark
  (`WITNESS_KILL`, keyed by sign, wail excluded as always), subject to the
  usual one-tell-a-night (`signGivenTonight()`).
  Shouting cannot kill you (the night already spared you) — it costs
  `s.monsterSawYou`, saves them at 0.35, and a successful save clears
  `doomedId` entirely and sets `s.embolden = n + 1`, so the village pays for
  your courage the following night.
- **`mods.quarry` is the walk's one promise to the next morning**: the
  animal that bolted and drew it off you. Set by the close pass and by a
  hide that resolves `distracted` on a tread that really was the monster
  (`walk.hideIsMonster`; a phantom tread kills nothing, so it owes nothing).
  `resolveNight` pays it: the body is found at dawn killed in the manner of
  its killer (`QUARRY_DAWN`, keyed by sign exactly like `ANIMAL_SIGN`), and
  the place keeps the marks of the chase for that one day if the player goes
  back (`QUARRY_ECHO` in `actSearch`, texture only). It surfaces a NEW tell
  only when the night has not already given one up (`signGivenTonight()`,
  `mods.searchRoll.found`): earned, never doubled, and never a plant.
- **The village keeps its own journal, and you are in it.** `sawYouOut`
  (recorded whenever a neighbour shares your location at night) now costs
  something: a morning card naming the teller and the place, escalating over
  three tiers by `seenOutNights(s)` (which counts NIGHTS, and never counts a
  `met` hail), a −1 disposition on the teller only from the second sighting
  night, floored at −2 so the bottom of the scale stays reserved for things
  you did *to* someone, an innocent's barb in the "where were you" answer,
  and your name coming up in the square before the mob settles on its target.
  The rope never comes for the player: that fail state would make going out
  unplayable.
  **And it knows who you were with.** Crossing paths with someone in the
  lanes on the night they die used to be a private fact ("the village does
  not know that. You do."). It stays private only while nobody saw you: if
  any living neighbour has a `sawYouOut` entry for that same night, the
  village does the arithmetic out loud and `s.lastWith` records it — a
  morning card naming the teller, −1 on the dead's bonded kin (same −2
  floor), the barb said to your face when you ask anyone where they were
  *that* night (it replaces the ordinary lantern barb rather than stacking
  with it), and your name in the square the next time the mob forms. Still
  never fatal.
- **It knows which door is yours.** Once `s.monsterSawYou`, an active night
  can bring it to your threshold (0.35). It never enters and never kills
  there, whatever its `reach` — the barred door is the promise the game
  makes. A night spent **at home** gets dread and *nothing else*, and the
  `DOOR_HOME` pool is deliberately manner-blind (weight, cold, sound, the
  latch) so staying in cannot leak what kind of thing it is: safe and blind
  is the whole bargain. A night spent **out** is different — it had your
  step to itself, so the morning may pay a real tell (`DOOR_MARK`, keyed by
  sign, so a wraith can only leave cold or prints and never claw marks).
  `DOOR_MANNER` splits the sixteen 4/8/4 into beast / cunning / haunt: how
  it stood there, never what it is. The clever kinds sometimes write instead
  of clawing (`DOOR_NOTE`) — never a bargain, that is the coercion note's
  job. Same one-tell-a-night rule as the quarry (`signGivenTonight()`).
- **Fled villagers are gone**: `sampleNight` skips them (no `outMap` entry),
  they cannot be victims, met, or rumored about. Keep `!x.fled` filters when
  adding new pools of villagers.
- `pickFreshIdx(key, arr)` = anti-repetition picker; use it for any pool that
  can surface twice in a game.
- Text style: second person, present tense, dread over gore, em-dash-free,
  "the ${loc}" phrasing. Beats are full paragraphs; morning dawn cards are
  capped at 5 (ranked by `pri`).
- **Line length is a budget, not a preference** — this is a phone game and
  every one of these pools competes with art and a choice stack for one
  screen. Match the house medians when adding to a pool: **night beats ~140
  chars** (cap ~215), **dawn cards ~150** (cap ~235), **interview answers
  ~170** (cap ~200; only `PAST_LINES`, asked once ever, runs to ~315). A new
  pool that reads 20% long will not look wrong in the file and will push the
  buttons off an iPhone. Where a stage stacks beats (the close pass shows
  six), only the current beat plus the last two stay on screen.

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
  one at a time, with pips for how many are left. Beats are `ev` objects so
  portraits ride along. A beat the search *reports* rather than sets
  atmosphere around is wrapped in `evPlaque(ev(...), rule, sign)` and renders
  as a ruled plaque instead of plain prose: `"amber"` = a find (and stamps a
  `<SIGN> · STAMPED` chip under the prose), `"bone"` = a daylight fact (the
  necromancer's grave), `"red"` = a mark exposed as planted. The tag is
  presentational — nothing else reads it, and it touches no odds.
- The search picker is the daylight masthead (`dayMasthead`), not the shared
  `pickerShell`: masked `DayStrip`, question in display type, the six places
  two-up and weighted to the bottom of the screen. Day cards carry no
  affliction suffix — `DawnScene` already bakes burned/riot/fouled/shut into
  the art. Nothing is ticked, greyed or removed: the same place tomorrow is
  a different search.
- `runExamine` wraps `actLookOver`: a positive "changed" finding opens the
  interview with the turned villager immediately (free — the exam already
  cost the daylight), opened with a `TURNED_FACED` line; their answers are
  the `TURNED_RAVING` pool.
- Exams are Falk's (**0.9**); if he is dead/fled, Greta serves at **0.75**,
  and she is the end of the line — lose both and the exam action goes dark.
  These were 0.65/0.45 and were raised deliberately: at 0.45 the action was
  a bad bet the moment Falk died, since it costs an hour and two steps of
  the target's trust and a clean result still meant nothing. The gap between
  the two still says who you want kept alive. **The corrupted examiner is
  not part of this**: a reader who is turned, or is the thing wearing the
  physician's face, clears the changed at any skill level and says so in
  wording you can catch (`"Nothing amiss at all."` versus the honest miss's
  `"It proves less than you would like."`).

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
- A night out never certifies the rhythm: quiet nights can queue a rare
  phantom hide beat (0.12), and two `SOUND_CHASE_MUNDANE` resolutions stay
  deliberately ambiguous, so neither hiding nor running a sound to earth
  proves whether the horror hunts tonight. Only meeting it does.
- Secrets are a payoff, not a nightly harvest: a stay-home watch decodes
  one at 0.12 (`rollHomeWatch`); a crossed-paths "wait" vantage and a
  deliberate follow both decode one only when the night's sampled
  `secretCatch[id]` allows (0.5, rolled once in `sampleNight` so the live
  walk and recap agree — a failed catch reads as an ordinary errand, so a
  tail is a good bet, never a harvest). Villagers go out and lie about
  their nights at the same rate regardless (`outP` untouched).
- `Snd.wail("song")` is the succubus's sweeter night-sound, played only on
  its active nights; everything else gets the grief glide.
- **Grief is bonds, and grief is never a tell.** `BONDS` (6 ties) and
  `FRICTIONS` (3) are authored, symmetrical and the same every game — the
  village is meant to be learnable, like the bestiary. `grievingFor(s, id)`
  returns the most recent death within 3 nights that this villager was tied
  to, bond outranking friction, else `"distant"`. It reroutes `howare`:
  `GRIEF_CLOSE[id]` (2 bespoke lines each, in their own voice), or
  `GRIEF_FRICTION[id]` (guilt, not grief), or `GRIEF_DISTANT`, or
  `GRIEF_TURNED` for a thrall.
  **The monster speaks the villager's own true line** — it wears that face
  and has learned how that face grieves. All that separates them is noise:
  it rings wrong 45% of the time (`GRIEF_OFF`), an innocent 18%. Measured
  over 200k draws that means the monster is the *only* one ringing wrong on
  just 11% of mornings, it grieves flawlessly on 55%, and some innocent
  rings wrong on 75%. Do not "tighten" those numbers — a readable grief tell
  would end the game on day two. `GRIEF_DAWN_DRY` names anyone NOT tied to
  the dead (usually an innocent) and waits for night 3, same as every other
  named rumour.
  Bonds also carry the moral weight: hanging someone on your word costs
  their bonded kin −2 disposition (the heaviest single move in the game),
  the mob hanging them costs −1 for your standing by, and saving them earns
  their kin +1.
- **The grief errand** (`facts.griefOut`, sampled in `sampleNight`, logged on
  `nightLogs` so the interview can read it): a close mourner goes out alone
  to the Graveyard at 0.4, which outranks the gathering and the ordinary
  errand both. From any doorway that is indistinguishable from the other
  thing — out late, no lantern, and the ground where the dead are — and the
  mob will hang them for it.
  **The monster takes this errand too**, on nights it is not hunting, wearing
  a face that had every reason to go (see the `else` in its `sampleNight`
  branch). So `followScene`'s `"grief"` kind resolves the same for both, with
  no catch roll (there is nothing to decode about someone at a grave), and
  the clue is written as fact, never clearance: *"That is where they were. It
  is not what they are."* The monster's `where` answer on a grave night is
  drawn from the **same** `GRIEF_WHERE_TRUE`/`LIE` pools at the **same** 60/40
  split as an honest mourner — an alibi pattern that differed from grief's
  would be exactly the tell grief is not allowed to be.
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

- Player deaths go to `s.deathBeats` (NOT the night beats): the moment a
  run ends against the player, the blood-dark death screen ("YOU DO NOT
  SEE THE DAWN", looming art) plays the `DEATH_SCENES` beats immediately.
  The live walk already delivered the encounter, so no night cinematic
  plays in between. Never append death scenes to `nightBeats`.
- `MonsterArt`/`MonsterDeath` take a `light` prop (pale backdrop discs) for
  dark-on-dark contexts: home Black Book grid, epilogue, death/offer/win
  screens. The journal/bestiary render on parchment and must NOT use it.
- The night cinematic shows `MonsterDeath` art on a win and a looming
  `MonsterArt` (`.mvLoom`) on a player death. The walk is a full-bleed
  `NightShell` whose whole frame goes red and breathes (`.mvEdgeRed`,
  `.mvHeart` on the SOMETHING IS CLOSE line) during dangerous stages —
  the old `.mvDangerPulse` panel is gone.

## Testing (no network to unpkg from CI/sandbox)

The steps below are now scripted. **Run this before every commit** — it is the
only automated check the project has, and JSX transpiles at page load, so a
typo is invisible until something renders it:

```bash
bash tools/setup-local.sh     # vendor the 5 CDN libs into .local-test/ (once)
node tools/smoke.mjs          # boot + play smoke test; non-zero on any error
node tools/smoke.mjs --headed # watch it run
```

`setup-local.sh` vendors the libraries and writes `.local-test/index.local.html`
(a copy of index.html with its five `<script src>` URLs repointed locally),
because the CDNs are usually blocked in sandboxes. `.local-test/` is gitignored
— **never commit the patched copy, and never copy it over `index.html`**: it
only runs with `.local-test/vendor/` beside it. `smoke.mjs` serves it, asserts
the page boots (`#boot` is removed on success), React mounts, and the gate
reaches a live run, printing Babel's line number and code frame on a parse
failure.

Two caveats and two techniques:
1. The vendored Tailwind is **v4**; production loads the **v3** CDN. The
   harness proves "does it run", never "does it look right" — don't chase a
   layout difference seen only locally.
2. Bump a library version in `index.html` and you must bump the matching pin in
   `tools/setup-local.sh` (it fails loudly rather than testing the wrong thing).
3. To force rare paths (deaths, offers), override `Math.random` via
   `page.evaluate(() => { Math.random = () => 0.001; })` after starting the
   walk — an active night + event + hunts-crowd usually lands at the Village
   Square.
4. Watch `page.on('pageerror')` — Babel parse errors also surface in
   `#bootErr`. Babel also logs one harmless "deoptimised the styling" error on
   every run (the inline script is >500KB); `smoke.mjs` filters that one string
   only, and the filter must stay narrow.

See `AGENTS.md` for repo state, the `main` history split, and the deploy path.

## Git / authorship preferences (important)

- Commits in this repo are authored as **Jacob Strong
  <jacobstrong3357@gmail.com>**. Do NOT add `Co-Authored-By: Claude`,
  `Claude-Session` trailers, or any AI attribution to commits, PRs, or code
  comments — the owner explicitly requested authorship be theirs alone.
- Work happens on feature branches, pushed with `git push -u origin <branch>`.
