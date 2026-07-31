# Handoff: Hollow's Edge mobile redesign (22 turns of screens)

## Overview
A full visual redesign of **Hollow's Edge**, the folk-horror deduction game that lives as a single
`index.html` (inline React + Tailwind classes + a `C` colour object) in
`jacobstrong3357/Hollow-edge`. Every screen in the game's loop has been redesigned: the day screen,
villager page, interview, title/Black Book, journal, dawn reveal, night cards, night walks, nightfall,
the daylight search, the death-scene investigation, the examination, the accusation, the offer/rite,
and all four endings.

**Nothing about the game's mechanics changes.** This is presentation only. Several times during design
we drafted screens that implied new features (a monster appearing at a villager's door, warning a
villager, examining a corpse for four kinds of evidence, searching two places a day) and each was
removed once the source was read. If an instruction in this package seems to add, remove or reweight
a player choice, it is a mistake in this package — follow `index.html`.

## About the design files
The files in this bundle are **design references written in HTML**, not production code.
`Hollow's Edge Redesign.dc.html` is one long canvas: each redesign round is a `<section class="dv-turn">`
holding two to six options, each option a phone frame with a caption explaining the intent. It uses a
component runtime (`support.js`) and inline styles that have no place in the game.

**The task is to recreate these designs inside `index.html` as it already is** — same inline React,
same Tailwind utility classes, same `C` token object, same component library
(`Scene`, `DawnScene`, `NightScene`, `Portrait`, `MonsterArt`, `MonsterDeath`, `InterviewScene`,
`DayStrip`, `MoonStrip`, `MvIcon`, `IvIcon`, `Btn`, `METHOD_FX`) — not to introduce a build step,
a component framework, a CSS file or a new art pipeline.

## Fidelity
**High fidelity.** Colours, type sizes, spacing, radii and copy are all final and should be matched.
Two caveats:
- Copy shown in the mocks is **sample output** of the game's real generators (`DAY_SEARCH_STYLES`,
  `INVEST_ACTS`, `OFFER_SCENES`, `N1_*` beat pools, `DEATH_SCENES`, `NPC_LORE`). Wire the real
  strings; don't hardcode the sample sentences.
- Villager names/portraits in the mocks (Greta, Hazel, Old Tobias, Father Ansel, Wilhelm, Liesel,
  Doctor Falk, Rosa) come from `NPC_DEFS`, but each run generates its own cast. Everything is driven
  by state.

## The design system, in one page
The game already had most of this; the redesign made it consistent.

### Colour, and what each colour is allowed to mean
Taken from the build's `C` object (~L4718) and extended only where noted.

| Token | Hex | Meaning — used for nothing else |
| --- | --- | --- |
| `C.bg` | `#101321` | day/UI ground |
| `C.panel` | `#171B2E` | raised panel |
| `C.panel2` | `#1E2338` | inset panel, chips, speech bubbles |
| `C.line` | `#2B3050` | every hairline border |
| `C.text` | `#C9CBD8` | body |
| `C.dim` | `#8A8FA8` | secondary, rubrics, italic asides |
| `C.amber` | `#D9A441` | **the player's own agency** — the committing action, the spendable pip, a stamped sign |
| `C.red` | `#9E3039` | filled destructive button |
| `C.redBright` | `#C24450` | danger rule, "something is close", death-scene labels |
| `C.turn` | `#7A5FA0` | **the change** — the examination and a known-changed villager, never death |
| bone | `#E9DFC8` | display type on dark |
| gilt | `#F5D9A0` | dawn kicker only |
| stamp | `#2B2416` bg / `#8A6E32` label | a sign written into your evidence |
| bruise | `#1A0F14` → `#101321` | accusation and death-scene grounds |
| night | `#070910` | the night walk |
| siege | `#08070C` | the walk once it is hunting you |

New (extending, not replacing): `#E8A0A8` pale red for "it is close" rubrics, `#C0A6E0` pale violet as
its examination equivalent, `#C9B98F` bone rule on daylight report plaques.

