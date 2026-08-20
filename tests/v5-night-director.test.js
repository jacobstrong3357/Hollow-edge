"use strict";

var assert = require("assert");
var Director = require("../v5-night-director.js");

var villagers = [
  { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, disposition: 1, motive: { id: "rosa_grave", family: "grief", destination: "Graveyard", reason: "leave cloth at Tobias's grave", object: "a length of black cloth", depart: 0, duration: 4 } },
  { id: "falk", name: "Doctor Falk", role: "the Physician", alive: true, disposition: 1, motive: { id: "falk_church", family: "secret", destination: "Old Church", reason: "meet Father Ansel", object: "a folded medical note", depart: 0, duration: 4 } },
  { id: "ansel", name: "Father Ansel", role: "the Priest", alive: true, disposition: 0, motive: { id: "ansel_church", family: "faith", destination: "Old Church", reason: "alter the parish ledger", object: "the parish ledger", depart: 0, duration: 4 } },
  { id: "tobias", name: "Old Tobias", role: "the Gravedigger", alive: false },
  { id: "liesel", name: "Liesel", role: "the Innkeeper", alive: true, fled: true }
];

function baseConfig(seed) {
  return {
    seed: seed || "rosa-night",
    night: 3,
    slots: 7,
    villagers: villagers,
    player: { afflicted: true },
    monster: { id: "ghoul", hostId: "greta", active: true, signs: ["tracks", "graves", "bite"], hunts: ["Graveyard"], attack: "kill", reach: "out", huntSlot: 3 },
    currentFacts: { weather: "fog", active: true, huntLoc: "Graveyard", attackSlot: 3 },
    forcedBeats: [
      { id: "forced-stamp", type: "stamp", slot: 2, location: "Old Church", sign: "tracks", text: "Heavy prints stop at the vestry wall." },
      { id: "forced-clue", type: "clue", slot: 2, location: "Old Church", actorId: "falk", text: "A torn medical wrapper catches beneath the gate." },
      { id: "forced-whisper", type: "whisper", slot: 1, location: "Village Square", text: "A voice behind the well says your name." },
      { id: "forced-delusion", type: "delusion", slot: 0, location: "Village Square", text: "Every shutter opens, then none of them are open." }
    ]
  };
}

function take(state, wanted) {
  var available = Director.availableActions(state);
  var legal = available.find(function (item) {
    return item.type === wanted.type && (wanted.to == null || item.to === wanted.to) && (wanted.actorId == null || item.actorId === wanted.actorId);
  });
  assert(legal, "expected legal action " + JSON.stringify(wanted) + " among " + JSON.stringify(available));
  return Director.reduce(state, wanted);
}

(function deterministicGeneration() {
  var a = Director.createNight(baseConfig("same-seed"));
  var b = Director.createNight(baseConfig("same-seed"));
  assert.deepStrictEqual(a, b, "same seed must create the same hidden night");
  var c = Director.createNight(baseConfig("different-seed"));
  assert.notDeepStrictEqual(a.outcomes, c.outcomes, "different seeds should change sampled outcomes");
})();

(function filtersCastAndBuildsAgendas() {
  var state = Director.createNight(baseConfig());
  assert.deepStrictEqual(state.cast.map(function (v) { return v.id; }).sort(), ["ansel", "falk", "rosa"]);
  assert(!state.schedules.tobias && !state.schedules.liesel, "dead and fled villagers must not be scheduled");
  Object.keys(state.schedules).forEach(function (id) {
    var agenda = state.schedules[id];
    assert(agenda.motive.reason && agenda.motive.destination, "every actor needs a motive and destination");
    assert.strictEqual(agenda.slots.length, state.slots, "every agenda spans the night");
  });
  assert.deepStrictEqual(Director.validateNight(state), []);
})();

(function activeVillagersExistBeforeDeparture() {
  var config = baseConfig("real-origin");
  config.villagers = [{
    id: "falk", name: "Doctor Falk", role: "the Physician", alive: true,
    home: "Village Square", motive: { id: "late-call", family: "medicine", destination: "Old Church", reason: "answer a late call", object: "a medical bag", depart: 2, duration: 2 }
  }];
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { falk: "Old Church" } };
  var state = Director.createNight(config);
  assert.deepStrictEqual(state.schedules.falk.slots.slice(0, 2), ["Village Square", "Village Square"], "an active villager waits at their real origin rather than vanishing into an abstract Home");
})();

