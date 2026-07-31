repo: jacobstrong3357/Hollow-edge
branch: main

## Last sync
date: 2026-07-31T13:22:25Z
commit: fa06f0e6b483

### Updated in this project
- The accusation built (22a/22b) from `accuseModal`: WHO under a night hero then WHAT over her own room, struck names and ruled-out creatures dimmed but still pressable, and the rite/method/hand prescription card before SAY IT ALOUD.
- Death scene restored as its own action (21a/21b): `investModal` with two looks out of `INVEST_ACTS`' four, death red on a bruised backdrop, amber pips spending down, findings as left-ruled plaques, `ShroudH` lifted verbatim into `hollow-art.jsx`.
- Examination screens recoloured to the build's changed-violet (`C.turn` #7A5FA0) instead of the death red.
- Daylight search and the examination (20a-20e) rebuilt from `searchModal`, `runSearchScene`, `DAY_SEARCH_STYLES`/`DAY_SEARCH_FOLK` and `actLookOver`: six `LOCS` in daylight, the three-approach "work the place" rubric, beats one at a time with the sign stamped after the prose, and the exam as Falk reading a living neighbour for the cold, straight into the raving interview.
- Watch, follow and sighting (18, 19) restyled as the existing night walk with 10l's close state — no new mechanics.
- Nightfall redesigned (17a/17b): the question as the screen, weather beneath it, each choice weighted with its yield and risk, and the place picked inline instead of in a second modal.
- Under siege (16a/16b): the two-option nightfall modal with its verbatim warning, dead ACCUSE reading UNMASKED, and the failed-rite night card in red.
- Offer and rite screens (15a/15b): `OFFER_SCENES.wraith` verbatim with the take/refuse pair, and the rite modal's silhouette grid, `METHODS` prescription line and two-attempt warning.
- Night cards (14a/14b) built on the build's night cinematic: real `N1_OPEN` / tension / death beats and the `WEATHER.fog` beat, dealt 1.2s + 1.4s apart, with the NightScene hero, skip affordance and ONWARD bar.
- End screens: death beats and report (11), rite and dawn (12), and the Hollow ending as accepting the monster's offer (13a), plus death variants driven by `MonsterDeath` + `METHOD_FX`.
- Nights are open-ended: fixed eight-night pips dropped for nights kept / souls still living.
- Journal shipped as four tabs: Evidence (signs as stamped tiles, red dot for witnessed, then Your reckoning), Bestiary (one row of short sign chips, rite right), and Record, which merges the old Seen & Heard, Testimony, Nights and Days into one dated ledger with filter chips.
- Dawn reveal shipped: real `DawnScene` sunrise under a gilt kicker, one report card at a time with pips, amber FACE THE DAY bar.
- Journal built to `CLAUDE.md`'s rules: Evidence is the eight signs as a player-filled tick sheet (SEEN is witnessed, never auto-ticked), the Bestiary is sixteen ink silhouettes on parchment with no `light` discs, and nothing is computed — no fits/doesn't-fit, no tally of what remains.
- Journal, bestiary and bestiary entry (5a-5c) all render on the parchment sheet with five/six ruled tabs and an ink CLOSE bar.
- Locked a day-screen direction (2a): masthead day title over the village skyline, bone nameplates on the original portrait grid, engraved plaque actions with daylight on their rule, journal bar over ACCUSE / NIGHTFALL.
- Recreated the villager page (2c) and interview (2d) from the build, with button styling brought in line with 2a.
- Title screen shipped in three states: first run (3a, with a possession sweep across the eight faces), returning player with the Black Book as a bound ledger (3b), and a book entry with per-monster stats (3d).
- Art components lifted verbatim into `hollow-art.jsx` for reuse in mockups.

## Screen map
| Project screen | Repo source |
| --- | --- |
| 2a / 2b Day screen | `index.html` day screen + fixed foot (~L9278-9500), `DayStrip`, `MoonStrip`, `MvIcon` |
| 2c Villager page | `profileModal` (~L9147-9276), `NPC_LORE` (~L1650), `NPC_DEFS` (~L1634) |
| 2d Interview | `InterviewView` (~L6040-6340), `IvIcon` (~L5994), `InterviewScene` |
| 3a / 3b Title screen | title branch (~L7100-7231), `Scene`, `Portrait`, `MonsterArt` |
| 7a-7c Journal (shipped) | `journal` block (~L8369-8560), `SIGNS`, `METHODS`, `MONSTERS`, `MonsterArt` with `flat` |
| 8a / 8b Dawn reveal | dawn branch (~L9288-9316), `DawnScene`, `DawnCarousel`/`Carousel` (~L6527-6590) |
| 5a Evidence tick sheet | `SIGNS` (8 labels), `SIGN_SENSE(_BODY)`, journal evidence page in `MonsterVillage` |
| 5b / 5c Bestiary + entry | `MONSTERS` (signs, rhythm, hunts, method, lore), `MonsterArt` (no `light` on parchment) |
| 3d Black Book entry | `MONSTERS` lore/signs/method (~L1200+), `MonsterArt` |
| 11-13 End screens | death/offer branches (~L7467-7600), `DEATH_SCENES`, `MonsterDeath`, `METHOD_FX` |
| 22a / 22b Accusation | `accuseModal` (~L9063), `METHODS` (~L310), `gameMonsters`, `ritePreparer`, `NightScene`, `InterviewScene` |
| 21a / 21b Death scene | `investModal` (~L8816), `INVEST_ACTS` (~L388), `investLook`, `MvIcon` (wounds/ground/air/walls) |
| 20a-20e Search + exam | `searchModal` (~L8624), `runSearchScene` (~L8586), `DAY_SEARCH_STYLES` (~L607), `DAY_SEARCH_FOLK` (~L612), `actLookOver` (~L3573), `examineModal` (~L8904), `LOCS` (~L215) |
| 17a / 17b Nightfall | `planModal` (~L8969-9000), `watchModal`/`nightwalk` pickers, `WEATHER` (~L1344), `NightScene` |
| 16a / 16b Under siege | `s.fled` plan modal (~L8977-8990), fled endgame beats (~L2406-2456), foot bar (~L9466-9469) |
| 15a Offer | `OFFER_SCENES` (~L848-905), offer phase render (~L7549-7604) |
| 15b Rite modal | `riteModal` (~L9005-9045), `METHODS` (~L310), `MONSTERS` (~L357) |
| 14a / 14b Night cards | night cinematic (~L7467-7540), `NIGHT_ONE_SCENE` + `N1_*` beat pools (~L960-1032), `WEATHER` (~L1344), `NightScene` |
| `hollow-art.jsx` | `index.html` L4718-5993, L5994-6006, L6382-6398, L6493-6511 (verbatim) |

## Sync history
- 2026-07-30: nightfall, siege, offer/rite, night cards, end screens.
- 2026-07-29: journal, dawn reveal, bestiary; art lifted verbatim.
- 2026-07-28: day, villager, interview and title screens; art lifted to `hollow-art.jsx`.
- 2026-07-27: initial import of `index.html`; recreated current title and day screens.
