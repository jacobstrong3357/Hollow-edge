# V5 audio library

`v5-content.js` contains the authoritative cue manifest. Each cue has an
`intendedPath` in this directory and a procedural fallback in `Snd.cue()`, so
the game remains playable while recorded assets are sourced and mastered.

Required recording groups:

- bells and bell-rope movement;
- iron gate, latch and hinge movement;
- boots on gravel, wet grass and dry leaves;
- spade in wet earth, branches, cloth and stone contact;
- close and distant breathing;
- directional whispers, ambiguous wails and distant animal calls;
- crickets, empty church room tone and village ambience.

Only owned, commissioned, CC0, or explicitly licensed recordings should be
added. Record the creator, source URL, license, edit and normalization target in
`SOURCES.md` beside the files. Do not make a required clue audible only: every
cue retains its caption or visible equivalent.
