# Hollow's Edge V5 Night Director

This branch replaces the idea of a night as a stack of unrelated screens with one seeded village simulation.

## What is playable now

- **One continuous night:** Search and Watch both enter the same route system. The opening choice is an intention, not a locked destination.
- **A moving village:** living villagers receive a motive, destination, departure time, route, duration, return journey, object and cover story. Dead and fled villagers are excluded before the night is compiled.
- **A real clock:** every move, wait, search, listen, hail and follow advances the same seven-slot night. Presentation cards do not define time.
- **Consequences off-screen:** going home ends the player's access to the lanes, not the simulation. A later scheduled attack still happens.
- **Causal horror:** monster activity, hunting ground, attack window, victim priority, flight, hiding and intervention outcomes are fixed when the night is created. Buttons never roll fresh fate.
- **A real pursuit:** choosing to run opens a short chase across legal roads. Running, breaking line of sight, abandoning the lantern or making a distraction consumes a named outcome tape and changes distance until the player escapes or is caught.
- **The threshold:** a monster that has learned the player's face may test the cottage after the escape. The player may keep the shutter closed, look, or answer without opening. The barred home remains absolutely safe; curiosity changes only what is perceived and remembered.
- **Evidence moments:** physical clues and genuine signs require a search; whispers require listening; delusions alter player perception only. A delusion cannot kill, create a witness or award a stamp.
- **Witness memory:** truth, player observations and each villager's memory are separate ledgers. A dawn alibi comes from real overlap near the attack window. Hostile witnesses can remember the player and still refuse to defend them.
- **One-sided sightings:** fog and storms can let a villager identify the player's lantern without being identified in return. The player cannot hail or follow a hidden name, but that villager's memory can confront them in a later interview without polluting the Journal with knowledge they never earned.
- **Human-sized consequences:** adjacent sightings of the same person at the same place collapse into one interview thread while retaining their source slots for alibi checks. Rescue and abandonment become durable relationship events, and actor-linked physical findings become evidence questions rather than passive Journal prose.
- **Contextual interviews:** an encountered villager creates a specific next-day question about the place and hour. Their answer is grounded in that night's motive and changes with honesty and disposition.
- **Semantic non-repetition:** the save remembers actors, locations, motive families, interaction shapes and outcome signatures. Exact scenario titles are not used.
- **Save safety:** the complete Director state is JSON-safe and is persisted beside the current run. Reloading does not rebuild or reroll the night.
- **Forward-safe test saves:** version-one Director walks upgrade on their next action. Existing encounters remain visible and the new chase tape and threshold are derived from the original seed rather than rerolled.

## How a night is composed

The Director does not select one of hundreds of scripts. It combines:

1. The established monster truth: host, rhythm, reach, hunt locations, attack style and genuine signs.
2. The current village: living cast, deaths, flight, changed villagers, bonds, disposition and damage.
3. Thirty-two role motives plus secret, grief and location-adapted errands.
4. Routes through a shared location graph.
5. Player time spent and roads chosen.
6. Scheduled discoveries, sounds, distortions and threat collisions.
7. A semantic cooldown ledger from earlier nights.

The same authored units can therefore produce thousands of coherent nights without making the prose responsible for the logic.

## Source-of-truth layers

```text
Night plan       seeded schedules, hunt, discoveries and named outcomes
Player actions   append-only choices that spend world time
Truth ledger     what physically happened
Observations     what the player was allowed to perceive
Memories         what each villager saw and how they interpreted it
Morning adapter  exact deaths, stamps, questions, suspicion and alibis
```

The legacy dawn/day game currently remains as a compatibility shell. It formats the Director's outcome but may not choose a substitute victim or reroll an attack.

## Retirement gates for the old night walk

The legacy queue remains in the file only as a load-failure fallback. Remove it after these gates pass in the playable build:

- Search and Watch both complete and resume from storage through the Director.
- A player can encounter, hail and follow every living villager.
- A hunt may end in an empty hunt, villager death/change, intervention, player escape or player death.
- Stamps, clues, whispers and delusions reach the Journal correctly.
- Director encounters generate next-day questions without duplicate paraphrases.
- Dawn reports the same victim, location, witnesses and signs as the lived night.
- Seeded simulations pass for every monster and damaged-location state.
- Chase and threshold outcomes survive storage and project correctly into dawn and the Journal.

At that point delete the old queue builder, Watch fork, stage switch, handler-time `chance()` calls and obsolete prose pools. Keep the V5 `NightShell`, scene art, portraits, audio primitives, evidence plaques, `StampChip`, First Light separation and any prose adopted by Director beats.

## Next content pass

The next vertical slice should deepen the same engine rather than add another special scenario:

- a second chase composition built around helping or abandoning another villager;
- delayed doorstep consequences that can recur several nights after the monster learns the player's home;
- location- and weather-driven audio cues for bells, breath, leaves, crickets, gates, bustle, wails and deliberate silence;
- relationship actions such as warn, escort, seek, avoid and mourn;
- findings that can be dropped, destroyed by weather or carried by another villager;
- a visible Journal timeline and relationship map built only from observation and testimony.
