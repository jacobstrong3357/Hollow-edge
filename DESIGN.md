# Design handoff — the visual layer of Hollow's Edge

Everything renders from **`index.html`**. The art/design code is one contiguous
band of that file. Scope any design task to a component below, not "redo the
designs." Line numbers drift as the file changes — search by the component name.

## The art components

| Component | ~Line | What it draws |
|---|---|---|
| `Scene` | 4725 | Location silhouettes. Unknown loc falls back to the cottage. |
| `Portrait` | 4805 | Villager faces (second pass: profession marks, per-villager tint). |
| `MonsterArt` | 4885 | The monster, looming/portrait forms. |
| `METHOD_FX` / `MonsterDeath` | 5192 / 5200 | Rite-specific kill animation, keyed off `method`. |
| `InterviewScene` | 5218 | Per-villager rooms + afflicted variants. |
| `DawnScene` | 5694 | Per-location morning scenes + burned/riot/shut/fouled variants. |
| `DayStrip` / `MvIcon` | 5938 / 5962 | Day header strip; small icons. |
| `EXTRA_CSS` | 6401 | All styling, plus the `mvKill-*` kill animations. |

## Props / state contract (why the art isn't standalone)

- `Portrait({ id, size, dead, turnedKnown, disp })` — `dead` renders greyscale
  with a baked-in grey ✕; `disp` is disposition and gates the smile (below).
- `DawnScene({ loc, s, height })` — reads run state `s` and branches on flags
  (`burned` / `riot` / `shut` / `fouled`). Don't invent new branches without a
  state flag behind them.
- `MonsterDeath({ id, method, ... })` — chooses the animation via `METHOD_FX`
  from the kill `method`. New rites need a `METHOD_FX` entry + a `mvKill-*` CSS
  keyframe.
- `MonsterArt` / `MonsterDeath` take a `light` prop (pale backdrop discs) for
  dark-on-dark screens (home Black Book grid, epilogue, death/offer/win). The
  **journal/bestiary render on parchment and must NOT pass `light`.**

## Design rules that are easy to break (do not)

- **Hostility is rings/prose, never a scowl.** A `Portrait` adds a smile *only*
  at `disp >= 1`; there is no angry face.
- **`mvKill-*` animations must end on a VISIBLE dimmed corpse** (opacity
  ~0.4–0.55), never fade to nothing — players screenshot/arrive after the
  animation ends.
- **"Nothing is ever proof."** No art may uniquely identify the monster; tells
  overlap several types. This is a game rule but it constrains visuals too.
- Text style around scenes: second person, present tense, dread over gore,
  em-dash-free, "the ${loc}" phrasing.

See `CLAUDE.md` for the complete invariant list and game-logic context.
