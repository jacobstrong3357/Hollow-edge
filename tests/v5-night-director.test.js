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
  for (var i = 0; i < 140 && !(sawClue && heardWords && drewSuspicion); i += 1) {
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
  }
  assert(sawClue && heardWords && drewSuspicion, "the deterministic investigation tape contains evidence, last-word and social-suspicion outcomes");
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
  assert(/Rosa's face/.test(state.currentBeat.text), "following the active host reaches the monster-specific body reveal before the survival choice");
  assert(state.currentBeat.text.startsWith("Fog hides the face until it is close."), "recognition weather uses a short concrete opener");
  assert((state.currentBeat.text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g) || []).length <= 30, "the complete weather and recognition card fits a three-to-five-line mobile beat");
  var actions = Director.availableActions(state);
  assert(!actions.some(function (action) { return action.type === "HAIL" || action.type === "SEARCH"; }), "hail and search disappear after the mask drops");
  assert.deepStrictEqual(actions.map(function (action) { return action.type; }), ["FLEE", "WATCH_MONSTER", "CONFRONT_MONSTER"]);
  state.monsterSchedule.signs = ["bite"];
  state.outcomes[state.cursor].hide = 0.99;
  state = take(state, { type: "WATCH_MONSTER" });
  assert.strictEqual(state.phase, "returning");
  assert(/pins a dead fox and bites once through the ribs/i.test(state.currentBeat.text), "watching a bite sign shows what the monster bites and what it does");
  assert(!/what was left here|borrowed body at its work/.test(state.currentBeat.text), "a learned sign cannot be joined to vague unrelated fragments");
  var revealChoice = state.ledgers.truth.find(function (event) { return event.kind === "monster_reveal_choice" && event.action === "WATCH_MONSTER"; });
  assert(revealChoice && revealChoice.location === "Old Church", "the survival choice retains the place where the encounter actually happened");
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
  state = take(state, followAction);
  assert.strictEqual(state.phase, "complete");
  assert(/follow Greta to the Graveyard/.test(state.currentBeat.text) && /fresh earth/.test(state.currentBeat.text));
  assert(state.found.clues.some(function (clue) { return clue.source === "threshold_neighbour" && clue.location === "Graveyard"; }), "following the neighbour produces a concrete lead");
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

(function aFalseNeighbourMustLureThePlayerPastTheBolt() {
  var config = baseConfig("indoor-threshold-kill");
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.hostId = "rosa";
  config.monster.active = true;
  config.monster.reach = "home";
  config.currentFacts = { weather: "fog", active: true, huntLoc: "Village Square", attackSlot: 3, outMap: { rosa: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.visitorKind = "monster";
  state.thresholdEvent.actorId = "rosa";
  state.thresholdEvent.requestRoll = 0;
  state.thresholdEvent.canEnter = true;
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  state = take(state, { type: "ANSWER_DOOR" });
  assert.strictEqual(state.phase, "threshold", "answering through the door is not the same as opening it");
  assert(state.player.alive);
  assert(Director.availableActions(state).some(function (action) { return action.type === "STEP_OUTSIDE"; }), "the false neighbour asks the player to cross the safe threshold");
  state = take(state, { type: "STEP_OUTSIDE" });
  assert.strictEqual(state.phase, "dead", "stepping outside lets the waiting monster attack");
  assert.strictEqual(state.player.alive, false);
  assert(/open the door|waiting for this/i.test(state.currentBeat.text), "the death text names the choice that exposed the player");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "player_slain" && event.source === "threshold"; }));
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
  state = take(state, { type: "STEP_OUTSIDE" });
  assert(state.found.clues.some(function (clue) { return /Doctor Falk/.test(clue.text) && /fear, or it may be useful/.test(clue.text); }), "a worried neighbour creates a lead without declaring it true");
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
  assert.strictEqual(state.currentBeat.actorId, null, "finding an object does not identify its owner before inspection");
  var projection = Director.consequenceProjection(state);
  assert.strictEqual(projection.encounters.length, 1, "three adjacent clock ticks at one place become one interview thread");
  assert.strictEqual(projection.encounters[0].sourceEventIds.length, 4, "the compact thread retains every truth event for timing audits");
  assert(projection.encounters[0].acknowledged, "a hail upgrades the whole thread to a clear mutual memory");
  assert.strictEqual(projection.findings.length, 0, "an unopened object cannot unlock a named evidence question");
  state = take(state, { type: "INSPECT_CLUE" });
  projection = Director.consequenceProjection(state);
  assert.strictEqual(projection.findings.length, 1, "an actor-linked physical clue becomes an evidence question candidate");
  assert.strictEqual(projection.findings[0].actorId, "falk");
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
  assert(/grave twine/.test(state.currentBeat.text) && /This belongs to Old Tobias/.test(state.currentBeat.text), "opening the parcel provides visible ownership evidence");
  assert(state.ledgers.truth.some(function (event) { return event.kind === "clue_inspected" && event.actorId === "tobias"; }));
  assert.strictEqual(Director.consequenceProjection(state).findings[0].actorId, "tobias", "inspection unlocks the Tobias interview lead");
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
      meta: { affliction: "churchBurn", afflictionLocation: "Old Church", afflictionWound: "burn", afflictionLabel: "THE CHURCH BURNS", soundCue: "fire", critical: true, crisis: true, crisisStage: "arrival", crisisChoices: [{ choice: "help", label: "Join the bucket line" }, { choice: "witness", label: "Watch who helps" }] }
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
  assert(state.ledgers.truth.some(function (event) { return event.kind === "crisis_response" && event.choice === "help"; }), "helping in the crisis becomes causal truth for dawn");
  assert.strictEqual(state.currentBeat.id, "church-burning-struggle", "one response advances into the next crisis beat");
})();

