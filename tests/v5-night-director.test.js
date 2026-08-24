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

(function strangeSightWaitsForAChoiceAndApproachCarriesRealRisk() {
  var sawSafe = false;
  var sawThreat = false;
  for (var i = 0; i < 80 && !(sawSafe && sawThreat); i += 1) {
    var config = baseConfig("delusion-choice:" + i);
    config.monster.attackSlot = 6;
    config.currentFacts.attackSlot = 6;
    config.forcedBeats = [{
      id: "strange-sight", type: "delusion", slot: 0, location: "Village Square", text: "A giggle comes from the leaves.",
      meta: { fragments: ["A giggle comes from the leaves.", "You move closer. The sound stops.", "Only trampled leaves. Something was there."], requiresResponse: true, resolvedAsUnreal: true }
    }];
    var state = Director.createNight(config);
    state = take(state, { type: "LEAVE", to: "Village Square" });
    var actions = Director.guidedActions(state, { target: "Old Church", kind: "search", intentDone: false, interacted: {} });
    assert.deepStrictEqual(actions.map(function (a) { return a.label; }), ["Move closer and inspect", "Run. Head for home"], "the sight is unresolved until the player chooses");
    state = take(state, actions[0]);
    var choice = state.ledgers.truth.find(function (event) { return event.kind === "delusion_approach"; });
    assert(choice, "approaching the hallucination is recorded as a causal choice");
    if (choice.attractedThreat) {
      sawThreat = true;
      assert.strictEqual(state.phase, "threat", "the deterministic danger roll can turn curiosity into an attack");
    } else {
      sawSafe = true;
      assert(state.currentBeat && state.currentBeat.type === "delusion" && state.currentBeat.meta.requiresResponse === false, "a safe approach reveals the concrete resolution once");
    }
  }
  assert(sawSafe && sawThreat, "the seeded approach tape contains both safe resolutions and real threats");

  var retreatConfig = baseConfig("delusion-retreat");
  retreatConfig.forcedBeats = [{ id: "retreat-sight", type: "delusion", slot: 0, location: "Village Square", text: "A figure waits.", meta: { fragments: ["A figure waits.", "Only a tree."], requiresResponse: true } }];
  var retreat = Director.createNight(retreatConfig);
  retreat = take(retreat, { type: "LEAVE", to: "Village Square" });
  var retreatAction = Director.guidedActions(retreat, { target: "Old Church", kind: "search", intentDone: false, interacted: {} })[1];
  retreat = take(retreat, retreatAction);
  assert.strictEqual(retreat.phase, "returning");
  assert(!retreat.ledgers.truth.some(function (event) { return event.kind === "delusion_approach"; }), "retreating does not secretly spend the approach risk");
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
  assert.deepStrictEqual(actions.map(function (item) { return item.label; }), ["Move closer and inspect", "Run. Head for home"]);
  var finalSlot = state.cursor;
  state = Director.reduce(state, actions[0]);
  assert.strictEqual(state.cursor, finalSlot, "answering a sight is a reaction in the current slot, not an eighth hour of night");
  assert.strictEqual(state.phase, "returning", "after resolving the final sight, reaching home remains an explicit step");
  assert.strictEqual(state.player.location, "Village Square");
  assert(state.currentBeat && state.currentBeat.meta.requiresResponse === false, "the concrete resolution remains visible on the journey-home choice");
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

(function guidedNightOffersAStoryCorridorNotTheWholeMap() {
  var state = Director.createNight(baseConfig("guided-corridor"));
  var guide = { target: "Old Church", kind: "search", intentDone: false, interacted: {} };
  var actions = Director.guidedActions(state, guide);
  assert.strictEqual(actions.length, 1, "leaving home is one committed beginning");
  assert.strictEqual(actions[0].type, "LEAVE");
  assert.strictEqual(actions[0].to, "Old Church", "a church-bound walk takes the real back-lane edge instead of staging a visit to the Square");
  assert(/back lanes straight/.test(actions[0].label), "the opening choice names the route the simulation actually takes");
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

(function followingTheActiveHostEndsAllSocialChoices() {
  var config = baseConfig("recognition-is-not-a-chat");
  config.monster = { id: "werewolf", hostId: "rosa", active: true, signs: ["claw", "tracks", "bite"], hunts: ["Graveyard"], attack: "kill", reach: "out", voice: { mode: "beast" }, revealText: "The muzzle opens through Rosa's face, but her long frame and eyes remain unmistakable." };
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
  assert.strictEqual(state.currentBeat.type, "threat");
  assert(/Rosa's face/.test(state.currentBeat.text), "following the active host reaches the monster-specific body reveal before the survival choice");
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
  state = take(state, { type: "REACH_HOME" });
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

(function theThresholdIsSafeButNotQuiet() {
  var config = baseConfig("door-2");
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.active = false;
  config.currentFacts = { weather: "still", active: false, outMap: { rosa: "home" } };
  var state = Director.createNight(config);
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  assert.strictEqual(state.phase, "returning", "the forest does not turn directly into the player's threshold");
  state = take(state, { type: "REACH_HOME" });
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

(function thresholdDetailsRespectTheSampledWeather() {
  var config = baseConfig("storm-threshold");
  config.villagers = [{ id: "rosa", name: "Rosa", role: "the Seamstress", alive: true }];
  config.player = { monsterSawYou: true };
  config.monster.active = false;
  config.currentFacts = { weather: "storm", active: false, outMap: { rosa: "home" } };
  var state = Director.createNight(config);
  state.thresholdEvent.roll = 0;
  state.thresholdEvent.kind = "breath";
  state.thresholdEvent.look = "The breathing stops when the shutter moves. The frost on the outer latch is already melting.";
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  assert.strictEqual(state.phase, "threshold");
  assert(/Rain rattles/.test(state.currentBeat.text) && !/frost/i.test(state.currentBeat.text));
  state = take(state, { type: "LOOK_THROUGH" });
  assert(/Rainwater/.test(state.currentBeat.text) && !/frost/i.test(state.currentBeat.text), "a storm threshold cannot borrow the frost latch");
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

(function soundCannotBlockTheWalkTransition() {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var start = html.slice(html.indexOf("const startDirectorNight"), html.indexOf("/* ---------- The night walk", html.indexOf("const startDirectorNight")));
  assert(start.indexOf("setWalk({") < start.indexOf("Snd.scene("), "the Director walk state must be queued before optional ambience runs");
  assert(html.includes('catch (e) { console.warn("Night sound cue could not play", e); }'), "a failed Director sound effect cannot unmount the night screen");
  assert(html.includes('catch (e) { console.warn("Night heartbeat could not play", e); }'), "a failed heartbeat cannot unmount the night screen");
  assert(html.includes('if (beat.meta && beat.meta.changedAftermath) return beat.text;'), "changed survivors keep their aftermath dialogue instead of reverting to an ordinary errand");
  assert(html.includes('changedScene ? "CHANGED"'), "the night card visibly labels a witnessed turning");
  assert(html.includes('directorSawChange'), "a witnessed turning remains known at dawn");
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
  assert(html.includes("I was only passing through, taking the back lane toward"), "interviews explain a route waypoint separately from the villager's destination");
  assert(html.includes("WEATHER_WALK_CONTINUED") && html.includes("WEATHER_DAWN_CONTINUED"), "consecutive weather has authored second-night openings and dawn consequences");
  assert(html.includes("QUIET_NIGHT_WEATHER") && html.includes('quietNight:${wx || "still"}'), "quiet Director recaps are selected from the sampled weather instead of the generic frost-capable pool");
  assert(html.includes('soundCue: temperament.cue, weatherSoundCue: facts.wx === "storm" ? "thunder" : null'), "storm keeps the monster voice cue instead of replacing it with thunder");
  assert(html.includes("if (directorBeat.meta.weatherSoundCue) Snd.cue(directorBeat.meta.weatherSoundCue)"), "the weather cue and creature cue are both played for the same Director beat");
  assert(html.includes("[0, 0.2, 0.43].forEach"), "the whisper cue has its own audible three-part texture");
  assert(!html.includes("When you reach it, the lane is empty and the voice is behind you."), "a sound opening cannot move the player before they choose a response");
  assert(html.includes("allDelusionFragments.slice(0, 1)"), "an unresolved strange sight shows only its opening image before asking the player what to do");
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
  var recordedFindingSource = html.slice(html.indexOf("function directorRecordedFindingText"), html.indexOf("function directorMotiveFor"));
  var recordedFindingContext = {};
  vm.createContext(recordedFindingContext);
  vm.runInContext(recordedFindingSource + "; this.wasRecorded = directorFindingAlreadyRecorded;", recordedFindingContext);
  var oldSave = { clues: ["Night 2: You find a sealed note tucked into the prayer book. It belongs to a human errand: answer a confession requested through a third party. It explains the hour, not the person."] };
  var oldAgenda = { motive: { object: "a sealed note tucked into the prayer book", reason: "answer a confession requested through a third party" } };
  assert(recordedFindingContext.wasRecorded(oldSave, "new presentation text", oldAgenda), "older saves recognise a previously shown errand from their journal text even without Director signature history");
  assert(html.includes("Someone came here to ${clueAgenda.motive.reason}."), "human errand clues state the observed explanation concisely");
  assert(!html.includes("It explains the hour, not the person."), "the retired explanatory tag cannot return");
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