(function existingFactsAreAuthoritative() {
  var config = baseConfig("existing-facts");
  config.currentFacts = {
    weather: "storm",
    active: true,
    huntLoc: "Old Mill",
    attackSlot: 4,
    outMap: { rosa: "Village Square", falk: "Old Church", ansel: "home" },
    griefOut: "rosa",
    secretOut: { falk: true }
  };
  var state = Director.fromExistingFacts(config, config.currentFacts);
  assert.strictEqual(state.weather, "storm");
  assert.strictEqual(state.monsterSchedule.huntLoc, "Old Mill");
  assert.strictEqual(state.monsterSchedule.attackSlot, 4);
  assert.strictEqual(state.schedules.rosa.motive.family, "grief");
  assert.strictEqual(state.schedules.rosa.motive.destination, "Village Square");
  assert(state.schedules.ansel.slots.every(function (x) { return x === "Home"; }), "outMap home must keep actor home");
})();

(function routeActionsWriteSeparateLedgers() {
  var state = Director.createNight(baseConfig("route-ledgers"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert(state.found.delusions.length === 1, "afflicted arrival should reveal the forced delusion");
  state = take(state, { type: "LISTEN" });
  assert(state.found.whispers.length === 1, "listening should reveal the whisper");
  state = take(state, { type: "MOVE", to: "Old Church" });
  var hail = Director.availableActions(state).find(function (x) { return x.type === "HAIL"; });
  assert(hail, "a co-located villager should be hail-able");
  var beforeDelay = state.delays[hail.actorId] || 0;
  var beforeHailSlot = state.cursor;
  state = take(state, { type: "HAIL", actorId: hail.actorId });
  assert.strictEqual(state.cursor, beforeHailSlot, "speaking inside a scene must not consume a whole hour of night");
  assert.strictEqual(state.delays[hail.actorId], beforeDelay + 1, "hailing must delay the villager by one slot");
  assert(state.ledgers.truth.some(function (x) { return x.kind === "hailed"; }), "truth records the mutual meeting");
  assert(state.ledgers.observations.some(function (x) { return x.kind === "meeting"; }), "player observation records the meeting");
  assert(state.ledgers.memories[hail.actorId].some(function (x) { return x.acknowledged; }), "villager memory records an acknowledged alibi-grade meeting");
})();

(function aGatheringIsOneSceneRatherThanAQueueOfVillagers() {
  var config = baseConfig("bonfire-crowd");
  config.monster.active = false;
  config.player = {};
  config.forcedBeats = [];
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "Village Square", falk: "Village Square", ansel: "Village Square" } };
  config.gathering = { id: "bonfire", name: "bonfire", location: "Village Square", text: "A great bonfire is built in the square. Everyone pretends it is only for warmth." };
  config.encounterBudget = 2;
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert.strictEqual(state.currentBeat.type, "atmosphere");
  assert(/bonfire/.test(state.currentBeat.text), "the player sees the gathering that later testimony may name");
  assert.strictEqual(state.beats.filter(function (beat) { return beat.type === "encounter"; }).length, 0, "the crowd does not arrive as a stack of individual interruptions");
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "WAIT" });
  assert(state.presentedActorIds.length <= 2, "only a small cast is individually framed during one night");
})();

