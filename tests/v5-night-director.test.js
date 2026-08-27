"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
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

function answerAttackSetup(state, preferredMode) {
  if (state.phase !== "attack_setup") return state;
  var choices = Director.availableActions(state);
  var reply = choices.find(function (entry) { return !preferredMode || entry.responseMode === preferredMode; }) || choices[0];
  assert(reply && reply.type === "RESPOND_ATTACK_SETUP", "a focused pre-attack exchange must offer a human response");
  return take(state, reply);
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

(function aRemotePublicGatheringIsAnnouncedBeforeItEntersTheRecord() {
  var config = baseConfig("remote-grain-weighing");
  config.monster.active = false;
  config.player = {};
  config.forcedBeats = [];
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "home", falk: "home", ansel: "home" } };
  config.gathering = {
    id: "millgrind", name: "grain weighing", location: "Old Mill",
    text: "Inside the Old Mill, the season's last grain is weighed by lantern light.",
    distantText: "Before you choose a road, you know the grain weighing is underway at the Old Mill."
  };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert.strictEqual(state.currentBeat.type, "atmosphere");
  assert(/grain weighing|Old Mill/.test(state.currentBeat.text), "the player is told about the public mill event even when taking another road");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "gathering_announced" && event.location === "Old Mill"; }), "the ledger distinguishes public knowledge from attendance");
  assert(!state.ledgers.truth.some(function (event) { return event.kind === "gathering_seen"; }), "a remote announcement does not claim the player attended the mill");
})();

(function presentationBeatDoesNotRepeatAcrossEmptyActions() {
  var state = Director.createNight(baseConfig("non-sticky-beat"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert(state.currentBeat, "the forced delusion should produce a presentation beat");
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.currentBeat, null, "an uneventful next action must not repeat the previous presentation beat");
})();

(function strangeSightOffersIgnoreAndCanRevealPeopleSignsOrDanger() {
  var outcomes = { falseSight: false, person: false, sign: false, threat: false };
  for (var i = 0; i < 400 && !Object.keys(outcomes).every(function (key) { return outcomes[key]; }); i += 1) {
    var config = baseConfig("delusion-choice:" + i);
    config.monster.attackSlot = 6;
    config.currentFacts.attackSlot = 6;
    config.currentFacts.outMap = { rosa: "Village Square" };
    config.villagers = [{
      id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
      motive: { id: "market", family: "work", destination: "Village Square", reason: "deliver cloth", object: "a parcel", depart: 0, duration: 4 }
    }];
    config.forcedBeats = [{
      id: "strange-sight", type: "delusion", slot: 0, location: "Village Square", text: "A giggle comes from the leaves.",
      meta: { fragments: ["A giggle comes from the leaves.", "You move closer. The sound stops.", "Only trampled leaves. Something was there."], requiresResponse: true, unresolvedSight: true }
    }];
    var state = Director.createNight(config);
    state = take(state, { type: "LEAVE", to: "Village Square" });
    var actions = Director.guidedActions(state, { target: "Old Church", kind: "search", intentDone: false, interacted: {} });
    assert.deepStrictEqual(actions.map(function (a) { return a.label; }), ["Move closer and see what it is", "Do not look. Continue to the Old Church", "Leave it. Head for home"], "the sight offers curiosity, refusal and retreat as distinct choices");
    state = take(state, actions[0]);
    var choice = state.ledgers.truth.find(function (event) { return event.kind === "delusion_approach"; });
    assert(choice, "approaching the hallucination is recorded as a causal choice");
    if (choice.attractedThreat) {
      outcomes.threat = true;
      assert.strictEqual(state.phase, "threat", "the deterministic danger roll can turn curiosity into an attack");
    } else if (state.currentBeat && state.currentBeat.type === "encounter") {
      outcomes.person = true;
      assert.strictEqual(state.currentBeat.actorId, "rosa", "a real nearby villager can be the shape in the dark");
      assert(state.ledgers.truth.some(function (event) { return event.kind === "strange_sight_person" && event.actorId === "rosa"; }), "the real sighting is recorded");
    } else if (state.currentBeat && state.currentBeat.type === "stamp") {
      outcomes.sign = true;
      assert(state.found.stamps.length, "a dead animal, hex or other real monster sign is stamped for the Journal");
      assert(state.ledgers.truth.some(function (event) { return event.kind === "strange_sight_sign"; }), "the sign is recorded as a real event");
    } else {
      outcomes.falseSight = true;
      assert(state.currentBeat && state.currentBeat.type === "delusion" && state.currentBeat.meta.requiresResponse === false, "a false sight receives one concrete resolution");
      assert.strictEqual(state.currentBeat.meta.strangeSightResolution, "false");
      var continuation = Director.guidedActions(state, { target: "Old Church", kind: "search", intentDone: false, interacted: {} });
      assert.strictEqual(continuation[0].label, "Continue your search", "a resolved sight returns to the declared errand instead of asking the player to wait for a promise");
    }
  }
  assert(Object.keys(outcomes).every(function (key) { return outcomes[key]; }), "the seeded sightings include false shapes, people, signs and attacks");

  var ignoreConfig = baseConfig("delusion-ignore");
  ignoreConfig.forcedBeats = [{ id: "ignored-sight", type: "delusion", slot: 0, location: "Village Square", text: "A figure waits.", meta: { fragments: ["A figure waits.", "Only a tree."], requiresResponse: true } }];
  var ignored = Director.createNight(ignoreConfig);
  ignored = take(ignored, { type: "LEAVE", to: "Village Square" });
  var ignoreAction = Director.guidedActions(ignored, { target: "Old Church", kind: "search", intentDone: false, interacted: {} })[1];
  ignored = take(ignored, ignoreAction);
  assert(ignored.ledgers.truth.some(function (event) { return event.kind === "strange_sight_ignored"; }), "refusing to look is recorded separately");
  assert(!ignored.ledgers.truth.some(function (event) { return event.kind === "delusion_approach"; }), "refusing to look does not roll the approach danger");
  assert.strictEqual(ignored.phase, "active", "refusing to look continues the declared errand");

  var homeConfig = baseConfig("delusion-home");
  homeConfig.forcedBeats = [{ id: "home-sight", type: "delusion", slot: 0, location: "Village Square", text: "A figure waits.", meta: { fragments: ["A figure waits.", "Only a tree."], requiresResponse: true } }];
  var home = Director.createNight(homeConfig);
  home = take(home, { type: "LEAVE", to: "Village Square" });
  var homeAction = Director.guidedActions(home, { target: "Old Church", kind: "search", intentDone: false, interacted: {} })[2];
  home = take(home, homeAction);
  assert.strictEqual(home.phase, "returning", "heading home remains a separate choice");
  assert(!home.ledgers.truth.some(function (event) { return event.kind === "delusion_approach"; }));
})();

(function aFinalStrangeSightMustBeAnsweredBeforeTheJourneyHome() {
  var config = baseConfig("final-strange-sight");
  config.slots = 3;
  config.monster.active = false;
  config.currentFacts = { weather: "frost", active: false, outMap: {} };
  config.villagers = [];
  config.forcedBeats = [{
    id: "last-sight", type: "delusion", slot: 2, location: "Village Square", text: "A child-sized shape crosses the road.",
    meta: { fragments: ["A child-sized shape crosses the road.", "You hurry to the place it vanished.", "Only a dropped mitten, wet with dew."], requiresResponse: true }
  }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.phase, "active", "the final slot cannot complete while its strange sight still requires a choice");
  assert.strictEqual(state.player.location, "Village Square", "the unresolved sight remains where it happened instead of becoming the threshold");
  var actions = Director.guidedActions(state, { target: "Village Square", kind: "search", intentDone: true, searches: {}, interacted: {} });
  assert.deepStrictEqual(actions.map(function (item) { return item.label; }), ["Move closer and see what it is", "Do not look. Continue your search", "Leave it. Head for home"]);
  var finalSlot = state.cursor;
  state = Director.reduce(state, actions[0]);
  assert.strictEqual(state.cursor, finalSlot, "answering a sight is a reaction in the current slot, not an eighth hour of night");
  assert.strictEqual(state.phase, "returning", "after resolving the final sight, reaching home remains an explicit step");
  assert.strictEqual(state.player.location, "Village Square");
  assert(state.currentBeat && !(state.currentBeat.meta && state.currentBeat.meta.requiresResponse), "the concrete resolution remains visible on the journey-home choice");
  assert.deepStrictEqual(Director.availableActions(state).map(function (item) { return item.type; }), ["REACH_HOME"]);
})();

(function aWatchedVillagerDoesNotCrossTheirOwnDoorScene() {
  var config = baseConfig("watch-door-not-lane");
  config.openingIntent = { kind: "watch", id: "rosa" };
  config.monster.active = false;
  config.currentFacts = { weather: "storm", active: false, outMap: { rosa: "Old Church", falk: "home", ansel: "home" } };
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square", motive: { id: "late-delivery", family: "work", destination: "Old Church", reason: "deliver cloth", object: "a parcel", depart: 2, duration: 2 } }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert(!state.ledgers.truth.some(function (event) { return event.id.indexOf("encounter:") === 0 && event.actors.indexOf("rosa") >= 0; }), "the person still inside the watched house is not framed as a passer-by");
})();

(function aDoorWatchCommitsToFollowingTheDeparture() {
  var config = baseConfig("watch-door-follows");
  config.openingIntent = { kind: "watch", id: "rosa" };
  config.monster.active = false;
  config.currentFacts = { weather: "fog", active: false, outMap: { rosa: "Old Church", falk: "home", ansel: "home" } };
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square", motive: { id: "late-delivery", family: "work", destination: "Old Church", reason: "deliver cloth", object: "a parcel", depart: 1, duration: 3 } }];
  config.forcedBeats = [{ id: "rosa-departs", type: "watch", slot: 1, location: "Village Square", actorId: "rosa", text: "Rosa's door opens.", meta: { departure: true } }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "WAIT" });
  assert(state.currentBeat && state.currentBeat.meta.departure, "the watched departure owns the scene");
  var actions = Director.guidedActions(state, { target: "Village Square", kind: "watch", actorId: "rosa", actorName: "Rosa", interacted: {} });
  assert.deepStrictEqual(actions.map(function (action) { return [action.type, action.label]; }), [["FOLLOW", "Follow Rosa"]], "leaving the watched house commits the player to the follow instead of offering an abandoned watch");
  state = Director.reduce(state, actions[0]);
  assert(state.actionHistory.some(function (row) { return row.type === "FOLLOW" && row.actorId === "rosa"; }), "the single continuation begins the follow");
})();

(function guidedNightOffersAStoryCorridorNotTheWholeMap() {
  var corridorConfig = baseConfig("guided-corridor");
  corridorConfig.player.afflicted = false;
  var state = Director.createNight(corridorConfig);
  var guide = { target: "Old Church", kind: "search", intentDone: false, interacted: {} };
  var actions = Director.guidedActions(state, guide);
  assert.strictEqual(actions.length, 1, "leaving home is one committed beginning");
  assert.strictEqual(actions[0].type, "LEAVE");
  assert.strictEqual(actions[0].to, "Old Church", "a church-bound walk takes the real back-lane edge instead of staging a visit to the Square");
  assert(/back lanes straight/.test(actions[0].label), "the opening choice names the route the simulation actually takes");
  Object.keys(state.visibility[0] || {}).forEach(function (actorId) { state.visibility[0][actorId] = true; });
  state = take(state, actions[0]);
  actions = Director.guidedActions(state, guide);
  assert.deepStrictEqual(actions.map(function (a) { return [a.type, a.searchMode]; }), [["SEARCH", "ground"], ["SEARCH", "edges"]], "arrival offers two concrete ways to investigate the destination");
  state = take(state, actions[0]);
  guide.intentDone = true;
  guide.searches = { ground: true };
  actions = Director.guidedActions(state, guide);
  assert.deepStrictEqual(actions.map(function (a) { return [a.type, a.searchMode]; }), [["SEARCH", "edges"], ["SEARCH_ON", undefined], ["GO_HOME", undefined]], "the second search method and an ongoing search replace passive waiting while preserving the road home");
  assert(!actions.some(function (a) { return /until something changes/i.test(a.label); }), "continuing a search does not promise that the night will produce an event");
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

(function aFramedVillagerKeepsBothSocialChoicesInsideTheCorridor() {
  var config = baseConfig("greta-follow-visible");
  config.monster.active = false;
  config.currentFacts = { weather: "storm", active: false, outMap: { greta: "Dark Forest" } };
  config.forcedBeats = [];
  config.villagers = [{
    id: "greta", name: "Greta", role: "the Herbalist", alive: true, home: "Dark Forest",
    motive: { id: "night-herbs", family: "medicine", destination: "Dark Forest", reason: "gather night herbs", object: "a small bundle", depart: 0, duration: 4 }
  }];
  var state = Director.createNight(config);
  state.phase = "active";
  state.cursor = 0;
  state.player.location = "Dark Forest";
  state.schedules.greta.slots[0] = "Dark Forest";
  state.visibility[0].greta = true;
  state.currentBeat = { id: "greta-crosses", type: "encounter", slot: 0, location: "Dark Forest", actorId: "greta", text: "Greta crosses the lantern." };
  var actions = Director.guidedActions(state, { target: "Dark Forest", kind: "search", actorId: "greta", intentDone: false, searches: {}, interacted: {} });
  assert.deepStrictEqual(actions.slice(0, 2).map(function (item) { return item.type; }), ["HAIL", "FOLLOW"], "Hail and Follow take priority when a villager is visibly crossing the scene");
  assert(actions.some(function (item) { return item.type === "SEARCH"; }), "one location-specific search choice remains beside the social choices");
})();

(function searchChoicesBelongToThePlaceInsteadOfAdvertisingEvidence() {
  var expected = {
    "Village Square": /well|market|alley|doorway/i,
    "Old Church": /churchyard|church|vestry|window/i,
    Graveyard: /grave|plot|boundary wall/i,
    "Dark Forest": /trail|tree|bracken|path/i,
    "Old Mill": /millrace|wheel|store shed|door/i,
    Tavern: /stable|wagon|cellar|window/i
  };
  Object.keys(expected).forEach(function (target) {
    var config = baseConfig("site-search-labels:" + target);
    config.monster.active = false;
    config.currentFacts = { weather: "still", active: false, outMap: {} };
    config.villagers = [];
    config.player = {};
    config.forcedBeats = [];
    var state = Director.createNight(config);
    state.phase = "active";
    state.player.location = target;
    state.currentBeat = null;
    var actions = Director.guidedActions(state, { target: target, kind: "search", intentDone: false, searches: {}, interacted: {} });
    assert.strictEqual(actions.length, 2, target + " offers two parts of the place to explore");
    actions.forEach(function (action) {
      assert(expected[target].test(action.label), action.label + " should belong specifically to " + target);
      assert(!/tracks|marks|carcasses|blight/i.test(action.label), action.label + " should not advertise the hidden evidence category");
    });
    var onward = Director.guidedActions(state, { target: target, kind: "search", intentDone: true, searches: { ground: true, edges: true }, interacted: {} });
    assert(onward.some(function (action) { return action.type === "SEARCH_ON" && !/until something changes/i.test(action.label); }), target + " offers another concrete circuit without promising an event");
  });
})();

(function searchModesRevealOnlyTheEvidenceTheyCouldFind() {
  var config = baseConfig("search-modes");
  config.forcedBeats = [
    { id: "edge-sign:2", type: "stamp", slot: 2, location: "Old Church", sign: "bite", text: "A dead rook bears two clean punctures.", meta: { searchMode: "edges" } },
    { id: "edge-sign:3", type: "stamp", slot: 3, location: "Old Church", sign: "bite", text: "A dead rook bears two clean punctures.", meta: { searchMode: "edges" } }
  ];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "MOVE", to: "Old Church" });
  state = take(state, { type: "SEARCH", searchMode: "ground" });
  assert.strictEqual(state.found.stamps.length, 0, "the ground search does not magically expose a carcass hidden at the edge");
  state = take(state, { type: "SEARCH", searchMode: "edges" });
  assert.strictEqual(state.found.stamps.length, 1);
  assert.strictEqual(state.found.stamps[0].sign, "bite", "switching to walls and margins reveals the persistent carcass evidence one hour later");
  assert.strictEqual(state.currentBeat.id, "edge-sign:3");
})();

(function continuingASearchAdvancesTheWholeHiddenNight() {
  var config = baseConfig("search-through-night");
  config.monster.active = false;
  config.currentFacts = { weather: "frost", active: false, outMap: {} };
  config.villagers = [];
  config.player = {};
  config.forcedBeats = [{ id: "late-finding", type: "atmosphere", slot: 4, location: "Village Square", text: "A gate moves near the well." }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "SEARCH_ON" });
  assert.strictEqual(state.cursor, 4, "continuing the search advances every hidden slot until something changes");
  assert.strictEqual(state.currentBeat.id, "late-finding");
  assert(state.actionHistory.filter(function (row) { return row.type === "SEARCH_ON"; }).length >= 4, "the ledger records searching through the intervening hours instead of waiting");
})();

(function searchingCanDrawTheActiveMonster() {
  var sawThreat = false;
  var sawSafe = false;
  for (var i = 0; i < 80 && !(sawThreat && sawSafe); i += 1) {
    var config = baseConfig("search-risk:" + i);
    config.villagers = [];
    config.player = {};
    config.forcedBeats = [];
    config.monster.attackSlot = 6;
    config.currentFacts = { weather: "storm", active: true, huntLoc: "Village Square", attackSlot: 6, outMap: {} };
    var state = Director.createNight(config);
    state = take(state, { type: "LEAVE", to: "Village Square" });
    state.discoverySchedule = {};
    state = take(state, { type: "SEARCH", searchMode: "edges" });
    if (state.phase === "threat") {
      sawThreat = true;
      assert.strictEqual(state.pendingThreat.source, "search");
    } else sawSafe = true;
  }
  assert(sawThreat && sawSafe, "the deterministic search tape contains both quiet searches and searches that attract the hunter");
})();

(function everyOpeningDestinationIsReachedDirectly() {
  ["Village Square", "Old Church", "Graveyard", "Dark Forest", "Old Mill", "Tavern"].forEach(function (target) {
    var state = Director.createNight(baseConfig("direct-opening:" + target));
    var actions = Director.guidedActions(state, { target: target, kind: "search", intentDone: false, interacted: {} });
    assert.strictEqual(actions[0].to, target, target + " must be the first lived location, not an intermediate route node");
    assert(/straight/.test(actions[0].label));
  });

  var state = Director.createNight(baseConfig("graveyard-back-lane"));
  var actions = Director.guidedActions(state, { target: "Graveyard", kind: "search", intentDone: false, interacted: {} });
  assert.strictEqual(actions[0].to, "Graveyard");
  assert(/straight to the Graveyard/.test(actions[0].label));
  state = take(state, actions[0]);
  assert.strictEqual(state.player.location, "Graveyard");
  actions = Director.guidedActions(state, { target: "Graveyard", kind: "search", intentDone: false, interacted: {} });
  assert(actions.every(function (action) { return action.type !== "MOVE"; }), "arrival at the Graveyard cannot masquerade as arrival at the Church");
})();