(function soundCannotBlockTheWalkTransition() {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert(!/\bsetGiveUpConfirm\s*\(/.test(html), "the retired daylight surrender setter cannot crash the app during its first effect pass");
  var start = html.slice(html.indexOf("const startDirectorNight"), html.indexOf("/* ---------- The night walk", html.indexOf("const startDirectorNight")));
  assert(start.indexOf("setWalk({") < start.indexOf("Snd.scene("), "the Director walk state must be queued before optional ambience runs");
  assert(html.includes('catch (e) { console.warn("Night sound cue could not play", e); }'), "a failed Director sound effect cannot unmount the night screen");
  assert(html.includes('catch (e) { console.warn("Night heartbeat could not play", e); }'), "a failed heartbeat cannot unmount the night screen");
  assert(html.includes('directorBeat.meta.recognition') && html.includes('Snd.beat(true);'), "the monster-recognition choice keeps the heartbeat running beneath the decision");
  assert(html.includes('monsterEndedHere ? "Take the news back to the village →"') && html.includes('const livedLocation = monsterEndedHere ? monsterEndedHere.location : d.player.location;'), "a night victory remains at its lived location and does not offer to draw a distant home bolt");
  var sampledNight = html.slice(html.indexOf("function sampleNight"), html.indexOf("/* ================= V5 NIGHT DIRECTOR ADAPTER"));
  assert(sampledNight.indexOf("if (s.warnedLoc") < sampledNight.indexOf("let guaranteedVictimId"), "natural, secret and warned routes settle before an empty hunting ground receives a fallback villager");
  assert(sampledNight.includes('if (active && m.reach !== "home" && huntLoc)'), "every outdoor hunt night, not only night one or a werewolf night, checks for a real quarry");
  assert(sampledNight.includes("delete secretOut[forced.id]") && sampledNight.includes("delete griefOut[forced.id]"), "a fallback hunt route cannot retain a contradictory secret or mourning destination");
  assert(!sampledNight.includes('if (n === 1 && active && m.reach !== "home")'), "the retired first-night-only guarantee cannot return");
  var secretCadence = html.slice(html.indexOf("function primeDirectorSecret"), html.indexOf("/* ================= V5 NIGHT DIRECTOR ADAPTER"));
  assert(secretCadence.includes("secretDroughtNights(s, n) < 2"), "two nights without a discovery activate the secret corridor safeguard");
  assert(secretCadence.includes("npc.id !== facts.guaranteedVictimId") && secretCadence.includes("npc.id !== s.monster.vid"), "the safeguard cannot reroute the hunt's quarry or its host");
  assert(secretCadence.includes("facts.secretCatch[chosen.id] = true") && start.includes("primeDirectorSecret"), "a primed secret is readable and enters the Director before the walk is compiled");
  var compiledNight = html.slice(html.indexOf("function compileDirectorNight"), html.indexOf("function resolveNight"));
  assert(compiledNight.includes("directorAfflictionBeats(s, facts, slots)") && html.includes('crisisStage: "arrival"') && html.includes('crisisStage: "struggle"') && html.includes('crisisStage: "aftermath"') && html.includes('crisisStage: "resolution"'), "a sampled village crisis owns a multi-beat Director sequence through its final outcome");
  assert(html.includes("afflictionLocation: scene.location") && html.includes("afflictionWound: scene.wound"), "the crisis carries its authored location and damaged-night artwork into every beat");
  assert(html.includes('churchBurn: { location: "Old Church", wound: "burn"') && html.includes('wellFouled: { location: "Village Square", wound: "fouled"'), "church fire and poisoned-well nights select their existing crisis plates");
  assert(html.includes('wound={afflictionScene ? afflictionScene.wound : nightWound(s, location)}'), "the live crisis art is shown before dawn persists the wound");
  assert(sampledNight.includes("afflictionCrisisRoster") && sampledNight.includes("setOut(id, afflictLoc") && sampledNight.includes("afflictionCrowd"), "rare disasters force a stable crowd onto the damaged ground");
  assert(compiledNight.includes("crisisMotive") && compiledNight.includes("family: \"crisis\"") && compiledNight.includes("duration: slots"), "crisis attendees remain scheduled at the scene rather than resuming unrelated errands");
  assert(start.includes("const livedIntent = crisisScene") && start.includes("AFFLICTION_SUMMON[facts.affliction]"), "the disaster interrupts the player's declared errand and sends them to the real scene");
  assert(html.includes('event.kind === "crisis_response"') && html.includes('event.choice === "help"') && html.includes('event.choice === "comfort"') && html.includes('event.choice === "witness"'), "help, support and observation have distinct dawn consequences");
  assert(compiledNight.includes("facts.guaranteedVictimId") && compiledNight.includes("guaranteedTarget ? { ...(sampledMotive || fallbackMotive), depart: 0, duration: slots }"), "the fallback neighbour is physically on the hunting ground throughout the attack hour");
  assert(compiledNight.includes("activeHost ? { ...(sampledMotive || fallbackMotive), depart: 1, duration: slots }"), "an active monster host leaves its house before it hunts");
  assert(html.includes("then followed them to the ${log.you.followedTo}"), "the final night history distinguishes following a watched suspect from remaining at their door");
  var chunkSource = html.slice(html.indexOf("function nightTextChunks"), html.indexOf("/* Director prose", html.indexOf("function nightTextChunks")));
  var chunkContext = {};
  vm.createContext(chunkContext);
  vm.runInContext(chunkSource + "; this.nightTextChunks = nightTextChunks;", chunkContext);
  var paced = chunkContext.nightTextChunks("One short sentence. This deliberately longer sentence contains enough separate words to require more than one compact typed line on a narrow phone screen.");
  assert(paced.length >= 3 && paced.every(function (words) { return words.length <= 18; }), "night prose is divided into sentence-sized runs of at most eighteen words");
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
  var nightPanel = interviewIa.slice(interviewIa.indexOf('ivSub === "catN"'), interviewIa.indexOf('ivSub === "catS"'));
  assert(nightPanel.includes("nightRow") && nightPanel.includes('askQ("where")') && nightPanel.includes('askQ("saw")') && nightPanel.includes('setIvSub("nightPerson")') && !nightPanel.includes("contextQuestions.map"), "the night group contains only the selected night's whereabouts and sightings");
  assert(interviewIa.includes('askQ("opinion", t.id)') && interviewIa.includes('askQ("whereNow", t.id)') && interviewIa.includes('askQ("worried", t.id)') && interviewIa.includes('askQ("mentioned", `${source.id}|${x.id}`)'), "a portrait now opens opinion, whereabouts, concern and cross-mention questions");
  assert(interviewIa.includes("These questions can improve how they receive you.") && interviewIa.includes("Sit with them awhile."), "personal conversation clearly advertises its relationship purpose");
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
  var repairBlameSource = html.slice(html.indexOf("function repairPublicBlame"), html.indexOf("/* One short-lived build", html.indexOf("function repairPublicBlame")));
  var repairBlameContext = {
    npcById: function (state, id) { return state.npcs.find(function (npc) { return npc.id === id; }); },
    bondedTo: function () { return ["greta"]; },
    clampDisp: function (value) { return Math.max(-2, Math.min(2, value)); }
  };
  vm.createContext(repairBlameContext);
  vm.runInContext(repairBlameSource + "; this.repairPublicBlame = repairPublicBlame;", repairBlameContext);
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
  repairBlameContext.repairPublicBlame(blameState);
  assert.strictEqual(blameState.npcs.find(function (npc) { return npc.id === "falk"; }).disp, -2, "the direct witness keeps their initial distrust and loses wider village trust too");
  assert.strictEqual(blameState.npcs.find(function (npc) { return npc.id === "greta"; }).disp, -2, "someone close to the victim reacts more strongly");
  assert.strictEqual(blameState.npcs.find(function (npc) { return npc.id === "rosa"; }).disp, 0, "the accusation lowers the wider village's disposition");
  assert.strictEqual(blameState.publicBlame.kind, "changed", "the lasting accusation distinguishes a changed victim from a death");
  assert.deepStrictEqual(Array.from(blameState.worldEvents[0].actorIds), ["falk"], "an older save repairs the witness list needed by its interview response");
  assert(html.includes("const offeredLabels = new Set()") && html.includes("offeredLabels.has(visible)"), "context questions deduplicate identical visible wording across ledger events");
  assert(html.includes('event.kind === "director_body_investigation"') && html.includes("PUBLIC_BLAME_WITNESS"), "a body witness gives a concrete response instead of a generic denial");
  assert(html.includes('q === "where" && publicBlame') && html.includes("PUBLIC_BLAME_GOSSIP"), "where and village-talk questions surface the lasting accusation");
  assert(html.includes("THE VILLAGE SUSPECTS YOU") && html.includes("repairPublicBlame(run)"), "the accusation is visible in interviews and repaired into existing saves");
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
  vm.runInContext(followWeatherSource + followHelperSource + "; this.followSamples = ['fog', 'storm', 'frost'].map(function (wx) { return directorFollowAction(wx, { name: 'Greta' }, 'Tavern', 'collect a message left with Liesel and answer none of her questions'); });", followContext);
  assert.strictEqual(followContext.followSamples[1], "By lightning, you follow Greta to the Tavern. There, you watch Greta collect a message left with Liesel and answer none of her questions.");
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
  assert(html.includes("Someone asked me to keep this private. I will not give you their name."), "the replacement plainly states what the villager is withholding");
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
  assert(html.includes('(DEATH_SCENES[monsterOf(s).id] || DEATH_SCENES.wraith)(host ? host.name'), "a Director death restores the monster-specific death scene with the actual host named");
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
  assert(html.includes('askQ("whereNow", t.id)') && html.includes("Where is {t.name}?"), "the person interview offers a direct whereabouts question for Greta or anyone else who fled");
  var goneReplySource = html.slice(html.indexOf('if (q === "whereNow"'), html.indexOf('if (q === "opinion"', html.indexOf('if (q === "whereNow"')));
  assert.strictEqual((goneReplySource.match(/whereNowGone:/g) || []).length, 1, "fled-villager replies use one stable keyed pool");
  assert((goneReplySource.match(/^\s+`“/gm) || []).length >= 6, "villagers have several concise explanations for someone leaving the village");
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
  assert(html.includes('THE VILLAGE HAS TURNED AGAINST YOU') && html.includes("hostileMajority"), "village-wide hostility is visible and changes cooperation");
  assert(html.includes('askQ("apologise")') && html.includes('askQ("help")'), "the player has deliberate ways to repair disposition");
  assert(html.includes('standing.hostileMajority ? 0.08'), "a hostile village makes calming a mob nearly impossible");
  assert(!directorSource.includes("Open the door and I will return it") && !directorSource.includes("Be more careful next time"), "retired return-item dialogue cannot recur");
  var thresholdRequestSource = directorSource.slice(directorSource.indexOf("function thresholdRequestText"), directorSource.indexOf("function thresholdNeighbourAnswer"));
  assert(!/[‘’]/.test(thresholdRequestSource), "doorstep requests use paired double quotation marks rather than stray single marks");
  assert(directorSource.includes("var nightOffset") && directorSource.includes("thresholdLine(state, threshold.dialogueRoll, lines)"), "doorstep replies rotate across nights rather than repeating the same seeded line");
  assert(html.includes('/^[,;:\'"‘’“”]+$/.test(fragment)'), "the paced night text drops orphan punctuation fragments");
  assert(!html.includes("It explains the hour, not the person."), "the retired explanatory tag cannot return");
  assert(html.includes('v5-night-director.js?v=9'), "the local page cache-busts the current Director runtime");
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
  assert(!html.includes("It knows your face now. The dark is more dangerous for you than for anyone."), "the vague warning is retired");
  assert(html.includes("After two nights unchallenged, the next hunt takes your route."), "the replacement warning states the actual mechanic");
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