### Type
Two faces already in the build: `.mv-display` (the woodcut display face) and `.mv-body`.
- Kicker: display, 10.5px, `letter-spacing: 3.2px`, uppercase, amber (gilt at dawn)
- Screen title: display, 26–28px, `line-height: 1.1`, bone
- Place line on a walk: display, 12px, `letter-spacing: 3.2px`, bone at 50%
- Event line (the sentence that *is* the night): body, **19px**, `line-height: 1.42`, bone,
  `text-shadow: 0 2px 14px rgba(0,0,0,.9)`, `text-wrap: pretty`
- Report/plaque prose: body, 15.5–16.5px, `line-height: 1.45`
- Atmosphere: body, 14px, italic, `C.dim`, in a left rule `2px solid rgba(233,223,200,.22)`, 12px padding
- Rubric above a choice group: display, 10.5px, `letter-spacing: 2.5px`, `C.dim`, centred,
  written `&middot; LIKE THIS &middot;`
- Stamp chip: display, 9px, `letter-spacing: 1.6px`
- Never below 10px; nothing tappable under 44px.

### The four recurring objects
1. **Plaque** — anything the game *reports*. `background: #141830`, `border-top: 2px solid <rule>`,
   `border-radius: 2px`, `padding: 13-14px`. Rule colour states the kind: amber = a find,
   `#C9B98F` = a body/daylight fact, `C.redBright` = danger, `#9E7FC4` = the change.
   A plaque with a portrait puts it left at 40–44px, `gap: 12px`.
2. **Stamp tile** — a sign written into evidence. Held: `background: #2B2416`, bone label, 6px red dot.
   Not held: `rgba(233,223,200,.07)`, `1px solid C.line`, label at 45%. **Only ever list signs the
   player has actually found** — the row must not double as a checklist of what is missing.
3. **Pips** — how many looks/beats remain. 6–8px dots, amber with
   `box-shadow: 0 0 6px rgba(217,164,65,.45)` when live, `1.5px solid C.line` when spent.
4. **Dock** — the bottom bar, `class="mvIvDock"`,
   `background: linear-gradient(#181D31,#131728)`, `border-top: 1px solid C.line`,
   `padding: 12px 16px 34px` (safe area). One committing action, amber outline
   (`background: rgba(217,164,65,.1); border: 1px solid #D9A441`); destructive is filled `C.red`;
   secondary is transparent with a `C.line` border.

### Layout rules that carry across every screen
- Phone frame 402 × 874 (iPhone 16). Every screen is
  `display:flex; flex-direction:column` with `overflow:hidden`.
- **Content sits against the dock, not under the header.** The scrolling middle is
  `flex:1; min-height:0` and its choice group carries `margin-top:auto`. This is what stops the
  half-empty screens the first drafts had.
- `.mvGrain` under content, `.mvVignette` + `.mvGrainF` over it. Both already in the build.
- Full-bleed art **never hard-cuts**. Every strip carries
  `mask-image: linear-gradient(#000 0%, #000 52%, rgba(0,0,0,.6) 74%, rgba(0,0,0,.2) 90%, transparent 100%)`
  and a veil gradient over it. Day strips render at 230px and fade, rather than being clipped at 150px.
- Hero card (report screens): `border-radius: 14–16px`, `1px solid C.line`,
  `box-shadow: 0 10px 26px rgba(4,6,12,.55)`, art 100–210px with a bottom-weighted scrim,
  kicker chip top-left, place name bottom-left.
- Groups are `display:flex`/`grid` with `gap` — never margins between siblings.

## Screens
Each entry names the repo function it replaces. Line numbers are from the last sync
(commit `fa06f0e6b483`) and will have drifted.

### 1. Day screen — 2a/2b · `index.html` day screen (~L9278-9500)
Masthead day title over the village skyline (`DayStrip`), villager grid with **bone nameplates**
under each portrait, actions as engraved plaques with daylight on the rule, journal bar,
then `ACCUSE` / `NIGHTFALL` in the foot. `MoonStrip` keeps the nights.

