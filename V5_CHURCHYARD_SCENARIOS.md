# V5 Churchyard scenario system

The Churchyard night walk now runs on the latest illustrated V5 interface.
Authored scenario labels are development metadata only: the player experiences
a place, a sound, a face, or an uncertainty, never a named chapter.

## Runtime ledgers

- `worldEvents` records what actually happened.
- `observations` records only what the player perceived or chose not to see.
- `memories` records what a villager remembers about the player.
- `scenarioHistory` records scenario IDs solely to prevent reuse.

The four ledgers must remain separate. A presentation choice cannot alter the
sampled night, and hidden truth cannot leak into an interview or the Journal.

## Non-repetition rules

- A scenario ID can be selected at most once in a run.
- Once the catalogue is exhausted, another Churchyard visit uses the ordinary
  night walk instead of recycling an authored event.
- One encounter offers at most one contextual question per villager interview.
- If the player identified the villager, the direct question about their
  actions takes priority.
- The reverse-memory question appears only if the villager noticed the player
  but the player did not identify them.

## Fairness

Participant scenes draw only from villagers the sampled night already placed
at the Old Church. Monster tags adjust weights but never exclusively gate a
scene. The hidden host can give an evasive answer, but no scene or response is
proof by itself.

## Audio

`v5-content.js` owns the cue manifest. Recorded files belong in
`assets/audio-v5/` and require a completed row in `SOURCES.md`. Procedural Tone
fallbacks keep every cue testable until licensed recordings are mastered.
