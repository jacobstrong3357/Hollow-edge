# Redesign migration ledger

The mobile redesign is being applied to `index.html` **one screen at a time**,
across many sessions and many different agents. This file is the shared memory.
It is the only file you must read to pick the work up cold.

**If you are starting a session: read "Resuming cold" below, pick the next
unstarted row from the status table, and do exactly that one row.**

---

## Resuming cold

1. Read `CLAUDE.md` at the repo root (project invariants — these outrank the
   design package everywhere they disagree).
2. Read this file's status table. Pick the topmost row marked `todo`.
3. Read **only** that row's README section and its canvas section. Do not read
   the whole canvas — it is 414 KB and will eat the session.
   - README: `design_handoff_hollows_edge_redesign/README.md`, the numbered
     entry under "## Screens".
   - Canvas: `design_handoff_hollows_edge_redesign/Hollow's Edge Redesign.dc.html`.
     Find the section with `grep -n 'id="tNN"'`, then read that line range only.
     Section line offsets are in the status table so you can jump straight there.
4. Read the repo function(s) that row replaces. Nothing else.
5. Build it, test it (see "Testing"), commit it, tick the row, push.

**One row per commit.** Do not batch two screens into one commit — a
half-finished batch is what makes a credit outage expensive.

---

## The rules that outrank the design package

The handoff's own README says it plainly, and it is worth repeating because it
is the mistake this project keeps almost making:

> If an instruction in this package seems to add, remove or reweight a player
> choice, it is a mistake in this package — follow `index.html`.

The redesign is **presentation only**. Concretely, before you build a screen,
check the mock against the real function and refuse the mock where it:

- invents a player choice the code does not offer, or drops one it does;
- changes odds, costs, action-point spend, or what a roll can produce;
- computes anything for the player (the journal in particular: no
  "fits / doesn't fit", no tally of what remains, no auto-ticked signs);
- surfaces a planted decoy as gospel from an honest villager or a village event.

Everything in `CLAUDE.md` under "Core invariants" and "Tuning choices" still
holds. If a mock implies otherwise, the mock is wrong. Note the conflict in
this file's "Conflicts found" section rather than silently resolving it.

---

## Status

Sections are the README's own numbering. "Canvas" is the `id=` to grep for.
"Offset" is the line the section started at as of commit `bac0533` — the file
does not change, so these stay valid.

| # | Screen | Canvas | Offset | Replaces | Status |
|---|---|---|---|---|---|
| 11 | **Daylight search** | `t20` 20a-20c | 368 | `searchModal`, `runSearchScene`, `dayLocBtn` | **done** — `bac0533` |
| — | Recurring objects as helpers | — | — | `Plaque` / `StampChip` / `Pips` / `Dock` + `DockBtn` | **done** — *"Lift the four recurring objects out of the search screen"* |
| 9 | Night walk, watch, follow | `t18` 18a-18d, `t19` 19a/19b | 749, 653 | walk render, `watchModal` | todo |
| 8 | Nightfall | `t17` 17a-17c | 953 | `planModal` | todo |
| 10 | Under siege | `t16` 16a/16b | 1166 | `s.fled` branch of the plan modal | todo |
| 1 | Day screen | `t2` 2a/2b | 3546 | day screen render, `actCard`, ACCUSE/NIGHTFALL foot | **done** — *"Redesign the day screen"* |
| 13 | Examination | `t20` 20d/20e | 368 | `examineModal`, `runExamine` | **mostly** — *"Redesign the examination"*. 20d and the reading are done; 20e's violet interview waits on §3, see below |
| 12 | Death scene | `t21` 21a/21b | 257 | `investModal`, `INVEST_ACTS`; needs `ShroudH` folded in | todo |
| 6 | Dawn reveal | `t8` 8a/8b | 2479 | dawn branch, `DawnCarousel` | todo |
| 5 | Journal | `t7` 7a-7c (+ any `t5`) | 2561 | `journal` block | todo |
| 3 | Interview | `t2` 2d | 3546 | `InterviewView` | todo |
| 2 | Villager page | `t2` 2c | 3546 | `profileModal` | todo |
| 4 | Title + Black Book | `t3` 3a/3b/3d | 3229 | title branch | todo |
| 7 | Night cards | `t14` 14a/14b | 1493 | night cinematic, `N1_*` pools | todo |
| 14 | Accusation | `t22` 22a/22b | 97 | `accuseModal` | todo |
| 15 | Offer and rite | `t15` 15a-15c | 1273 | `OFFER_SCENES`, `riteModal` — **15b/15c are superseded by 22a/22b, reference only** | todo |
| 16 | Endings | `t11`, `t12`, `t13` | 1843, 1708, 1588 | death / offer / win branches, `DEATH_SCENES` | todo |