(function presentationBeatDoesNotRepeatAcrossEmptyActions() {
  var state = Director.createNight(baseConfig("non-sticky-beat"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert(state.currentBeat, "the forced delusion should produce a presentation beat");
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.currentBeat, null, "an uneventful next action must not repeat the previous presentation beat");
})();

(function guidedNightOffersAStoryCorridorNotTheWholeMap() {
  var state = Director.createNight(baseConfig("guided-corridor"));
  var guide = { target: "Old Church", kind: "search", intentDone: false, interacted: {} };
  var actions = Director.guidedActions(state, guide);
  assert.strictEqual(actions.length, 1, "leaving home is one committed beginning");
  assert.strictEqual(actions[0].type, "LEAVE");
  state = take(state, actions[0]);
  actions = Director.guidedActions(state, guide);
  assert(actions.length <= 3, "an ordinary scene never becomes a wall of controls");
  assert.deepStrictEqual(actions.map(function (a) { return [a.type, a.to]; }), [["MOVE", "Old Church"]], "the player is led toward the declared errand rather than shown every road");
  state = take(state, actions[0]);
  actions = Director.guidedActions(state, guide);
  assert.deepStrictEqual(actions.map(function (a) { return a.type; }), ["SEARCH"], "arrival frames the intended investigation");
  state = take(state, actions[0]);
  guide.intentDone = true;
  actions = Director.guidedActions(state, guide);
  assert.deepStrictEqual(actions.map(function (a) { return a.type; }), ["KEEP_WATCH", "GO_HOME"], "after the errand, one meaningful watch replaces a stack of empty time buttons");
  var actorAction = Director.availableActions(state).find(function (a) { return a.type === "HAIL"; });
  if (actorAction) {
    actions = Director.guidedActions(state, { target: "Old Church", kind: "search", actorId: actorAction.actorId, intentDone: true, interacted: {} });
    assert(actions.some(function (a) { return a.type === "HAIL"; }), "the framed villager can be greeted once");
    var used = {};
    used[actorAction.actorId + "|HAIL"] = true;
    used[actorAction.actorId + "|FOLLOW"] = true;
    actions = Director.guidedActions(state, { target: "Old Church", kind: "search", actorId: actorAction.actorId, intentDone: true, interacted: used });
    assert(!actions.some(function (a) { return a.type === "HAIL" || a.type === "FOLLOW"; }), "the same villager interaction does not reappear at the next bend");
  }
})();

(function discoveriesAreEarnedAndFair() {
  var config = baseConfig("discoveries");
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "MOVE", to: "Old Church" });
  state = take(state, { type: "SEARCH" });
  assert.strictEqual(state.found.stamps.length, 1);
  assert.strictEqual(state.found.clues.length, 1, "a searched mundane object is filed separately from a monster sign");
  assert.strictEqual(state.found.stamps[0].sign, "tracks");
  assert(state.monsterSchedule.signs.indexOf(state.found.stamps[0].sign) >= 0, "stamps only reveal a real monster sign");
  assert.notStrictEqual(state.found.stamps[0].sign, "wail", "wailing is never found on the ground");
  var invalidConfig = baseConfig("invalid-stamp");
  invalidConfig.forcedBeats = [{ type: "stamp", slot: 0, location: "Village Square", sign: "claw" }];
  var invalidState = Director.createNight(invalidConfig);
  assert(!Object.keys(invalidState.discoverySchedule).some(function (key) { return invalidState.discoverySchedule[key].some(function (b) { return b.sign === "claw"; }); }), "a sign the monster does not leave must be rejected");
})();

(function keepingWatchSkipsFillerButNotEvents() {
  var config = baseConfig("watch-forward");
  config.monster.active = false;
  config.player = {};
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "home", falk: "Old Church", ansel: "home" } };
  config.forcedBeats = [{ id: "late-watch", type: "watch", slot: 4, location: "Village Square", actorId: "rosa", text: "A back door opens after hours of stillness." }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  var before = state.cursor;
  state = take(state, { type: "KEEP_WATCH" });
  assert(state.cursor > before + 1, "one keep-watch choice advances across empty clock slots");
  assert.strictEqual(state.currentBeat.id, "late-watch", "the simulation returns control at the next authored event");
})();

(function nightsMayBeShortWithoutAdvertisingTheirLengthToTheWorldModel() {
  var config = baseConfig("short-night");
  config.slots = 3;
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "home", falk: "home", ansel: "home" } };
  var state = Director.createNight(config);
  assert.strictEqual(state.slots, 3, "the Director accepts a genuinely short three-beat night");
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  assert.strictEqual(state.phase, "complete", "a quiet night can end promptly when the player returns home");
})();

(function uncaughtPrivateErrandsDoNotLeakIntoIncidentalClues() {
  for (var i = 0; i < 120; i += 1) {
    var config = baseConfig("private-stays-private:" + i);
    config.monster.active = false;
    config.villagers = [{
      id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
      motive: { id: "hidden-pages", family: "secret", destination: "Old Church", reason: "hide a packet of pages", object: "a packet of pages", depart: 0, duration: 6, secret: true },
      dialogue: { revealsSecret: false }
    }];
    config.currentFacts = { weather: "still", active: false, outMap: { rosa: "Old Church" }, secretOut: { rosa: true } };
    var state = Director.createNight(config);
    var leaked = Object.keys(state.discoverySchedule).some(function (key) {
      return state.discoverySchedule[key].some(function (beat) { return beat.type === "clue" && beat.actorId === "rosa"; });
    });
    assert(!leaked, "a secret errand only becomes a clue after the established catch gate succeeds");
  }
})();