### 2. Villager page — 2c · `profileModal` (~L9147)
Portrait, name, role, `NPC_LORE` in body prose, what you have on them as plaques.

### 3. Interview — 2d · `InterviewView` (~L6040)
Room art (`InterviewScene`) behind a 30px strip, portrait with mood dot and word, the exchange as
speech bubbles (yours right, amber-tinted; theirs left, `C.panel2`), free follow-ups as pill buttons
under the reply, question pips in the dock, the four categories as a 2×2 of icon+label+italic-hint
plaques (`IvIcon` `catN`/`catP`/`catV`/`catH`), `End the interview` underlined below.
Moods use `C.redBright` when hostile, `C.dim` when guarded.

### 4. Title screen and Black Book — 3a/3b/3d · title branch (~L7100)
First run: possession sweep across the eight faces. Returning: the Black Book as a bound ledger.
Book entry: per-monster stats, `MonsterArt` silhouette, lore, signs, rite.

### 5. Journal — 5a-5c / 7a-7c · `journal` block (~L8369)
Parchment sheet, ruled tabs, ink `CLOSE` bar. Four tabs:
**Evidence** — the eight `SIGNS` as a player-filled tick sheet (a sign is ticked only when
*witnessed*; never auto-ticked), then "Your reckoning".
**Bestiary** — sixteen ink silhouettes on parchment (no `light` disc), one row of short sign chips,
rite right-aligned.
**Record** — one dated ledger merging the old Seen & Heard / Testimony / Nights / Days, with filter chips.
**Nothing is computed for the player**: no "fits / doesn't fit", no tally of what remains.

### 6. Dawn reveal — 8a/8b · dawn branch (~L9288)
Real `DawnScene` sunrise in a hero card under a gilt `AT DAWN · <PLACE>` plate, report cards one at
a time with pips and `‹ ›`, amber `FACE THE DAY` in the dock. A morning with no body reports the
night's find in the same deck — a find is the same kind of news as a body and gets no card of its own.

### 7. Night cards — 14a/14b · night cinematic (~L7467), `N1_*` pools (~L960)
Title card, not a card of choices. `NightScene` hero, real beats (`NIGHT_ONE_SCENE`, tension pools,
`WEATHER.fog`) dealt 1.2s then 1.4s apart, skip affordance, `ONWARD` bar.

### 8. Nightfall — 17a-17c · `planModal` (~L8969)
The question is the screen, in the *walk's* furniture rather than a modal: weather beat in the italic
rule, each choice weighted with its yield and risk, and the target picked **inline on the same screen**
— six places as their own art two-up (17b), or eight faces four-up (17c), named and nothing else.
Dead villagers stay in the grid, greyed and struck.

### 9. Night walk, watch, follow — 18a-18d, 19a/19b · walk render + `watchModal`
All one shell: `Scene` at 190px behind the moon (66px disc at 352,29 with craters, glow, moonlight
ellipse), two drifting fog banks, place + weather on one ruled line, atmosphere in the italic rule,
event line at 19px, choices stacked with the committing one in amber.
- **18a** watching a door; **18b** the follow one place further out; **18c** what she did there.
- **18d / 19a** the two ends: seeing it, or nothing at all.
- **Sighting state** (reused from the existing close state, *not* new): scene
  `filter: saturate(.6) brightness(.75)`, moon warms to `#FBF1EA`/pink glow, `.mvEdgeRed` +
  `.mvHeart` breathing on the 2.4s beat, place line `C.redBright`, rubric "SOMETHING IS CLOSE",
  choices collapse to two with the committing one **filled** `C.red`.
- An empty watch has **one** thing to press and sends you home with rumours.

### 10. Under siege — 16a/16b · `s.fled` plan modal (~L8977)
17a's furniture stripped: ruled line red, italic describes the thing instead of the weather, two
options, verbatim warning, `ACCUSE` reads `UNMASKED`. 16b is the failed-rite night card in red.