Unmapped canvas sections: `t4` (offset 2913) and `t10` (offset 2041) were not
identified. There is no `t5`, `t6` or `t9` despite the README citing "5a-5c".
Whoever touches the journal or interview should check `t4`/`t10` for an earlier
pass and record what they are here.

### Why this order

Helpers first, because every screen after them is assembly rather than
restatement. Then the night-walk shell, which is the most reused layout in the
game (§9 → §8 → §10 all share its furniture). Then the day screen and the two
remaining day actions, which share the daylight masthead the search already
built. Reports, then the endgame screens last — they are the least reused and
the most self-contained, so they are the safest things to leave unfinished.

---

## Conventions already established

Set by the daylight search (`bac0533`). Reuse these; do not reinvent them.

- **`evPlaque(ev(...), rule, sign)`** (near the `ev` helper, ~L2133) tags a day
  beat that the game *reports* rather than sets atmosphere around, so the
  renderer can give it a ruled plaque. `rule` is a `PLAQUE_RULES` key — `"amber"`
  (a find, and stamps a `<SIGN> · STAMPED` chip), `"bone"` (a daylight fact),
  `"danger"` (a mark exposed as planted), `"change"`. Purely presentational —
  nothing else reads it.
- **`DAY_STRIP_MASK`** (just after the `C` object) is the shared fade ramp for
  any full-bleed strip that runs off the top of a screen. Full-bleed art never
  hard-cuts.
- **`dayMasthead(kicker, title, sub)`** and **`apKicker()`** (in
  `MonsterVillage`, near `searchModal`) are the daylight header: masked
  `DayStrip` at 230px, amber kicker, 26px display title, `C.dim` sub. The
  examination (20d) and the day screen use the same one.
- **The dock** is now the `<Dock>` / `<DockBtn>` pair — see the next section.
  Do not hand-roll one.
- **Content sits against the dock, not under the header**: the scrolling middle
  is `flex-1 min-h-0` and its choice group carries `marginTop: "auto"`. This is
  what stops the half-empty screens the first drafts had.
- **Safe areas**: `paddingTop: max(env(safe-area-inset-top), 16-20px)` on any
  full-screen takeover. The mocks' 52px top padding is the iOS status bar in the
  phone frame, not a real value — do not copy it literally.
- Existing CSS to reuse rather than re-add: `.mvGrain`, `.mvVignette`,
  `.mvGrainF`, `.mvIvIn` (fade-up), `.mvIvChip`, `.mvIvDock`, `.mvDangerPulse`,
  `.mvEdgeRed`, `.mvHeart`, `.mvLoom`, `.mvKill-*`.

### The four recurring objects — built, use them

Module-level components just after `Btn` (~L6395). They hold no state and no
game knowledge, so a screen decides *what* to say and these decide how it looks.
**Assemble screens out of these rather than restating their styles inline.**