(function hallucinationsCarryTheirOwnExplicitCorrection() {
  var config = baseConfig("unreal-memory");
  config.monster.active = false;
  config.forcedBeats = [{
    id: "false-road", type: "delusion", slot: 0, location: "Village Square",
    text: "The road changes and changes back.",
    meta: { fragments: ["The road changes.", "It changes back.", "It was not real."], resolvedAsUnreal: true }
  }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert.strictEqual(state.currentBeat.type, "delusion");
  assert.strictEqual(state.currentBeat.meta.resolvedAsUnreal, true);
  assert(/not real/i.test(state.currentBeat.meta.fragments[state.currentBeat.meta.fragments.length - 1]), "the last beat plainly corrects the hallucination");
})();

(function followingRevealsARealSceneAndInterviewThread() {
  var config = baseConfig("follow-payoff");
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "Graveyard", falk: "home", ansel: "home" } };
  config.villagers = [{
    id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
    motive: { id: "hidden-pages", family: "secret", destination: "Graveyard", reason: "hide a packet of pages", object: "a packet of pages", depart: 1, duration: 5, secret: true },
    dialogue: { follow: "Rosa buries a packet of pages beneath the wall.", revealsSecret: true, secretSummary: "she writes under another name" }
  }];
  var state = Director.createNight(config);
  Object.keys(state.visibility).forEach(function (slot) { state.visibility[slot].rosa = true; });
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "FOLLOW", actorId: "rosa" });
  assert.strictEqual(state.currentBeat.type, "follow");
  assert(/packet of pages/.test(state.currentBeat.text), "following shows what the villager actually does");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "followed" && event.actorId === "rosa"; }));
  var projection = Director.consequenceProjection(state);
  assert(projection.encounters.some(function (event) { return event.actorId === "rosa" && event.followed; }), "the follow becomes a daylight interview thread");
  assert(projection.secrets.some(function (event) { return event.actorId === "rosa"; }), "an actually witnessed secret survives into the village state");
})();

(function followingTheActiveHostEndsAllSocialChoices() {
  var config = baseConfig("recognition-is-not-a-chat");
  config.monster = { id: "werewolf", hostId: "rosa", active: true, signs: ["claw", "tracks", "bite"], hunts: ["Graveyard"], attack: "kill", reach: "out", voice: { mode: "beast" } };
  config.currentFacts = { weather: "still", active: true, huntLoc: "Graveyard", attackSlot: 6, outMap: { rosa: "Old Church" } };
  config.villagers = [{
    id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
    motive: { id: "false-errand", family: "work", destination: "Old Church", reason: "carry a parcel", object: "a parcel", depart: 1, duration: 5 },
    dialogue: { follow: "Rosa stops pretending and scents the church road for somebody's trail." }
  }];
  var state = Director.createNight(config);
  Object.keys(state.visibility).forEach(function (slot) { state.visibility[slot].rosa = true; });
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "FOLLOW", actorId: "rosa" });
  assert.strictEqual(state.phase, "threat", "recognising the host immediately enters survival state");
  assert.strictEqual(state.pendingThreat.kind, "recognition");
  var actions = Director.availableActions(state);
  assert(!actions.some(function (action) { return action.type === "HAIL" || action.type === "SEARCH"; }), "hail and search disappear after the mask drops");
  assert.deepStrictEqual(actions.map(function (action) { return action.type; }), ["FLEE", "WATCH_MONSTER", "CONFRONT_MONSTER"]);
  state.outcomes[state.cursor].hide = 0.99;
  state = take(state, { type: "WATCH_MONSTER" });
  assert.strictEqual(state.phase, "returning");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "monster_reveal_choice" && event.action === "WATCH_MONSTER"; }));
})();

(function aCorrectArmedConfrontationCanEndAtTheReveal() {
  var config = baseConfig("named-in-the-dark");
  config.player = { armedGuess: { id: "werewolf", name: "Werewolf", method: "silver" } };
  config.monster = { id: "werewolf", hostId: "rosa", active: true, signs: ["claw", "tracks", "bite"], hunts: ["Graveyard"], attack: "kill", reach: "out", voice: { mode: "beast" } };
  config.currentFacts = { weather: "still", active: true, huntLoc: "Graveyard", attackSlot: 6, outMap: { rosa: "Old Church" } };
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square", motive: { id: "false-errand", family: "work", destination: "Old Church", reason: "carry a parcel", object: "a parcel", depart: 1, duration: 5 }, dialogue: { follow: "Rosa stops pretending." } }];
  var state = Director.createNight(config);
  Object.keys(state.visibility).forEach(function (slot) { state.visibility[slot].rosa = true; });
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "FOLLOW", actorId: "rosa" });
  state = take(state, { type: "CONFRONT_MONSTER" });
  assert.strictEqual(state.phase, "complete");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "monster_slain"; }), "the true prepared name settles the confrontation without returning to social play");
})();

