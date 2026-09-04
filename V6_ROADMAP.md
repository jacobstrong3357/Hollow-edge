# Hollow's Edge V6 — The Village Remembers

V6 is a continuity release before it is a content release. Its purpose is to
make the night, daylight, interviews, Journal and endings read one canonical
history instead of reconstructing one another from prose and compatibility
flags.

The production V5 build is frozen at commit `268c926`. V6 work lives on the
`codex/v6-continuity` branch until its migration and full-run gates pass.

## Product rules

1. Truth, observation, testimony and belief are different things.
2. Every death, meeting, visit, discovery, accusation and relationship change
   has one durable event ID.
3. A screen may only describe facts permitted by its audience's knowledge.
4. A villager cannot act after death, flight or disappearance.
5. Evidence has a source event, an exact object identity and a matching image.
6. Finding evidence never stamps it automatically; the player owns the Journal.
7. Planted evidence can be recorded but never counts as a genuine monster sign.
8. Important dramatic arcs are scheduled promises, not indefinitely unlucky
   low-probability rolls.
9. All consequential randomness is keyed and reproducible.
10. Endings explain the event and arithmetic that caused them.

## Architecture

`v6-continuity.js` is the first V6 seam. It currently provides:

- an append-only truth event ledger;
- separate observations for the player and each villager;
- testimony that remains hearsay instead of becoming retroactive sight;
- actor status projection that prevents inactive characters from acting;
- evidence provenance, object/image identity and authenticity;
- explicit discover, inspect and manual-stamp transitions;
- durable dramatic promises for threshold visits, offers and other owed scenes;
- presentation contracts for knowledge- and status-gated prose;
- deterministic keyed rolls; and
- conservative, idempotent V5-to-V6 save preparation.

It is wired into `index.html` only at the terminal-night import boundary. The
existing V5 screens remain authoritative until each consumer below has moved
and its parity tests pass. This is deliberate: V6 must replace the compatibility
shell gradually, not become another independent story engine beside it.

### Current checkpoint: V6.1f

The playable build now initializes and persists the V6 ledger. When a Director
night reaches a terminal state, `v6-director-adapter.js` imports every truth
event, player observation, villager memory, genuine physical discovery and
planted mark before the existing daylight projection runs. The old daylight UI
still reads its compatibility collections; this is a parity checkpoint, not the
end of the migration.

Contextual interview questions are the first daylight consumer: for imported
V6 nights, a question is only eligible when the player directly observed the
source event, heard testimony about it, or discovered evidence from it. Nights
played before V6 retain their legacy questions until they have an explicit
migration source.

One hundred varied terminal Director nights are projected twice in tests. The
second import must be identical, proving that reload or repeated settlement
cannot duplicate events or evidence.

Actor fate is now the second live consumer. Every playable death,
transformation, unbinding, flight and monster defeat records a canonical
status event before the older NPC-card fields are updated. Loading a save and
settling a Director night both project those statuses back into the temporary
UI fields, so a dead or fled actor cannot remain available because one copied
boolean was missed.

Director death recaps now ask the canonical observation history whether the
player witnessed the death, reached the aftermath, shared the discovery,
merely heard danger, last saw the victim alive, or knew nothing until dawn.
The old collection of follow/hail/watch guesses is used only for pre-V6 fallback
nights. Witnessing a death can therefore no longer produce “you left them
living,” and a body already found by the player is not introduced as new
information at first light.

Doorstep arrivals, spoken reports and the player's final door choice are now
read as one canonical visit chain. Derived doorstep facts are explicitly
recorded as player knowledge, so a visitor cannot knock at night and then lose
that interview topic in daylight. The displayed door-visit total is rebuilt
from those chains rather than incremented independently.

Shared rescue discoveries now require the player and companion to remember the
same investigation event. Dawn and interview prompts read that mutual event;
daylight no longer writes a duplicate compatibility memory that can drift from
the night. Conservative legacy fallback remains for nights saved before V6.

Monster awareness is now directional canonical knowledge. Recognising a
neighbour in the road does not reveal that they are the monster; witnessing the
borrowed face break does. Likewise the monster only knows the player after a
mutual confrontation, chase, hail, shout or close discovery. Failed rites are
canonical events, so later threshold taunts receive the real history without
double-counting the daylight compatibility pass.

Rescue, attempted rescue, abandonment, caught-watching, intrusion and restraint
now read from the participant's observation of the original night event. Their
interview opener is acknowledged by a separate durable event, preventing it
from repeating. Character records also read these canonical relationships
instead of the temporary memory list.

A development-only continuity inspector is available by opening the game with
`?continuity=1`. It displays canonical truth separately from the player's and
each villager's observations, reports ledger validation errors and checks that
the displayed history survives serialization unchanged. It is read-only and
does not appear in the ordinary game.

The 100-run night gate now pauses after every fourth action, serializes and
upgrades the save, then proves both the exact available choices and the exact
result of the following choice are unchanged. Legacy prose remains visible to
the compatibility build but is deliberately not promoted into V6 truth or
observer knowledge during migration.