- **`<Plaque rule portrait className style>`** — anything the game *reports*.
  `rule` is a key, never a colour: `"amber"` = a find, `"bone"` = a daylight
  fact, `"danger"` = something turned against you, `"change"` = the examination
  and a neighbour known changed (`PLAQUE_RULES` holds the hexes). Pass
  `portrait={<Portrait .../>}` for the left-portrait variant at 40-44px, gap 12.
  **A rule may not mean two things** — that is the whole vocabulary.
- **`<StampChip sign held suffix>`** — a sign written into evidence. `held`
  false renders the not-held treatment. Default suffix is `· STAMPED`; pass
  `suffix=""` for a bare label (the bestiary's sign rows).
  **Only ever list signs the player has actually found.**
- **`<Pips n live size>`** — how many looks or beats remain.
- **`<Dock tone line>`** + **`<DockBtn kind>`** — the bottom bar. `tone` is
  `"night"` (default), `"deep"`, or `"bruise"` (accusation, death scene).
  `DockBtn` `kind` is `"commit"` (amber outline), `"destroy"` (filled `C.red`),
  or `"quiet"`. **Amber is never decoration**: if it is amber, pressing it
  spends something or ends a phase.

The daylight search is the reference implementation of all five. The ~15 older
docks elsewhere in the file still carry their styles inline; convert each one as
you redesign its screen, not before.

---

## Per-screen workflow

1. `git checkout -B claude/hollows-edge-<screen-slug> origin/main` — or continue
   on the current branch if the previous screen has not merged yet. Check with
   the repo owner if unsure; never push to `main`.
2. Read the README entry + the one canvas section + the one repo function.
3. Build it. Match colours, type sizes, spacing, radii exactly — fidelity is
   high. Wire real generators; the mocks' sentences are sample output of the
   game's own pools and must never be hardcoded. Villager names in the mocks
   come from `NPC_DEFS` but every run generates its own cast.
4. Test (below). Zero page errors is the bar.
5. Commit one screen, in the repo's voice (see "Authorship").
6. **Update this file**: flip the row to `done`, identifying the commit by its
   **subject line, not its sha** — you cannot know your own sha before you make
   the commit, and amending to backfill it only changes the sha again. Add any new
   convention to "Conventions", add any mock-vs-code conflict to "Conflicts
   found". Commit that with the screen.
7. `git push -u origin <branch>`.

### Optional prep: per-screen briefs

`briefs/` is reserved for pre-digested per-screen specs, so an implementing
session never opens the canvas at all. An attempt to generate these via parallel
subagents was made at `bac0533` and died on a session limit before writing
anything — the directory is currently empty. This is a **nice-to-have, not a
blocker**: reading one canvas section directly is cheap. If you do generate a
brief, write it as `briefs/NN-name.md` covering: what it replaces, intent,
structure with exact transcribed styles, real data to wire, interactions,
conflicts with `index.html`, open questions.

---

## Testing

The CDNs are blocked in sandboxes, so test against a local-vendored copy. Never
commit the copy.

```sh
SP=<scratchpad>/t; mkdir -p $SP && cd $SP
npm install react@18.3.1 react-dom@18.3.1 @babel/standalone@7.24.7 \
            tone@14.7.77 @tailwindcss/browser playwright
cp /home/user/Hollow-edge/index.html $SP/test.html
cp node_modules/react/umd/react.production.min.js react.js
cp node_modules/react-dom/umd/react-dom.production.min.js react-dom.js
cp node_modules/tone/build/Tone.js tone.js
cp node_modules/@babel/standalone/babel.min.js babel.js
cp node_modules/@tailwindcss/browser/dist/index.global.js tw.js
sed -i 's|https://cdn.tailwindcss.com|./tw.js|; \
        s|https://unpkg.com/react@18.3.1/umd/react.production.min.js|./react.js|; \
        s|https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js|./react-dom.js|; \
        s|https://unpkg.com/tone@14.7.77/build/Tone.js|./tone.js|; \
        s|https://unpkg.com/@babel/standalone@7.24.7/babel.min.js|./babel.js|' test.html
python3 -m http.server 8899 &
```

Then drive it with Playwright at `executablePath: '/opt/pw-browsers/chromium'`,
viewport 402x874. Notes that cost time to rediscover:

- Use `page.evaluate` + native `el.click()`. Playwright actionability fights the
  overlay animations.
- Getting to the day screen: click `ENTER HOLLOW'S EDGE`, then loop clicking
  `ONWARD` / `FACE THE DAY` / `skip` until a button containing `Search a Place`
  exists. Night one is a cinematic, not a menu.
- Watch `page.on('pageerror')`. Babel parse errors also land in `#bootErr`.
  Ignore the `[BABEL] deoptimised` console note and favicon 404s — both benign.
- To force rare paths, override `Math.random` via `page.evaluate` **after**
  reaching the screen. Note that `Math.random = () => 0.05` is not enough on its
  own when a pool is empty — e.g. a daylight search finds nothing if
  `s.locEvidence[loc]` is empty regardless of the roll. To exercise a find,
  patch the *test copy* (`sed` the `unfound` line to a literal) rather than
  fighting the state.
- The death-scene modal's close button reads `STEP AWAY FROM THE BODY`, not
  `CLOSE`. Several modals have bespoke close copy; grep before assuming.

---

## Conflicts found

Where a mock implied a mechanic the code does not have, and what was done.

- **§11 daylight search** — none. The three approaches are cosmetic in both the
  mock and the code (the roll is settled in `actSearch` before the scene opens),
  and the mock's "nothing is ticked or greyed" matches the code, where searching
  the same place again is a fresh roll.

- **§1 day screen** — none, and one near-miss worth recording. The mock's
  journal bar reads `THE JOURNAL · 7 REMAIN`, which looks like the auto-computed
  "tally of what remains" §5 forbids. It is not: `remainCount` is derived from
  the player's own tick-marks and the bar has always shown it. Kept as-is.
  Check before you cut something for breaking an invariant — it may already be
  the shipped behaviour the mock was drawn from.

## Findings banked for later rows

Things noticed in passing that will save the next session a lookup.

- **§12 death scene** — the README's "two looks out of four" is correct. The
  live modal offers four: *Examine the wounds · Search the ground nearby · Feel
  the air, the chill of it · Study the surroundings*, and closes on **STEP AWAY
  FROM THE BODY**. Do not reduce the four to two; the two is the spend.
- **§13 examination** — the day-screen action label is generated, not fixed: it
  reads "Have Greta look someone over" once Falk is gone. Whatever the redesign
  does must keep reading from that generator.
- **§3 interview owes §13 a debt.** A positive examination is already, in code,
  the raving interview: `runExamine` seeds `iv` with the verdict beats plus a
  `TURNED_FACED` opener and `examineModal` hands off to `InterviewView` whole.
  That means **screen 20e is InterviewView wearing violet**, and it was left
  undone rather than forked — forking it would have built §3's screen twice.
  When you redesign `InterviewView`, give it a `tone` prop (`"change"` →
  `C.turn` rules, `#C0A6E0` rubrics, pill buttons at `rgba(122,95,160,.16)`,
  mood word "no longer wholly herself", dock label "THREE QUESTIONS · FREE")
  and 20e falls out. The 20e mock in the canvas is the spec for that variant —
  read it when you do §3, not before.

---

## Authorship

From `CLAUDE.md`, and it matters:

- Commits are authored **Jacob Strong <jacobstrong3357@gmail.com>**.
- **No** `Co-Authored-By: Claude`, no `Claude-Session` trailer, no AI attribution
  in commits, PR bodies, or code comments. The owner asked for authorship to be
  theirs alone.
- Work on feature branches, `git push -u origin <branch>`. Do not open a PR
  unless asked.
- Commit messages read like the game: plain, specific, no bullet-point changelog
  voice. Say what moved and why, and state plainly that no mechanics changed.