(function homeReachingHuntsDoNotRequireAStreetCollision() {
  var config = {
    seed: "witch-at-the-window", night: 6, slots: 7,
    villagers: [
      { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true },
      { id: "falk", name: "Doctor Falk", role: "the Physician", alive: true }
    ],
    monster: { id: "witch", hostId: "greta", active: true, signs: ["hex", "flora", "graves"], hunts: ["Old Church"], attack: "kill", reach: "home" },
    currentFacts: { weather: "still", active: true, huntLoc: "Old Church", attackSlot: 3, outMap: { rosa: "home", falk: "home" } }
  };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  var attack = state.ledgers.truth.find(function (event) { return event.kind === "slain"; });
  assert(attack, "a home-reaching active hunt must land even when the hunting ground is empty");
  assert.strictEqual(attack.location, "home", "dawn finds a behind-the-door victim at home");
  assert(!state.ledgers.truth.some(function (event) { return event.kind === "hunt_empty"; }));
})();

(function anEmptyOutdoorHuntStillDisturbsTheLivedNight() {
  var config = {
    seed: "empty-ghoul-ground", night: 5, slots: 5,
    villagers: [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }],
    monster: { id: "ghoul", hostId: "greta", active: true, signs: ["tracks", "graves"], hunts: ["Graveyard"], attack: "kill", reach: "out" },
    currentFacts: { weather: "still", active: true, huntLoc: "Graveyard", attackSlot: 2, outMap: { rosa: "home" } }
  };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "KEEP_WATCH" });
  assert(state.ledgers.truth.some(function (event) { return event.kind === "hunt_empty"; }));
  assert(state.beats.some(function (beat) { return beat.id.indexOf("hunt-empty-beat") === 0; }), "an active miss has a sensory near-miss rather than invisible bookkeeping");
})();

(function turningDoesNotFalselyKillTheVictim() {
  var config = baseConfig("turn-resolution");
  config.monster.attack = "turn";
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "MOVE", to: "Old Church" });
  state = take(state, { type: "MOVE", to: "Graveyard" });
  state = take(state, { type: "WAIT" });
  if (state.pendingThreat.kind === "witness") {
    var victimId = state.pendingThreat.victimId;
    state = Director.reduce(state, { type: "IGNORE" });
    var victim = state.cast.find(function (v) { return v.id === victimId; });
    assert(victim.alive && victim.changed, "a turning attack keeps the changed villager physically present");
    assert(state.ledgers.truth.some(function (x) { return x.victimId === victimId && x.kind === "changed"; }));
    assert(state.ledgers.truth.some(function (x) { return x.victimId === victimId && x.kind === "abandonment"; }), "leaving a neighbour is durable relationship truth, not merely attack presentation");
    assert(Director.consequenceProjection(state).relationships.some(function (x) { return x.actorId === victimId && x.kind === "abandoned"; }));
  } else {
    assert.strictEqual(state.pendingThreat.victimId, "player", "the only alternate target is the player");
  }
})();

(function attackAndEscapeUseSampledOutcomes() {
  var state = Director.createNight(baseConfig("attack-resolution"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "MOVE", to: "Old Church" });
  state = take(state, { type: "MOVE", to: "Graveyard" });
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.phase, "threat", "a player present at the sampled attack receives a threat choice");
  var snapshot = JSON.stringify(state.outcomes);
  var actions = Director.availableActions(state);
  assert(actions.every(function (a) { return a.label && a.tone; }), "threat actions carry UI labels and tones");
  var choice = actions[0];
  var resolved = Director.reduce(state, { type: choice.type });
  assert.strictEqual(JSON.stringify(resolved.outcomes), snapshot, "resolving a threat must not reroll sampled outcomes");
  assert(resolved.ledgers.truth.some(function (x) { return x.kind === "escape" || x.kind === "intervention" || x.kind === "slain"; }), "the consequence is written into truth");
  assert(resolved.beats.some(function (b) { return b.type === "flee" || b.type === "aftermath"; }), "the consequence has a renderable flee or aftermath beat");
})();