(function aDistantScreamCanBeInvestigatedForAStampLastWordsAndSuspicion() {
  var sawClue = false;
  var heardWords = false;
  var drewSuspicion = false;
  var offeredDefence = false;
  for (var i = 0; i < 140 && !(sawClue && heardWords && drewSuspicion && offeredDefence); i += 1) {
    var config = baseConfig("body-investigation:" + i);
    config.slots = 6;
    config.openingIntent = { kind: "search", loc: "Graveyard" };
    config.player = {};
    config.forcedBeats = [];
    config.villagers = [
      { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square", motive: { id: "late-delivery", family: "work", destination: "Village Square", reason: "deliver a coat", object: "a parcel", depart: 0, duration: 6 } },
      { id: "falk", name: "Doctor Falk", role: "the Physician", alive: true, home: "Old Church" }
    ];
    config.monster = { id: "ghoul", hostId: "greta", active: true, signs: ["bite", "graves"], hunts: ["Village Square"], attack: "kill", reach: "out", huntSlot: 1 };
    config.currentFacts = { weather: "frost", active: true, huntLoc: "Village Square", attackSlot: 1, outMap: { rosa: "Village Square", falk: "home" } };
    var state = Director.createNight(config);
    state = take(state, { type: "LEAVE", to: "Graveyard" });
    state.discoverySchedule = {};
    state = take(state, { type: "SEARCH", searchMode: "ground" });
    assert(state.currentBeat && state.currentBeat.meta && state.currentBeat.meta.investigable, "the distant scream identifies a direction the player may choose to pursue");
    var choices = Director.guidedActions(state, { target: "Graveyard", kind: "search", intentDone: true, searches: { ground: true }, interacted: {} });
    var investigate = choices.find(function (action) { return action.investigateEventId; });
    assert(investigate && investigate.to === "Village Square" && /Investigate the scream/.test(investigate.label));
    state = take(state, investigate);
    var inquiry = Director.consequenceProjection(state).investigations[0];
    assert(inquiry && inquiry.victimId === "rosa" && inquiry.location === "Village Square");
    assert(state.currentBeat && state.currentBeat.meta && state.currentBeat.meta.bodyInvestigation, "investigating reaches the body as a lived scene");
    sawClue = sawClue || inquiry.clueFound;
    heardWords = heardWords || inquiry.heardLastWords;
    drewSuspicion = drewSuspicion || inquiry.suspicious;
    if (inquiry.clueFound) assert(state.found.stamps.some(function (stamp) { return stamp.sign === inquiry.sign; }), "physical evidence beside the body appears as a real stamp");
    if (inquiry.suspicious) {
      var defence = Director.guidedActions(state, { target: "Graveyard", kind: "search", intentDone: true, searches: { ground: true }, interacted: {} })
        .find(function (entry) { return entry.type === "PLEAD_INNOCENCE"; });
      assert(defence, "a player found beside the body can answer the accusation instead of silently accepting it");
      state = take(state, defence);
      var defended = Director.consequenceProjection(state).investigations[0];
      assert(defended.defenceMade, "the player's account is carried into the daylight consequence projection");
      offeredDefence = true;
    }
  }
  assert(sawClue && heardWords && drewSuspicion && offeredDefence, "the deterministic investigation tape contains evidence, last-word, social-suspicion and defence outcomes");
})();

(function aFinalBeatScreamMustBeAnsweredBeforeGoingHome() {
  var config = baseConfig("final-beat-scream");
  config.slots = 3;
  config.openingIntent = { kind: "search", loc: "Old Church" };
  config.player = {};
  config.forcedBeats = [];
  config.villagers = [
    { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square", motive: { id: "mill-errand", family: "work", destination: "Old Mill", reason: "collect flour", object: "a flour sack", depart: 0, duration: 3 } }
  ];
  config.monster = { id: "ghoul", hostId: "greta", active: true, signs: ["bite"], hunts: ["Old Mill"], attack: "kill", reach: "out", huntSlot: 2 };
  config.currentFacts = { weather: "still", active: true, huntLoc: "Old Mill", attackSlot: 2, outMap: { rosa: "Old Mill" } };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Old Church" });
  state.discoverySchedule = {};
  state = take(state, { type: "SEARCH", searchMode: "ground" });
  state = take(state, { type: "SEARCH", searchMode: "edges" });

  assert.strictEqual(state.cursor, 2, "the scream occurs in the final night slot");
  assert.strictEqual(state.phase, "active", "a final scream keeps the night active until the player answers it");
  assert(state.currentBeat && state.currentBeat.meta && state.currentBeat.meta.investigable, "the final scream remains an actionable scene");
  var savedDuringBug = JSON.parse(JSON.stringify(state));
  savedDuringBug.phase = "returning";
  savedDuringBug.ledgers.truth.push({ id: "dawn-return:2", slot: 2, kind: "started_home", location: "Old Church", reason: "dawn" });
  var repairedSave = Director.upgradeState(savedDuringBug);
  assert.strictEqual(repairedSave.phase, "active", "reloading a save stranded by the old bug restores the unanswered scream");
  assert(!repairedSave.ledgers.truth.some(function (event) { return event.id === "dawn-return:2"; }), "save repair removes the premature journey-home record");
  var choices = Director.guidedActions(state, { target: "Old Church", kind: "search", intentDone: true, searches: { ground: true, edges: true }, interacted: {} });
  var investigate = choices.find(function (entry) { return entry.investigateEventId; });
  assert(investigate && investigate.to === "Old Mill", "the player can go to the sound instead of being forced home");

  state = take(state, investigate);
  assert.strictEqual(state.cursor, 2, "following a final scream does not advance beyond the night");
  assert.strictEqual(state.player.location, "Old Mill");
  assert(state.currentBeat && state.currentBeat.meta && state.currentBeat.meta.bodyInvestigation, "the sound opens its aftermath scene");
})();

(function aScreamInThePlayersCurrentPlaceCanBeInvestigatedDirectly() {
  var config = baseConfig("same-place-scream");
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false };
  config.forcedBeats = [];
  var state = Director.createNight(config);
  state.phase = "active";
  state.cursor = 1;
  state.player.location = "Village Square";
  state.discoverySchedule = {};
  var victim = state.cast.find(function (entry) { return entry.id === "rosa"; });
  victim.alive = false;
  state.ledgers.truth.push({ id: "attack:1:rosa", slot: 1, kind: "slain", location: "Village Square", victimId: "rosa", sign: "bite", actors: ["greta", "rosa"] });
  state.currentBeat = {
    id: "same-place-scream-beat", type: "atmosphere", slot: 1, location: "Village Square",
    text: "A scream cuts across the Village Square.", truthEventId: "attack:1:rosa",
    meta: { heardOnly: true, investigable: true, disturbanceLocation: "Village Square", victimId: "rosa", attackEventId: "attack:1:rosa" }
  };
  state.beats.push(state.currentBeat);
  var guide = { target: "Village Square", kind: "search", intentDone: true, searches: {}, interacted: {} };
  var choices = Director.guidedActions(state, guide);
  assert.strictEqual(choices[0].type, "INVESTIGATE_HERE");
  assert.strictEqual(choices[0].label, "Run toward the scream");
  assert(!/from the Village Square/.test(choices[0].label), "the player is not told the scream came from somewhere else while standing there");

  var investigated = take(state, choices[0]);
  assert.strictEqual(investigated.player.location, "Village Square");
  assert(investigated.currentBeat && investigated.currentBeat.meta && investigated.currentBeat.meta.bodyInvestigation, "running across the same place opens the body scene without a fake travel step");

  var stayed = Director.reduce(state, choices[1]);
  assert(stayed.ledgers.truth.some(function (entry) { return entry.kind === "disturbance_ignored"; }), "staying records the decision not to investigate");
  assert(stayed.currentBeat && /No second cry comes/.test(stayed.currentBeat.text), "staying receives a concrete outcome rather than a generic wait line");
})();

(function bodyEvidenceIsOccasionalSpecificAndNeverRestamped() {
  function investigateClaw(seed, knownSigns) {
    var config = baseConfig(seed);
    config.player = {};
    config.knownSigns = knownSigns || [];
    config.forcedBeats = [];
    config.currentFacts = { weather: "frost", active: false };
    config.monster.active = false;
    config.villagers = [{ id: "tobias", name: "Old Tobias", role: "the Gravedigger", alive: true, home: "Village Square" }];
    var state = Director.createNight(config);
    state.phase = "active";
    state.cursor = 1;
    state.player.location = "Old Mill";
    state.cast[0].alive = false;
    state.ledgers.truth.push({ id: "attack:1:tobias", slot: 1, kind: "slain", location: "Old Mill", victimId: "tobias", sign: "claw", actors: ["greta", "tobias"] });
    state.currentBeat = {
      id: "claw-scream", type: "atmosphere", slot: 1, location: "Old Mill", truthEventId: "attack:1:tobias",
      meta: { investigable: true, disturbanceLocation: "Old Mill", victimId: "tobias", attackEventId: "attack:1:tobias" }
    };
    state.beats.push(state.currentBeat);
    return Director.reduce(state, { type: "INVESTIGATE_HERE", investigateEventId: "attack:1:tobias" });
  }

  var clues = 0;
  var samples = 240;
  for (var i = 0; i < samples; i += 1) {
    var state = investigateClaw("body-evidence-rate:" + i);
    var inquiry = Director.consequenceProjection(state).investigations[0];
    if (inquiry.clueFound) {
      clues += 1;
      assert(/Old Tobias's blood covers the ground/.test(state.currentBeat.text));
      assert(/Four deep claw marks/.test(state.currentBeat.text), "the prose names the stamped mark instead of referring to generic physical evidence");
      assert(/No human hand made them/.test(state.currentBeat.text));
    }
    assert(!/Do not follow the breathing/.test(state.currentBeat.text), "abstract last words are removed");
    assert(!/breathing just long enough/.test(state.currentBeat.text), "last words use a short physical beat");
  }
  assert(clues / samples > 0.32 && clues / samples < 0.58, "frost preserves evidence sometimes, not on every investigated body");

  var known = investigateClaw("known-claw-body", ["claw"]);
  var knownInquiry = Director.consequenceProjection(known).investigations[0];
  assert.strictEqual(knownInquiry.clueFound, false, "a mark already stamped in the Journal is not awarded again from another body");
  assert.strictEqual(known.currentBeat.type, "aftermath");
})();

(function aTavernScreamAlwaysOpensItsBodyScene() {
  for (var i = 0; i < 40; i += 1) {
    var config = baseConfig("tavern-investigation:" + i);
    config.slots = 6;
    config.openingIntent = { kind: "search", loc: "Old Mill" };
    config.player = {};
    config.forcedBeats = [];
    config.villagers = [
      { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square", motive: { id: "tavern-delivery", family: "work", destination: "Tavern", reason: "deliver cloth", object: "a parcel", depart: 0, duration: 6 } },
      { id: "falk", name: "Doctor Falk", role: "the Physician", alive: true, home: "Old Church" }
    ];
    config.monster = { id: "ghoul", hostId: "greta", active: true, signs: ["bite", "graves"], hunts: ["Tavern"], attack: "kill", reach: "out", huntSlot: 1 };
    config.currentFacts = { weather: "storm", active: true, huntLoc: "Tavern", attackSlot: 1, outMap: { rosa: "Tavern", falk: "home" } };
    var state = Director.createNight(config);
    state = take(state, { type: "LEAVE", to: "Old Mill" });
    state.discoverySchedule = {};
    state = take(state, { type: "SEARCH", searchMode: "ground" });
    var investigate = Director.guidedActions(state, { target: "Old Mill", kind: "search", intentDone: true, searches: { ground: true }, interacted: {} }).find(function (action) { return action.investigateEventId; });
    assert(investigate && investigate.to === "Tavern", "the Tavern scream has an investigation route");
    state.ledgers.memories = {};
    state = take(state, investigate);
    assert.strictEqual(state.player.location, "Tavern");
    assert(state.currentBeat && state.currentBeat.meta && state.currentBeat.meta.bodyInvestigation, "the Tavern investigation renders the body scene even when an older save lacks memory buckets");
  }
})();

(function aChangedScreamVictimNeverUsesOrdinaryErrandDialogue() {
  var config = baseConfig("tavern-changed-survivor");
  config.slots = 6;
  config.openingIntent = { kind: "search", loc: "Old Mill" };
  config.player = {};
  config.forcedBeats = [];
  config.villagers = [
    { id: "liesel", name: "Liesel", role: "the Innkeeper", alive: true, home: "Village Square", disposition: 1, motive: { id: "tavern-work", family: "work", destination: "Tavern", reason: "deliver a parcel", object: "a parcel", depart: 0, duration: 6 }, dialogue: { hail: "A neighbour needs this before dawn. I intend to deliver it.", follow: "Liesel finishes an ordinary errand." } },
    { id: "falk", name: "Doctor Falk", role: "the Physician", alive: true, home: "Old Church" }
  ];
  config.monster = { id: "ghoul", hostId: "greta", active: true, signs: ["graves"], hunts: ["Tavern"], attack: "turn", reach: "out", huntSlot: 1 };
  config.currentFacts = { weather: "storm", active: true, huntLoc: "Tavern", attackSlot: 1, outMap: { liesel: "Tavern", falk: "home" } };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Old Mill" });
  state.discoverySchedule = {};
  state = take(state, { type: "SEARCH", searchMode: "ground" });
  var guide = { target: "Old Mill", kind: "search", intentDone: true, searches: { ground: true }, interacted: {} };
  var investigate = Director.guidedActions(state, guide).find(function (action) { return action.investigateEventId; });
  state = take(state, investigate);
  assert(/Liesel is alive, but the attack has changed them\./.test(state.currentBeat.text), "the investigation names a turning instead of describing ambiguous shock");
  assert.strictEqual(state.currentBeat.meta.recognizedChanged, true, "the changed survivor is a certain witnessed consequence");
  guide.actorId = "liesel";
  var sceneActions = Director.guidedActions(state, guide);
  assert.deepStrictEqual(sceneActions.slice(0, 2).map(function (action) { return action.label; }), ["Speak to Liesel", "Follow Liesel when they move"]);
  state = take(state, { type: "HAIL", actorId: "liesel" });
  assert(state.currentBeat.meta.changedAftermath, "speaking to the changed survivor keeps the aftermath context");
  assert(!/neighbour needs this|ordinary errand/i.test(state.currentBeat.text), "pre-attack work dialogue cannot overwrite the changed survivor");
  state = take(state, { type: "FOLLOW", actorId: "liesel" });
  assert(state.currentBeat.meta.changedAftermath && /attack changed them/i.test(state.currentBeat.text), "following the changed survivor remains explicit about what happened");
  assert(Director.consequenceProjection(state).investigations.some(function (entry) { return entry.victimId === "liesel" && entry.recognizedChanged; }), "dawn receives the witnessed turning as certain knowledge");
})();

(function discoveriesAreEarnedAndFair() {
  var config = baseConfig("discoveries");
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "MOVE", to: "Old Church" });
  state = take(state, { type: "SEARCH" });
  assert.strictEqual(state.found.stamps.length, 1);
  assert.strictEqual(state.found.clues.length, 1, "a searched mundane object is filed separately from a monster sign");
  var livedDiscoveries = state.beats.filter(function (beat) { return beat.id === "forced-stamp" || beat.id === "forced-clue"; });
  assert.strictEqual(livedDiscoveries.length, 2);
  assert(livedDiscoveries[1].text.includes(livedDiscoveries[0].text), "every discovery filed from one search is surfaced together on the lived card");
  assert.strictEqual(state.found.stamps[0].sign, "tracks");
  assert(state.beats.some(function (beat) { return beat.id === "forced-stamp" && /fog/i.test(beat.text); }), "fog is present in the physical-search presentation, not only the night label");
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
  assert.strictEqual(state.phase, "returning", "heading home remains a visible journey beat before the threshold");
  state = take(state, { type: "REACH_HOME" });
  assert.strictEqual(state.phase, "complete", "a quiet night can end promptly once the player reaches home");
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
  config.currentFacts = { weather: "storm", active: false, outMap: { rosa: "Graveyard", falk: "home", ansel: "home" } };
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
  assert.strictEqual(state.currentBeat.text, "Rosa buries a packet of pages beneath the wall.", "the Director does not stack a second weather preamble onto authored follow copy");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "followed" && event.actorId === "rosa"; }));
  var projection = Director.consequenceProjection(state);
  assert(projection.encounters.some(function (event) { return event.actorId === "rosa" && event.followed; }), "the follow becomes a daylight interview thread");
  assert(projection.secrets.some(function (event) { return event.actorId === "rosa"; }), "an actually witnessed secret survives into the village state");
})();

(function aSecretLeadCrossesTheChosenSearchBeforeItsPrivateDestination() {
  var config = baseConfig("secret-corridor-lead");
  config.monster.active = false;
  config.openingIntent = { kind: "search", loc: "Old Church" };
  config.currentFacts = { weather: "fog", active: false, outMap: { rosa: "Dark Forest" }, secretOut: { rosa: true }, secretLeadId: "rosa", secretLeadLoc: "Old Church", secretLeadSlot: 0 };
  config.villagers = [{
    id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
    motive: { id: "hidden-pages", family: "secret", destination: "Dark Forest", reason: "hide a packet of pages", object: "a packet of pages", route: ["Village Square", "Old Church", "Dark Forest"], depart: 0, duration: 7, secret: true },
    dialogue: { follow: "Rosa leaves a packet of pages beneath a boundary stone.", revealsSecret: true, secretSummary: "she writes under another name" }
  }];
  config.forcedBeats = [
    { id: "fog-at-church", type: "atmosphere", slot: 0, location: "*", text: "The bell sounds once through the fog." },
    { id: "rosa-secret-lead", type: "encounter", slot: 0, location: "Old Church", actorId: "rosa", text: "Rosa crosses the lantern and keeps walking.", meta: { secretLead: true, critical: true } }
  ];
  var state = Director.createNight(config);
  state.visibility[0].rosa = true;
  assert.deepStrictEqual(state.schedules.rosa.route, ["Village Square", "Old Church", "Dark Forest"], "the sampled corridor lead is preserved instead of replaced by direct travel");
  state = take(state, { type: "LEAVE", to: "Old Church" });
  assert(state.currentBeat && state.currentBeat.id === "rosa-secret-lead", "the secret-bearing villager crosses the chosen location even when weather lands in the same hour");
  assert(Director.guidedActions(state, { kind: "search", target: "Old Church", actorId: "rosa" }).some(function (action) { return action.type === "FOLLOW" && action.actorId === "rosa"; }), "following the lead remains the player's choice");
  state = take(state, { type: "FOLLOW", actorId: "rosa" });
  assert.strictEqual(state.player.location, "Dark Forest");
  assert(Director.consequenceProjection(state).secrets.some(function (entry) { return entry.actorId === "rosa"; }), "following the corridor lead reveals the human secret");
})();

(function aLastHourFollowCanLingerAtItsDestination() {
  var config = baseConfig("last-hour-graveyard-pause");
  config.slots = 3;
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { tobias: "Graveyard" } };
  config.villagers = [{
    id: "tobias", name: "Old Tobias", role: "the Gravedigger", alive: true, home: "Village Square",
    motive: { id: "late-mourning", family: "grief", destination: "Graveyard", reason: "visit Father Ansel's grave", object: "a small sprig", depart: 1, duration: 3 },
    dialogue: { follow: "You follow Old Tobias to the Graveyard. Old Tobias speaks softly to Father Ansel's grave. Once, they laugh; then they go quiet.", griefName: "Father Ansel" }
  }];
  var state = Director.createNight(config);
  state.phase = "active";
  state.cursor = 1;
  state.player.location = "Village Square";
  state.schedules.tobias.slots[1] = "Village Square";
  state.schedules.tobias.slots[2] = "Graveyard";
  state.visibility[1].tobias = true;
  state.currentBeat = { id: "tobias-late", type: "encounter", slot: 1, location: "Village Square", actorId: "tobias", text: "Old Tobias crosses your lantern." };

  state = take(state, { type: "FOLLOW", actorId: "tobias" });
  assert.strictEqual(state.phase, "active", "arriving in the last hour does not immediately force the dawn return");
  assert.strictEqual(state.player.location, "Graveyard");
  assert.strictEqual(state.followPause.remaining, 2);
  var choices = Director.guidedActions(state, { kind: "search", target: "Graveyard", intentDone: true });
  assert.deepStrictEqual(choices.map(function (item) { return [item.type, item.pauseMode || null]; }), [
    ["LINGER_AFTER_FOLLOW", "near"],
    ["LINGER_AFTER_FOLLOW", "edges"],
    ["GO_HOME", null]
  ], "the graveyard offers two distinct beats and an immediate way home");

  state = take(state, { type: "LINGER_AFTER_FOLLOW", actorId: "tobias", pauseMode: "near" });
  assert.strictEqual(state.currentBeat.type, "linger");
  assert(/stay close enough to hear/i.test(state.currentBeat.text) && /Father Ansel's name/.test(state.currentBeat.text));
  assert.strictEqual(state.followPause.remaining, 1);
  choices = Director.availableActions(state);
  assert.deepStrictEqual(choices.map(function (item) { return item.pauseMode || item.type; }), ["edges", "GO_HOME"], "the unused second beat remains optional");

  state = take(state, { type: "LINGER_AFTER_FOLLOW", actorId: "tobias", pauseMode: "edges" });
  assert(/neighbouring graves/i.test(state.currentBeat.text));
  assert.strictEqual(state.followPause.remaining, 0);
  assert.deepStrictEqual(Director.availableActions(state).map(function (item) { return item.type; }), ["GO_HOME"], "after two beats the player chooses when to leave");
  state = take(state, { type: "GO_HOME" });
  assert.strictEqual(state.phase, "returning");
  assert.strictEqual(state.followPause, null);
})();

(function aChosenFollowCannotBeSuppressedAsRepeatedProse() {
  var config = baseConfig("follow-is-never-empty");
  config.slots = 4;
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { tobias: "Graveyard" } };
  config.villagers = [{
    id: "tobias", name: "Old Tobias", role: "the Gravedigger", alive: true, home: "Village Square",
    motive: { id: "mourning", family: "grief", destination: "Graveyard", reason: "visit a grave", object: "a flower", depart: 0, duration: 4 },
    dialogue: { follow: "Old Tobias kneels at one grave and lays down a flower." }
  }];
  config.recentSignatures = [Director.semanticSignature({ family: "follow", actorId: "tobias", location: "Graveyard", interaction: "follow", outcome: "shown" })];
  var state = Director.createNight(config);
  state.phase = "active";
  state.cursor = 0;
  state.player.location = "Village Square";
  state.schedules.tobias.slots[0] = "Village Square";
  state.schedules.tobias.slots[1] = "Graveyard";
  state.visibility[0].tobias = true;
  state.currentBeat = { id: "tobias-crosses", type: "encounter", slot: 0, location: "Village Square", actorId: "tobias", text: "Old Tobias crosses the road." };
  state = take(state, { type: "FOLLOW", actorId: "tobias" });
  assert(state.currentBeat && state.currentBeat.type === "follow", "a deliberate follow always produces its authored destination scene even when its signature appeared on an earlier night");
  assert.strictEqual(state.currentBeat.text, "Old Tobias kneels at one grave and lays down a flower.");
})();

(function followingTheActiveHostEndsAllSocialChoices() {
  var config = baseConfig("recognition-is-not-a-chat");
  config.monster = { id: "werewolf", hostId: "rosa", active: true, signs: ["claw", "tracks", "bite"], hunts: ["Graveyard"], attack: "kill", reach: "out", voice: { mode: "beast" }, revealText: "The muzzle opens through Rosa's face, but her long frame and eyes remain unmistakable." };
  config.currentFacts = { weather: "fog", active: true, huntLoc: "Graveyard", attackSlot: 6, outMap: { rosa: "Old Church" } };
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
  assert.strictEqual(state.currentBeat.type, "threat");
  assert(/monstrous shape/.test(state.currentBeat.text) && /cannot see its face/.test(state.currentBeat.text), "following the active host can reveal the monster without automatically naming its borrowed face");
  assert(state.currentBeat.text.startsWith("Fog closes over the turning."), "fog can conceal the host during an otherwise unmistakable monster sighting");
  assert((state.currentBeat.text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length <= 30, "the complete weather and recognition card fits a three-to-five-line mobile beat");
  var actions = Director.availableActions(state);
  assert(!actions.some(function (action) { return action.type === "HAIL" || action.type === "SEARCH"; }), "hail and search disappear after the mask drops");
  assert.deepStrictEqual(actions.map(function (action) { return action.type; }), ["FLEE", "WATCH_MONSTER", "CONFRONT_MONSTER"]);
  var quietEscape = JSON.parse(JSON.stringify(state));
  quietEscape.outcomes[quietEscape.cursor].flee = 0.5;
  quietEscape = take(quietEscape, { type: "FLEE" });
  assert.strictEqual(quietEscape.phase, "returning");
  assert.strictEqual(quietEscape.player.monsterSawYou, false, "a successful quiet retreat does not falsely mark the player as seen");
  state.monsterSchedule.signs = ["bite"];
  state.outcomes[state.cursor].hide = 0.99;
  state = take(state, { type: "WATCH_MONSTER" });
  assert.strictEqual(state.phase, "returning");
  assert(/pins a dead fox and bites once through the ribs/i.test(state.currentBeat.text), "watching a bite sign shows what the monster bites and what it does");
  assert(!/what was left here|borrowed body at its work/.test(state.currentBeat.text), "a learned sign cannot be joined to vague unrelated fragments");
  var revealChoice = state.ledgers.truth.find(function (event) { return event.kind === "monster_reveal_choice" && event.action === "WATCH_MONSTER"; });
  assert(revealChoice && revealChoice.location === "Old Church", "the survival choice retains the place where the encounter actually happened");
  assert.strictEqual(revealChoice.identityVisible, false, "an anonymous sighting stays distinct from identifying the host");
  assert.strictEqual(revealChoice.seenByMonster, false, "remaining successfully hidden does not invent mutual recognition");
})();

(function aMaskedInvitationTurnsFollowIntoAnAcceptance() {
  var config = baseConfig("masked-monster-lure");
  config.monster = { id: "werewolf", hostId: "rosa", active: true, signs: ["claw", "tracks"], hunts: ["Village Square"], attack: "kill", reach: "out", voice: { mode: "beast" } };
  config.currentFacts = { weather: "storm", active: true, huntLoc: "Village Square", attackSlot: 5, outMap: { rosa: "Old Church" } };
  config.villagers = [{
    id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
    motive: { id: "masked-errand", family: "work", destination: "Old Church", reason: "carry a parcel", object: "a parcel", depart: 1, duration: 5 },
    dialogue: { hail: "Rosa smiles. Walk with me.", luresFollow: true }
  }];
  var state = Director.createNight(config);
  state.phase = "active";
  state.cursor = 0;
  state.player.location = "Village Square";
  state.schedules.rosa.slots[0] = "Village Square";
  state.visibility[0].rosa = true;
  state.currentBeat = { id: "rosa-hail", type: "encounter", slot: 0, location: "Village Square", actorId: "rosa", text: "Rosa smiles. Walk with me." };
  var actions = Director.guidedActions(state, { actorId: "rosa", interacted: { "rosa|HAIL": true } });
  var follow = actions.find(function (action) { return action.type === "FOLLOW"; });
  assert(follow && follow.label === "Accept. Walk with Rosa", "a masked invitation has a natural acceptance instead of a generic tailing command");
  state = take(state, { type: "FOLLOW", actorId: "rosa" });
  assert.strictEqual(state.phase, "threat");
  assert.strictEqual(state.pendingThreat.location, "Village Square", "an invited monster reveals itself where the player accepted, not at its later destination");
  assert.strictEqual(state.player.location, "Village Square", "the danger screen and any resulting death retain the lived encounter location");
  assert.strictEqual(state.ledgers.truth.find(function (event) { return event.kind === "followed"; }).location, "Village Square", "the follow ledger agrees with the visible ambush location");
  state.outcomes[state.cursor].hide = 0.01;
  state = take(state, { type: "WATCH_MONSTER" });
  var caught = state.ledgers.truth.find(function (event) { return event.kind === "monster_reveal_choice"; });
  assert.strictEqual(state.phase, "dead");
  assert(caught && caught.caught && caught.location === "Village Square", "the caught outcome carries the same location into the death resolver");
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
  assert.strictEqual(state.player.location, "Old Church", "ending the monster keeps the player at the confrontation scene instead of teleporting them behind their bolt");
  assert(state.ledgers.truth.some(function (event) { return event.id === "night-complete" && event.kind === "ended_at_scene" && event.location === "Old Church"; }), "the night ledger distinguishes a victory at the scene from returning home");
  assert(/The monster is dead\./.test(state.currentBeat.text), "the armed confrontation states its successful outcome plainly");
})();

(function fleeingARecognitionAtTheFinalSlotCannotLeaveTheNightTape() {
  var config = baseConfig("final-slot-recognition-flee");
  config.slots = 3;
  config.forcedBeats = [];
  config.monster = { id: "werewolf", hostId: "rosa", active: true, signs: ["claw", "tracks"], hunts: ["Graveyard"], attack: "kill", reach: "out", voice: { mode: "beast" } };
  config.currentFacts = { weather: "fog", active: true, huntLoc: "Graveyard", attackSlot: 0, outMap: { rosa: "Old Church" } };
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square", motive: { id: "late-errand", family: "work", destination: "Old Church", reason: "carry a parcel", object: "a parcel", depart: 0, duration: 3 } }];
  var state = Director.createNight(config);
  state.phase = "active";
  state.cursor = state.slots - 1;
  state.player.location = "Old Church";
  state.schedules.rosa.slots[state.cursor] = "Old Church";
  state.visibility[state.cursor].rosa = true;
  state = take(state, { type: "FOLLOW", actorId: "rosa" });
  assert.strictEqual(state.cursor, state.slots - 1, "a final-slot follow stays on the final sampled hour");
  assert(state.pendingThreat && state.pendingThreat.slot === state.cursor, "the recognition uses an existing outcome slot");

  var escaped = JSON.parse(JSON.stringify(state));
  escaped.outcomes[escaped.cursor].flee = 0.99;
  escaped = take(escaped, { type: "FLEE" });
  assert.strictEqual(escaped.phase, "returning", "a successful final-slot flee opens the road-home result");
  assert(escaped.currentBeat && escaped.currentBeat.id.indexOf("reveal-escape:") === 0);

  var caught = JSON.parse(JSON.stringify(state));
  caught.outcomes[caught.cursor].flee = 0.01;
  caught = take(caught, { type: "FLEE" });
  assert.strictEqual(caught.phase, "dead", "the caught outcome renders its death result instead of throwing");
  assert(caught.currentBeat && caught.currentBeat.id.indexOf("reveal-caught:") === 0);

  var oldSave = JSON.parse(JSON.stringify(state));
  oldSave.cursor = oldSave.slots;
  oldSave.pendingThreat.slot = oldSave.slots;
  delete oldSave.outcomes[oldSave.slots - 1].flee;
  oldSave = Director.upgradeState(oldSave);
  assert.strictEqual(oldSave.cursor, oldSave.slots - 1, "an already-saved overflow slot is repaired on its next action");
  assert.strictEqual(oldSave.pendingThreat.slot, oldSave.slots - 1);
  assert.strictEqual(typeof oldSave.outcomes[oldSave.slots - 1].flee, "number", "missing flee odds are restored deterministically");
  assert.doesNotThrow(function () { Director.reduce(oldSave, { type: "FLEE" }); }, "a repaired in-progress save cannot blank on flee");
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
  state = take(state, { type: "REACH_HOME" });
  var attack = state.ledgers.truth.find(function (event) { return event.kind === "slain"; });
  assert(attack, "a home-reaching active hunt must land even when the hunting ground is empty");
  assert.strictEqual(attack.location, "home", "dawn finds a behind-the-door victim at home");
  assert(!state.ledgers.truth.some(function (event) { return event.kind === "hunt_empty"; }));
})();

(function guaranteedOutdoorQuarryOccupiesTheAttackHour() {
  var config = {
    seed: "guaranteed-outdoor-quarry", night: 8, slots: 6,
    villagers: [
      { id: "ansel", name: "Father Ansel", role: "the Priest", alive: true, home: "Old Church", motive: { id: "host-hunt", family: "faith", destination: "Graveyard", reason: "cross the churchyard", object: "a lantern", depart: 1, duration: 6 } },
      { id: "hazel", name: "Hazel", role: "the Midwife", alive: true, home: "Village Square", motive: { id: "late-errand", family: "obligation", destination: "Graveyard", reason: "leave a promised parcel", object: "a parcel", depart: 0, duration: 6 } }
    ],
    monster: { id: "ghoul", hostId: "ansel", active: true, signs: ["tracks", "graves", "bite"], hunts: ["Graveyard"], attack: "kill", reach: "out" },
    currentFacts: { weather: "frost", active: true, huntLoc: "Graveyard", attackSlot: 3, guaranteedVictimId: "hazel", outMap: { ansel: "Graveyard", hazel: "Graveyard" } },
    forcedBeats: []
  };
  var state = Director.createNight(config);
  assert.strictEqual(state.schedules.ansel.slots[1], "Graveyard", "the host has left the watched church door before the hunt");
  assert.strictEqual(state.schedules.hazel.slots[3], "Graveyard", "the fallback neighbour is present at the sampled attack hour");
  state = take(state, { type: "LEAVE", to: "Village Square" });
  while (state.phase === "active" && state.cursor < 3) state = take(state, { type: "KEEP_WATCH" });
  assert(state.ledgers.truth.some(function (event) { return event.kind === "slain" && event.victimId === "hazel"; }), "an uninterrupted active hunt lands on the scheduled neighbour");
  assert(!state.ledgers.truth.some(function (event) { return event.kind === "hunt_empty"; }), "an uninterrupted active hunt cannot report empty ground");
})();

(function watchedDoorResultOutranksCoincidentWeather() {
  var config = {
    seed: "door-opens-through-thunder", night: 4, slots: 5,
    openingIntent: { kind: "watch", id: "ansel" },
    villagers: [{ id: "ansel", name: "Father Ansel", role: "the Priest", alive: true, home: "Old Church", motive: { id: "night-crossing", family: "faith", destination: "Graveyard", reason: "cross the churchyard", object: "a lantern", depart: 0, duration: 5 } }],
    monster: { id: "ghoul", hostId: "greta", active: false, signs: ["tracks", "graves"], hunts: ["Graveyard"], attack: "kill", reach: "out" },
    currentFacts: { weather: "storm", active: false, outMap: { ansel: "Graveyard" } },
    forcedBeats: [
      { id: "thunder-at-door", type: "atmosphere", slot: 1, location: "Old Church", text: "Thunder rolls over the church." },
      { id: "door-opens", type: "watch", slot: 1, location: "Old Church", actorId: "ansel", text: "Father Ansel's door opens.", meta: { departure: true, critical: true } }
    ]
  };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Old Church" });
  state = take(state, { type: "KEEP_WATCH" });
  assert.strictEqual(state.currentBeat.id, "door-opens", "weather cannot overwrite the watched suspect's departure");
  assert(Director.guidedActions(state, { kind: "watch", actorName: "Father Ansel", target: "Old Church" }).some(function (action) { return action.type === "FOLLOW" && action.actorId === "ansel"; }), "the departure still exposes the required follow action");
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
  state = answerAttackSetup(state);
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
  state = answerAttackSetup(state);
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

(function reachingTheSampledHuntRestoresTheWarningScene() {
  var config = baseConfig("witnessed-warning-restored");
  config.slots = 5;
  config.openingIntent = { kind: "search", loc: "Old Mill" };
  config.player = {};
  config.forcedBeats = [];
  config.villagers = [{
    id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
    motive: { id: "mill-errand", family: "work", destination: "Old Mill", reason: "collect flour", object: "a flour sack", depart: 0, duration: 5 }
  }];
  config.monster = { id: "ghoul", hostId: "greta", active: true, signs: ["bite", "graves"], hunts: ["Old Mill"], attack: "kill", reach: "out", huntSlot: 2 };
  config.currentFacts = { weather: "still", active: true, huntLoc: "Old Mill", attackSlot: 2, guaranteedVictimId: "rosa", outMap: { rosa: "Old Mill" } };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Old Mill" });
  state.discoverySchedule = {};
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "WAIT" });

  assert.strictEqual(state.phase, "attack_setup", "the neighbour first becomes the focus of an ordinary exchange");
  assert(state.currentBeat.actorId === "rosa" && state.currentBeat.type === "encounter", "Rosa is alive and speaking before the danger appears");
  assert(Director.availableActions(state).every(function (action) { return action.type === "RESPOND_ATTACK_SETUP"; }), "the setup lets the player answer Rosa before the attack interrupts");
  state = answerAttackSetup(state, "ask");
  assert.strictEqual(state.phase, "threat", "being at the sampled hunt opens a live intervention scene");
  assert(state.pendingThreat && state.pendingThreat.kind === "witness" && state.pendingThreat.victimId === "rosa", "the sampled neighbour remains the quarry when the player witnesses the hunt");
  assert(Director.availableActions(state).some(function (action) { return action.type === "INTERVENE" && action.label === "Shout a warning"; }), "the player can try to stop the killing");

  state.outcomes[2].intervene = 0.1;
  state = take(state, { type: "INTERVENE" });
  assert(state.cast.find(function (villager) { return villager.id === "rosa"; }).alive, "a successful warning saves the neighbour");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "intervention" && event.succeeded; }), "the rescue remains a durable consequence");
})();

