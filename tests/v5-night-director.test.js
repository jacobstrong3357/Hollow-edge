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
  state = take(state, { type: "HAIL", actorId: hail.actorId });
  assert.strictEqual(state.delays[hail.actorId], beforeDelay + 1, "hailing must delay the villager by one slot");
  assert(state.ledgers.truth.some(function (x) { return x.kind === "hailed"; }), "truth records the mutual meeting");
  assert(state.ledgers.observations.some(function (x) { return x.kind === "meeting"; }), "player observation records the meeting");
  assert(state.ledgers.memories[hail.actorId].some(function (x) { return x.acknowledged; }), "villager memory records an acknowledged alibi-grade meeting");
})();

(function presentationBeatDoesNotRepeatAcrossEmptyActions() {
  var state = Director.createNight(baseConfig("non-sticky-beat"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert(state.currentBeat, "the forced delusion should produce a presentation beat");
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.currentBeat, null, "an uneventful next action must not repeat the previous presentation beat");
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
  state = take(state, { type: "WAIT" });
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
  config.forcedBeats = [{ id: "falk-note", type: "clue", slot: 3, location: "Village Square", actorId: "falk", text: "A folded medical note lies in the mud." }];
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
  assert.strictEqual(Director.version, 2);
  var state = Director.createNight(baseConfig("visible"));
  var visible = Director.visibleState(state);
  assert(Array.isArray(visible.actions));
  assert(!Object.prototype.hasOwnProperty.call(visible, "monsterSchedule"), "visible state must not leak hidden monster truth");
})();

(function versionOneWalksUpgradeWithoutRerolling() {
  var state = Director.createNight(baseConfig("old-save"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state.version = 1;
  delete state.visibility;
  delete state.chase;
  delete state.thresholdEvent;
  Object.keys(state.outcomes).forEach(function (slot) { delete state.outcomes[slot].chase; });
  var restored = JSON.parse(JSON.stringify(state));
  assert(Director.availableActions(restored).some(function (a) { return a.type === "WAIT"; }), "an old save remains playable before its first upgraded action");
  restored = take(restored, { type: "WAIT" });
  assert.strictEqual(restored.version, 2);
  assert(restored.visibility && restored.thresholdEvent && restored.outcomes[1].chase, "the first action fills only the new deterministic fields");
})();

console.log("v5-night-director: all tests passed");