(function interventionProjectsAsARescueRelationship() {
  var state = Director.createNight(baseConfig("relationship-rescue"));
  state.phase = "threat";
  state.cursor = 2;
  state.player.location = "Dark Forest";
  state.pendingThreat = { id: "forced-threat", slot: 2, location: "Dark Forest", victimId: "falk", kind: "witness", sign: "tracks" };
  state.outcomes[2].intervene = 0.1;
  state = Director.reduce(state, { type: "INTERVENE" });
  var relationship = Director.consequenceProjection(state).relationships.find(function (rel) { return rel.actorId === "falk"; });
  assert(relationship && relationship.kind === "rescued" && relationship.succeeded, "a successful intervention becomes a durable rescue relationship");
})();

(function playerFlightBecomesARealChase() {
  var state = Director.createNight(baseConfig("chase-0"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "MOVE", to: "Old Church" });
  state = take(state, { type: "MOVE", to: "Graveyard" });
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.pendingThreat.victimId, "player");
  var sampled = JSON.stringify(state.outcomes[state.pendingThreat.slot].chase);
  state = take(state, { type: "FLEE" });
  assert.strictEqual(state.phase, "chase", "running opens a pursuit instead of resolving survival in one click");
  assert(Director.availableActions(state).some(function (a) { return a.type === "RUN" && a.to; }), "the chase offers real adjacent routes");
  assert(Director.availableActions(state).some(function (a) { return a.type === "BREAK_LINE"; }));
  state = take(state, { type: "BREAK_LINE" });
  assert.notStrictEqual(state.phase, "dead", "this seeded route breaks line of sight");
  assert.strictEqual(JSON.stringify(state.outcomes[3].chase), sampled, "the chase consumes its named tape without rerolling it");
  assert(state.ledgers.truth.some(function (e) { return e.kind === "chase_started"; }));
  assert(state.ledgers.truth.some(function (e) { return e.kind === "chase_step"; }));
  assert(state.ledgers.truth.some(function (e) { return e.kind === "escape" && e.succeeded; }));
  assert.strictEqual(state.phase, "returning", "the escape result remains visible before the threshold transition");
  state = take(state, { type: "REACH_HOME" });
  if (state.phase === "threshold") state = take(state, { type: "KEEP_BARRED" });
  assert.strictEqual(state.phase, "complete");
  assert(state.player.alive);
})();

(function aWerewolfEscapeTransfersRatherThanCancelsTheKill() {
  var config = {
    seed: "werewolf-relentless",
    night: 4,
    slots: 7,
    villagers: [{
      id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
      motive: { id: "late-parcel", family: "work", destination: "Old Mill", reason: "deliver a parcel", object: "a tied parcel", depart: 0, duration: 7 }
    }],
    monster: { id: "werewolf", hostId: "greta", active: true, signs: ["claw", "bite", "tracks"], hunts: ["Old Mill"], attack: "kill", reach: "out", huntSlot: 3 },
    currentFacts: { weather: "still", active: true, huntLoc: "Old Mill", attackSlot: 3, outMap: { rosa: "Old Mill" } }
  };
  var state = Director.createNight(config);
  state.attackPriorities[3].player = 0.01;
  state.attackPriorities[3].rosa = 0.9;
  state.outcomes[3].chase.breakLine[0] = 0.9;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "MOVE", to: "Old Mill" });
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.phase, "threat");
  assert.strictEqual(state.pendingThreat.victimId, "player", "the player is the werewolf's first quarry");
  assert.strictEqual(state.pendingThreat.fallbackVictimId, "rosa", "the night already knows who remains exposed");
  state = take(state, { type: "FLEE" });
  state = take(state, { type: "BREAK_LINE" });
  assert.strictEqual(state.phase, "returning", "the player really did escape");
  assert(state.player.alive);
  assert(state.ledgers.truth.some(function (event) { return event.kind === "relentless_retarget" && event.victimId === "rosa"; }), "truth records why the quarry changed");
  assert.strictEqual(state.ledgers.truth.filter(function (event) { return event.kind === "slain"; }).length, 1, "the third-night kill still lands exactly once");
  assert.strictEqual(state.ledgers.truth.find(function (event) { return event.kind === "slain"; }).victimId, "rosa", "dawn receives the replacement victim rather than an empty hunt");

  state = Director.createNight(config);
  state.attackPriorities[3].rosa = 0.01;
  state.attackPriorities[3].player = 0.9;
  state.outcomes[3].intervene = 0.1;
  state.outcomes[3].chase.breakLine[0] = 0.9;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "MOVE", to: "Old Mill" });
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.pendingThreat.victimId, "rosa", "the alternate branch catches a neighbour first");
  state = take(state, { type: "INTERVENE" });
  assert.strictEqual(state.phase, "chase", "a successful warning redirects the uninterruptible hunt onto the player");
  assert.strictEqual(state.chase.fallbackVictimId, "rosa");
  state = take(state, { type: "BREAK_LINE" });
  assert(state.player.alive && state.ledgers.truth.some(function (event) { return event.kind === "slain" && event.victimId === "rosa"; }), "even a successful intervention changes the route of the kill, not the werewolf's rhythm");
})();