(function aRepeatedVillagerIsReintroducedAtTheLaterThreat() {
  var config = baseConfig("repeat-villager-threat");
  config.slots = 4;
  config.player = {};
  config.forcedBeats = [];
  config.villagers = [{
    id: "greta", name: "Greta", role: "the Herbalist", alive: true, home: "Village Square",
    motive: { id: "forest-crossing", family: "work", destination: "Dark Forest", reason: "gather yew", object: "a yew bundle", depart: 0, duration: 4 }
  }];
  config.monster = { id: "ghoul", hostId: "rosa", active: true, signs: ["bite"], hunts: ["Dark Forest"], attack: "kill", reach: "out", huntSlot: 2 };
  config.currentFacts = { weather: "frost", active: true, huntLoc: "Dark Forest", attackSlot: 2, guaranteedVictimId: "greta", outMap: { greta: "Dark Forest" } };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Dark Forest" });
  state.ledgers.truth.push({ id: "followed:1:greta", slot: 1, kind: "followed", location: "Tavern", actors: ["player", "greta"], actorId: "greta" });
  state.followedActorIds.push("greta");
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.phase, "attack_setup");
  assert(/Greta catches your lantern again\./.test(state.currentBeat.text), "a repeated villager is named as a return rather than introduced cold");
  assert(/last spoke at the Tavern/.test(state.currentBeat.text) && /Dark Forest/.test(state.currentBeat.text), "the new scene bridges the villager's previous and current locations");
  assert(state.currentBeat.meta && state.currentBeat.meta.attackSetup, "the repeat encounter holds the danger until the player has focused on Greta");
  state = answerAttackSetup(state);
  assert.strictEqual(state.phase, "threat", "the attack interrupts only after the exchange has landed");
})();

(function everyWitnessedNeighbourAttackBeginsWithAContextualExchange() {
  var setupKinds = {};
  for (var i = 0; i < 120; i += 1) {
    var config = baseConfig("attack-focus-variety:" + i);
    config.slots = 4;
    config.player = {};
    config.forcedBeats = [];
    config.villagers = [
      { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square", motive: { id: "forest-thread", family: "work", destination: "Dark Forest", reason: "collect blackthorn before dawn", object: "a reed basket", depart: 0, duration: 4 } },
      { id: "wilhelm", name: "Wilhelm", role: "the Miller", alive: true, home: "Old Mill", motive: { id: "mill-check", family: "work", destination: "Old Mill", reason: "check the sluice", object: "a mill key", depart: 0, duration: 4 } },
      { id: "greta", name: "Greta", role: "the Herbalist", alive: true, home: "Village Square", motive: { id: "herbs", family: "medicine", destination: "Dark Forest", reason: "gather yew", object: "a yew bundle", depart: 0, duration: 4 } }
    ];
    config.monster = { id: "ghoul", hostId: "greta", active: true, signs: ["bite"], hunts: ["Dark Forest"], attack: "kill", reach: "out", huntSlot: 2 };
    config.currentFacts = { weather: "still", active: true, huntLoc: "Dark Forest", attackSlot: 2, guaranteedVictimId: "rosa", outMap: { rosa: "Dark Forest", wilhelm: "Old Mill", greta: "Dark Forest" } };
    var state = Director.createNight(config);
    state.phase = "active";
    state.cursor = 1;
    state.player.location = "Dark Forest";
    state.schedules.rosa.slots[1] = "Dark Forest";
    state.schedules.rosa.slots[2] = "Dark Forest";
    state.visibility[1].rosa = true;
    state.currentBeat = { id: "rosa-crossing:" + i, type: "encounter", slot: 1, location: "Dark Forest", actorId: "rosa", text: "Rosa steps into the lantern light." };
    state.attackPriorities[2] = { rosa: -1 };
    state = take(state, { type: "FOLLOW", actorId: "rosa" });
    assert.strictEqual(state.phase, "attack_setup", "Rosa must be alive, speaking and foregrounded before any witnessed kill");
    assert(state.currentBeat.actorId === "rosa" && state.currentBeat.meta.attackSetup && !state.currentBeat.sign, "the setup is a normal person scene rather than a pre-coloured danger reveal");
    assert.strictEqual(Director.availableActions(state).length, 2, "the player gets a short, real exchange before the interruption");
    setupKinds[state.currentBeat.meta.setupKind] = true;
    state = answerAttackSetup(state);
    assert.strictEqual(state.phase, "threat");
    assert(state.ledgers.truth.some(function (event) { return event.kind === "attack_setup_exchange" && event.actorId === "rosa"; }), "the conversation is durable night truth if Rosa survives");
  }
  ["returned_item", "shared_suspicion", "errand", "personal_concern"].forEach(function (kind) {
    assert(setupKinds[kind], "the setup tape includes the " + kind + " conversation family");
  });
})();

(function closeMonsterChoicesTradeSafetyForWhatCanBeSeen() {
  var config = baseConfig("close-read-risks");
  config.villagers = [{ id: "tobias", name: "Old Tobias", role: "the Gravedigger", build: "stooped", alive: true, home: "Village Square" }];
  config.monster = { id: "demon", hostId: "tobias", active: true, signs: ["hex", "flora"], hunts: ["Dark Forest"], attack: "kill", reach: "out", revealText: "Rotted flesh opens in black seams. Beneath it, the stoop is unmistakably Old Tobias." };
  config.currentFacts = { weather: "still", active: true, huntLoc: "Dark Forest", attackSlot: 2, outMap: { tobias: "Dark Forest" } };
  config.forcedBeats = [];
  var original = Director.createNight(config);
  original.phase = "threat";
  original.cursor = 2;
  original.player.location = "Dark Forest";
  original.pendingThreat = { id: "close-demon", slot: 2, location: "Dark Forest", victimId: "player", kind: "player", sign: "hex" };
  var actions = Director.availableActions(original);
  assert.deepStrictEqual(actions.map(function (action) { return [action.type, action.hideMode]; }), [
    ["HIDE", "cover"], ["HIDE", "shadow"], ["HIDE", "still"], ["FLEE", undefined]
  ], "a close encounter offers three distinct ways to hide and the road home");
  assert(/roots/.test(actions[0].label) && /bracken/.test(actions[1].label) && /path/.test(actions[2].label), "the Dark Forest hiding choices use the place rather than imaginary village doorways");

  var shadow = JSON.parse(JSON.stringify(original));
  shadow.outcomes[2].conceal.shadow = { survive: 0.31, reveal: 0.9 };
  shadow = Director.reduce(shadow, { type: "HIDE", hideMode: "shadow" });
  assert.strictEqual(shadow.phase, "returning", "deep shadow is the safer low-information choice");
  assert(!shadow.ledgers.truth.some(function (event) { return event.kind === "monster_close_read" && (event.learnedIdentity || event.learnedBuild || event.learnedSign); }));

  var still = JSON.parse(JSON.stringify(original));
  still.outcomes[2].conceal.still = { survive: 0.31, reveal: 0.1 };
  still = Director.reduce(still, { type: "HIDE", hideMode: "still" });
  assert.strictEqual(still.phase, "dead", "the same sampled survival value fails when the player risks standing in the open");

  var closeLook = JSON.parse(JSON.stringify(original));
  closeLook.outcomes[2].conceal.still = { survive: 0.99, reveal: 0.1 };
  closeLook = Director.reduce(closeLook, { type: "HIDE", hideMode: "still" });
  var reading = closeLook.ledgers.truth.find(function (event) { return event.kind === "monster_close_read"; });
  assert(reading && reading.learnedIdentity && reading.learnedBuild && reading.learnedSign === "hex", "surviving the most exposed choice can reveal sign, build and host together");
  assert.strictEqual(closeLook.currentBeat.actorId, "tobias");
  assert(/Old Tobias/.test(closeLook.currentBeat.text));
  assert(closeLook.found.stamps.some(function (stamp) { return stamp.sign === "hex" && stamp.source === "monster_close_read"; }), "a sign seen on the body becomes a real Journal stamp");
})();

(function aQuietTemperamentBeatCannotBecomeAnAttack() {
  var config = baseConfig("quiet-temperament");
  config.monster = { id: "vampire", hostId: "rosa", active: false, signs: ["bite", "cold"], hunts: ["Village Square"], attack: "kill", reach: "out", voice: { mode: "speaker" } };
  config.currentFacts = { weather: "still", active: false, outMap: {} };
  config.villagers = [];
  config.player = {};
  config.forcedBeats = [{
    id: "quiet-laugh", type: "atmosphere", slot: 0, location: "*", text: "A soft laugh comes from an empty house.",
    meta: { requiresResponse: true, quietPresence: true, voiceMode: "speaker", responseText: "The laugh moves to another lane and fades." }
  }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert(state.currentBeat.meta.quietPresence, "the non-hunt night still carries the monster's speaker temperament");
  var actions = Director.guidedActions(state, { target: "Village Square", kind: "search", intentDone: false, searches: {}, interacted: {} });
  assert.deepStrictEqual(actions.map(function (action) { return action.type; }), ["LISTEN", "GO_HOME"]);
  state = take(state, { type: "LISTEN" });
  assert(/another lane/.test(state.currentBeat.text), "turning toward the sound receives its authored quiet-night resolution");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "quiet_monster_presence" && event.activeHunt === false; }));
  assert(!state.ledgers.truth.some(function (event) { return event.kind === "slain" || event.kind === "changed" || event.kind === "player_slain"; }), "temperament can own an inactive night without inventing a victim");
})();

(function stormSoundResponseDoesNotPretendToKnowADirection() {
  var config = baseConfig("storm-voice-response");
  config.monster.active = false;
  config.currentFacts = { weather: "storm", active: false, outMap: {} };
  config.villagers = [];
  config.forcedBeats = [{
    id: "storm-voice", type: "atmosphere", slot: 0, location: "*", text: "Rain drowns the voice.",
    meta: { requiresResponse: true, soundCue: "whisper", weatherSoundCue: "thunder", voiceMode: "speaker" }
  }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Old Mill" });
  var actions = Director.guidedActions(state, { target: "Old Mill", kind: "search", intentDone: false, searches: {}, interacted: {} });
  assert.deepStrictEqual(actions.map(function (action) { return action.label; }), ["Hold still. Listen for the voice again", "Run. Head for home"]);
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
  assert.strictEqual(state.phase, "attack_setup", "the neighbour is foregrounded before the werewolf interrupts");
  state = answerAttackSetup(state);
  state = take(state, { type: "INTERVENE" });
  assert.strictEqual(state.phase, "chase", "a successful warning redirects the uninterruptible hunt onto the player");
  assert.strictEqual(state.chase.fallbackVictimId, "rosa");
  state = take(state, { type: "BREAK_LINE" });
  assert(state.player.alive && state.ledgers.truth.some(function (event) { return event.kind === "slain" && event.victimId === "rosa"; }), "even a successful intervention changes the route of the kill, not the werewolf's rhythm");
})();

(function aMarkedPlayerIsTheHuntsFirstQuarry() {
  var config = {
    seed: "marked-player-hunt",
    night: 8,
    slots: 5,
    villagers: [{
      id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
      motive: { id: "mill-errand", family: "work", destination: "Old Mill", reason: "leave a parcel", object: "a parcel", depart: 0, duration: 5 }
    }],
    player: { monsterSawYou: true, targeted: true },
    monster: { id: "ghoul", hostId: "greta", active: true, signs: ["bite", "graves"], hunts: ["Old Mill"], attack: "kill", reach: "out", huntSlot: 2 },
    currentFacts: { weather: "still", active: true, huntLoc: "Old Mill", attackSlot: 2, targetingPlayer: true, outMap: { rosa: "Old Mill" } },
    forcedBeats: []
  };
  var state = Director.createNight(config);
  assert.strictEqual(state.player.targeted, true);
  assert.strictEqual(state.attackPriorities[2].player, -1, "a marked hunt ranks the player ahead of neighbours sharing the ground");
  state = take(state, { type: "LEAVE", to: "Old Mill" });
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "WAIT" });
  assert.strictEqual(state.phase, "threat");
  assert.strictEqual(state.pendingThreat.victimId, "player", "the warning becomes a lived survival encounter rather than another neighbour dying nearby");
})();

(function aHomeReachingAttackIsWitnessedWhereThePlayerAndVictimStand() {
  var config = baseConfig("graveyard-witness-continuity");
  config.slots = 3;
  config.villagers = [{
    id: "tobias", name: "Old Tobias", role: "the Gravedigger", alive: true, home: "Village Square",
    motive: { id: "tobias-grave", family: "grief", destination: "Graveyard", reason: "stand at Father Ansel's grave", object: "a rusted key", depart: 1, duration: 3 }
  }];
  config.monster.reach = "home";
  config.monster.hostId = "greta";
  config.currentFacts = { weather: "still", active: true, huntLoc: "Old Church", attackSlot: 2, outMap: { tobias: "Graveyard" } };
  config.forcedBeats = [];
  var state = Director.createNight(config);
  state.phase = "active";
  state.cursor = 1;
  state.player.location = "Village Square";
  state.schedules.tobias.slots[1] = "Village Square";
  state.schedules.tobias.slots[2] = "Graveyard";
  state.visibility[1].tobias = true;
  state.currentBeat = { id: "tobias-crosses", type: "encounter", slot: 1, location: "Village Square", actorId: "tobias", text: "Old Tobias crosses your lantern." };
  state.attackPriorities[2] = { tobias: -1 };
  state = take(state, { type: "FOLLOW", actorId: "tobias" });
  assert.strictEqual(state.phase, "attack_setup", "Tobias speaks to the player before the visible threat interrupts them");
  assert.strictEqual(state.currentBeat.actorId, "tobias");
  assert(Director.availableActions(state).length >= 2, "the player can answer Tobias rather than watching a death arrive out of nowhere");
  state = answerAttackSetup(state);
  assert.strictEqual(state.phase, "threat", "the attack interrupts the Graveyard scene instead of changing Tobias off screen");
  assert.strictEqual(state.pendingThreat.victimId, "tobias");
  assert.strictEqual(state.pendingThreat.location, "Graveyard", "the witnessed attack occurs where Tobias and the player actually stand");
  assert.strictEqual(state.cast.find(function (actor) { return actor.id === "tobias"; }).alive, true, "Tobias remains alive until the player resolves the visible threat");
  assert(!state.ledgers.truth.some(function (event) { return event.kind === "followed" && event.actorId === "tobias"; }), "the calm follow card is not emitted after the attack has already begun");
  state = take(state, { type: "IGNORE" });
  var death = state.ledgers.truth.find(function (event) { return event.kind === "slain" && event.victimId === "tobias"; });
  assert(death && death.witnessed && death.location === "Graveyard", "the death is recorded as witnessed at the Graveyard");
  assert(/stay hidden|before your eyes/i.test(state.currentBeat.text) && /Old Tobias/.test(state.currentBeat.text) && /neck breaks|colour drains|frost races|skin turns grey|vessels around it blacken|grave soil pours|wounds tear open/i.test(state.currentBeat.text), "staying silent shows Tobias dying in front of the player rather than replacing the death with a label");
  var aftermathChoices = Director.guidedActions(state, { target: "Graveyard", kind: "search", intentDone: true, searches: {}, interacted: {} });
  assert.strictEqual(aftermathChoices[0].type, "INVESTIGATE_HERE", "a witnessed body makes examination the first immediate choice");
  assert.strictEqual(aftermathChoices[0].label, "Examine Old Tobias's body and the fresh mark");
  state = Director.reduce(state, aftermathChoices[0]);
  var investigation = state.ledgers.truth.find(function (event) { return event.kind === "investigated_attack" && event.victimId === "tobias"; });
  assert(investigation && investigation.clueFound && investigation.sign === death.sign, "examining a witnessed body always identifies the real physical sign");
  assert(state.found.stamps.some(function (stamp) { return stamp.sign === death.sign; }), "the fresh mark is recorded in the Journal");
  assert(/Blood has soaked|neck is broken|Most of .*blood is gone|rigid and colder|blight reached the heart|No ordinary wound|Earth packs/.test(state.currentBeat.text), "the examination states a concrete manner of death");
  assert(state.currentBeat.meta && state.currentBeat.meta.bodyInvestigation, "the examination remains a full body scene before the next route choice");
})();