### 11. Daylight search — 20a-20c · `searchModal` (~L8624), `runSearchScene` (~L8586)
- **20a** all six `LOCS` as daylight art cards, two-up, 110px art + 13px display label on the card.
  **Nothing is ticked, greyed or removed** — the same place tomorrow is a different search, and one
  search costs one action. Affliction states (burned/fouled/shut) are already in the art.
- **20b** arrival: hero card, opening line, then `DAY_SEARCH_STYLES` verbatim as three single-line
  buttons (`#141830`, `1px solid C.line`, `border-radius: 8px`, 15px body, no subtitles) under the
  rubric `· CHOOSE HOW TO WORK THE PLACE ·`. All three are cosmetic — the roll is already settled.
- **20c** beats one at a time: style line in italic, folk beat with the neighbour's portrait
  (`DAY_SEARCH_FOLK`), the find as an amber-ruled plaque **in prose**, and only then the
  `CLAW MARKS · STAMPED` chip. Pips bottom-centre, `ONWARD` dock.
- A search that finds nothing is this same screen minus the plaque and the stamp.

### 12. Death scene — 21a/21b · `investModal` (~L8816), `INVEST_ACTS` (~L388)
Going to where a fresh body fell. Bruised ground (`#1A1520`→`C.bg`), hero at 128px with a red wash
and the shrouded shape low-right (`ShroudH`), `DAY 4 · THE DEATH SCENE` chip, `WHERE ROSA FELL` in
`C.redBright`. **Two looks out of four**, one column, each an icon chip
(`MvIcon` `wounds`/`ground`/`air`/`walls`) with a `rgba(194,68,80,.35)` border. Two amber pips under
a `LOOK CLOSER` label spend down. Findings are left-ruled plaques
(`3px solid C.redBright`, `rgba(158,48,57,.08)`) under their own label, newest typed in as it speaks.
Signs stamp on the way out, never on the plaque. Closes with Tobias and the cart in italic.

### 13. Examination — 20d/20e · `examineModal` (~L8904), `actLookOver` (~L3573)
**Not a body.** Doctor Falk pressing a glass to a *living* neighbour's chest to feel for the cold.
Everything here is `C.turn` `#7A5FA0` (rules, borders, pill buttons at `rgba(122,95,160,.16)`,
pale violet `#C0A6E0` rubrics) — the violet means *changed*, and death red must not appear.
- **20d** Falk fronts the screen in a `#9E7FC4`-ruled plaque explaining what he can read
  (Greta at worse odds if he is gone; nobody after her), then the living four-up as 38px portraits.
  The cost line is stated: it costs a neighbour's trust whatever it finds.
- **20e** the positive finding: Falk's verdict in his own words, the portrait switching to its
  known-changed state, mood "no longer wholly herself", and the raving interview opening underneath
  — **free**, because the daylight is already spent.

### 14. The accusation — 22a/22b · `accuseModal` (~L9063)
Two steps, one sheet, in a bruised red (`#1A0F14`→`C.bg`) that appears nowhere else in the day.
- **22a** WHO: `NightScene` hero at 100px (an accusation is done in the dark whatever the hour),
  the plain warning — the village hangs whoever you circle, an innocent emboldens it, a second ends
  you — then the living four-up at 48px. Struck names sit at 40% with a line through.
- **22b** WHAT: hero becomes *her own room* (`InterviewScene`) with her portrait in it, so the
  question is asked of a person. Fifteen `MonsterArt` silhouettes five-up at 42px; ruled-out ones at
  35% (still pressable — the game never decides for you); selected gets
  `box-shadow: 0 0 0 2px C.redBright`. Then the prescription card, the only place the rite, the
  method (`METHODS`) and whose hand are named together. `SAY IT ALOUD` is filled `C.red` and dead
  until a creature is picked.