(function theThresholdIsSafeButNotQuiet() {
  var config = baseConfig("door-2");
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "home" } };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  assert.strictEqual(state.phase, "threshold");
  assert.strictEqual(state.currentBeat.type, "doorstep");
  assert.deepStrictEqual(Director.availableActions(state).map(function (a) { return a.type; }), ["KEEP_BARRED", "LOOK_THROUGH", "ANSWER_DOOR"]);
  state = take(state, { type: "ANSWER_DOOR" });
  assert.strictEqual(state.phase, "complete");
  assert(state.player.alive, "the barred cottage remains a hard safety promise");
  assert.strictEqual(state.found.whispers.length, 1, "answering may preserve a voice, never a physical stamp");
  assert.strictEqual(state.found.stamps.length, 0);
  assert(state.ledgers.truth.some(function (e) { return e.kind === "threshold_choice"; }));
})();

(function goingHomeDoesNotStopTheVillageClock() {
  var state = Director.createNight(baseConfig("home-is-not-pause"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  assert.strictEqual(state.phase, "complete");
  assert.strictEqual(state.cursor, state.slots - 1, "the hidden village clock must settle through the final slot");
  assert(state.ledgers.truth.some(function (e) { return e.kind === "slain" && e.victimId === "rosa"; }), "a scheduled later attack still happens after the player bars the door");
})();

(function rosaFalkAnselAcceptanceRoute() {
  var cast = villagers.filter(function (v) { return ["rosa", "falk", "ansel"].includes(v.id); }).concat([{ id: "greta", name: "Greta", role: "the Herbalist", alive: true, disposition: -1, motive: { id: "greta_cover", family: "medicine", destination: "Graveyard", reason: "gather yew", object: "a yew bundle", depart: 0, duration: 4 } }]);
  var state = Director.fromExistingFacts({
    seed: "accept-0", night: 4, slots: 7, villagers: cast,
    monster: { id: "ghoul", hostId: "greta", active: true, signs: ["tracks", "graves"], hunts: ["Graveyard"], attack: "kill" }
  }, {
    weather: "fog", active: true, huntLoc: "Graveyard", attackSlot: 5,
    outMap: { rosa: "Graveyard", falk: "Old Church", ansel: "Old Church", greta: "Graveyard" }
  });
  /* This acceptance route proves a particular causal chain. Visibility itself
     has a separate test below, so keep every intended witness identifiable. */
  Object.keys(state.visibility).forEach(function (slot) {
    Object.keys(state.visibility[slot]).forEach(function (actorId) { state.visibility[slot][actorId] = true; });
  });
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "MOVE", to: "Old Church" });
  state = take(state, { type: "HAIL", actorId: "falk" });
  state = take(state, { type: "MOVE", to: "Graveyard" });
  state = take(state, { type: "HAIL", actorId: "rosa" });
  while (state.phase === "active" && state.cursor < state.monsterSchedule.attackSlot) state = take(state, { type: "WAIT" });
  assert.strictEqual(state.phase, "threat");
  assert.strictEqual(state.pendingThreat.victimId, "rosa", "the timetable, hail delay and seeded priority make Rosa the traceable target");
  assert(state.ledgers.memories.falk.length && state.ledgers.memories.ansel.length, "Falk and Ansel remember the player's church visit independently");
  assert.strictEqual(state.delays.rosa, 1, "the player's conversation changed Rosa's timing before the hunt");
  state = take(state, { type: "IGNORE" });
  assert(state.ledgers.truth.some(function (e) { return e.kind === "slain" && e.victimId === "rosa" && e.location === "Graveyard"; }), "the lived attack, not a dawn roll, fixes Rosa's fate and location");
})();