(function aMillRescueCrewWitnessesRosasVisibleDeathAndCorroboratesThePlayer() {
  var config = baseConfig("mill-rescue-witnesses");
  config.slots = 4;
  config.player = {};
  config.forcedBeats = [];
  config.villagers = [
    { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square", motive: { id: "rosa-mill", family: "work", destination: "Old Mill", reason: "save the grain", object: "a rope", depart: 0, duration: 4 } },
    { id: "tobias", name: "Old Tobias", role: "the Gravedigger", alive: true, home: "Graveyard", motive: { id: "tobias-mill", family: "duty", destination: "Old Mill", reason: "hold the rescue rope", object: "a rope", depart: 0, duration: 4 } },
    { id: "liesel", name: "Liesel", role: "the Innkeeper", alive: true, home: "Tavern", motive: { id: "liesel-mill", family: "duty", destination: "Old Mill", reason: "carry grain clear", object: "a grain sack", depart: 0, duration: 4 } }
  ];
  config.monster = { id: "blight", hostId: "greta", active: true, signs: ["flora"], hunts: ["Old Mill"], attack: "kill", reach: "out", huntSlot: 2 };
  config.currentFacts = {
    weather: "still", active: true, huntLoc: "Old Mill", attackSlot: 2,
    outMap: { rosa: "Old Mill", tobias: "Old Mill", liesel: "Old Mill" },
    affliction: "millFlood", afflictionLoc: "Old Mill", afflictionCrowd: ["rosa", "tobias", "liesel"]
  };
  var state = Director.createNight(config);
  state.phase = "active";
  state.cursor = 1;
  state.player.location = "Old Mill";
  ["rosa", "tobias", "liesel"].forEach(function (id) {
    state.schedules[id].slots[1] = "Old Mill";
    state.schedules[id].slots[2] = "Old Mill";
  });
  state.visibility[1].rosa = true;
  state.currentBeat = { id: "rosa-on-rope", type: "encounter", slot: 1, location: "Old Mill", actorId: "rosa", text: "Rosa takes the rope beside you." };
  state.attackPriorities[2] = { rosa: -1 };

  state = take(state, { type: "FOLLOW", actorId: "rosa" });
  assert.strictEqual(state.phase, "attack_setup", "the mill rescue pauses on Rosa as a living person before the danger");
  assert(/braces the rescue rope beside you/.test(state.currentBeat.text) && /If the grain goes/.test(state.currentBeat.text), "Rosa works and speaks beside the player before the attack");
  assert(Director.availableActions(state).some(function (action) { return action.responseMode === "ask" && /who broke the millrace/.test(action.label); }), "the player can ask Rosa about the flooding before the scene turns");
  state = answerAttackSetup(state, "ask");
  assert.strictEqual(state.phase, "threat", "the attack interrupts the shared mill rescue");
  state = take(state, { type: "IGNORE" });
  assert(/Rosa's skin turns grey/.test(state.currentBeat.text) && /Black veins spread across their face/.test(state.currentBeat.text) && /then fall/.test(state.currentBeat.text), "Rosa's death is shown as a visible physical collapse");
  assert(/Old Tobias and Liesel are still on the rescue line/.test(state.currentBeat.text), "the death scene keeps the other mill rescuers present as witnesses");

  var examine = Director.guidedActions(state, { target: "Old Mill", kind: "search", intentDone: true, searches: {}, interacted: {} })[0];
  assert.strictEqual(examine.type, "INVESTIGATE_HERE");
  state = take(state, examine);
  assert(/blight reached the heart/.test(state.currentBeat.text), "the body examination explains what killed Rosa");
  assert(/Every plant beneath Rosa has greyed from the root/.test(state.currentBeat.text), "the examination reveals the separate plant sign around the body");
  assert(!/Rosa's skin turns grey/.test(state.currentBeat.text), "the examination does not simply replay the witnessed death animation");
  var inquiry = Director.consequenceProjection(state).investigations[0];
  assert(inquiry.corroborated && !inquiry.suspicious, "the rescue crew's direct view prevents a false body accusation");
  assert.deepStrictEqual(inquiry.corroboratingWitnessIds.sort(), ["liesel", "tobias"], "both surviving rescuers can account for the player");
  assert(!Director.guidedActions(state, { target: "Old Mill", kind: "search", intentDone: true, searches: {}, interacted: {} }).some(function (entry) {
    return entry.type === "PLEAD_INNOCENCE" || entry.type === "SHOW_BODY_EVIDENCE";
  }), "the player is not asked to plead against an accusation the witnesses already disproved");
})();

(function aNeighbourAtTheThresholdNamesThePlayersNightAction() {
  var config = baseConfig("door-2");
  config.openingIntent = { kind: "watch", id: "rosa" };
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorRoll = 0.9;
  state.thresholdEvent.dialogueRoll = 0;
  state.thresholdEvent.purpose = "return_item";
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  assert.strictEqual(state.phase, "returning", "the forest does not turn directly into the player's threshold");
  state = take(state, { type: "REACH_HOME" });
  assert.strictEqual(state.phase, "threshold");
  assert.strictEqual(state.thresholdEvent.visitorKind, "neighbour", "a real neighbour can be selected instead of the monster");
  assert.strictEqual(state.thresholdEvent.actorId, "rosa");
  assert.strictEqual(state.currentBeat.type, "doorstep");
  assert.deepStrictEqual(Director.availableActions(state).map(function (a) { return a.type; }), ["KEEP_BARRED", "LOOK_THROUGH", "ANSWER_DOOR"]);
  assert.strictEqual(Director.availableActions(state)[2].label, "Answer without looking");
  state = take(state, { type: "ANSWER_DOOR" });
  assert.strictEqual(state.phase, "threshold", "speaking through the closed door does not commit the player to opening it");
  assert(state.player.alive, "answering a real neighbour through the closed door is safe");
  assert(/watching|hid|hiding|outside my house/.test(state.currentBeat.text), "the watched neighbour confronts the player about that specific watch");
  assert.deepStrictEqual(Director.availableActions(state).map(function (a) { return a.type; }), ["KEEP_BARRED", "LOOK_THROUGH", "STEP_OUTSIDE"]);
  state = take(state, { type: "STEP_OUTSIDE" });
  assert.strictEqual(state.phase, "complete");
  assert.strictEqual(state.found.whispers.length, 0, "a neighbour's threshold conversation is not filed as supernatural evidence");
  assert.strictEqual(state.found.stamps.length, 0);
  assert(state.ledgers.truth.some(function (e) { return e.kind === "threshold_choice"; }));
  assert(state.ledgers.truth.some(function (e) { return e.kind === "threshold_confrontation" && e.actorId === "rosa"; }), "being caught watching creates a social consequence");
  assert(Director.consequenceProjection(state).relationships.some(function (event) { return event.kind === "caught_watching" && event.actorId === "rosa"; }));
})();

(function thresholdDetailsRespectTheSampledWeather() {
  var config = baseConfig("storm-threshold");
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.active = false;
  config.currentFacts = { weather: "storm", active: false, outMap: { rosa: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.kind = "breath";
  state.thresholdEvent.visitorKind = "neighbour";
  state.thresholdEvent.actorId = "rosa";
  state.thresholdEvent.item = "a button from your coat";
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  assert.strictEqual(state.phase, "threshold");
  assert(/Rain rattles/.test(state.currentBeat.text) && !/frost/i.test(state.currentBeat.text));
  state = take(state, { type: "LOOK_THROUGH" });
  assert.strictEqual(state.phase, "threshold", "looking reveals the visitor without ending the decision");
  assert(/Rain/.test(state.currentBeat.text) && /Rosa/.test(state.currentBeat.text) && !/frost/i.test(state.currentBeat.text), "a storm threshold reveals the real visitor in the sampled weather");
  assert.deepStrictEqual(Director.availableActions(state).map(function (action) { return action.type; }), ["KEEP_BARRED", "ANSWER_DOOR"], "the player may answer or remain barred after looking");
  assert(/Answer Rosa/.test(Director.availableActions(state)[1].label));
  state = take(state, { type: "KEEP_BARRED" });
  assert.strictEqual(state.phase, "complete");
})();

(function aThresholdLookShowsAConcerningNeighbourWithoutSolvingTheirIdentity() {
  var config = baseConfig("ambiguous-monster-threshold");
  config.villagers = [{ id: "greta", name: "Greta", role: "the Herbalist", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.hostId = "greta";
  config.monster.active = true;
  config.monster.reach = "home";
  config.currentFacts = { weather: "still", active: true, huntLoc: "Dark Forest", attackSlot: 5, outMap: { greta: "home" } };
  config.forcedBeats = [];
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "monster";
  state.thresholdEvent.actorId = "greta";
  state.thresholdEvent.clueLocation = "Dark Forest";
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  state = take(state, { type: "LOOK_THROUGH" });
  assert.strictEqual(state.currentBeat.type, "doorstep", "looking at Greta keeps the neutral doorstep presentation");
  assert(/Greta/.test(state.currentBeat.text) && !/\bmonster\b|followed you home|claws|no breath/i.test(state.currentBeat.text), "the scene is unsettling without confirming Greta is the monster");
  var answer = Director.availableActions(state).find(function (action) { return action.type === "ANSWER_DOOR"; });
  assert(answer && answer.label === "Answer Greta through the closed door" && answer.tone === "bone", "the action wording and colour do not reveal hidden visitor truth");
})();

(function aThresholdQuestionBecomesANaturalFollowUp() {
  var config = baseConfig("threshold-question-conversation");
  config.villagers = [{ id: "greta", name: "Greta", role: "the Herbalist", alive: true }];
  config.monster.hostId = "ansel";
  config.monster.active = false;
  config.currentFacts = { weather: "storm", active: false, huntLoc: "Graveyard", outMap: { greta: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "neighbour";
  state.thresholdEvent.actorId = "greta";
  state.thresholdEvent.purpose = "question";
  state.thresholdEvent.clueLocation = "Graveyard";
  state.thresholdEvent.requestRoll = 0;
  state.thresholdEvent.dialogueRoll = 0;
  state = take(state, { type: "LEAVE", to: "Graveyard" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  assert.strictEqual((state.currentBeat.text.match(/Were you near the Graveyard tonight/g) || []).length, 1, "the opening asks the question once");
  assert(!/I need to ask you something/.test(state.currentBeat.text), "the question does not announce another question");
  assert.strictEqual(Director.availableActions(state)[2].label, "Yes. I was near the Graveyard");
  state = take(state, { type: "LOOK_THROUGH" });
  assert(/Greta/.test(state.currentBeat.text) && /wait for your answer/i.test(state.currentBeat.text));
  assert(!/Were you near/.test(state.currentBeat.text), "looking through the shutter does not repeat the question");
  state = take(state, { type: "ANSWER_DOOR" });
  assert(/“Yes[,.]”/.test(state.currentBeat.text) && /follow me|bring your lantern/i.test(state.currentBeat.text), "the player's answer receives a direct reply");
  var followAction = Director.availableActions(state).find(function (action) { return action.type === "STEP_OUTSIDE"; });
  assert(followAction && followAction.label === "Follow Greta to the Graveyard", "the next choice names the agreed action");
  assert.strictEqual(followAction.tone, "amber", "a safe neighbour uses the same neutral threshold styling as any unknown visitor");
  state = take(state, followAction);
  assert.strictEqual(state.phase, "complete");
  assert(/lift the bar and open the door/.test(state.currentBeat.text) && /follow Greta to the Graveyard/.test(state.currentBeat.text) && /fresh earth/.test(state.currentBeat.text));
  assert(state.found.clues.some(function (clue) { return clue.source === "threshold_neighbour" && clue.location === "Graveyard"; }), "following the neighbour produces a concrete lead");
})();

(function aDoorstepRumourIsOnlyRevealedAfterThePlayerOpensTheDoor() {
  var config = baseConfig("threshold-rumour-after-risk");
  config.villagers = [
    { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true },
    { id: "wilhelm", name: "Wilhelm", role: "the Blacksmith", alive: true }
  ];
  config.monster.hostId = "ansel";
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, huntLoc: "Dark Forest", outMap: { rosa: "home", wilhelm: "home" } };
  config.forcedBeats = [];
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "neighbour";
  state.thresholdEvent.actorId = "rosa";
  state.thresholdEvent.purpose = "rumour";
  state.thresholdEvent.concernId = "wilhelm";
  state.thresholdEvent.clueLocation = "Dark Forest";
  state.thresholdEvent.requestRoll = 0;
  state.thresholdEvent.dialogueRoll = 0;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  assert(/need to talk|private word|something you should hear/i.test(state.currentBeat.text), "Rosa first asks for a private conversation");
  assert(!/Wilhelm|Dark Forest/.test(state.currentBeat.text), "the barred-door request does not give away the clue");
  assert(!state.found.clues.some(function (clue) { return clue.source === "threshold_neighbour"; }), "the clue is not awarded while the player remains safe inside");
  state = take(state, { type: "ANSWER_DOOR" });
  assert(!/Wilhelm|Dark Forest/.test(state.currentBeat.text), "answering through the closed door still withholds the private report");
  var outside = Director.availableActions(state).find(function (action) { return action.type === "STEP_OUTSIDE"; });
  assert(outside && outside.label === "Step outside and hear Rosa out", "the risky choice clearly promises the conversation");
  state = take(state, outside);
  assert(/I saw Wilhelm near the Dark Forest/.test(state.currentBeat.text), "Rosa gives the report once the player steps outside");
  assert.strictEqual(state.found.clues.filter(function (clue) { return clue.source === "threshold_neighbour"; }).length, 1, "opening the door awards the clue exactly once");
})();

(function aThresholdNeighbourCanReturnSomethingFromTheSearchedPlace() {
  var config = baseConfig("searched-place-threshold");
  config.openingIntent = { kind: "search", loc: "Old Church" };
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }];
  config.player = { monsterSawYou: false };
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "neighbour";
  state.thresholdEvent.actorId = "rosa";
  state.thresholdEvent.item = "your scarf pin";
  state.thresholdEvent.dialogueRoll = 0;
  state.thresholdEvent.purpose = "return_item";
  state = take(state, { type: "LEAVE", to: "Old Church" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  assert(!/Open the door and I will return it/.test(state.currentBeat.text), "a real neighbour does not issue an unnatural command before returning an item");
  state = take(state, { type: "ANSWER_DOOR" });
  assert(/scarf pin/.test(state.currentBeat.text) && /Old Church/.test(state.currentBeat.text), "the neighbour returns the dropped item and names the place the player searched");
  assert(!/answers quietly|Be more careful next time/.test(state.currentBeat.text), "the reply is a conversation rather than the repeated stock warning");
  state = take(state, { type: "STEP_OUTSIDE" });
  assert.strictEqual(state.phase, "complete");
})();

(function aThirdPartyDoorstepReportBecomesAQuestionForTheWatchedVillager() {
  var config = baseConfig("third-party-watched-item");
  config.openingIntent = { kind: "watch", id: "ansel" };
  config.villagers = [
    { id: "ansel", name: "Father Ansel", role: "the Priest", alive: true, home: "Old Church" },
    { id: "falk", name: "Doctor Falk", role: "the Physician", alive: true, home: "Old Mill" }
  ];
  config.player = { monsterSawYou: false };
  config.monster.active = false;
  config.currentFacts = { weather: "frost", active: false, outMap: { ansel: "home", falk: "home" } };
  config.forcedBeats = [];
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "neighbour";
  state.thresholdEvent.actorId = "falk";
  state.thresholdEvent.item = "your scarf pin";
  state.thresholdEvent.dialogueRoll = 0.3;
  state.thresholdEvent.purpose = "return_item";
  state = take(state, { type: "LEAVE", to: "Old Church" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  state = take(state, { type: "ANSWER_DOOR" });
  assert(/outside Father Ansel's door/.test(state.currentBeat.text), "Falk clearly says where the item was found");
  assert(!/Tell Father Ansel yourself/.test(state.currentBeat.text), "the report does not use the unclear stock dismissal");
  var choices = Director.availableActions(state);
  assert.strictEqual(choices.find(function (choice) { return choice.type === "KEEP_BARRED"; }).label, "Ask Doctor Falk to leave your scarf pin on the step");
  assert.strictEqual(choices.find(function (choice) { return choice.type === "STEP_OUTSIDE"; }).label, "Open the door and take back your scarf pin");
  assert(!state.ledgers.truth.some(function (event) { return event.kind === "threshold_confrontation" && event.actorId === "falk"; }), "a third-party finder is not treated as the person caught being watched");
  var projection = Director.consequenceProjection(state);
  var report = projection.findings.find(function (finding) { return finding.source === "threshold_report" && finding.actorId === "ansel"; });
  assert(report, "the report becomes evidence tied to Father Ansel");
  assert.strictEqual(report.question, "Doctor Falk found my scarf pin outside your door. Did you see who left it?");
  var barred = take(state, { type: "KEEP_BARRED" });
  assert(/ask Doctor Falk to leave your scarf pin on the step/.test(barred.currentBeat.text), "staying inside carries out the choice the player selected");
  var opened = take(state, { type: "STEP_OUTSIDE" });
  assert(/returns your scarf pin/.test(opened.currentBeat.text) && /outside Father Ansel's door/.test(opened.currentBeat.text), "opening the door resolves the handover without inventing a request");
})();

(function aFalseNeighbourMustLureThePlayerPastTheBolt() {
  var config = baseConfig("indoor-threshold-kill");
  config.villagers = [{ id: "wilhelm", name: "Wilhelm", role: "the Blacksmith", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.hostId = "wilhelm";
  config.monster.active = true;
  config.monster.reach = "home";
  config.currentFacts = { weather: "fog", active: true, huntLoc: "Village Square", attackSlot: 3, outMap: { wilhelm: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "monster";
  state.thresholdEvent.actorId = "wilhelm";
  state.thresholdEvent.requestRoll = 0;
  state.thresholdEvent.canEnter = true;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  state = take(state, { type: "ANSWER_DOOR" });
  assert.strictEqual(state.phase, "threshold", "answering through the door is not the same as opening it");
  assert(state.player.alive);
  var outsideAction = Director.availableActions(state).find(function (action) { return action.type === "STEP_OUTSIDE"; });
  assert(outsideAction, "the false neighbour asks the player to cross the safe threshold");
  assert.strictEqual(outsideAction.label, "Open the door. Step outside", "the choice makes the physical risk explicit without naming the visitor");
  assert.strictEqual(outsideAction.tone, "amber", "the action styling does not reveal that Wilhelm is the monster");
  state = take(state, outsideAction);
  assert.strictEqual(state.phase, "dead", "stepping outside lets the waiting monster attack");
  assert.strictEqual(state.player.alive, false);
  assert(/lift the bar and open the door/i.test(state.currentBeat.text), "the result makes clear that the player opened the door");
  assert(/Wilhelm stands on the step/.test(state.currentBeat.text) && /something you must see/i.test(state.currentBeat.text), "Wilhelm first appears as an ordinary neighbour with a plausible request");
  assert(/borrowed face changes/.test(state.currentBeat.text) && /waiting for this/i.test(state.currentBeat.text), "the monster is only revealed after the player steps into the lane");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "threshold_choice" && event.opened === true; }), "the threshold record preserves that the door was opened");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "player_slain" && event.source === "threshold"; }));
})();

(function aContextualMonsterCanOnlyTalkBeyondTheBarredDoor() {
  var config = baseConfig("contextual-door-taunt");
  config.monster.active = false;
  config.currentFacts = {
    weather: "still", active: false, huntLoc: null, outMap: {},
    monsterTaunt: {
      kind: "wrongful_hanging", channel: "door", accusedId: "hazel", accusedName: "Hazel",
      line: "The voice laughs softly. “You thought it was Hazel? Do not make me laugh. Hazel could never do what I do.”"
    }
  };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  assert.strictEqual(state.phase, "threshold", "a selected contextual taunt reaches the barred door even on a non-feeding night");
  assert(/only want to talk/i.test(state.currentBeat.text) && !/Hazel/.test(state.currentBeat.text), "the first knock does not reveal the speech before the player answers");
  state = take(state, { type: "ANSWER_DOOR" });
  assert(/thought it was Hazel/.test(state.currentBeat.text), "the voice answers the player's actual wrongful accusation");
  var afterAnswer = Director.availableActions(state);
  assert(!afterAnswer.some(function (choice) { return choice.type === "STEP_OUTSIDE" || choice.type === "INVITE_IN"; }), "a taunt does not become another lethal lure choice");
  var keepBarred = afterAnswer.find(function (choice) { return choice.type === "KEEP_BARRED"; });
  assert(keepBarred && /Let the voice leave/.test(keepBarred.label), "the only resolution keeps the physical safety choice explicit");
  state = take(state, keepBarred);
  assert.strictEqual(state.phase, "complete");
  assert(state.player.alive, "talking through the barred door is safe");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "monster_taunt" && event.contextKind === "wrongful_hanging"; }), "the contextual speech is preserved in the night record");
})();

(function aPromisedReplacementVictimCarriesTheMonstersNote() {
  var config = baseConfig("rescue-replacement-note");
  config.slots = 3;
  config.villagers = [{
    id: "tobias", name: "Old Tobias", role: "the Gravedigger", alive: true, home: "Village Square",
    motive: { id: "late-grave", family: "work", destination: "Dark Forest", reason: "check the boundary stones", object: "a spade", depart: 0, duration: 3 }
  }];
  config.monster.hostId = "greta";
  config.monster.active = true;
  config.monster.reach = "out";
  config.currentFacts = {
    weather: "still", active: true, huntLoc: "Dark Forest", attackSlot: 1, guaranteedVictimId: "tobias", outMap: { tobias: "Dark Forest" },
    monsterTaunt: { kind: "rescued_neighbour", channel: "walk", savedId: "greta", savedName: "Greta", targetId: "tobias", targetName: "Old Tobias", noteText: "YOU CHOSE." }
  };
  var state = Director.createNight(config);
  state.phase = "active";
  state.cursor = 0;
  state.player.location = "Village Square";
  state.schedules.tobias.slots[1] = "Dark Forest";
  state = take(state, { type: "WAIT" });
  var attack = state.ledgers.truth.find(function (event) { return event.kind === "slain" && event.victimId === "tobias"; });
  assert(attack && attack.monsterNote === "YOU CHOSE.", "the promised replacement victim carries the exact note named by the taunt");
  assert.strictEqual(attack.tauntKind, "rescued_neighbour");
})();

(function aQuietGroundTauntResolvesAsARealVoiceNotEvidence() {
  var config = baseConfig("quiet-hunting-ground-taunt");
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, huntLoc: null, outMap: {} };
  config.forcedBeats = [{
    id: "quiet-taunt", type: "atmosphere", slot: 0, location: "Village Square",
    text: "A voice says you make this easy.",
    meta: { contextualTaunt: true, tauntKind: "quiet_hunting_ground", quietPresence: true, requiresResponse: true, responseText: "The voice laughs and moves away." }
  }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert(/make this easy/.test(state.currentBeat.text));
  state = take(state, { type: "LISTEN" });
  assert(/laughs and moves away/.test(state.currentBeat.text), "listening resolves the contextual voice instead of repeating it");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "monster_taunt" && event.contextKind === "quiet_hunting_ground"; }), "the voice is recorded as a taunt, not a physical monster sign");
  assert.strictEqual(state.found.stamps.length, 0, "a taunt never narrows the monster type");
})();

(function anOutdoorMonsterCannotCrossTheBarredDoor() {
  var config = baseConfig("outdoor-threshold-safe");
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.hostId = "rosa";
  config.monster.active = true;
  config.monster.reach = "out";
  config.currentFacts = { weather: "frost", active: true, huntLoc: "Village Square", attackSlot: 3, outMap: { rosa: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "monster";
  state.thresholdEvent.actorId = "rosa";
  state.thresholdEvent.canEnter = false;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  state = take(state, { type: "ANSWER_DOOR" });
  assert.strictEqual(state.phase, "threshold", "the outdoor monster keeps trying after the player answers");
  state = take(state, { type: "KEEP_BARRED" });
  assert.strictEqual(state.phase, "complete");
  assert(state.player.alive && /bolt/.test(state.currentBeat.text), "an outdoor-only monster can threaten the threshold but not cross it");
})();

(function aVampireNeedsAnExplicitInvitation() {
  var config = baseConfig("vampire-threshold-invitation");
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.id = "vampire";
  config.monster.hostId = "rosa";
  config.monster.reach = "invite";
  config.monster.voice = { mode: "speaker" };
  config.currentFacts = { weather: "frost", active: true, huntLoc: "Village Square", attackSlot: 3, outMap: { rosa: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "monster";
  state.thresholdEvent.actorId = "rosa";
  state.thresholdEvent.requestRoll = 0;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  assert(/May I come in|Invite me in|Say I may enter/i.test(state.currentBeat.text), "the vampire asks for the permission it needs");
  state = take(state, { type: "ANSWER_DOOR" });
  assert(state.player.alive && state.phase === "threshold", "conversation alone is not an invitation");
  assert(Director.availableActions(state).some(function (action) { return action.type === "INVITE_IN"; }));
  state = take(state, { type: "INVITE_IN" });
  assert.strictEqual(state.phase, "dead");
  assert(/give permission|cross the threshold/i.test(state.currentBeat.text));
})();

(function aQuietNightDoesNotAddASecretMonsterAttackAtHome() {
  var config = baseConfig("quiet-threshold-is-not-a-hunt");
  config.villagers = [
    { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true },
    { id: "falk", name: "Doctor Falk", role: "the Physician", alive: true }
  ];
  config.player = { monsterSawYou: true };
  config.monster.hostId = "rosa";
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "home", falk: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorRoll = 0;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  assert.strictEqual(state.phase, "threshold");
  assert.strictEqual(state.thresholdEvent.visitorKind, "neighbour", "a non-hunt night cannot smuggle in a lethal monster visit");
})();

(function aRealNeighbourCanBringAStampedSign() {
  var config = baseConfig("neighbour-threshold-sign");
  config.villagers = [
    { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true },
    { id: "falk", name: "Doctor Falk", role: "the Physician", alive: true }
  ];
  config.monster.active = false;
  config.currentFacts = { weather: "fog", active: false, huntLoc: "Graveyard", outMap: { rosa: "home", falk: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "neighbour";
  state.thresholdEvent.actorId = "rosa";
  state.thresholdEvent.purpose = "sign";
  state.thresholdEvent.sign = "bite";
  state.thresholdEvent.clueLocation = "Graveyard";
  state.thresholdEvent.requestRoll = 0;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  state = take(state, { type: "ANSWER_DOOR" });
  assert(/show you the mark|clearer if you see it yourself/i.test(state.currentBeat.text), "the neighbour answers once and asks the player to follow");
  state = take(state, { type: "STEP_OUTSIDE" });
  assert(state.player.alive && state.phase === "complete");
  assert(state.found.stamps.some(function (stamp) { return stamp.sign === "bite" && stamp.source === "threshold_neighbour"; }), "following a real neighbour to physical evidence creates a Journal stamp");
})();

(function aRealNeighbourCanBringAnUncertainLead() {
  var config = baseConfig("neighbour-threshold-concern");
  config.villagers = [
    { id: "rosa", name: "Rosa", role: "the Seamstress", alive: true },
    { id: "falk", name: "Doctor Falk", role: "the Physician", alive: true }
  ];
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, huntLoc: "Old Mill", outMap: { rosa: "home", falk: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "neighbour";
  state.thresholdEvent.actorId = "rosa";
  state.thresholdEvent.purpose = "concern";
  state.thresholdEvent.concernId = "falk";
  state.thresholdEvent.clueLocation = "Old Mill";
  state.thresholdEvent.requestRoll = 0;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  assert(/Doctor Falk has not come home/i.test(state.currentBeat.text));
  state = take(state, { type: "ANSWER_DOOR" });
  assert(/left for the Old Mill before the bell/i.test(state.currentBeat.text), "answering advances from the missing-person claim to a concrete last sighting");
  state = take(state, { type: "STEP_OUTSIDE" });
  assert(state.found.clues.some(function (clue) { return /Doctor Falk/.test(clue.text) && /search the first stretch together/i.test(clue.text); }), "opening the door advances the search instead of repeating the threshold line");
  var findings = Director.consequenceProjection(state).findings.filter(function (finding) { return finding.source === "threshold_missing_report"; });
  assert.deepStrictEqual(findings.map(function (finding) { return finding.actorId; }).sort(), ["falk", "rosa"], "the reporter and missing neighbour each receive a usable interview lead");
  assert(findings.every(function (finding) { return finding.question && finding.honest && finding.evasive; }), "both sides of the report have complete interview copy");
})();

(function announcedGatheringsRemainReachable() {
  var config = baseConfig("remote-market-route");
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "home", falk: "home", ansel: "home" } };
  config.gathering = { id: "market", name: "market eve", location: "Village Square", text: "Market eve fills the square with lanterns and neighbours.", distantText: "Market eve is underway in the Village Square." };
  config.forcedBeats = [];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Tavern" });
  assert.strictEqual(state.gathering.announced, true);
  assert.strictEqual(state.gathering.seen, false, "hearing the event from the Tavern does not pretend the player attended it");
  var route = Director.guidedActions(state, { target: "Tavern", kind: "search", intentDone: false, searches: {}, interacted: {} }).find(function (entry) { return /Go to the market eve/.test(entry.label); });
  assert(route && route.type === "MOVE" && route.to === "Village Square", "the announced event offers a clear route from another location");
  state = take(state, route);
  assert.strictEqual(state.gathering.seen, true);
  assert(state.ledgers.truth.some(function (event) { return event.kind === "gathering_announced"; }) && state.ledgers.truth.some(function (event) { return event.kind === "gathering_seen"; }), "announcement and attendance remain distinct causal facts");
  assert(/fills the square/.test(state.currentBeat.text), "arrival shows the event itself rather than repeating the distant notice");
})();

(function goingHomeDoesNotStopTheVillageClock() {
  var state = Director.createNight(baseConfig("home-is-not-pause"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  assert.strictEqual(state.phase, "returning");
  state = take(state, { type: "REACH_HOME" });
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
  assert.strictEqual(state.phase, "attack_setup", "Rosa's earlier hail leads into one last focused exchange");
  assert.strictEqual(state.currentBeat.actorId, "rosa");
  state = answerAttackSetup(state);
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
  var projection = Director.consequenceProjection(state);
  assert.strictEqual(projection.weather, "fog");
  assert.strictEqual(projection.encounters[0].clarity, "one_sided");
  assert(/fog hid/i.test(projection.encounters[0].weatherEffect), "the daylight thread preserves why recognition failed");
})();

(function anUnidentifiedFigureOffersARealDecision() {
  var config = baseConfig("actionable-hidden-figure");
  config.villagers = [{
    id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Village Square",
    motive: { id: "late-errand", family: "work", destination: "Old Church", reason: "deliver cloth", object: "a parcel", depart: 2, duration: 2 }
  }];
  config.monster.active = false;
  config.player = {};
  config.forcedBeats = [];
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "Old Church" } };
  var state = Director.createNight(config);
  state.discoverySchedule = {};
  state.visibility[0].rosa = false;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  assert(state.currentBeat && state.currentBeat.meta.hiddenFigure && !state.currentBeat.actorId, "the first card does not magically name the turned-away figure");
  var choices = Director.guidedActions(state, { target: "Village Square", kind: "watch", intentDone: false, interacted: {} });
  assert.deepStrictEqual(choices.map(function (choice) { return choice.type; }), ["IDENTIFY_FIGURE", "FOLLOW", "KEEP_WATCH"]);
  assert.deepStrictEqual(choices.map(function (choice) { return choice.label; }), ["Raise the lantern. Call out to them", "Follow the figure", "Let them pass. Take up the watch"]);

  var called = take(JSON.parse(JSON.stringify(state)), choices[0]);
  assert.strictEqual(called.currentBeat.actorId, "rosa");
  assert(/It is Rosa/.test(called.currentBeat.text), "calling out in clear weather answers who the figure is");
  assert(called.ledgers.truth.some(function (event) { return event.kind === "hidden_figure_identified" && event.actorId === "rosa"; }));
  var namedChoices = Director.guidedActions(called, { target: "Village Square", kind: "watch", intentDone: false, interacted: {} });
  assert.deepStrictEqual(namedChoices.map(function (choice) { return choice.label; }), ["Follow Rosa", "Let Rosa go. Take up the watch", "Leave them. Head for home"]);
  assert(!namedChoices.some(function (choice) { return choice.type === "HAIL"; }), "calling out does not immediately offer the same greeting again");

  var followed = take(JSON.parse(JSON.stringify(state)), choices[1]);
  assert(followed.ledgers.truth.some(function (event) { return event.kind === "followed" && event.actorId === "rosa"; }), "the player can follow the unidentified figure instead of losing the scene");

  var passed = take(JSON.parse(JSON.stringify(state)), choices[2]);
  assert(passed.ledgers.truth.some(function (event) { return event.kind === "hidden_figure_passed" && event.actorId === "rosa"; }), "letting the figure pass is also recorded as a deliberate choice");
})();

(function weatherProfilesChangeEvidenceHearingAndRecognition() {
  assert(Director.WEATHER_PROFILES.fog.visibility < Director.WEATHER_PROFILES.storm.visibility, "fog is the strongest recognition penalty");
  assert(Director.WEATHER_PROFILES.storm.whisperChance < Director.WEATHER_PROFILES.fog.whisperChance, "storm drowns subtle audible clues");
  assert(Director.WEATHER_PROFILES.frost.stampChance > Director.WEATHER_PROFILES.still.stampChance, "frost strengthens ground evidence");
  assert(Director.WEATHER_PROFILES.frost.visibility > Director.WEATHER_PROFILES.still.visibility, "breath and tracks make frost sightings unusually legible");
})();

(function adjacentEncountersBecomeOneHumanConversation() {
  var config = baseConfig("coalesced-encounters");
  config.villagers = [{
    id: "falk", name: "Doctor Falk", role: "the Physician", alive: true,
    home: "Village Square", motive: { id: "late-call", family: "medicine", destination: "Old Church", reason: "examine an animal that stopped eating after sunset", object: "a leather roll of instruments", depart: 3, duration: 2 }
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
  assert.strictEqual(state.currentBeat.actorId, null, "finding an object does not identify its owner before inspection");
  var projection = Director.consequenceProjection(state);
  assert.strictEqual(projection.encounters.length, 1, "three adjacent clock ticks at one place become one interview thread");
  assert.strictEqual(projection.encounters[0].sourceEventIds.length, 4, "the compact thread retains every truth event for timing audits");
  assert(projection.encounters[0].acknowledged, "a hail upgrades the whole thread to a clear mutual memory");
  assert.strictEqual(projection.findings.length, 0, "an unopened object cannot unlock a named evidence question");
  state = take(state, { type: "INSPECT_CLUE" });
  assert.strictEqual((state.currentBeat.text.match(/Doctor Falk/g) || []).length, 1, "Falk's inspected-object card names him only once");
  assert(/after dusk/.test(state.currentBeat.text) && !/after sunset/.test(state.currentBeat.text), "the final timing phrase is shortened so it stays with the errand");
  assert(!/This belongs to|addressed to/.test(state.currentBeat.text), "the compact card does not restate ownership after naming the addressee");
  projection = Director.consequenceProjection(state);
  assert.strictEqual(projection.findings.length, 1, "an actor-linked physical clue becomes an evidence question candidate");
  assert.strictEqual(projection.findings[0].actorId, "falk");
  assert.strictEqual(projection.findings[0].privateItem, false, "an exposed tool roll can be returned as a considerate ordinary find");
})();

(function aParcelMustBeOpenedBeforeItNamesTobias() {
  var config = baseConfig("open-tobias-parcel");
  config.villagers = [{
    id: "tobias", name: "Old Tobias", role: "the Gravedigger", alive: true,
    home: "Village Square", motive: { id: "grave-repair", family: "duty", destination: "Graveyard", reason: "repair a grave marker before dawn", object: "a small parcel", depart: 0, duration: 5 }
  }];
  config.slots = 3;
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { tobias: "Graveyard" } };
  config.forcedBeats = [{ id: "tobias-parcel", type: "clue", slot: 2, location: "Graveyard", actorId: "tobias", text: "You find a small parcel." }];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Graveyard" });
  state = take(state, { type: "WAIT" });
  state = take(state, { type: "SEARCH" });
  assert.strictEqual(state.phase, "active", "a parcel found in the last hour remains openable before the journey home");
  assert.strictEqual(state.currentBeat.actorId, null);
  assert(!/Tobias/.test(state.currentBeat.text), "the unopened parcel does not magically name its owner");
  var choices = Director.guidedActions(state, { target: "Graveyard", kind: "search", intentDone: true, searches: { ground: true }, interacted: {} });
  assert.deepStrictEqual(choices.map(function (choice) { return choice.label; }), ["Open the parcel", "Leave it closed. Continue your search", "Leave it closed. Head for home"]);
  var leftClosed = Director.reduce(JSON.parse(JSON.stringify(state)), choices[1]);
  assert.strictEqual(leftClosed.phase, "returning", "leaving a final-hour parcel closed cannot strand the night");
  assert(leftClosed.ledgers.truth.some(function (event) { return event.kind === "clue_left_closed"; }));
  state = take(state, choices[0]);
  assert.strictEqual(state.phase, "returning", "opening the final-hour parcel resolves before the explicit journey home");
  assert.strictEqual(state.currentBeat.actorId, "tobias");
  assert(/grave twine/.test(state.currentBeat.text) && /asks Old Tobias/.test(state.currentBeat.text), "opening the parcel provides concise visible ownership evidence");
  assert.strictEqual((state.currentBeat.text.match(/Old Tobias/g) || []).length, 1, "the inspected-object card names its owner once instead of repeating them");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "clue_inspected" && event.actorId === "tobias"; }));
  assert.strictEqual(Director.consequenceProjection(state).findings[0].actorId, "tobias", "inspection unlocks the Tobias interview lead");
  assert.strictEqual(Director.consequenceProjection(state).findings[0].privateItem, true, "opening a sealed parcel is preserved as snooping for the return conversation");
  choices = Director.guidedActions(state, { target: "Graveyard", kind: "search", intentDone: true, searches: { ground: true }, interacted: {} });
  assert(!choices.some(function (choice) { return choice.type === "HAIL" || choice.type === "FOLLOW"; }), "identifying an absent owner does not make them available to hail or follow");
})();

(function siteObjectsRequireAChoiceAndCanChangeTrust() {
  var sawIntrusion = false;
  var sawRestraint = false;
  for (var i = 0; i < 240 && (!sawIntrusion || !sawRestraint); i += 1) {
    var config = baseConfig("site-object:" + i);
    config.slots = 3;
    config.villagers = [{
      id: "rosa", name: "Rosa", role: "the Seamstress", alive: true, home: "Graveyard",
      motive: { id: "mourning", family: "grief", destination: "Graveyard", reason: "leave flowers", object: "a flower", depart: 0, duration: 3 }
    }];
    config.monster.active = false;
    config.currentFacts = { weather: "frost", active: false, outMap: { rosa: "Graveyard" } };
    config.forcedBeats = [{
      id: "grave-object", type: "clue", slot: 1, location: "Graveyard",
      text: "An object sits outside one grave.",
      meta: { siteObject: true, siteSearch: true, sitePayoff: "Fresh kneeling prints mark the grave. A dead flower lies beside a newly cut sprig. The coffin soil is untouched.", inspectLabel: "Investigate the object" }
    }];
    var state = Director.createNight(config);
    state = take(state, { type: "LEAVE", to: "Graveyard" });
    state = take(state, { type: "SEARCH" });
    assert(/An object sits outside one grave/.test(state.currentBeat.text), "the initial card describes only what can be seen without touching it");
    assert(!/kneeling prints/.test(state.currentBeat.text), "interpretation waits for the player's choice");
    var actions = Director.guidedActions(state, { target: "Graveyard", kind: "search", intentDone: false, interacted: {} });
    assert.deepStrictEqual(actions.map(function (choice) { return choice.label; }), ["Investigate the object", "Leave it where it is. Continue your search", "Leave it where it is. Head for home"]);

    var inspected = Director.reduce(JSON.parse(JSON.stringify(state)), actions[0]);
    assert(/kneeling prints/.test(inspected.currentBeat.text), "investigation reveals the concrete grave discovery");
    assert(inspected.ledgers.truth.some(function (event) { return event.kind === "site_clue_inspected"; }), "the decision is recorded");
    if (Director.consequenceProjection(inspected).relationships.some(function (rel) { return rel.kind === "intrusion" && rel.actorId === "rosa"; })) sawIntrusion = true;

    var untouched = Director.reduce(JSON.parse(JSON.stringify(state)), actions[1]);
    if (Director.consequenceProjection(untouched).relationships.some(function (rel) { return rel.kind === "restraint" && rel.actorId === "rosa"; })) sawRestraint = true;
  }
  assert(sawIntrusion, "a neighbour can disapprove when the player disturbs a private offering");
  assert(sawRestraint, "a neighbour can remember the player respecting a private offering");
})();

(function semanticsPenaliseRepetition() {
  var sig = Director.semanticSignature({ family: "grief", actorId: "rosa", location: "Graveyard", interaction: "errand", outcome: "unresolved" });
  assert(Director.noveltyScore(sig, [sig]) < Director.noveltyScore(sig, []), "exact semantic repetition is heavily penalised");
  var state = Director.createNight(Object.assign(baseConfig("semantic"), { recentSignatures: [sig] }));
  assert.strictEqual(new Set(state.usedSignatures).size, state.usedSignatures.length, "a generated night contains no duplicate semantic signatures");
})();

(function identicalClueTextIsOnlyPresentedOnce() {
  var config = baseConfig("duplicate-clue-text");
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false };
  config.forcedBeats = [
    { id: "note-one", type: "clue", slot: 1, location: "Old Church", actorId: "ansel", text: "A sealed note rests in the prayer book.", signature: "clue-one" },
    { id: "note-two", type: "clue", slot: 1, location: "Old Church", actorId: "ansel", text: "A sealed note rests in the prayer book.", signature: "clue-two" }
  ];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Old Church" });
  state = take(state, { type: "SEARCH" });
  assert.strictEqual(state.found.clues.length, 1, "the same clue text cannot appear twice even if two generators assigned different signatures");
})();

(function browserAndNodeSurface() {
  assert.strictEqual(Director.version, 5);
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
  assert.strictEqual(restored.version, 5);
  assert(restored.visibility && restored.thresholdEvent && restored.outcomes[1].chase, "the first action fills only the new deterministic fields");
  assert.strictEqual(restored.monsterSchedule.relentless, false, "old monster schedules gain the deterministic rhythm flag without rerolling");
})();

(function aVillageCrisisOwnsSeveralPlayableBeats() {
  var config = baseConfig("director-affliction-night");
  config.forcedBeats = [
    {
      id: "church-burning-arrival", type: "atmosphere", slot: 0, location: "Old Church",
      text: "The Old Church is burning.",
      meta: { affliction: "churchBurn", afflictionLocation: "Old Church", afflictionWound: "burn", afflictionLabel: "THE CHURCH BURNS", soundCue: "fire", critical: true, crisis: true, crisisStage: "arrival", crisisChoices: [{ choice: "help", label: "Join the bucket line" }, { choice: "witness", label: "Watch who helps" }], crisisResponses: { help: "You take a bucket and join the line." } }
    },
    {
      id: "church-burning-struggle", type: "atmosphere", slot: 1, location: "Old Church",
      text: "The roof starts to fall.",
      meta: { affliction: "churchBurn", afflictionLocation: "Old Church", crisis: true, crisisStage: "struggle", crisisChoices: [{ choice: "help", label: "Keep the line moving" }], critical: true }
    }
  ];
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Old Church" });
  assert.strictEqual(state.player.location, "Old Church", "the crisis is lived at its real location");
  assert.strictEqual(state.currentBeat.id, "church-burning-arrival", "arrival begins the authored crisis sequence");
  assert.strictEqual(state.currentBeat.meta.afflictionLocation, "Old Church");
  assert.strictEqual(state.currentBeat.meta.afflictionWound, "burn");
  var crisisActions = Director.guidedActions(state, { kind: "search", target: "Old Church" });
  assert.deepStrictEqual(crisisActions.map(function (action) { return action.label; }), ["Join the bucket line", "Watch who helps"], "the disaster offers authored responses instead of routine site searches");
  state = Director.reduce(state, crisisActions[0]);
  assert(state.ledgers.truth.some(function (event) { return event.kind === "crisis_response" && event.choice === "help" && event.crisisStage === "arrival"; }), "helping in the crisis becomes stage-specific causal truth for dawn");
  assert.strictEqual(state.currentBeat.id, "church-burning-struggle", "one response advances into the next crisis beat");
  assert(/^You take a bucket and join the line\./.test(state.currentBeat.text), "the chosen crisis action leads into the next event beat instead of disappearing");
})();

(function soundCannotBlockTheWalkTransition() {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert(!/\bsetGiveUpConfirm\s*\(/.test(html), "the retired daylight surrender setter cannot crash the app during its first effect pass");
  var start = html.slice(html.indexOf("const startDirectorNight"), html.indexOf("/* ---------- The night walk", html.indexOf("const startDirectorNight")));
  assert(start.indexOf("setWalk({") < start.indexOf("Snd.scene("), "the Director walk state must be queued before optional ambience runs");
  assert(html.includes('catch (e) { console.warn("Night sound cue could not play", e); }'), "a failed Director sound effect cannot unmount the night screen");
  assert(html.includes('catch (e) { console.warn("Night heartbeat could not play", e); }'), "a failed heartbeat cannot unmount the night screen");
  assert(html.includes('directorBeat.meta.recognition') && html.includes('Snd.beat(true);'), "the monster-recognition choice keeps the heartbeat running beneath the decision");
  assert(html.includes("DIRECTOR_MASKED_MONSTER_HAIL") && html.includes("luresFollow"), "an active host can plausibly invite the player to follow before the danger screen");
  assert(!html.includes("low growl forced through a throat still trying to pass for human") && !html.includes("It sounds like scheduling"), "a casual hail cannot announce the monster before recognition");
  var maskedHailSource = html.slice(html.indexOf("const HAIL_MONSTER_LINES"), html.indexOf("const HAIL_TURNED_LINES"));
  ["growl", "teeth", "scheduling", "trying to pass for human"].forEach(function (tell) {
    assert(!maskedHailSource.toLowerCase().includes(tell), "masked roadside dialogue cannot contain the explicit tell: " + tell);
  });
  assert(html.includes('monsterEndedHere ? "Take the news back to the village →"') && html.includes('const livedLocation = monsterEndedHere ? monsterEndedHere.location : d.player.location;'), "a night victory remains at its lived location and does not offer to draw a distant home bolt");
  var sampledNight = html.slice(html.indexOf("function sampleNight"), html.indexOf("/* ================= V5 NIGHT DIRECTOR ADAPTER"));
  assert(sampledNight.indexOf("if (s.warnedLoc") < sampledNight.indexOf("let guaranteedVictimId"), "natural, secret and warned routes settle before an empty hunting ground receives a fallback villager");
  assert(sampledNight.includes('if (active && m.reach !== "home" && huntLoc)'), "every outdoor hunt night, not only night one or a werewolf night, checks for a real quarry");
  assert(sampledNight.includes("delete secretOut[forced.id]") && sampledNight.includes("delete griefOut[forced.id]"), "a fallback hunt route cannot retain a contradictory secret or mourning destination");
  assert(!sampledNight.includes('if (n === 1 && active && m.reach !== "home")'), "the retired first-night-only guarantee cannot return");
  var secretCadence = html.slice(html.indexOf("function primeDirectorSecret"), html.indexOf("/* ================= V5 NIGHT DIRECTOR ADAPTER"));
  assert(secretCadence.includes("secretDroughtNights(s, n) < 5"), "only a five-night drought activates the secret corridor safeguard");
  assert(secretCadence.includes("npc.id !== facts.guaranteedVictimId") && secretCadence.includes("npc.id !== s.monster.vid"), "the safeguard cannot reroute the hunt's quarry or its host");
  assert(secretCadence.includes("facts.secretCatch[chosen.id] = true") && start.includes("primeDirectorSecret"), "a primed secret is readable and enters the Director before the walk is compiled");
  assert(sampledNight.includes("const secretWalkerId") && sampledNight.includes("npc.id === secretWalkerId"), "an ordinary night can schedule at most one secret-carrying villager");
  assert(sampledNight.includes("const secretNightChance = 0.35"), "secrets use one 35% village-wide roll rather than a separate roll for every villager");
  assert(sampledNight.includes("chance(0.48)"), "ordinary errands remain the common reason a human neighbour is out at night");
  assert(sampledNight.includes("const secretCatchChance") && sampledNight.includes(": 0.35"), "meeting a secret-carrying villager does not automatically decode the errand");
  var compiledNight = html.slice(html.indexOf("function compileDirectorNight"), html.indexOf("function resolveNight"));
  assert(compiledNight.includes("directorAfflictionBeats(s, facts, slots)") && html.includes('crisisStage: "arrival"') && html.includes('crisisStage: "struggle"') && html.includes('crisisStage: "aftermath"') && html.includes('crisisStage: "resolution"'), "a sampled village crisis owns a multi-beat Director sequence through its final outcome");
  assert(html.includes("afflictionLocation: scene.location") && html.includes("afflictionWound: scene.wound"), "the crisis carries its authored location and damaged-night artwork into every beat");
  assert(html.includes('event: { bg: "#0A0907"') && html.includes('kicker={crisisEvent ? "A VILLAGE EVENT"') && !html.includes('const danger = !!afflictionScene'), "village events use an amber event treatment rather than monster-danger red");
  [
    "A drinker accused another of being the monster",
    "the village's last shared fire, shelter and place to exchange news",
    "Help Liesel clear the room without a crush",
    "Help Liesel set the iron bar",
    "Offer to carry news between the houses"
  ].forEach(function (phrase) {
    assert(html.includes(phrase), "the closing tavern explains and advances its event: " + phrase);
  });
  [
    "THE MILL IS FLOODING",
    "Black water is rising across the ground floor by the second",
    "Shore the beam holding the rope line",
    "Save the final dry sacks before the wall gives",
    "Recover the iron pin from the broken sluice"
  ].forEach(function (phrase) {
    assert(html.includes(phrase), "the flooded mill clearly escalates through a new decision: " + phrase);
  });
  ["churchBurn", "wellFouled", "breadRiot", "tavernShut", "millFlood"].forEach(function (affliction) {
    var startAt = html.indexOf(affliction + ": {", html.indexOf("const AFFLICTION_CRISIS"));
    var nextAt = html.indexOf("\n  },", startAt);
    var definition = html.slice(startAt, nextAt);
    assert(definition.includes("stageChoices") && definition.includes("stageResponses"), affliction + " advances through distinct choices whose results carry into the following beat");
  });
  assert(fs.readFileSync(path.join(__dirname, "..", "v5-night-director.js"), "utf8").includes("crisisResponseText + \" \" + next.currentBeat.text"), "a village-event choice is acknowledged by the following stage");
  assert(fs.readFileSync(path.join(__dirname, "..", "v5-night-director.js"), "utf8").includes("crisisStage: presentingBeat.meta.crisisStage"), "the Director records which stage each crisis decision belonged to");
  assert(html.includes("s.millFloodOutcome = outcome") && html.includes('grain: grainCount >= 2 ? "saved"') && html.includes('sabotage: witnessCount >= 2 ? "certain"'), "mill decisions persist as saved grain, injuries and sabotage evidence rather than decorative dialogue");
  var tauntSource = html.slice(html.indexOf("function directorContextualTaunt"), html.indexOf("function compileDirectorNight"));
  var tauntContext = {
    stableIdx: function () { return 0; },
    HOME_LOC: {},
    monsterOf: function () { return { hunts: ["Dark Forest"] }; },
    npcById: function (state, id) { return state.npcs.find(function (npc) { return npc.id === id; }); }
  };
  vm.createContext(tauntContext);
  vm.runInContext(tauntSource + "; this.directorContextualTaunt = directorContextualTaunt;", tauntContext);
  var tauntState = {
    monster: { vid: "wilhelm" }, monsterSawYou: true, enraged: false,
    npcs: [{ id: "greta", name: "Greta", alive: true }, { id: "tobias", name: "Old Tobias", alive: true }],
    relationshipEvents: [{ kind: "rescued", actorId: "greta", night: 3 }], deaths: []
  };
  var rescueTaunt = tauntContext.directorContextualTaunt(tauntState, { active: true, guaranteedVictimId: "tobias", huntLoc: "Graveyard" }, { kind: "search", loc: "Graveyard" }, 4, "rescue-seed");
  assert(rescueTaunt && rescueTaunt.channel === "walk" && /Greta\. Greta\. Greta\./.test(rescueTaunt.line) && rescueTaunt.noteText === "YOU CHOSE.", "a recent rescue produces a rare replacement-victim threat with a matching note");
  var ropeTaunt = tauntContext.directorContextualTaunt({ monster: { vid: "wilhelm" }, npcs: [], relationshipEvents: [], deaths: [{ id: "hazel", name: "Hazel", kind: "executed", night: 3 }] }, { active: false }, { kind: "search", loc: "Village Square" }, 4, "rope-seed");
  assert(ropeTaunt && ropeTaunt.channel === "door" && /thought it was Hazel/.test(ropeTaunt.line), "a recent wrongful hanging is named rather than receiving a generic threat");
  var quietTaunt = tauntContext.directorContextualTaunt({ monster: { vid: "wilhelm" }, npcs: [], relationshipEvents: [], deaths: [] }, { active: false }, { kind: "search", loc: "Dark Forest" }, 4, "quiet-seed");
  assert(quietTaunt && quietTaunt.kind === "quiet_hunting_ground" && /still you walk my ground/.test(quietTaunt.line), "a non-feeding walk taunt is limited to the monster's own hunting ground");
  assert(compiledNight.includes("contextualTaunt.channel === \"walk\"") && compiledNight.includes("monsterTaunt: contextualTaunt"), "selected taunts enter the same deterministic night plan used by the walk and threshold");
  assert(html.includes("barred-home-taunt") && html.includes("IF THE LITTLE PIG WILL NOT COME OUT"), "a stay-home night can rarely leave the requested barred-door note");
  assert(html.includes("directorAttack.monsterNote") && html.includes("Pinned to ${victim.name}'s coat"), "a promised replacement victim carries the taunt's note into the dawn account");
  assert(html.includes('churchBurn: { location: "Old Church", wound: "burn"') && html.includes('wellFouled: { location: "Village Square", wound: "fouled"'), "church fire and poisoned-well nights select their existing crisis plates");
  assert(html.includes('wound={crisisEvent ? afflictionScene.wound : nightWound(s, location)}'), "the live crisis art is shown before dawn persists the wound");
  assert(sampledNight.includes("afflictionCrisisRoster") && sampledNight.includes("setOut(id, afflictLoc") && sampledNight.includes("afflictionCrowd"), "rare disasters force a stable crowd onto the damaged ground");
  assert(compiledNight.includes("crisisMotive") && compiledNight.includes("family: \"crisis\"") && compiledNight.includes("duration: slots"), "crisis attendees remain scheduled at the scene rather than resuming unrelated errands");
  assert(start.includes("const livedIntent = crisisScene") && start.includes("AFFLICTION_SUMMON[facts.affliction]"), "the disaster interrupts the player's declared errand and sends them to the real scene");
  assert(html.includes('event.kind === "crisis_response"') && html.includes('choiceCount("help")') && html.includes('choiceCount("comfort")') && html.includes('choiceCount("witness")'), "help, support and observation have distinct dawn consequences");
  assert(compiledNight.includes("facts.guaranteedVictimId") && compiledNight.includes("guaranteedTarget ? { ...(sampledMotive || fallbackMotive), depart: 0, duration: slots }"), "the fallback neighbour is physically on the hunting ground throughout the attack hour");
  assert(compiledNight.includes("activeHost ? { ...(sampledMotive || fallbackMotive), depart: 1, duration: slots }"), "an active monster host leaves its house before it hunts");
  assert(html.includes("then followed them to the ${log.you.followedTo}"), "the final night history distinguishes following a watched suspect from remaining at their door");
  var chunkSource = html.slice(html.indexOf("function nightTextChunks"), html.indexOf("/* Director prose", html.indexOf("function nightTextChunks")));
  var chunkContext = {};
  vm.createContext(chunkContext);
  vm.runInContext(chunkSource + "; this.nightTextChunks = nightTextChunks;", chunkContext);
  var paced = chunkContext.nightTextChunks("One short sentence. This deliberately longer sentence contains enough separate words to require more than one compact typed line on a narrow phone screen.");
  assert(paced.length >= 3 && paced.every(function (chunk) { return chunk.words.length <= 18; }), "night prose is divided into sentence-sized runs of at most eighteen words");
  var wrappedPhrase = chunkContext.nightTextChunks("In a lightning flash, the figure becomes Hazel only when your lantern reaches them; they hold a small bundle.");
  assert.strictEqual(wrappedPhrase.length, 2, "a long sentence still pauses after eighteen words");
  assert.strictEqual(wrappedPhrase[1].breakBefore, false, "a pacing pause inside one sentence does not force a visual paragraph break");
  var flowSource = html.slice(html.indexOf("function NightTextFlow"), html.indexOf("/* Staged suspense", html.indexOf("function NightTextFlow")));
  assert(flowSource.includes('display: chunk.breakBefore ? "block" : "inline"') && flowSource.includes('i > 0 && !chunk.breakBefore ? " " : ""'), "continued chunks remain inline with a real word space");
  assert(html.includes("!terminal && flowReady") && html.includes("terminal && flowReady"), "night choices remain hidden until the current typed scene has finished or the player reveals it");
  assert(html.includes('if (beat.meta && beat.meta.changedAftermath) return beat.text;'), "changed survivors keep their aftermath dialogue instead of reverting to an ordinary errand");
  assert(html.includes('changedScene ? "CHANGED"'), "the night card visibly labels a witnessed turning");
  assert(html.includes('directorSawChange'), "a witnessed turning remains known at dawn");
  assert(html.includes('changed ? (\n              <div>') && html.includes('onClick={() => askQ("turnedWho")}') && html.includes('onClick={() => askQ("turnedMemory")}') && html.includes('onClick={() => askQ("turnedMark")}'), "a known changed villager receives three dedicated questions instead of the ordinary interview categories");
  assert(html.includes('!changed && ivSub === "catF"') && html.includes('!changed && ivSub === "catN"') && html.includes('!changed && ivSub === "catS"') && html.includes('!changed && ivSub === "catK"') && html.includes('!changed && ivSub === "catH"'), "ordinary evidence, night, person, knowledge and personal questions stay hidden in a known-turned interview");
  var interviewIa = html.slice(html.indexOf("const IV_CATS"), html.indexOf("/* ================= UI ================= */", html.indexOf("const IV_CATS")));
  assert(interviewIa.includes('label: "Ask about a night"') && interviewIa.includes('label: "Ask about someone"') && interviewIa.includes('label: "Ask what they know"') && interviewIa.includes('label: "Talk personally"'), "the interview tray uses the four plain-language question groups");
  assert(interviewIa.includes('hasFoundLeads &&') && interviewIa.includes('setIvSub("catF")') && interviewIa.includes('WHAT YOU FOUND'), "relevant evidence receives a conditional, promoted group above generic conversation");
  var evidencePanel = interviewIa.slice(interviewIa.indexOf('ivSub === "catF"'), interviewIa.indexOf('ivSub === "catN"'));
  assert(evidencePanel.includes("contextQuestions.map") && evidencePanel.includes('askQ("press")') && evidencePanel.includes('askQ("report")') && evidencePanel.includes("showNote"), "the evidence group gathers witnessed events, contradictions, reports and the coercion note");
  var contextualSource = html.slice(html.indexOf("function contextualQuestionsFor"), html.indexOf("/* ---------- grief", html.indexOf("function contextualQuestionsFor")));
  var contextualContext = {};
  vm.createContext(contextualContext);
  vm.runInContext(contextualSource + "; this.contextualQuestionsFor = contextualQuestionsFor;", contextualContext);
  var contextualState = {
    nightNum: 3, askedLog: { falk: [] }, npcs: [],
    worldEvents: [
      { eventId: "old-find", night: 2, location: "Old Mill", question: "Return the old parcel" },
      { eventId: "new-find", night: 3, location: "Old Mill", question: "Return the leather roll" },
      { eventId: "old-memory", night: 2, location: "Village Square" },
      { eventId: "new-memory", night: 3, location: "Village Square" },
      { eventId: "newer-memory", night: 3, location: "Old Church" }
    ],
    observations: [
      { eventId: "old-find", night: 2, subjectId: "falk", kind: "evidence" },
      { eventId: "new-find", night: 3, subjectId: "falk", kind: "evidence" }
    ],
    memories: [
      { eventId: "old-memory", night: 2, actorId: "falk", target: "player" },
      { eventId: "new-memory", night: 3, actorId: "falk", target: "player" },
      { eventId: "newer-memory", night: 3, actorId: "falk", target: "player" }
    ]
  };
  var currentContextQuestions = contextualContext.contextualQuestionsFor(contextualState, "falk");
  assert(currentContextQuestions.length === 2 && currentContextQuestions.every(function (entry) { return entry.night === 3; }), "the evidence tray offers only events from the immediately preceding night");
  assert.strictEqual(currentContextQuestions.filter(function (entry) { return entry.kind === "memory"; }).length, 1, "several sightings from one walk become one reverse-memory question");
  assert(currentContextQuestions.some(function (entry) { return /What did you make of that/.test(entry.label); }), "a reverse sighting asks a concise consequential question");
  assert(!currentContextQuestions.some(function (entry) { return /old parcel/.test(entry.label); }), "older unasked evidence no longer crowds the current interview");

  var socialSource = html.slice(html.indexOf("function socialPreference"), html.indexOf("/* Disposition nudges", html.indexOf("function socialPreference")));
  var socialContext = {
    NPC_DEFS: ["marta", "tobias", "ansel", "greta", "wilhelm", "liesel", "falk", "rosa"].map(function (id) { return { id: id }; }),
    stableIdx: function (text, len) {
      var h = 0;
      String(text).split("").forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
      return len ? h % len : 0;
    },
    clampDisp: function (value) { return Math.max(-3, Math.min(3, value)); }
  };
  vm.createContext(socialContext);
  vm.runInContext(socialSource + "; this.socialPreference = socialPreference; this.secretSharingPreference = secretSharingPreference; this.secretSharingReply = secretSharingReply; this.reverseMemoryOutcome = reverseMemoryOutcome;", socialContext);
  var socialIds = socialContext.NPC_DEFS.map(function (npc) { return npc.id; });
  var pursuitPreferences = socialIds.map(function (id) { return socialContext.socialPreference({ gameId: "social-run-a" }, id, "night_pursuit"); });
  assert.strictEqual(pursuitPreferences.filter(function (value) { return value > 0; }).length, 2, "every run contains villagers who respect risky pursuit");
  assert.strictEqual(pursuitPreferences.filter(function (value) { return value < 0; }).length, 2, "every run contains villagers who distrust nocturnal pursuit");
  var positiveId = socialIds[pursuitPreferences.findIndex(function (value) { return value > 0; })];
  var negativeId = socialIds[pursuitPreferences.findIndex(function (value) { return value < 0; })];
  assert(/trying to do: catch whoever/.test(socialContext.reverseMemoryOutcome({ gameId: "social-run-a" }, positiveId, {}).quote));
  assert(/prowling for your next victim/.test(socialContext.reverseMemoryOutcome({ gameId: "social-run-a" }, negativeId, {}).quote));
  var secondRunPreferences = socialIds.map(function (id) { return socialContext.socialPreference({ gameId: "social-run-b" }, id, "night_pursuit"); });
  assert.notDeepStrictEqual(pursuitPreferences, secondRunPreferences, "the same cast reshuffles its social preferences in a new game");
  var secretPreferences = socialIds.map(function (id, index) {
    return socialContext.secretSharingPreference({ gameId: "social-run-a" }, id, socialIds[(index + 1) % socialIds.length]);
  });
  assert(secretPreferences.every(function (value) { return value === 1 || value === -1; }), "sharing a secret always improves or lowers the listener's disposition");
  assert.deepStrictEqual(secretPreferences, socialIds.map(function (id, index) {
    return socialContext.secretSharingPreference({ gameId: "social-run-a" }, id, socialIds[(index + 1) % socialIds.length]);
  }), "each listener's judgement of a secret stays stable within a game");
  var secretReplies = socialIds.map(function (id) {
    return socialContext.secretSharingReply({}, id, { name: "Wilhelm" }, { short: "he hid a letter beneath the millstone" }, 1);
  });
  assert.strictEqual(new Set(secretReplies).size, 8, "every neighbour reacts to a shared secret in their own voice");
  assert(secretReplies.every(function (line) { return line.includes("Wilhelm") && line.includes("hid a letter beneath the millstone"); }), "the response names the owner and the specific secret that was shared");
  assert(html.includes('socialPreference(s, id, "personal_concern")') && html.includes('socialPreference(s, listenerId, "shared_secrets")') && html.includes('applyVillagePreference(s, "public_accusation"'), "personal concern, spreading secrets and public accusations all consult hidden per-run preferences");
  var secretAnswer = html.slice(html.indexOf('if (q === "share"'), html.indexOf('if (q === "report"', html.indexOf('if (q === "share"')));
  assert(secretAnswer.includes("secretSharingPreference") && secretAnswer.includes("rec.reactions") && secretAnswer.includes("secretSharingReply"), "a first disclosure records and narrates the listener's disposition change");
  assert(!secretAnswer.includes("without much reaction"), "secret-sharing no longer falls through to a generic neutral response");
  var nightPanel = interviewIa.slice(interviewIa.indexOf('ivSub === "catN"'), interviewIa.indexOf('ivSub === "catS"'));
  assert(nightPanel.includes("nightRow") && nightPanel.includes('askQ("where")') && nightPanel.includes('askQ("saw")') && nightPanel.includes('setIvSub("nightPerson")') && !nightPanel.includes("contextQuestions.map"), "the night group contains only the selected night's whereabouts and sightings");
  var personPanel = interviewIa.slice(interviewIa.indexOf('ivSub === "catS"'), interviewIa.indexOf('ivSub === "catK"'));
  assert(personPanel.includes('faceGrid(pickTargets, (x) => askQ("person", x.id))') && !interviewIa.includes("personId") && !interviewIa.includes("mentionedBy"), "choosing a portrait asks one social question immediately instead of opening another question menu");
  assert(interviewIa.includes('faceGrid(pickTargets, (x) => askQ("about", x.id))') && !interviewIa.includes("nightPid"), "choosing a portrait under a specific night asks the sighting question immediately");
  var personAnswer = html.slice(html.indexOf('if (q === "person"'), html.indexOf('if (q === "whereNow"', html.indexOf('if (q === "person"')));
  assert(personAnswer.includes("tieIn(BONDS, id, targetId)") && personAnswer.includes("tieIn(FRICTIONS, id, targetId)") && personAnswer.includes("RELATIONSHIP_LIKES") && personAnswer.includes("RELATIONSHIP_SUSPECTS"), "every social answer has a stable trust or suspicion stance, including authored red herrings");
  assert(personAnswer.includes("s.deaths || []") && personAnswer.includes("s.nightLogs || []") && personAnswer.includes("secretKnown: true") && personAnswer.includes("accountLocationForNight"), "the same social question promotes a dead neighbour's secret or a last-seen timeline consistent with the speaker's account");
  assert(personAnswer.includes("t.fled") && personAnswer.includes("left before dawn") && personAnswer.includes('kind: "with"') && personAnswer.includes('kind: "suspects"'), "missing-person, witnessed-location and suspicion answers all create useful leads rather than a bare no");
  var answerDelivery = html.slice(html.indexOf("function computeAnswer"), html.indexOf("function answerFor", html.indexOf("function computeAnswer")));
  assert(html.includes("const INTERVIEW_DELIVERY") && html.includes("guarded:") && html.includes("practised:") && html.includes("afraid:"), "interviews have concise guarded, rehearsed and frightened delivery pools without adding choices");
  assert(answerDelivery.includes("out.guardedLie && roll < 72") && answerDelivery.includes("monsterish && roll < 32") && answerDelivery.includes("!monsterish && roll < 8") && answerDelivery.includes("8 + fearLimit"), "secret keepers often show strain, monsters sometimes sound practised, and innocent rehearsed answers remain possible red herrings");
  assert(answerDelivery.includes("s.deaths || []") && answerDelivery.includes("who.disp < 0") && answerDelivery.includes("deliveryTell: true"), "fearful delivery becomes more likely as deaths and hostility accumulate while remaining embedded in the answer");
  assert(personAnswer.includes("protectsSecret") && personAnswer.includes("guardedLie = true") && personAnswer.includes('kind: "vouch"'), "a bonded villager can falsely vouch that a neighbour was home to protect their secret");
  var aboutAnswer = html.slice(html.indexOf('if (q === "about"'), html.indexOf('if (q === "person"', html.indexOf('if (q === "about"')));
  assert(aboutAnswer.includes("protectsTargetSecret") && aboutAnswer.includes("tieIn(BONDS, id, targetId)") && aboutAnswer.includes("guardedLie = true"), "a night-specific sighting question can also draw a protective lie from someone close to the secret keeper");
  var answerCore = html.slice(html.indexOf("function answerFor"), html.indexOf("const NIGHT_QS", html.indexOf("function answerFor")));
  var suspectVoiceSource = html.slice(html.indexOf("const SUSPECT_VOICES"), html.indexOf("const FOLK_HINTS"));
  var suspectVoiceContext = { pickFreshIdx: function (key, rows) { return rows[0]; } };
  vm.createContext(suspectVoiceContext);
  vm.runInContext(suspectVoiceSource + "; this.voices = SUSPECT_VOICES; this.suspectVoiceLine = suspectVoiceLine;", suspectVoiceContext);
  assert.deepStrictEqual(Object.keys(suspectVoiceContext.voices).sort(), ["ansel", "falk", "greta", "liesel", "marta", "rosa", "tobias", "wilhelm"], "every neighbour owns a distinct suspicion voice");
  ["accuse", "caution", "evidence"].forEach(function (mode) {
    var firstLines = Object.keys(suspectVoiceContext.voices).map(function (id) {
      return suspectVoiceContext.suspectVoiceLine(id, "Rosa", mode, "Old Church", "Hazel");
    });
    assert.strictEqual(new Set(firstLines).size, 8, "the " + mode + " reply is recognisably different for every speaker");
  });
  Object.keys(suspectVoiceContext.voices).forEach(function (id) {
    var voice = suspectVoiceContext.voices[id];
    ["accuse", "caution", "evidence"].concat(id === "ansel" ? ["withhold"] : []).forEach(function (mode) {
      voice[mode].forEach(function (line) {
        var text = line("Rosa", "Old Church", "Hazel");
        var words = (text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
        assert(words <= 25, "a speaker-owned suspicion reply stays concise: " + text);
      });
    });
  });
  var suspectAnswer = answerCore.slice(answerCore.indexOf('if (q === "suspect")'), answerCore.indexOf('if (q === "strange")'));
  assert(suspectAnswer.includes('id === "ansel" && (npc.disp || 0) < 1') && suspectAnswer.indexOf('id === "ansel" && (npc.disp || 0) < 1') < suspectAnswer.indexOf("if (evidenced)"), "Ansel names nobody, including an evidenced suspect, until he trusts the player");
  assert(suspectAnswer.includes('suspectVoiceLine(id, "", "withhold")') && suspectAnswer.includes('suspectVoiceLine(id, t.name, "accuse")'), "Ansel can withhold while trusted villagers use their own accusation voices");
  assert(!html.includes("Feelings have hanged better people than us") && !html.includes("eats alone now. Always alone"), "the shared stock accusation cannot return");
  var accountSource = html.slice(html.indexOf("function establishedNightClaim"), html.indexOf("function answerFor", html.indexOf("function establishedNightClaim")));
  assert(answerCore.includes("const priorNightClaim = establishedNightClaim") && accountSource.includes('st.q === "where" || st.q === "saw"'), "whereabouts and witness answers recover the speaker's established account for that night");
  var accountContext = {};
  vm.createContext(accountContext);
  vm.runInContext(accountSource + "; this.accountLocationForNight = accountLocationForNight;", accountContext);
  var claimedHomeState = {
    statements: [{ id: "greta", night: 2, q: "where", claim: "home" }, { id: "greta", night: 2, q: "saw", claim: "home" }]
  };
  assert.strictEqual(accountContext.accountLocationForNight(claimedHomeState, "greta", { night: 2, outMap: { greta: "Old Mill", wilhelm: "Old Mill" } }), "home", "a later social answer cannot leak Greta's hidden mill route after she claimed home and saw no one");
  var mentionedMillFirst = {
    statements: [{ id: "greta", q: "person", mentions: [{ id: "wilhelm", night: 2, kind: "with", loc: "Old Mill" }] }]
  };
  assert.strictEqual(accountContext.accountLocationForNight(mentionedMillFirst, "greta", { night: 2, outMap: { greta: "Old Mill", wilhelm: "Old Mill" } }), "Old Mill", "a mill sighting given first becomes Greta's account, so a later whereabouts answer cannot claim home");
  var olderContradictorySave = {
    statements: [
      { id: "greta", night: 2, q: "where", claim: "home" },
      { id: "greta", q: "person", mentions: [{ id: "wilhelm", night: 2, kind: "with", loc: "Old Mill" }] }
    ]
  };
  assert.strictEqual(accountContext.accountLocationForNight(olderContradictorySave, "greta", { night: 2, outMap: { greta: "Old Mill" } }), "home", "an explicit alibi remains authoritative when repairing an older save that already contains a leaked social mention");
  assert(answerCore.includes('q === "where" && !quote && priorNightClaim') && answerCore.includes('Home. I have already told you that.'), "a later whereabouts question repeats the established cover story instead of resampling the truth");
  var sawAnswer = answerCore.slice(answerCore.indexOf('if (q === "saw")'), answerCore.indexOf('if (q === "read"'));
  assert(sawAnswer.includes("narrativeClaim") && sawAnswer.includes("coveringRealLocation") && sawAnswer.includes("I was home, as I told you") && sawAnswer.includes("I have already told you who was there"), "who did you see stays inside the same claimed location and respects an earlier free witness answer");
  assert(aboutAnswer.includes("priorNightClaim.claim !== actual") && aboutAnswer.includes("I saw nothing of ${t.name} that night"), "asking about one named neighbour cannot jump back to the speaker's hidden real route");
  assert(personAnswer.includes("const sharedLoc = shared ? accountLocationForNight") && !personAnswer.includes("const loc = shared.outMap[targetId]"), "the broad person question cannot contradict an established home/no-one account with a hidden gathering sighting");
  assert(answerCore.includes('q === "saw" && claim') && answerCore.includes("Their witness account depends on being"), "firsthand player evidence can explicitly expose a mixed witness account as a lie");
  assert(html.includes('marta: "Village Square"') && !html.includes('hazel: "Village Square"'), "Hazel's internal id resolves to her real home location in timeline answers");
  var personalPanel = interviewIa.slice(interviewIa.indexOf('ivSub === "catH"'), interviewIa.indexOf('ivSub === "nightPerson"'));
  assert(personalPanel.includes("Concern may build trust or test their patience. Useful work is safer.") && personalPanel.includes('askQ("howare")') && personalPanel.includes('askQ("apologise")') && personalPanel.includes('askQ("help")') && !personalPanel.includes('askQ("past")') && !personalPanel.includes('askQ("talk")'), "personal conversation offers one unpredictable concern question alongside deliberate repair actions");
  var helpAnswer = html.slice(html.indexOf('if (q === "help")'), html.indexOf('if (q === "howare")', html.indexOf('if (q === "help")')));
  assert(helpAnswer.includes("assignFollowFavour(s, id)") && helpAnswer.includes("FOLLOW_FAVOUR_ASK"), "asking what work needs doing can issue the follow-someone-tonight favour through the new personal category");
  var favourResolution = html.slice(html.indexOf("/* --- side quest: did the player watch/follow"), html.indexOf("/* --- a secret the player", html.indexOf("/* --- side quest: did the player watch/follow")));
  assert(favourResolution.includes('action.type === "FOLLOW"') && favourResolution.includes("directorFollowedTarget") && favourResolution.includes("targetStayedHome") && favourResolution.includes("keptFavour"), "a Director favour succeeds only when a departing target is actually followed, or a watched target stays home");
  var nightPlan = html.slice(html.indexOf('const planModal = modal === "plan"'), html.indexOf("const riteModal", html.indexOf('const planModal = modal === "plan"')));
  assert(nightPlan.includes("favourGiver") && nightPlan.includes("favourTarget") && nightPlan.includes("Keep {favourGiver.name}'s favour: watch {favourTarget.name}"), "nightfall gives an active interview favour a direct route to its named target");
  assert(html.includes('night: NIGHT_QS.includes(effectiveQ) ? questionNight : null') && html.includes('night: NIGHT_QS.includes(fu.q) ? iv.night : null'), "present-day interview questions no longer display a misleading night label");
  assert(html.includes('npc.alive && !npc.fled && !npc.turned && npc.disp >= 1'), "a known changed villager cannot end the interview by assigning an ordinary watch favour");
  var turnedInterviewSource = html.slice(html.indexOf('const TURNED_INTERVIEW_QS'), html.indexOf('/* The moment the examination lands'));
  function turnedInterviewContext(stableValue) {
    var ctx = {
      stableIdx: function (key, length) { return stableValue % length; },
      monsterOf: function () { return { signs: ["bite", "graves"] }; },
      npcById: function (state, id) { return state.npcs.find(function (npc) { return npc.id === id; }); },
      turnNightOf: function () { return 3; },
      pickFreshIdx: function (key, rows) { return rows[0]; },
      LOCS: ["Graveyard", "Dark Forest", "Old Church", "Village Square", "Tavern", "Old Mill"],
      SIGNS: { bite: "Bite Marks", graves: "Grave Dirt" }
    };
    vm.createContext(ctx);
    vm.runInContext(turnedInterviewSource + '; this.turnedInterviewAnswer = turnedInterviewAnswer; this.TURNED_SIGN_MEMORY = TURNED_SIGN_MEMORY;', ctx);
    return ctx;
  }
  function changedInterviewState() {
    return { gameId: "changed-interview", dayNum: 4, nightNum: 4, monster: { vid: "ansel", type: "vampire" }, npcs: [{ id: "liesel", name: "Liesel", turned: true, known: true }, { id: "ansel", name: "Father Ansel", sex: "m", build: "tall" }], nightLogs: [{ night: 3, huntLoc: "Graveyard" }], askedLog: {}, buildClues: [], clues: [] };
  }
  var buildCtx = turnedInterviewContext(0);
  var changedState = changedInterviewState();
  var changedNpc = changedState.npcs[0];
  var whoBuild = buildCtx.turnedInterviewAnswer(changedState, changedNpc, "turnedWho");
  assert.strictEqual(changedState.knownBuild, "tall", "who changed you can yield the true host build");
  assert(/tall of build/.test(whoBuild.clue));
  var remembered = buildCtx.turnedInterviewAnswer(changedState, changedNpc, "turnedMemory");
  assert.strictEqual(remembered.claim, "Graveyard", "what do you remember returns the actual turning location");
  assert(/Night 3/.test(remembered.clue));
  var marked = buildCtx.turnedInterviewAnswer(changedState, changedNpc, "turnedMark");
  assert(/Teeth|mouth|blood|bite/i.test(marked.quote) && /Bite Marks/.test(marked.clue), "what did it do returns testimony about one real monster sign");
  assert.strictEqual(marked.foundSign, null, "spoken sign testimony cannot masquerade as a physical stamp");
  Object.keys(buildCtx.TURNED_SIGN_MEMORY).forEach(function (sign) {
    buildCtx.TURNED_SIGN_MEMORY[sign].forEach(function (line) {
      var words = (line.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
      assert(words <= 18, "known-turned sign testimony stays brief enough to read before the next question: " + line);
    });
  });
  var sexCtx = turnedInterviewContext(1);
  var sexState = changedInterviewState();
  var whoSex = sexCtx.turnedInterviewAnswer(sexState, sexState.npcs[0], "turnedWho");
  assert.strictEqual(sexState.knownSex, "m", "who changed you can instead yield the true host gender");
  assert(/A man/.test(whoSex.quote));
  var unbindSceneSource = html.slice(html.indexOf("function unbindSuccessScene"), html.indexOf("/* A glimpse, or a dying whisper"));
  var unbindSceneContext = {};
  vm.createContext(unbindSceneContext);
  vm.runInContext(unbindSceneSource + "; this.unbindSuccessScene = unbindSuccessScene; this.unbindFailDeathScene = unbindFailDeathScene; this.unbindFailSurviveScene = unbindFailSurviveScene;", unbindSceneContext);
  [unbindSceneContext.unbindSuccessScene("Liesel"), unbindSceneContext.unbindFailDeathScene("Liesel"), unbindSceneContext.unbindFailSurviveScene("Liesel")].forEach(function (scene) {
    assert.strictEqual(scene.length, 2, "each unbinding branch uses two short action beats before its result");
    scene.forEach(function (line) {
      var words = (line.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
      assert(words <= 14, "an unbinding beat stays short enough to reveal alone: " + line);
    });
  });
  assert(!html.includes("What is left still stands, breathing"), "a death during unbinding cannot contradict the dead game state");
  assert(html.includes("UNBOUND. ${npc.name} is alive and entirely themselves again."), "successful unbinding ends on an explicit living result");
  assert(html.includes("RITE FAILED. ${npc.name} is alive, but still changed."), "a survived failure ends on an explicit unchanged result");
  assert(html.includes("DEAD. There is nothing left in ${npc.name} to call back."), "a fatal failure ends on an explicit death result");
  assert(html.includes("setUnbindRes({ id, beats: fresh, idx: 0, outcome })") && html.includes("unbindBeats[unbindIdx].t"), "the unbinding UI advances through one text beat at a time");
  assert(html.includes('>NEXT</DockBtn>') && html.includes('success: { label: "UNBOUND"') && html.includes('failed: { label: "RITE FAILED"') && html.includes('dead: { label: "DEAD"'), "the final unbinding screen names each possible outcome plainly");
  assert(html.includes("openUnbindInterview") && html.includes("committed: true"), "a surviving villager can be questioned after the result without charging another daylight action");
  assert(!html.includes("Their door is open, their bed is cold, and no body is found."), "an unwitnessed turning cannot identify its victim through omniscient dawn narration");
  assert(html.includes('pickFreshIdx("offscreenTurnDawn", OFFSCREEN_TURN_DAWN)'), "an unwitnessed turning reports only the public fact that nobody died");
  assert(!html.includes('dawn.push(ev(pickFreshIdx("rumorStrange"'), "hidden changed villagers are not named by an automatic dawn rumor");
  assert(html.includes('turnNightOf(s, x.id) === s.nightNum') && html.includes('GOSSIP_RECENT_CHANGE)(t.name)'), "asking an innocent neighbour for gossip can surface a concrete observation about the newly changed villager");
  var changedGossipSource = html.slice(html.indexOf("const GOSSIP_RECENT_CHANGE"), html.indexOf("/* ================= HELPERS", html.indexOf("const GOSSIP_RECENT_CHANGE")))
    .replace("const GOSSIP_RECENT_CHANGE =", "GOSSIP_RECENT_CHANGE =");
  var changedGossipContext = {};
  vm.createContext(changedGossipContext);
  vm.runInContext(changedGossipSource, changedGossipContext);
  assert.strictEqual(changedGossipContext.GOSSIP_RECENT_CHANGE.length, 10, "recent changed-neighbour gossip has enough variants to avoid a repeated giveaway");
  changedGossipContext.GOSSIP_RECENT_CHANGE.forEach(function (line) {
    var text = line("Liesel");
    var words = (text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
    assert(words <= 25, "changed-neighbour gossip stays concise and conversational: " + text);
    assert(/Liesel/.test(text), "changed-neighbour gossip names its subject as reported testimony");
  });
  var publicBlameSource = html.slice(html.indexOf("const PUBLIC_BLAME_WHERE"), html.indexOf("const GATE_LINES"));
  var publicBlameContext = {};
  vm.createContext(publicBlameContext);
  vm.runInContext(publicBlameSource + "; this.publicBlamePools = [PUBLIC_BLAME_WHERE, PUBLIC_BLAME_GOSSIP, PUBLIC_BLAME_WITNESS];", publicBlameContext);
  publicBlameContext.publicBlamePools.forEach(function (pool) {
    pool.forEach(function (line) {
      ["changed", "slain"].forEach(function (kind) {
        var text = line("Father Ansel", kind);
        var words = (text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
        assert(words <= 25, "public suspicion responses stay concise: " + text);
      });
    });
  });
  var repairBlameSource = html.slice(html.indexOf("function publicBlameLosses"), html.indexOf("/* One short-lived build", html.indexOf("function publicBlameLosses")));
  var repairBlameContext = {
    npcById: function (state, id) { return state.npcs.find(function (npc) { return npc.id === id; }); },
    bondedTo: function () { return ["greta"]; },
    clampDisp: function (value) { return Math.max(-2, Math.min(2, value)); }
  };
  vm.createContext(repairBlameContext);
  vm.runInContext(repairBlameSource + "; this.repairPublicBlame = repairPublicBlame; this.vindicatePlayer = vindicatePlayer; this.uncoverMonster = uncoverMonster; this.repairMonsterUncovered = repairMonsterUncovered;", repairBlameContext);
  var blameState = {
    nightNum: 4,
    npcs: [
      { id: "ansel", name: "Father Ansel", alive: true, fled: false, disp: 0 },
      { id: "falk", name: "Doctor Falk", alive: true, fled: false, disp: -1 },
      { id: "greta", name: "Greta", alive: true, fled: false, disp: 0 },
      { id: "rosa", name: "Rosa", alive: true, fled: false, disp: 1 }
    ],
    worldEvents: [{ eventId: "investigated:ansel", kind: "director_body_investigation", night: 4, victimId: "ansel", location: "Old Church", recognizedChanged: true, suspicious: true, witnessIds: ["falk"] }]
  };
  repairBlameContext.repairPublicBlame(blameState, null, { ansel: 0, falk: 0, greta: 0, rosa: 1 });
  assert.strictEqual(blameState.npcs.find(function (npc) { return npc.id === "falk"; }).disp, -2, "the direct witness keeps their initial distrust and loses wider village trust too");
  assert.strictEqual(blameState.npcs.find(function (npc) { return npc.id === "greta"; }).disp, -2, "someone close to the victim reacts more strongly");
  assert.strictEqual(blameState.npcs.find(function (npc) { return npc.id === "rosa"; }).disp, 0, "the accusation lowers the wider village's disposition");
  assert.strictEqual(blameState.publicBlame.kind, "changed", "the lasting accusation distinguishes a changed victim from a death");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(blameState.publicBlame.dispositionLossById)), { ansel: 0, falk: 2, greta: 2, rosa: 1 }, "the accusation records exactly how much trust it cost with each neighbour");
  assert.deepStrictEqual(Array.from(blameState.worldEvents[0].actorIds), ["falk"], "an older save repairs the witness list needed by its interview response");
  var changedApology = repairBlameContext.uncoverMonster(blameState, "Wilhelm");
  assert(/We blamed you.*We were wrong.*Wilhelm.*Forgive us/.test(changedApology), "public proof earns an explicit village apology");
  assert.strictEqual(blameState.monsterUncovered, true, "public proof permanently records that the monster was uncovered");
  assert.strictEqual(blameState.publicBlame, null, "vindication clears the active accusation");
  assert.strictEqual(blameState.npcs.find(function (npc) { return npc.id === "falk"; }).disp, 0);
  assert.strictEqual(blameState.npcs.find(function (npc) { return npc.id === "greta"; }).disp, 0);
  assert.strictEqual(blameState.npcs.find(function (npc) { return npc.id === "rosa"; }).disp, 1, "vindication restores only trust lost to the accusation");
  var hazelBlame = {
    nightNum: 3,
    npcs: [{ id: "rosa", name: "Rosa", alive: true, fled: false, disp: -1 }],
    worldEvents: [], lastWith: { id: "hazel" },
    publicBlame: { eventId: "hazel-body", victimId: "hazel", victimName: "Hazel", kind: "slain", dispositionLossById: { rosa: 1 } }
  };
  var hazelApology = repairBlameContext.uncoverMonster(hazelBlame, "Wilhelm");
  assert(/Hazel's death.*thing wearing Wilhelm's face.*Forgive us/.test(hazelApology), "Hazel's false accusation is resolved against the proven culprit");
  assert.strictEqual(hazelBlame.npcs[0].disp, 0);
  assert.strictEqual(hazelBlame.lastWith, null);
  var oldUncoveredSave = {
    nightNum: 5, fled: true, monster: { vid: "wilhelm" },
    npcs: [{ id: "wilhelm", name: "Wilhelm", alive: true, fled: true, disp: 0 }, { id: "liesel", name: "Liesel", alive: true, fled: false, disp: -1 }],
    worldEvents: [],
    publicBlame: { eventId: "hazel-body", victimId: "hazel", victimName: "Hazel", kind: "slain", dispositionLossById: { liesel: 1 } }
  };
  repairBlameContext.repairMonsterUncovered(oldUncoveredSave);
  assert.strictEqual(oldUncoveredSave.monsterUncovered, true, "an older save with the exposed culprit in hiding repairs the public-proof flag");
  assert.strictEqual(oldUncoveredSave.publicBlame, null, "repairing public proof removes stale blame from older saves");
  assert.strictEqual(oldUncoveredSave.npcs[1].disp, 0);
  assert(html.includes("const offeredLabels = new Set()") && html.includes("offeredLabels.has(visible)"), "context questions deduplicate identical visible wording across ledger events");
  assert(html.includes('event.kind === "director_body_investigation"') && html.includes("PUBLIC_BLAME_WITNESS"), "a body witness gives a concrete response instead of a generic denial");
  assert(html.includes('q === "where" && publicBlame') && html.includes("PUBLIC_BLAME_GOSSIP"), "where and village-talk questions surface the lasting accusation");
  assert(html.includes("THE VILLAGE SUSPECTS YOU") && html.includes("repairPublicBlame(run)"), "the accusation is visible in interviews and repaired into existing saves");
  var accusationSource = html.slice(html.indexOf("function actAccuse"), html.indexOf("/* ================= ART:", html.indexOf("function actAccuse")));
  assert(accusationSource.includes("uncoverMonster(s, npc.name)"), "both a true rite and a right-face/wrong-name public unmasking set the permanent proof flag");
  assert(html.includes('!s.monsterUncovered && s.publicBlame') && html.includes('!s.monsterUncovered && lw') && html.includes('event.kind === "director_body_investigation"') && html.includes("vindicationAnswer: true"), "public proof blocks gossip, last-seen and body-witness accusations while replacing culprit questions with an apology");
  assert(html.includes("repairMonsterUncovered(run);") && html.indexOf("repairMonsterUncovered(run);") < html.indexOf("repairPublicBlame(run);"), "older saves restore public proof before stale blame can be repaired back in");
  var favourLoreSource = html.slice(html.indexOf("const FOLK_HINTS"), html.indexOf("const FLED_OPENERS"));
  var favourLoreContext = {};
  vm.createContext(favourLoreContext);
  vm.runInContext(favourLoreSource + "; this.favourLore = FOLK_HINTS.concat([COLLECTOR_HINT]);", favourLoreContext);
  favourLoreContext.favourLore.forEach(function (hint) {
    var words = (hint.t.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
    assert(words <= 25, "a favour lore reward stays within 25 words: " + hint.t);
  });
  assert(!html.includes("They study you a long moment, then offer something back for the favour"), "a favour report does not bury its reward under transition narration");
  assert(html.includes("In return: ${recip.quote}"), "a favour report separates the observation and reward into clear beats");
  assert(html.includes('followLocation: revealChoice.location || director.player.location'), "a Director death recap receives the lived encounter location");
  assert(html.includes('const fDest = mods.followLocation || outMap[fw.id] || plan.loc;'), "a planned villager destination cannot overwrite the player's death location");
  assert(!html.includes('crosses the ${where} before you can rise'), "death prose does not describe crossing an entire named location to reach the player");
  assert(html.includes("node.volume.linearRampTo(db, seconds)"), "weather volume fades must use a linear ramp that accepts the silent decibel floor");
  assert(!html.includes("windFilter.frequency.rampTo("), "the LFO-owned wind filter parameter must not be automated directly");
  var sightings = html.slice(html.indexOf("const DIRECTOR_SIGHTING_LINES"), html.indexOf("function directorSightingFor"));
  assert.strictEqual((sightings.match(/^\s+\(nm, c\) =>/gm) || []).length, 10, "crossed-path encounters have ten short observable presentations");
  assert(!sightings.includes("${c.dest}") && !sightings.includes("${c.object}"), "a lantern sighting cannot reveal a destination or the private meaning of an object");
  assert(!html.includes("WHERE THEY REALLY WENT"), "following uses a neutral scene heading rather than editorialising about the villager");
  assert(html.includes('hail = directorHailFor(seed, npc, "mourning", ctx, deadName)'), "a graveside hail answers the mourning situation instead of using generic roadside gossip");
  var hailSource = html.slice(html.indexOf("const DIRECTOR_HAIL_BY_FAMILY"), html.indexOf("function directorHailFor"))
    .replace("const DIRECTOR_HAIL_BY_FAMILY =", "DIRECTOR_HAIL_BY_FAMILY =");
  var hailContext = {};
  vm.createContext(hailContext);
  vm.runInContext(hailSource, hailContext);
  var hailRows = Object.keys(hailContext.DIRECTOR_HAIL_BY_FAMILY).reduce(function (rows, family) {
    return rows.concat(hailContext.DIRECTOR_HAIL_BY_FAMILY[family].map(function (line) { return { family: family, line: line }; }));
  }, []);
  assert(hailRows.length >= 40, "walk hails have many situation-aware combinations");
  hailRows.forEach(function (entry) {
    var text = entry.line("Doctor Falk", { dest: "Graveyard" }, "Rosa");
    var words = (text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
    assert(words >= 10 && words <= 25, entry.family + " hail must remain within 10–25 words: " + text);
  });
  var secretHails = hailRows.filter(function (entry) { return entry.family === "secret"; }).map(function (entry) { return entry.line("Greta", { dest: "Old Church" }, "Rosa"); });
  assert(secretHails.every(function (line) { return !/private|contents|promise|leave this alone|answer in daylight/i.test(line); }), "a casual hail cannot make a villager defend an errand the player never asked about");
  var caughtHailSource = html.slice(html.indexOf("const DIRECTOR_CAUGHT_SECRET_HAIL"), html.indexOf("/* A roadside hail", html.indexOf("const DIRECTOR_CAUGHT_SECRET_HAIL")))
    .replace("const DIRECTOR_CAUGHT_SECRET_HAIL =", "DIRECTOR_CAUGHT_SECRET_HAIL =");
  var caughtHailContext = {};
  vm.createContext(caughtHailContext);
  vm.runInContext(caughtHailSource, caughtHailContext);
  assert.strictEqual(caughtHailContext.DIRECTOR_CAUGHT_SECRET_HAIL.length, 6, "a witnessed secret has several concise acknowledgements");
  caughtHailContext.DIRECTOR_CAUGHT_SECRET_HAIL.forEach(function (line) {
    var text = line("Greta");
    var words = (text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
    assert(words >= 10 && words <= 25, "a caught-secret hail stays concise: " + text);
  });
  var beatTextSource = html.slice(html.indexOf("const directorBeatText"), html.indexOf("const commitDirector", html.indexOf("const directorBeatText")));
  assert(beatTextSource.includes('event.kind === "followed"') && beatTextSource.includes("event.revealedSecret") && beatTextSource.includes("dialogue.caughtHail"), "hailing after a revealed follow acknowledges what the player witnessed");
  var roadsideSource = html.slice(html.indexOf("const DIRECTOR_ROADSIDE_WARNING"), html.indexOf("function directorHailFor"))
    .replace("const DIRECTOR_ROADSIDE_WARNING =", "DIRECTOR_ROADSIDE_WARNING =");
  var roadsideContext = {};
  vm.createContext(roadsideContext);
  vm.runInContext(roadsideSource, roadsideContext);
  var roadsideRows = Object.keys(roadsideContext.DIRECTOR_ROADSIDE_WARNING).reduce(function (rows, actorId) {
    return rows.concat(roadsideContext.DIRECTOR_ROADSIDE_WARNING[actorId].map(function (line) { return { actorId: actorId, line: line }; }));
  }, []);
  assert.strictEqual(roadsideRows.length, 24, "every villager has three concise roadside warnings in their own voice");
  roadsideRows.forEach(function (entry) {
    var text = entry.line("Liesel", { dest: "Graveyard" });
    var words = (text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
    assert(words >= 10 && words <= 25, entry.actorId + " roadside warning must remain within 10–25 words: " + text);
  });
  assert(roadsideContext.DIRECTOR_ROADSIDE_WARNING.liesel.some(function (line) { return /Dangerous night to be out, love/.test(line("Liesel", {})); }), "Liesel can warn the player warmly instead of treating every meeting as an interrogation");
  var hailFunctionSource = html.slice(html.indexOf("function directorHailFor"), html.indexOf("const DIRECTOR_INTERVIEW_WEATHER"));
  assert(hailFunctionSource.includes("npc.disposition") && hailFunctionSource.includes("warningThreshold"), "warm roadside concern is more likely when the villager likes the player");
  assert(hailFunctionSource.includes("situational-hail"), "the concrete errand reply remains the fallback when concern does not fire");
  var followWeatherSource = html.slice(html.indexOf("const WEATHER_DIRECTOR ="), html.indexOf("/* ---------- Zork", html.indexOf("const WEATHER_DIRECTOR =")));
  var followHelperSource = html.slice(html.indexOf("function directorFollowLead"), html.indexOf("function directorDialogueFor", html.indexOf("function directorFollowLead")));
  var followContext = {};
  vm.createContext(followContext);
  vm.runInContext(followWeatherSource + followHelperSource + "; this.followSamples = ['fog', 'storm', 'frost'].map(function (wx) { return directorFollowAction(wx, { name: 'Greta' }, 'Tavern', 'collect a message left with Liesel and answer none of her questions'); }); this.errandQuestion = directorErrandQuestion;", followContext);
  assert.strictEqual(followContext.followSamples[1], "By lightning, you follow Greta to the Tavern. There, you watch Greta collect a message left with Liesel and answer none of her questions.");
  assert.strictEqual(followContext.errandQuestion("collect supplies promised before the road became unsafe"), "Was collecting supplies the whole reason?", "the mill-supplies question uses a short grammatical gerund instead of inserting the whole motive");
  assert.strictEqual(followContext.errandQuestion("finish an errand promised before sunset"), "Was that the whole reason you went?", "other long motives receive a concise grammatical fallback");
  assert(!html.includes('Was ${ctx.reason} the whole reason?'), "raw motive text cannot be inserted into the interview question as broken grammar");
  followContext.followSamples.forEach(function (text) {
    var words = (text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
    assert(words <= 30, "a weather-aware follow result stays concise: " + text);
    assert(/to the Tavern/.test(text) && /watch Greta collect a message/.test(text), "a follow result states the destination and observed action plainly: " + text);
  });
  var directorSource = fs.readFileSync(path.join(__dirname, "..", "v5-night-director.js"), "utf8");
  var motiveRows = Array.from(directorSource.matchAll(/motive\("[^"]+",\s*"[^"]+",\s*"([^"]+)",\s*"([^"]+)"/g));
  motiveRows.forEach(function (row) {
    ["fog", "storm", "frost"].forEach(function (wx) {
      var text = followContext.directorFollowAction(wx, { name: "Doctor Falk" }, row[1], row[2]);
      var words = (text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
      assert(words <= 30, "every ordinary follow result stays at 30 words or fewer: " + text);
    });
  });
  var secretRows = Array.from(html.matchAll(/short:\s*"([^"]+)"/g)).map(function (match) { return match[1]; });
  secretRows.forEach(function (summary) {
    var text = followContext.directorFollowSecret("storm", { name: "Doctor Falk" }, "Old Church", summary);
    var words = (text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
    assert(words <= 30, "every discovered-secret follow result stays at 30 words or fewer: " + text);
  });
  var falkConfession = html.match(/confess: `([^`]*Laudanum[^`]*)`/);
  assert(falkConfession, "Doctor Falk's laudanum confession remains authored");
  assert((falkConfession[1].match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length <= 25, "Doctor Falk's secret answer stays concise");
  assert(!html.includes("works at the ${dest}") && !html.includes("They set down ${ctx.object}"), "follow results do not stack vague work language and decorative props");
  assert(!html.includes("a coat at one turning, an empty lane at the next"), "the retired long storm-follow preamble cannot return");
  assert(html.includes('const directorWeatherLabel = { fog: "FOG", storm: "STORM", frost: "FROST" }[walk.facts.wx] || "STILL";'), "the Director location row names the same weather value that drives its scene");
  assert(html.includes('{directorWeatherLabel}</span>'), "the Director renders weather on the right side of its location row");
  assert(!html.includes("crosses the edge of your lantern with"), "the retired repeating sighting line cannot leak through a fallback");
  assert(html.includes('q: "sawContext"'), "a Director encounter offers a location-specific witness follow-up");
  assert(!html.includes("The watch is over if you mean to know where they are going."), "the departure card does not pretend following is optional after the player chose to watch");
  assert(html.includes('No one else I could identify.'), "the witness follow-up gives one concise answer instead of joining two quoted replies");
  assert(!html.includes('quote += ` “I stayed only long enough to ${event.reason}.”`'), "a witness-list answer cannot append an unrelated errand explanation");
  assert(html.includes('reason: "keep a private appointment before dawn"'), "third-person secret summaries cannot be inserted after an infinitive in interviews");
  assert(html.includes('You saw me passing the ${thread.location} on my way to the ${destination}.'), "the main interview answer still explains a route waypoint separately from the villager's destination");
  assert(html.includes("const mutualMonsterRecognition = monsterFaceKnown && s.monsterSawYou;"), "daylight distinguishes secret host knowledge from mutual recognition");
  assert(html.includes("playerWitnessed && mutualMonsterRecognition"), "a monster that saw the player flee answers as an exposed enemy");
  assert(html.includes("playerWitnessed && !monsterFaceKnown"), "a monster cannot claim the player saw them when the player's host knowledge remains secret");
  assert(html.includes('claim !== "home" && !mutualMonsterRecognition'), "an exposed monster cannot offer an ordinary witness follow-up");
  assert(html.includes("The house is empty. They knew you escaped and left before dawn."), "an old open interview finds an exposed monster gone rather than confronting it indoors");
  assert(!html.includes("Do not call this an interview."), "daylight never stages a direct interview confrontation with the exposed monster");
  assert(html.includes("WEATHER_WALK_CONTINUED") && html.includes("WEATHER_DAWN_CONTINUED"), "consecutive weather has authored second-night openings and dawn consequences");
  assert(html.includes("QUIET_NIGHT_WEATHER") && html.includes('quietNight:${wx || "still"}'), "quiet Director recaps are selected from the sampled weather instead of the generic frost-capable pool");
  assert(html.includes('soundCue: temperament.cue, weatherSoundCue: facts.wx === "storm" ? "thunder" : null'), "storm keeps the monster voice cue instead of replacing it with thunder");
  assert(html.includes("if (directorBeat.meta.weatherSoundCue) Snd.cue(directorBeat.meta.weatherSoundCue)"), "the weather cue and creature cue are both played for the same Director beat");
  assert(html.includes("[0, 0.2, 0.43].forEach"), "the whisper cue has its own audible three-part texture");
  assert(!html.includes("When you reach it, the lane is empty and the voice is behind you."), "a sound opening cannot move the player before they choose a response");
  assert(html.includes("allDelusionFragments.slice(0, 1)"), "an unresolved strange sight shows only its opening image before asking the player what to do");
  assert(!/STEADY NERVE|Steady nerve held|composure/.test(html), "the removed steady-nerve mechanic cannot leak into state or presentation");
  assert(html.includes('directorBeat.meta.requiresResponse) {\n          Snd.silence(false);'), "an unresolved strange sight keeps the weather ambience alive");
  assert(html.includes("action.approachDelusion || action.ignoreDelusion"), "both looking and deliberately looking away restore the live weather soundscape");
  assert(!html.includes("SOMETHING ABROAD"), "quiet monster sounds use a concrete heading instead of the removed phrase");
  assert(!html.includes("The rest belongs to somebody who trusted me"), "secretive villagers do not answer with an abstract ownership metaphor");
  assert(!html.includes("Someone asked me to keep this private. I will not give you their name."), "the retired secret-defence line cannot answer a casual hail");
  assert(html.includes('directorBeat.type === "doorstep") {\n          Snd.silence(false);'), "a doorstep visit keeps storm ambience running");
  assert(html.includes('this.doorVol = new Tone.Volume(-8)') && html.includes('this.door.triggerAttackRelease("C1", "8n", t, 1)'), "the door has a dedicated louder knock voice");
  assert(html.includes("[.!?]+[”\"’']?"), "typed night text keeps a closing curly quote with the sentence instead of rendering it alone");
  assert(html.includes('beat.meta.thresholdAnswer ? "YOUR ANSWER"') && html.includes('beat.meta.thresholdLook ? "THROUGH THE SHUTTER"'), "each doorstep exchange has a stage-specific heading instead of repeating AT YOUR DOOR");
  assert(!html.includes("an uncertain sight: ${delusion.text}"), "resolved hallucinations do not clutter the evidence journal");
  assert(!html.includes("outside ${actorName}'s door in the ${target}"), "watch prose does not redundantly route a doorstep scene through its map label");
  assert(!/storm drowned half the night|storm drowned words/.test(html), "storm interview copy does not echo the same drowned-sound sentence in question and answer");
  assert(html.includes("projection.investigations") && html.includes("director_body_investigation"), "fresh-body investigations survive into dawn, clues and social suspicion");
  assert(html.includes("alive: directorActorState.alive"), "the night portrait uses the Director's death state before daylight updates the legacy cast");
  var revealSource = html.slice(html.indexOf("function directorHostBuild"), html.indexOf("const DIRECTOR_SEARCH_PAYOFF"))
    .replace("const DIRECTOR_MONSTER_REVEALS =", "DIRECTOR_MONSTER_REVEALS =");
  var revealContext = {};
  vm.createContext(revealContext);
  vm.runInContext(revealSource, revealContext);
  var demonReveal = revealContext.DIRECTOR_MONSTER_REVEALS.demon("Old Tobias", "stooped");
  assert(/rotted flesh/i.test(demonReveal) && /stoop/i.test(demonReveal) && /Old Tobias/.test(demonReveal), "a demon can be horrific while its ruined body still identifies Old Tobias");
  Object.keys(revealContext.DIRECTOR_MONSTER_REVEALS).forEach(function (monsterId) {
    var reveal = revealContext.DIRECTOR_MONSTER_REVEALS[monsterId]("Father Ansel", "tall");
    assert(reveal.includes("Father Ansel is the monster."), monsterId + " reveal states the host identity as a direct conclusion");
    var revealWords = (reveal.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
    assert(revealWords <= 22, monsterId + " reveal stays short enough for a three-to-five-line mobile card: " + reveal);
  });
  assert(/claws, frost and grave mould/i.test(revealContext.DIRECTOR_MONSTER_REVEALS.mimic("Father Ansel", "tall")), "the mimic keeps its physical transformation while naming Father Ansel directly");
  assert(html.includes('playerDeathBeats(monsterOf(s), host ? host.name'), "a Director death restores the monster-specific death scene with the actual host named and the lived encounter context");
  assert(html.includes('kind: deathKind') && html.includes('thresholdInside') && html.includes('thresholdOutside'), "a Director death continues from the threshold or lane where the player was caught");
  assert(html.includes('The road home gives you no room to set that guilt down.'), "prior hangings carry into the player's death scene");
  assert(html.includes('stageChoices:') && html.includes("Clean the child's mouth with stream water") && !html.includes('Stay until the danger passes'), "the poisoned-well crisis advances through distinct practical choices");
  assert(!html.includes('const thresholdLook = (director.ledgers.truth || []).find'), "looking through the shutter does not mark the hidden host as known");
  var deathSource = html.slice(html.indexOf("const DEATH_SCENES ="), html.indexOf("/* A live walk may already have shown the face"))
    .replace("const DEATH_SCENES =", "DEATH_SCENES =");
  var deathContext = {};
  vm.createContext(deathContext);
  vm.runInContext(deathSource, deathContext);
  assert.strictEqual(Object.keys(deathContext.DEATH_SCENES).length, 16, "every monster owns a distinct player-death finale");
  Object.keys(deathContext.DEATH_SCENES).forEach(function (monsterId) {
    var scene = deathContext.DEATH_SCENES[monsterId]("Hazel", "Village Square");
    assert.strictEqual(scene.length, 3, monsterId + " death lands in three cinematic beats");
    assert(scene[2].length > 70, monsterId + " death ends with a concrete killing rather than a vague fade-out");
    scene.forEach(function (beat) {
      assert((beat.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length <= 45, monsterId + " death beat remains readable on the night screen: " + beat);
    });
  });
  ["vampire", "witch", "demon", "shifter", "lich", "doppel", "hag", "necromancer", "mimic", "succubus", "hollowed"].forEach(function (monsterId) {
    assert(/[“”]/.test(deathContext.DEATH_SCENES[monsterId]("Hazel", "Village Square")[1]), monsterId + " speaks during the player's death");
  });
  assert(/always wanted your face/i.test(deathContext.DEATH_SCENES.shifter("Hazel", "Village Square").join(" ")), "the shapeshifter covets the player's face before taking it");
  assert(/which one did you like best/i.test(deathContext.DEATH_SCENES.mimic("Hazel", "Village Square").join(" ")), "the mimic asks the player to choose among its killing shapes");
  var playerDeathSource = html.slice(html.indexOf("function playerDeathBeats"), html.indexOf("/* Two wrong names", html.indexOf("function playerDeathBeats")));
  assert(playerDeathSource.includes("return [opening, ...full.slice(1)];"), "an interactive recognition death keeps both the monster's taunt and its killing beat");
  var temperamentSource = html.slice(html.indexOf("const DIRECTOR_TEMPERAMENT_QUIET"), html.indexOf("function directorHostBuild"))
    .replace("const DIRECTOR_TEMPERAMENT_QUIET =", "DIRECTOR_TEMPERAMENT_QUIET =");
  var temperamentContext = {};
  vm.createContext(temperamentContext);
  vm.runInContext(temperamentSource, temperamentContext);
  assert.deepStrictEqual(Object.keys(temperamentContext.DIRECTOR_TEMPERAMENT_QUIET).sort(), ["beast", "silent", "speaker"]);
  Object.keys(temperamentContext.DIRECTOR_TEMPERAMENT_QUIET).forEach(function (mode) {
    assert(temperamentContext.DIRECTOR_TEMPERAMENT_QUIET[mode].length >= 6, mode + " owns quiet nights through a varied authored pool");
  });
  assert(temperamentContext.DIRECTOR_TEMPERAMENT_QUIET.beast.some(function (row) { return /growl/i.test(row.open); }), "beast nights can carry a non-hunting growl");
  assert(temperamentContext.DIRECTOR_TEMPERAMENT_QUIET.speaker.some(function (row) { return /laugh/i.test(row.open); }), "speaker nights can carry an obscure non-hunting laugh");
  assert(temperamentContext.DIRECTOR_TEMPERAMENT_QUIET.silent.some(function (row) { return /silence|without making a sound|refuses/i.test(row.open); }), "silent horrors take sound away instead of borrowing a beast or speaker cue");
  assert(html.includes("if (!s.playerSigns.includes(stamp.sign)) s.playerSigns.push(stamp.sign)"), "a Director sign is already stamped when it reaches the Journal");
  assert(html.includes("const buildGlow = n.alive") && html.includes("0 0 14px rgba(217,164,65,.72)"), "a settled build gives every matching living villager a visible amber glow");
  assert(html.includes("THE NOTE IN YOUR POCKET") && html.includes("At nightfall, you must decide whether to obey."), "an active coercion note remains visible on the day screen");
  assert(html.includes('plan.kind === "give_up"'), "giving up the named villager resolves as a full night choice");
  assert(html.includes('nightfall({ kind: "give_up", id: bargainTarget.id })'), "the nightfall confirmation commits the bargain explicitly");
  var coercionReplySource = html.slice(html.indexOf("const COERCION_APPROVAL_BY_TEMPERAMENT"), html.indexOf("function coercionTemperament"))
    .replace("const COERCION_APPROVAL_BY_TEMPERAMENT =", "COERCION_APPROVAL_BY_TEMPERAMENT =");
  var coercionReplyContext = {};
  vm.createContext(coercionReplyContext);
  vm.runInContext(coercionReplySource, coercionReplyContext);
  assert.deepStrictEqual(Object.keys(coercionReplyContext.COERCION_APPROVAL_BY_TEMPERAMENT).sort(), ["beast", "silent", "speaker"]);
  assert(coercionReplyContext.COERCION_APPROVAL_BY_TEMPERAMENT.speaker.length >= 10, "talking monsters have a broad pool of mocking bargain replies");
  assert(coercionReplyContext.COERCION_APPROVAL_BY_TEMPERAMENT.beast.length >= 6 && coercionReplyContext.COERCION_APPROVAL_BY_TEMPERAMENT.silent.length >= 6, "beast and silent monsters answer the bargain in their own voices");
  var allCoercionReplies = Object.values(coercionReplyContext.COERCION_APPROVAL_BY_TEMPERAMENT).flat();
  assert.strictEqual(new Set(allCoercionReplies).size, allCoercionReplies.length, "no coercion approval line repeats across temperament pools");
  assert(coercionReplyContext.COERCION_APPROVAL_BY_TEMPERAMENT.speaker.some(function (line) { return /laugh|smil|funny|darling/i.test(line); }), "speaker replies can be giggling, intimate or openly mocking");
  allCoercionReplies.forEach(function (line) {
    var words = (line.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length;
    assert(words <= 18, "a coercion reply stays sharp and concise: " + line);
  });
  assert(html.includes("coercionApprovalScene(s, target, n)"), "the dawn body scene uses the temperament-aware reply");
  assert(html.includes("Beside the body, it left its answer: “${approval}”"), "the Journal preserves the exact reply shown at dawn");
  assert(!html.includes('the same small hand has written: "GOOD. I KNEW YOU WOULD."'), "the retired fixed approval cannot return");
  var bargainSettleSource = html.slice(html.indexOf("function settleGiveUpInPlace"), html.indexOf("/* Telling them the truth", html.indexOf("function settleGiveUpInPlace")));
  assert.strictEqual((bargainSettleSource.match(/s\.deaths\.push/g) || []).length, 1, "the surrender settlement records exactly the named victim");
  assert(!html.includes("function actGiveUp") && !html.includes("Give them up, truly"), "the coercion bargain cannot execute during daylight from a villager profile");
  assert(html.includes("function repairDaylightGiveUp") && html.includes("repairDaylightGiveUp(run);"), "a save made through the retired daylight action restores its victim and note on resume");
  var repairSource = html.slice(html.indexOf("function repairDaylightGiveUp"), html.indexOf("/* Telling them the truth", html.indexOf("function repairDaylightGiveUp")));
  var repairContext = { npcById: function (state, id) { return state.npcs.find(function (npc) { return npc.id === id; }); } };
  vm.createContext(repairContext);
  vm.runInContext(repairSource + "; this.repairDaylightGiveUp = repairDaylightGiveUp;", repairContext);
  var brokenDaySave = { nightNum: 3, bond: 2, monsterProtects: true, coerceNote: null, npcs: [{ id: "tobias", name: "Old Tobias", alive: false }], deaths: [{ night: 3, id: "tobias", name: "Old Tobias", kind: "slain", where: "home" }], dayEvents: [{ t: "You do as the note asked. By morning Old Tobias is dead all the same.", pid: "tobias" }], clues: ["Night 3: you gave it Old Tobias. The deaths did not end."] };
  repairContext.repairDaylightGiveUp(brokenDaySave);
  assert.strictEqual(brokenDaySave.npcs[0].alive, true, "the obsolete daytime victim is restored alive");
  assert.strictEqual(brokenDaySave.coerceNote.target, "tobias", "the note returns for the coming nightfall");
  assert.strictEqual(brokenDaySave.coerceNote.night, 3);
  assert.strictEqual(brokenDaySave.coerceNote.shown, false);
  assert.strictEqual(brokenDaySave.deaths.length, 0);
  assert.strictEqual(brokenDaySave.dayEvents.length, 0);
  assert.strictEqual(brokenDaySave.monsterProtects, false);
  assert.strictEqual(brokenDaySave.bond, 0);
  assert(html.includes('const pickTargets = s.npcs.filter((x) => x.id !== iv.id)'), "every other neighbour, including anyone who fled, remains available as an interview subject");
  assert(html.includes('person: "What can you tell me about someone?"') && html.includes('faceGrid(pickTargets, (x) => askQ("person", x.id))'), "the social portrait question has one visible aim and one click after entering its category");
  var recordedFindingSource = html.slice(html.indexOf("function directorRecordedFindingText"), html.indexOf("function directorMotiveFor"));
  var recordedFindingContext = {};
  vm.createContext(recordedFindingContext);
  vm.runInContext(recordedFindingSource + "; this.wasRecorded = directorFindingAlreadyRecorded;", recordedFindingContext);
  var oldSave = { clues: ["Night 2: You find a sealed note tucked into the prayer book. It belongs to a human errand: answer a confession requested through a third party. It explains the hour, not the person."] };
  var oldAgenda = { motive: { object: "a sealed note tucked into the prayer book", reason: "answer a confession requested through a third party" } };
  assert(recordedFindingContext.wasRecorded(oldSave, "new presentation text", oldAgenda), "older saves recognise a previously shown errand from their journal text even without Director signature history");
  assert(html.includes("There is no name on the outside."), "an unopened human errand clue does not reveal ownership or motive");
  assert(html.includes('action.type === "INSPECT_CLUE"') && html.includes('Snd.cue("cloth")'), "opening a found parcel is wired into the night UI and soundscape");
  assert(html.includes('"Graveyard": "An object sits outside one grave."'), "a grave object is presented before its meaning is interpreted");
  assert(html.includes('rel.kind === "intrusion"') && html.includes('rel.kind === "restraint"'), "nighttime intrusion and restraint both feed the disposition system");
  assert(html.includes('VILLAGE TURNED AGAINST YOU') && html.includes('className="heHostilityDetails"') && html.includes("hostileMajority"), "village-wide hostility is a compact one-line disclosure and still changes cooperation");
  assert(!html.includes('THE VILLAGE HAS TURNED AGAINST YOU'), "the longer hostility heading cannot wrap across the mobile day board");
  var villageStandingSource = html.slice(html.indexOf("function villageStanding"), html.indexOf("/* ---------- when they cannot stand you", html.indexOf("function villageStanding")));
  assert(villageStandingSource.includes("s.dayNum > 1"), "the village cannot be declared hostile before the player has had a daylight turn");
  var openingSource = html.slice(html.indexOf("const OPENING_DISPOSITIONS"), html.indexOf("function newGame", html.indexOf("const OPENING_DISPOSITIONS")));
  var openingContext = {
    NPC_DEFS: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "f" }, { id: "g" }, { id: "h" }],
    stableIdx: function (key) { return key.charCodeAt(key.length - 1); },
    Object: Object
  };
  vm.createContext(openingContext);
  vm.runInContext(openingSource + "; this.openingDispositionMap = openingDispositionMap;", openingContext);
  assert.deepStrictEqual(
    Object.values(openingContext.openingDispositionMap("test")).sort(function (a, b) { return a - b; }),
    [-2, -1, -1, 0, 0, 1, 1, 2],
    "new games begin with varied but balanced attitudes"
  );
  assert(!html.includes("disp: [-2, -1, 0, 1, 2][Math.floor(Math.random() * 5)]"), "opening hostility is no longer rolled independently for every villager");
  var firstDayRepairSource = html.slice(html.indexOf("function repairFirstDayStanding"), html.indexOf("/* One short-lived build", html.indexOf("function repairFirstDayStanding")));
  var firstDayRepairContext = { stableIdx: function (key) { return key.charCodeAt(key.length - 1); }, Set: Set, Math: Math };
  vm.createContext(firstDayRepairContext);
  vm.runInContext(firstDayRepairSource + "; this.repairFirstDayStanding = repairFirstDayStanding;", firstDayRepairContext);
  var badOpeningSave = { dayNum: 1, gameId: "old", npcs: [
    { id: "a", alive: true, fled: false, disp: -2 }, { id: "b", alive: true, fled: false, disp: -2 },
    { id: "c", alive: true, fled: false, disp: -2 }, { id: "d", alive: true, fled: false, disp: -2 },
    { id: "e", alive: true, fled: false, disp: 0 }, { id: "f", alive: true, fled: false, disp: 1 },
    { id: "g", alive: true, fled: false, disp: 2 }
  ] };
  firstDayRepairContext.repairFirstDayStanding(badOpeningSave);
  assert.strictEqual(badOpeningSave.npcs.filter(function (npc) { return npc.disp <= -2; }).length, 3, "an existing first-day save is softened just below a hostile majority");
  assert(html.includes("repairFirstDayStanding(run);"), "the first-day standing repair runs when a saved game resumes");
  assert(html.includes('standing.hostileMajority && !interviewBlame'), "a specific village-suspicion notice replaces the generic distrust notice instead of stacking two boxes");
  assert(html.includes('askQ("apologise")') && html.includes('askQ("help")'), "the player has deliberate ways to repair disposition");
  var findingReturnSource = html.slice(html.indexOf("function definiteFindingObject"), html.indexOf("function computeAnswer", html.indexOf("function definiteFindingObject")));
  var findingReturnContext = {};
  vm.createContext(findingReturnContext);
  vm.runInContext(findingReturnSource + "; this.findingReturnOutcome = findingReturnOutcome; this.definiteFindingObject = definiteFindingObject;", findingReturnContext);
  assert.strictEqual(findingReturnContext.definiteFindingObject("a leather roll of instruments"), "the leather roll of instruments", "the evidence button describes a concise return action");
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(findingReturnContext.findingReturnOutcome({ object: "a leather roll of instruments", privateItem: false }))),
    { delta: 1, quote: "“Thank you. I thought I had lost it.”" },
    "returning an ordinary lost object improves its owner's disposition"
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(findingReturnContext.findingReturnOutcome({ object: "a small wrapped object", privateItem: true }))),
    { delta: -1, quote: "“You found my parcel, opened it, and then returned it. I would have thanked you if you had left it sealed.”" },
    "returning an opened private parcel worsens its owner's disposition"
  );
  assert(html.includes('event.kind === "director_finding" && event.returnable') && html.includes("dispositionDelta: outcome.delta"), "returning evidence applies its trust consequence once through the interview state");
  var contextualSource = html.slice(html.indexOf("function contextualQuestionsFor"), html.indexOf("/* ---------- grief", html.indexOf("function contextualQuestionsFor")));
  var contextualContext = { npcById: function () { return null; }, Set: Set };
  vm.createContext(contextualContext);
  vm.runInContext(contextualSource + "; this.contextualQuestionsFor = contextualQuestionsFor;", contextualContext);
  var daylightFindingState = {
    nightNum: 3,
    askedLog: { greta: [] },
    memories: [],
    worldEvents: [{
      eventId: "day-remain:2:Old Mill:greta", night: 2, location: "Old Mill",
      kind: "director_finding", actorIds: ["greta"], returnable: true,
      question: "Return the yew bundle"
    }],
    observations: [{
      eventId: "day-remain:2:Old Mill:greta", night: 2, location: "Old Mill",
      kind: "evidence", subjectId: "greta"
    }]
  };
  var carriedFinding = contextualContext.contextualQuestionsFor(daylightFindingState, "greta");
  assert.strictEqual(carriedFinding.length, 1, "an unreturned daylight belonging survives into the owner's next available interview");
  assert.strictEqual(carriedFinding[0].label, "Return the yew bundle");
  daylightFindingState.askedLog.greta.push("2:context:day-remain:2:Old Mill:greta:evidence");
  assert.strictEqual(contextualContext.contextualQuestionsFor(daylightFindingState, "greta").length, 0, "a returned belonging leaves the interview tray permanently");
  assert(!html.includes("That does not make it mine"), "the repetitive generic ownership denial cannot return");
  assert(html.includes('standing.hostileMajority ? 0.08'), "a hostile village makes calming a mob nearly impossible");
  assert(!directorSource.includes("Open the door and I will return it") && !directorSource.includes("Be more careful next time"), "retired return-item dialogue cannot recur");
  assert(html.includes("question: finding.question ||") && html.includes("honest: finding.honest ||") && html.includes("evasive: finding.evasive ||"), "authored doorstep reports survive into the next interview");
  var thresholdRequestSource = directorSource.slice(directorSource.indexOf("function thresholdRequestText"), directorSource.indexOf("function thresholdNeighbourAnswer"));
  assert(!/[‘’]/.test(thresholdRequestSource), "doorstep requests use paired double quotation marks rather than stray single marks");
  assert(directorSource.includes("var nightOffset") && directorSource.includes("thresholdLine(state, threshold.dialogueRoll, lines)"), "doorstep replies rotate across nights rather than repeating the same seeded line");
  assert(html.includes('/^[,;:\'"‘’“”]+$/.test(fragment)'), "the paced night text drops orphan punctuation fragments");
  assert(!html.includes("It explains the hour, not the person."), "the retired explanatory tag cannot return");
  assert(html.includes("last evening's work boarding windows and repairing shutters"), "the boarding-up dawn report explains the event instead of relying on its shorthand name");
  assert(!html.includes("picked apart over breakfast the way a body is picked apart"), "a public event is not described with the unexplained table metaphor");
  assert(html.includes('v5-night-director.js?v=17'), "the local page cache-busts the current Director runtime");
  assert(html.includes("homeMusic(!s || (s.phase === \"day\" && !s.over && !walk), !s)"), "the piano distinguishes the fuller title menu from safe day screens");
  assert(html.includes('s.phase === "day" && !walk) { Snd.scene(null); Snd.wind_(-30); }'), "a true day screen clears the previous night's rain and weather scene");
  assert(html.includes('else if (!walk) Snd.wind_(-30);'), "the day-labelled state cannot clear weather underneath a night walk still in progress");
  assert(html.includes("this.pianoMenu ? -28.5 : -30") && html.includes("this.pianoMenu ? 0.12 : 0.09"), "the menu piano is only slightly fuller and louder than the daytime motif");
  assert(html.includes('}, 7.8)') && html.includes('new Tone.Volume(-30).toDestination()'), "the home piano leaves long, quiet spaces between phrases");
  ["giggle", "murmur", "hallucination_steps", "hallucination_whispers", "hallucination_drift"].forEach(function (cue) {
    assert(html.includes('"' + cue + '"'), "the procedural soundscape includes the " + cue + " cue");
  });
  assert(html.includes('new Tone.Volume(-24).toDestination()') && html.includes('new Tone.Volume(-28).toDestination()'), "voice and hallucination textures remain quiet but audible beneath weather");
  assert(html.includes("ambientCue(directorBeat.text, directorBeat.type") && html.includes('kind === "distant_steps"') && html.includes('kind === "hum"'), "otherwise silent night cards receive text- and location-matched environmental cues");
  assert(html.includes("Snd.textCue(directorBeat.text, directorBeat.type)"), "night card prose selects matching subtle sound cues");
  assert(html.includes('soundCue: hallucinationCue'), "authored hallucinations receive an unstable cue rather than a generic weather hit");
  assert(directorSource.includes('threshold.visitorKind === "taunt" ? "murmur" : null'), "a speaking threshold taunt uses a quiet voice texture");
  assert(directorSource.includes('threshold.visitorKind === "taunt" ? "giggle" : null'), "a departing threshold taunt can leave a quiet laugh behind");
  assert(directorSource.includes('soundCue: "hallucination_drift"'), "a false sight stays sonically unstable when the player moves closer");
  assert(html.includes("thresholdAnswer || directorBeat.meta.thresholdDecision"), "answering the visitor does not replay the arrival knock");
  var directorFallbackSource = html.slice(html.indexOf("const directorFallbackLine"), html.indexOf("const actDirector", html.indexOf("const directorFallbackLine")));
  assert(directorFallbackSource.includes('WAIT: ["For now, the road stays quiet.", "You wait a while. Nothing moves yet."]'), "a one-hour wait describes a temporary lull before the stay-or-leave choice");
  assert(!directorFallbackSource.includes("Nothing happens, so you head home") && !directorFallbackSource.includes("Nothing comes. You go home"), "waiting cannot claim the player went home while the night is still active");
  var markedHuntSource = html.slice(html.indexOf("function primeMarkedPlayerHunt"), html.indexOf("function monsterDangerWarning"));
  var markedHuntContext = {
    HOME_LOC: { rosa: "Village Square" },
    LOCS: ["Village Square", "Old Church", "Graveyard", "Dark Forest", "Old Mill", "Tavern"],
    stableIdx: function () { return 999; },
    Number: Number
  };
  vm.createContext(markedHuntContext);
  vm.runInContext(markedHuntSource + "; this.primeMarkedPlayerHunt = primeMarkedPlayerHunt;", markedHuntContext);
  var markedState = { gameId: "old-save", monster: { vid: "greta" }, monsterSawYou: false, enraged: true };
  var inactiveFacts = { active: false, huntLoc: null, outMap: { greta: "home" }, exposureMap: { greta: "indoor" } };
  assert.strictEqual(markedHuntContext.primeMarkedPlayerHunt(markedState, inactiveFacts, { kind: "search", loc: "Old Mill" }, 11), inactiveFacts, "recognition cannot break a strict monster's inactive night");
  var activeFacts = { active: true, huntLoc: "Graveyard", outMap: { greta: "Graveyard" }, exposureMap: { greta: "outdoor" } };
  var markedFacts = markedHuntContext.primeMarkedPlayerHunt(markedState, activeFacts, { kind: "search", loc: "Old Mill" }, 12);
  assert.strictEqual(markedFacts.targetingPlayer, true, "an older enraged save with an unfulfilled warning receives its overdue stalk on the next active night");
  assert.strictEqual(markedFacts.huntLoc, "Old Mill");
  assert.strictEqual(markedFacts.outMap.greta, "Old Mill");
  assert(html.includes("markedOutNights: 0") && html.includes("active && f.targetingPlayer ? 0"), "new saves count exposed nights and reset the drought only when the stalk happens");
  assert(html.includes("primeMarkedPlayerHunt(s, sampledFacts, livedIntent, comingNight)"), "the marked-hunt pass runs before every Director night, including a disaster route");
  var dangerWarningSource = html.slice(html.indexOf("function monsterDangerWarning"), html.indexOf("/* After five nights", html.indexOf("function monsterDangerWarning")));
  var dangerWarningContext = { Number: Number };
  vm.createContext(dangerWarningContext);
  vm.runInContext(dangerWarningSource + "; this.monsterDangerWarning = monsterDangerWarning;", dangerWarningContext);
  var firstWarning = dangerWarningContext.monsterDangerWarning({ monsterSawYou: true, monsterWarningSeen: false });
  var repeatedWarning = dangerWarningContext.monsterDangerWarning({ monsterSawYou: true, monsterWarningSeen: true });
  var unseenWarning = dangerWarningContext.monsterDangerWarning({ monsterSawYou: false, monsterWarningSeen: false, enraged: true });
  assert.strictEqual(firstWarning, "It saw you. Nights are more dangerous for you now.", "the first warning is short and concrete");
  assert.strictEqual(repeatedWarning, null, "the warning is shown only once");
  assert.strictEqual(unseenWarning, null, "anger alone cannot claim that the monster saw the player");
  assert.strictEqual((html.match(/You have named it wrong once\./g) || []).length, 1, "the second-accusation warning appears only in its confirmation screen, not again at dawn");
  var dayHomeSource = html.slice(html.indexOf('<div className="max-w-md mx-auto px-4 pb-32 heDayMainContent">'), html.indexOf("{/* Daylight search/exam findings", html.indexOf('<div className="max-w-md mx-auto px-4 pb-32 heDayMainContent">')));
  assert(!dayHomeSource.includes("monsterDangerWarning"), "the one-time warning does not repeat on the day board");
  assert(html.includes(".heInterviewQuestions .heInkButton { font-size:13.5px !important"), "interview question copy matches the smaller section-heading scale");
  assert(html.includes("white-space:normal; overflow-wrap:anywhere"), "long death-scene action titles wrap instead of clipping a villager's name");
  var planSource = html.slice(html.indexOf('const planModal = modal === "plan"'), html.indexOf("if (s.dawn.length", html.indexOf('const planModal = modal === "plan"')));
  assert(!planSource.includes("duskLine"), "nightfall no longer adds a decorative bell or dusk sentence beneath the location heading");
  ["draws its next hunt closer", "two nights unchallenged", "takes your route", "paying that off for a while", "Hunt it too openly"].forEach(function (phrase) {
    assert(!html.includes(phrase), "retired abstract danger language cannot return: " + phrase);
  });
  assert(html.includes("The monster has followed you here.") && html.includes("IT FOLLOWED YOU HERE"), "a live marked stalk says plainly that the monster followed the player");
  assert(directorSource.includes("Turn. Keep the lantern on the footsteps"), "the marked-stalk response describes the player's immediate action instead of promising a confrontation");
  assert(html.includes('modal === "spent"') && html.includes("You’ve done all you can today. Let night fall and see what the evening brings."), "zero-action daylight taps explain that the day is spent");
  assert(html.includes('disabled={disabled && !spent}') && html.includes('spent ? () => setModal("spent") : onClick'), "spent daylight cards remain tappable while genuinely unavailable actions remain disabled");
  assert(!html.includes("The hag leaves no struggle to clean up after; she prefers her work tidy."), "the Night Hag death cannot read as though a male victim is she");
  assert(html.includes("the thing prefers its work tidy"), "the Night Hag sentence identifies the monster rather than borrowing the victim's pronoun");
  assert(html.includes('.heDeathScene > .max-w-md { width:calc(100% - 28px)') && html.includes('max-width:25rem'), "mobile death and ending copy receives a narrower inset frame");
  var pacingSource = html.slice(html.indexOf("function isActive"), html.indexOf("/* ================= NIGHT RESOLUTION", html.indexOf("function isActive")));
  var pacingContext = { chance: function () { return false; } };
  vm.createContext(pacingContext);
  vm.runInContext(pacingSource + "; this.isActive = isActive; this.consecutiveInactiveNights = consecutiveInactiveNights;", pacingContext);
  var quietRun = { embolden: 0, lastActive: 1, nightLogs: [{ active: true }, { active: false }, { active: false }] };
  assert.strictEqual(pacingContext.consecutiveInactiveNights(quietRun), 2);
  assert.strictEqual(pacingContext.isActive(quietRun, { rhythm: { kind: "loose", gap: 1, p: 0 } }, 4), true, "a loose monster cannot produce a third consecutive inactive night");
  assert.strictEqual(pacingContext.isActive(quietRun, { rhythm: { kind: "strict", n: 4 } }, 4), false, "the pacing guard does not break a strict creature's promised count");
  assert(html.includes("quiet-night-event") && html.includes("inactiveStreak >= 2"), "a strict-cycle lull receives deterministic public activity instead of a dead stretch");
  assert(directorSource.includes("visibleDiscoveries") && directorSource.includes('join(" ")'), "multiple findings earned in one action are presented together before entering the Journal");
  assert(html.includes('source === "threshold_missing_report"') && html.includes("is missing from the village"), "an unavailable subject of a threshold report is explained in the interview picker");
  assert(html.includes('window.storage.get("mv-run-day-ui")') && html.includes('window.storage.set("mv-run-day-ui"'), "committed daylight presentation is saved separately from the run");
  assert(html.includes("dayUi.iv.committed") && html.includes('dayUi.dayScene.stage === "beats"'), "only paid interviews and completed searches are restorable");
  assert(html.includes("if (runDayUi && runDayUi.iv)") && html.includes("setDayScene(runDayUi.dayScene)"), "continue restores the exact interview or search presentation");
  var runtimeCopy = [html, directorSource, fs.readFileSync(path.join(__dirname, "..", "v5-content.js"), "utf8")].join("\n");
  assert(!runtimeCopy.includes("\u2014"), "player-facing runtime files contain no em dashes");
  [
    "none of them breaks into the wrong shape you feared",
    "The earth is disturbed only where the gravedigger expected it",
    "keeps its counsel",
    "keeping whatever it keeps",
    "Something in the dark refuses a simple explanation",
    "Whatever was there kept what it knows"
  ].forEach(function (phrase) {
    assert(!runtimeCopy.includes(phrase), "retired vague prose cannot return: " + phrase);
  });
  assert(runtimeCopy.includes("The soil shows bootprints and recent shovel cuts, but no grave has been opened."), "an empty graveyard search reports concrete visible evidence");
})();

console.log("v5-night-director: all tests passed");