Learned secrets are now canonical player observations with their exact owner,
selected secret, source scene and time. The old `secretKnown` field is only a
UI projection; an orphan flag can no longer teach the player a secret after its
owner died. Followed and watched Director scenes import the same durable secret
event, and an inactive villager cannot produce a later live confession.

Witness lists for imported nights now come from events the speaker actually
observed and people they recognised. The hidden location schedule is not used
as eyewitness memory: two villagers may visit the Graveyard at different hours
without meeting, and an empty answer says this plainly rather than claiming an
all-night alibi.

The boundary between sensory and physical evidence is enforced centrally.
Unearthly Wailing remains a true sign for its established monsters—including
the Night Hag and all-sign Mimic—but no search, village sweep, gravedigger hint
or migrated ground cache may return it as an object found in daylight. The
monster/sign table is regression-locked independently of that filter.

## Delivery slices

### V6.1 — Canonical continuity (in progress)

- [x] Give Director truth, observations and memories durable V6 event IDs.
- [x] Record the canonical ledger before `consequenceProjection` runs.
- [ ] Replace copied compatibility arrays consumer by consumer.
- [x] Gate contextual interview questions through canonical player knowledge.
- [x] Move actor deaths, changes, flight, unbinding and monster defeat onto
  canonical status events.
- [x] Make witnessed-death and aftermath recaps read player observations.
- [x] Move doorstep visits, shared body discoveries, monster recognition and
  relationship events off their compatibility arrays.
- [x] Add a development inspector that shows truth and each observer separately.
- [x] Preserve old saves without treating loose legacy prose as newly proven fact.

Gate: a serialized night and its following day produce no fact outside the V6
ledger, and the same save produces the same next action after reload.

### V6.2 — Evidence and Journal

- Replace `locEvidence`, `foundSigns`, `playerSigns`, `planted`, `nightRemains`
  and free-form evidence clues with evidence entities.
- Create an item-art manifest with one exact `imageKey` per object.
- Give evidence present, carried, destroyed and lost states.
- Add the manual `Discover → Inspect → Stamp` flow.
- Build the Journal timeline, testimony list and contradiction view from player
  knowledge only.

Gate: every evidence image matches its object; a source event can be opened from
the Journal; false evidence never satisfies a true-sign requirement.

### V6.3 — Daylight and interviews

- Generate questions from shared events, observed events and heard testimony.
- Generate answers from the speaker's observations, beliefs and willingness.
- Make shared quests and doorstep rescues durable mutual memories.
- Add relationship actions: warn, escort, seek, avoid, protect and mourn.
- Replace live interview `chance()` calls with keyed outcomes.
- Add grammar and duplicate-prose validation.

Gate: the player cannot ask about an event they neither witnessed nor heard
about, and an NPC cannot describe an event absent from their own memory unless
the line is explicitly a lie or inference.

### V6.4 — Crises, danger and pacing

- Give each village crisis five beats: situation, danger, decision, immediate
  result and morning consequence.
- Keep witnessed death scenes to no more than six short beats or forty words
  before the next choice.
- Track monster awareness: unaware, noticed, home known, suspicion, recognised,
  openly unmasked.
- Schedule a threshold consequence within two eligible nights once the monster
  learns the player's home.
- Schedule an offer by the next eligible encounter once its conditions are met.
- Give planted-mark monsters a fair discovery/exposure opportunity.

Gate: a player can explain what is dangerous, what their choice changes and why
an offer or threshold scene appeared without seeing a numerical affinity meter.

### V6.5 — Endings and full-game proof

- Stage the prepared rite in the lived night before transitioning to victory.
- Give hangings and other public deaths their own First Light scenes.
- Explain the decisive death, remaining population and threshold on every loss.
- Add alternate resolved outcomes only after the existing endings are proven:
  save or unbind the host, accept/refuse the offer, and evacuate survivors.
- Add shareable seeds and a case-summary bug report containing recent event IDs.

Gate: every ending and achievement is reached by at least one automated seed,
and every loss names its causal event and survival arithmetic.

## Automated quality gates

The full-run harness must eventually cover all monsters, hosts, weathers,
crises, damaged locations, reload points and endings. It should assert:

- no dead or fled character speaks or appears as an actor;
- no player question assumes unobserved knowledge;
- NPC testimony has observation, hearsay, inference or deliberate-lie provenance;
- lived deaths and recaps agree;
- shared scenes are remembered by every surviving participant;
- evidence authenticity cannot change without a recorded exposure event;
- saving after every action preserves the next outcome;
- every achievement and ending is reachable;
- every phase has a legal continuation; and
- mobile screens remain readable at 360×800, 390×844 and 412×915.

Add screenshot coverage for the day hub, Journal, interview, crisis, witnessed
death, First Light, “You Do Not See the Dawn”, victory and loss screens. Include
contrast checks, large text, reduced motion and instant-text settings.

## Content restraint

Do not add another monster, generic prose pool, larger map or longer cinematic
until V6.5 passes. New content should deepen remembered relationships, locations
and consequences rather than multiply untracked combinations.