(function fogCanCreateOneSidedSightings() {
  var config = baseConfig("one-sided-fog");
  config.villagers = [{
    id: "falk", name: "Doctor Falk", role: "the Physician", alive: true,
    home: "Village Square", motive: { id: "late-call", family: "medicine", destination: "Old Church", reason: "answer a late call", object: "a medical bag", depart: 2, duration: 2 }
  }];
  config.monster.active = false;
  config.currentFacts = { weather: "fog", active: false, outMap: { falk: "Old Church" } };
  var state = Director.createNight(config);
  state.visibility[0].falk = false;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  var event = state.ledgers.truth.find(function (e) { return e.kind === "passed_unseen"; });
  assert(event && event.actors.includes("falk"), "the world records who passed the player unseen");
  assert(!state.ledgers.observations.some(function (o) { return o.eventId === event.id; }), "the player journal cannot identify someone hidden by fog");
  assert(state.ledgers.memories.falk.some(function (m) { return m.eventId === event.id; }), "the villager can still remember seeing the player's lantern");
  assert(!Director.availableActions(state).some(function (a) { return a.actorId === "falk" && ["HAIL", "FOLLOW"].includes(a.type); }), "an unseen villager cannot be hailed or followed by name");
})();

(function adjacentEncountersBecomeOneHumanConversation() {
  var config = baseConfig("coalesced-encounters");
  config.villagers = [{
    id: "falk", name: "Doctor Falk", role: "the Physician", alive: true,
    home: "Village Square", motive: { id: "late-call", family: "medicine", destination: "Old Church", reason: "answer a late call", object: "a medical bag", depart: 3, duration: 2 }
  }];
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { falk: "Old Church" } };
  config.forcedBeats = [{ id: "falk-note", type: "clue", slot: 2, location: "Village Square", actorId: "falk", text: "A folded medical note lies in the mud." }];
  var state = Director.createNight(config);
  state.visibility[0].falk = true;
  state.visibility[1].falk = true;
  state.visibility[2].falk = true;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "HAIL", actorId: "falk" });
  state = take(state, { type: "SEARCH" });
  var projection = Director.consequenceProjection(state);
  assert.strictEqual(projection.encounters.length, 1, "three adjacent clock ticks at one place become one interview thread");
  assert.strictEqual(projection.encounters[0].sourceEventIds.length, 4, "the compact thread retains every truth event for timing audits");
  assert(projection.encounters[0].acknowledged, "a hail upgrades the whole thread to a clear mutual memory");
  assert.strictEqual(projection.findings.length, 1, "an actor-linked physical clue becomes an evidence question candidate");
  assert.strictEqual(projection.findings[0].actorId, "falk");
})();

(function semanticsPenaliseRepetition() {
  var sig = Director.semanticSignature({ family: "grief", actorId: "rosa", location: "Graveyard", interaction: "errand", outcome: "unresolved" });
  assert(Director.noveltyScore(sig, [sig]) < Director.noveltyScore(sig, []), "exact semantic repetition is heavily penalised");
  var state = Director.createNight(Object.assign(baseConfig("semantic"), { recentSignatures: [sig] }));
  assert.strictEqual(new Set(state.usedSignatures).size, state.usedSignatures.length, "a generated night contains no duplicate semantic signatures");
})();

(function browserAndNodeSurface() {
  assert.strictEqual(Director.version, 4);
  var state = Director.createNight(baseConfig("visible"));
  var visible = Director.visibleState(state);
  assert(Array.isArray(visible.actions));
  assert(!Object.prototype.hasOwnProperty.call(visible, "monsterSchedule"), "visible state must not leak hidden monster truth");
})();

(function versionOneWalksUpgradeWithoutRerolling() {
  var state = Director.createNight(baseConfig("old-save"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state.version = 1;
  delete state.monsterSchedule.relentless;
  delete state.visibility;
  delete state.chase;
  delete state.thresholdEvent;
  Object.keys(state.outcomes).forEach(function (slot) { delete state.outcomes[slot].chase; });
  var restored = JSON.parse(JSON.stringify(state));
  assert(Director.availableActions(restored).some(function (a) { return a.type === "WAIT"; }), "an old save remains playable before its first upgraded action");
  restored = take(restored, { type: "WAIT" });
  assert.strictEqual(restored.version, 4);
  assert(restored.visibility && restored.thresholdEvent && restored.outcomes[1].chase, "the first action fills only the new deterministic fields");
  assert.strictEqual(restored.monsterSchedule.relentless, false, "old monster schedules gain the deterministic rhythm flag without rerolling");
})();

console.log("v5-night-director: all tests passed");