### 15. Offer and rite — 15a-15c · `OFFER_SCENES` (~L848), `riteModal` (~L9005)
15a is `OFFER_SCENES.wraith` verbatim, wordless, with the take/refuse pair. 15b/15c are the older
accusation pass (face first, then rite) — **22a/22b supersede them**; keep them only as reference.

### 16. Endings — 11, 12, 13 · death/offer branches (~L7467), `DEATH_SCENES`
Win and loss are the same ritual with the colour changed: three beats in the dark, then a plate.
Death beats at 21px with the creature looming, report with nights survived / signs found / deeds done,
epilogue as a villager deck. Win in amber with deeds struck on plaques. **13a Hollow** — accepting
the offer — is neither: it gets the fouled-well green, spent there and nowhere else, and one plaque
because there is only one thing to say. Death variants are driven by `MonsterDeath` + `METHOD_FX`
(pierce family for silver/stake, burn family for fire) with the layout unchanged.

## Interactions & behaviour
- **Beat dealing.** Night cards and search scenes reveal beats on a timer (1.2s, then 1.4s), each
  fading up, with a tap-to-skip affordance. Already implemented in the build — keep it.
- **Breathing danger.** `.mvEdgeRed` and `.mvHeart` pulse on a 2.4s loop. On only when something is
  close. Nothing else animates on a walk except the fog drift and the moon glow.
- **Portrait states.** alive / dead (greyed + cross) / known-changed (violet). One component,
  three flags.
- **Everything one screen.** No confirm dialogs; warnings are prose on the screen that carries the
  action. No modal-on-modal — nightfall picks its target inline.
- **Amber = spendable.** If a control costs an action or ends a phase, it is amber (or filled red when
  destructive). Never decorate with amber.

## State
No new state. The redesign reads what the build already keeps: `s.day`, `s.ap`,
`s.npcs[]` (alive/dead/turnedKnown/mood/trust), `s.signs` (which are witnessed),
`s.locs` (afflictions), `s.fled`, `s.nights`, `s.record`, `s.weather`, plus modal routing.
The only additions are presentational: which beat index a staged scene is on, and which pip is lit.

## Assets
All art is code — the SVG components already in `index.html`. `hollow-art.jsx` in this bundle is those
components lifted **verbatim** for use in the mocks, plus two additions to fold back in:
- `ShroudH` — the shrouded shape on the death-scene hero.
- `*H` wrappers (`SceneH`, `DawnSceneH`, `NightSceneH`, `DayStripH`, `InterviewSceneH`) — height-prop
  variants used for mock sizing. Cosmetic only; ignore or inline as `height`.
No raster images, no icon fonts, no web fonts beyond what the build loads.

## Files in this bundle
| File | What it is |
| --- | --- |
| `Hollow's Edge Redesign.dc.html` | the canvas: 22 turns, ~60 phone screens, each captioned |
| `hollow-art.jsx` | the build's art components, verbatim, + `ShroudH` and the `*H` wrappers |
| `ios-frame.jsx` | the phone bezel used to present the mocks — **not for the game** |
| `support.js` | the mock runtime — **not for the game** |
| `github.md` | sync record: repo, branch, last commit, and the screen→source map |

## How to read the canvas
Open `Hollow's Edge Redesign.dc.html` in a browser. Newest work is at the top (turn 22), earliest at
the bottom (turn 2). Each `<section>` is one round; its `dv-note` paragraph states the intent and
which repo function it maps to; each option's `dv-osub` explains what that specific screen is doing
and why. Where two options in a turn look alike, the caption says what changed — that difference is
usually the whole point.

## Order of work, if you want one
1. `hollow-art.jsx` deltas (`ShroudH`) — smallest, unblocks the death scene.
2. The four recurring objects (plaque / stamp / pips / dock) as small helpers, so every screen after
   this is assembly.
3. The night-walk shell (18/19) — it is the most reused layout in the game.
4. Day screen (2a), then the day actions: search (20a-20c), death scene (21), examination (20d/20e).
5. Reports: dawn (8a), journal (5/7).
6. Accusation (22), then the endings (11/12/13).
