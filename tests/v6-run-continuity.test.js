"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Continuity = require("../v6-continuity.js");
var Adapter = require("../v6-director-adapter.js");
var RunContinuity = require("../v6-run-continuity.js");

var actors = [
  { id: "hazel", name: "Hazel", alive: true },
  { id: "wilhelm", name: "Wilhelm", alive: true },
  { id: "rosa", name: "Rosa", alive: true }
];

function run(seed) {
  return {
    gameId: seed,
    npcs: JSON.parse(JSON.stringify(actors)),
    continuity: Continuity.createLedger({ runId: seed, seed: seed, actors: actors })
  };
}

function addOutcome(state, options) {
  options = options || {};
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: options.id || "night:2:attack:wilhelm",
    type: options.status === "changed" ? "changed" : "slain",
    phase: "night",
    night: 2,
    location: options.location || "Old Mill",
    subjectIds: ["wilhelm"],
    statusChanges: [{ actorId: "wilhelm", status: options.status || "dead" }],
    truth: { data: { id: options.rawId || "attack:2:wilhelm", slot: 2, victimId: "wilhelm" } }
  });
  return state;
}

(function canonicalStatusDrivesTheOldNpcCards() {
  var state = addOutcome(run("status-projection"));
  assert.strictEqual(state.npcs.find(function (npc) { return npc.id === "wilhelm"; }).alive, true, "the compatibility card has not been projected yet");
  RunContinuity.syncRunActors(state);
  assert.strictEqual(state.npcs.find(function (npc) { return npc.id === "wilhelm"; }).alive, false, "canonical death closes the old card");
  assert.strictEqual(RunContinuity.actorCanAppear(state, "wilhelm"), false);
})();

(function witnessedDeathsAreNotMisreadAsLeavingSomeoneAlive() {
  var state = addOutcome(run("witnessed"));
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:attack:wilhelm",
    observerId: "player",
    mode: "direct",
    certainty: "certain",
    actorIdsRecognised: ["wilhelm"],
    factKeys: ["kind:attack_aftermath"]
  });
  assert.strictEqual(RunContinuity.playerOutcomeKnowledge(state, 2, "wilhelm").kind, "witnessed_death");
})();

(function theRealDirectorImportClassifiesWitnessedAndInvestigatedOutcomes() {
  function terminal(truth, observations) {
    return {
      seed: "director-outcome-knowledge",
      night: 2,
      phase: "complete",
      cast: JSON.parse(JSON.stringify(actors)),
      monsterSchedule: { hostId: "hazel" },
      ledgers: { truth: truth, observations: observations, memories: {} },
      found: { stamps: [], clues: [], whispers: [] }
    };
  }
  var witnessedDirector = terminal([
    { id: "attack:2:wilhelm", slot: 2, kind: "slain", location: "Old Mill", actors: ["hazel", "wilhelm"], victimId: "wilhelm", witnessed: true }
  ], [
    { eventId: "attack:2:wilhelm", slot: 2, kind: "attack_aftermath", location: "Old Mill", actors: ["wilhelm"], clarity: "partial", reliability: "direct" }
  ]);
  var witnessedRun = run("director-witnessed");
  witnessedRun.continuity = Adapter.projectDirectorNight(witnessedRun.continuity, witnessedDirector, { actors: actors });
  assert.strictEqual(RunContinuity.playerOutcomeKnowledge(witnessedRun, 2, "wilhelm").kind, "witnessed_death");

  var investigatedDirector = terminal([
    { id: "attack:2:wilhelm", slot: 2, kind: "slain", location: "Old Mill", actors: ["hazel", "wilhelm"], victimId: "wilhelm", witnessed: false },
    { id: "investigated:attack:2:wilhelm", slot: 3, kind: "investigated_attack", location: "Old Mill", actors: ["player", "wilhelm"], victimId: "wilhelm", attackEventId: "attack:2:wilhelm", clueFound: false }
  ], [
    { eventId: "attack:2:wilhelm", slot: 2, kind: "heard", location: "Village Square", actors: [], clarity: "sensory", reliability: "direct" },
    { eventId: "investigated:attack:2:wilhelm", slot: 3, kind: "attack_aftermath", location: "Old Mill", actors: ["wilhelm"], clarity: "partial", reliability: "direct" }
  ]);
  var investigatedRun = run("director-investigated");
  investigatedRun.continuity = Adapter.projectDirectorNight(investigatedRun.continuity, investigatedDirector, { actors: actors });
  assert.strictEqual(RunContinuity.playerOutcomeKnowledge(investigatedRun, 2, "wilhelm").kind, "found_body");
})();

(function reachingTheBodyAndMerelyHearingTheAttackStayDifferent() {
  var found = addOutcome(run("found-body"));
  found.continuity = Continuity.appendEvent(found.continuity, {
    id: "night:2:investigated:wilhelm",
    type: "investigated_attack",
    phase: "night",
    night: 2,
    location: "Old Mill",
    actorIds: ["player"],
    subjectIds: ["wilhelm"],
    truth: { data: { id: "investigated:attack:2:wilhelm", attackEventId: "attack:2:wilhelm", victimId: "wilhelm", slot: 3 } }
  });
  found.continuity = Continuity.recordObservation(found.continuity, {
    eventId: "night:2:investigated:wilhelm",
    observerId: "player",
    actorIdsRecognised: ["wilhelm"]
  });
  assert.strictEqual(RunContinuity.playerOutcomeKnowledge(found, 2, "wilhelm").kind, "found_body");

  var heard = addOutcome(run("heard-only"));
  heard.continuity = Continuity.recordObservation(heard.continuity, {
    eventId: "night:2:attack:wilhelm",
    observerId: "player",
    mode: "direct",
    certainty: "sensory",
    actorIdsRecognised: []
  });
  assert.strictEqual(RunContinuity.playerOutcomeKnowledge(heard, 2, "wilhelm").kind, "heard_only");
})();

(function aRealPriorMeetingCanBecomeLastSeenAlive() {
  var state = run("last-seen");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:meeting:wilhelm",
    type: "crossed_paths",
    phase: "night",
    night: 2,
    location: "Village Square",
    actorIds: ["player", "wilhelm"],
    truth: { data: { id: "meeting:wilhelm", slot: 1 } }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:meeting:wilhelm",
    observerId: "player",
    actorIdsRecognised: ["wilhelm"]
  });
  state = addOutcome(state);
  var knowledge = RunContinuity.playerOutcomeKnowledge(state, 2, "wilhelm");
  assert.strictEqual(knowledge.kind, "last_seen_alive");
  assert.strictEqual(knowledge.priorLocation, "Village Square");
})();

(function doorstepVisitsAreOneObservedChain() {
  var state = run("doorstep-chain");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:director:threshold-arrival:4", type: "threshold_arrival", phase: "night", night: 2,
    location: "Home", truth: { data: { id: "threshold-arrival:4", slot: 4, actorId: "hazel", visitorKind: "neighbour", thresholdKind: "knock" } }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:director:threshold-arrival:4", observerId: "player", mode: "heard", actorIdsRecognised: []
  });
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:director:threshold-missing-report:4", type: "threshold_missing_report", phase: "night", night: 2,
    location: "Home", actorIds: ["player", "hazel"], subjectIds: ["wilhelm"],
    truth: { data: { id: "threshold-missing-report:4", slot: 4, reporterId: "hazel", subjectId: "wilhelm" } }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:director:threshold-missing-report:4", observerId: "player", actorIdsRecognised: ["hazel", "wilhelm"]
  });
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:director:threshold-choice:4", type: "threshold_choice", phase: "night", night: 2,
    location: "Old Mill", actorIds: ["player", "hazel"],
    truth: { data: { id: "threshold-choice:4", slot: 4, actorId: "hazel", action: "STEP_OUTSIDE", opened: true } }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:director:threshold-choice:4", observerId: "player", actorIdsRecognised: ["hazel"]
  });
  var visits = RunContinuity.thresholdVisits(state, 2);
  assert.strictEqual(visits.length, 1);
  assert.strictEqual(visits[0].visitorId, "hazel");
  assert.strictEqual(visits[0].subjectId, "wilhelm");
  assert.strictEqual(visits[0].action, "STEP_OUTSIDE");
  assert.deepStrictEqual(visits[0].recognisedActorIds.sort(), ["hazel", "wilhelm"]);
  assert.strictEqual(RunContinuity.thresholdVisitCount(state), 1);
})();

(function sharedDiscoveriesRequireMutualMemoryOfOneEvent() {
  var state = run("shared-discovery");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:director:investigated:attack:wilhelm", type: "investigated_attack", phase: "night", night: 2,
    location: "Old Mill", actorIds: ["player", "hazel"], subjectIds: ["wilhelm"],
    truth: { data: { id: "investigated:attack:wilhelm", slot: 4, victimId: "wilhelm", attackEventId: "attack:wilhelm", sharedDiscovery: true, rescueReporterId: "hazel", corroboratingWitnessIds: ["hazel"] } }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:director:investigated:attack:wilhelm", observerId: "player", actorIdsRecognised: ["wilhelm", "hazel"]
  });
  assert.deepStrictEqual(RunContinuity.sharedDiscoveries(state, { night: 2 }), [], "one person's memory is not a shared scene");
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:director:investigated:attack:wilhelm", observerId: "hazel", actorIdsRecognised: ["player"]
  });
  var discovery = RunContinuity.sharedDiscoveryForActor(state, "hazel", 2);
  assert(discovery);
  assert.strictEqual(discovery.victimId, "wilhelm");
  assert.deepStrictEqual(discovery.companionIds, ["hazel"]);
})();

(function monsterAwarenessKeepsOrdinaryRecognitionSeparateFromExposure() {
  var state = run("monster-awareness");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:director:hailed:hazel", type: "hailed", phase: "night", night: 2,
    location: "Village Square", actorIds: ["player", "hazel"], truth: { data: { id: "hailed:hazel", actors: ["player", "hazel"] } }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:director:hailed:hazel", observerId: "player", actorIdsRecognised: ["hazel"]
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:director:hailed:hazel", observerId: "hazel", actorIdsRecognised: ["player"]
  });
  var greeted = RunContinuity.monsterAwareness(state, "hazel");
  assert.strictEqual(greeted.playerRecognisedHost, false, "recognising Hazel as Hazel is not proof she is the monster");
  assert.strictEqual(greeted.hostRecognisedPlayer, true, "the monster remembers the player who hailed it");

  RunContinuity.recordMonsterAwareness(state, "hazel", {
    id: "night:2:failed-rite:hazel", type: "failed_rite", night: 2, location: "Old Church",
    playerRecognisedHost: true, hostRecognisedPlayer: true, failedRite: true
  });
  var exposed = RunContinuity.monsterAwareness(state, "hazel");
  assert.strictEqual(exposed.playerRecognisedHost, true);
  assert.strictEqual(exposed.hostRecognisedPlayer, true);
  assert.strictEqual(exposed.failedRiteCount, 1);
  assert.deepStrictEqual(exposed.mutualEventIds, ["night:2:failed-rite:hazel"]);
})();

(function secretsBelongToObservedEventsRatherThanNpcFlags() {
  var state = run("canonical-secret");
  state.secretPick = { hazel: 2 };
  state.npcs = state.npcs.map(function (npc) {
    return npc.id === "hazel" ? Object.assign({}, npc, { secretKnown: true }) : npc;
  });
  assert.strictEqual(RunContinuity.secretKnowledge(state, "hazel"), null, "a stray compatibility flag cannot give the player a secret");
  var eventId = RunContinuity.recordSecretLearned(state, "hazel", {
    night: 2,
    location: "Graveyard",
    source: "watched_scene",
    secretIndex: 2,
    summary: "she visits an unmarked grave"
  });
  var learned = RunContinuity.secretKnowledge(state, "hazel");
  assert.strictEqual(learned.eventId, eventId);
  assert.strictEqual(learned.secretIndex, 2);
  assert.strictEqual(learned.location, "Graveyard");
  assert.strictEqual(Continuity.observedEvent(state.continuity, "player", eventId), true);
  assert.strictEqual(RunContinuity.recordSecretLearned(state, "hazel", { night: 3, source: "confession", secretIndex: 2 }), eventId, "the same learned secret cannot duplicate itself");
})();

(function aDeadVillagerCannotConfessAfterTheirDeath() {
  var state = run("dead-secret-owner");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:hazel-dies", type: "slain", phase: "night", night: 2,
    subjectIds: ["hazel"], statusChanges: [{ actorId: "hazel", status: "dead" }]
  });
  assert.throws(function () {
    RunContinuity.recordSecretLearned(state, "hazel", { day: 2, source: "confession", secretIndex: 0 });
  }, /inactive character cannot reveal/, "death closes live confession routes");
})();

(function witnessListsRequireRecognisedSharedEvents() {
  var state = run("canonical-companions");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:hazel-at-graveyard", type: "private_errand", phase: "night", night: 2,
    location: "Graveyard", actorIds: ["hazel"]
  });
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:rosa-at-graveyard", type: "private_errand", phase: "night", night: 2,
    location: "Graveyard", actorIds: ["rosa"]
  });
  assert.deepStrictEqual(RunContinuity.observedCompanionIds(state, "rosa", 2, "Graveyard"), [], "sharing a schedule location is not proof Rosa met Hazel");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:rosa-meets-hazel", type: "encounter", phase: "night", night: 2,
    location: "Graveyard", actorIds: ["rosa", "hazel"]
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:rosa-meets-hazel", observerId: "rosa", actorIdsRecognised: ["hazel"], locationRecognised: true
  });
  assert.deepStrictEqual(RunContinuity.observedCompanionIds(state, "rosa", 2, "Graveyard"), ["hazel"], "an observed and recognised meeting is remembered");
})();

(function sightingsStayDirectionalUntilBothPeopleRecogniseTheSameEvent() {
  var state = run("directional-recognition");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:lane-sighting", type: "crossed_paths", phase: "night", night: 2,
    location: "Old Church", actorIds: ["player", "rosa", "hazel"],
    truth: { data: { kind: "crossed_paths", slot: 2, acknowledged: false } }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    id: "night:2:lane-sighting:player", eventId: "night:2:lane-sighting",
    observerId: "player", actorIdsRecognised: ["rosa"], locationRecognised: true
  });
  var oneSided = RunContinuity.encounterRecognition(state, "rosa", { night: 2 });
  assert.strictEqual(oneSided.playerSawActor.length, 1);
  assert.strictEqual(oneSided.actorSawPlayer.length, 0, "seeing Rosa cannot give Rosa the reverse memory");
  assert.strictEqual(oneSided.mutual.length, 0);
  assert.strictEqual(RunContinuity.recognitionEvents(state, "player", "hazel", { night: 2 }).length, 0, "mere participation is not recognition");

  state.continuity = Continuity.recordObservation(state.continuity, {
    id: "night:2:lane-sighting:rosa", eventId: "night:2:lane-sighting",
    observerId: "rosa", actorIdsRecognised: ["player"], locationRecognised: true
  });
  var mutual = RunContinuity.encounterRecognition(state, "rosa", { night: 2, location: "Old Church" });
  assert.strictEqual(mutual.mutual.length, 1, "two directional observations of one event make a mutual sighting");
  assert.strictEqual(mutual.acknowledged.length, 0, "a mutual glimpse is not automatically a hail");

  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:lane-hail", type: "hailed", phase: "night", night: 2,
    location: "Old Church", actorIds: ["player", "rosa"],
    truth: { data: { kind: "hailed", slot: 3, acknowledged: true } }
  });
  [
    { id: "night:2:lane-hail:player", observerId: "player", actorIdsRecognised: ["rosa"] },
    { id: "night:2:lane-hail:rosa", observerId: "rosa", actorIdsRecognised: ["player"] }
  ].forEach(function (observation) {
    state.continuity = Continuity.recordObservation(state.continuity, Object.assign({
      eventId: "night:2:lane-hail", locationRecognised: true
    }, observation));
  });
  var hailed = RunContinuity.encounterRecognition(JSON.parse(JSON.stringify(state)), "rosa", { night: 2 });
  assert.strictEqual(hailed.acknowledged.length, 1, "an acknowledged mutual meeting survives serialization");
})();

(function evidenceAndJournalProjectFromOneCanonicalInventory() {
  var state = run("canonical-evidence");
  var genuineId = RunContinuity.recordEvidence(state, {
    id: "evidence:grave-dirt", sourceEventId: "night:2:grave-dirt", type: "physical_mark_discovered",
    night: 2, location: "Graveyard", objectKey: "sign:graves", imageKey: "sign:graves",
    sign: "graves", authenticity: "genuine"
  });
  var plantedId = RunContinuity.recordEvidence(state, {
    id: "evidence:false-hex", sourceEventId: "night:2:false-hex", type: "monster_plants_evidence",
    night: 2, location: "Old Church", objectKey: "sign:hex", imageKey: "sign:hex",
    sign: "hex", authenticity: "planted", discovered: false, inspected: false
  });
  assert.deepStrictEqual(RunContinuity.discoveredSignKeys(state), ["graves"]);
  assert.deepStrictEqual(RunContinuity.discoveredSignKeys(state, { genuineOnly: true }), ["graves"]);
  state.continuity = Continuity.discoverEvidence(state.continuity, plantedId, "player");
  state.continuity = Continuity.inspectEvidence(state.continuity, plantedId, "player");
  assert.deepStrictEqual(RunContinuity.discoveredSignKeys(state), ["graves", "hex"], "a planted mark looks usable until it is exposed");
  assert.deepStrictEqual(RunContinuity.discoveredSignKeys(state, { genuineOnly: true }), ["graves"], "false evidence never becomes a true sign");
  RunContinuity.setJournalSign(state, "hex", true);
  assert.deepStrictEqual(RunContinuity.journalSignKeys(state), ["hex"]);
  RunContinuity.exposeEvidence(state, plantedId, { day: 2, location: "Old Church" });
  assert.deepStrictEqual(RunContinuity.discoveredSignKeys(state), ["graves"], "exposed false evidence leaves the active evidence trail");
  assert.strictEqual(Continuity.evidenceById(state.continuity, genuineId).imageKey, "sign:graves");
  assert.deepStrictEqual(Continuity.validateLedger(state.continuity), []);
})();

(function alibisAreClaimsAboutPrivateRouteMemory() {
  var state = run("canonical-alibi");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:route:rosa", type: "night_route", phase: "night", night: 2,
    location: "Graveyard", subjectIds: ["rosa"],
    truth: { actorId: "rosa", primaryLocation: "Graveyard", locations: ["Graveyard"] }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:route:rosa", observerId: "rosa", mode: "memory",
    actorIdsRecognised: ["rosa"], locationRecognised: true
  });
  assert.strictEqual(RunContinuity.rememberedNightRoute(state, "rosa", 2).location, "Graveyard");
  assert.strictEqual(Continuity.observedEvent(state.continuity, "player", "night:2:route:rosa"), false, "the player does not inherit Rosa's private memory");

  var testimonyId = RunContinuity.recordAlibiTestimony(state, "rosa", 2, {
    day: 2, question: "where", claim: "home", exclusive: true, deliberateLie: true
  });
  var testimony = RunContinuity.alibiTestimonies(state, "rosa", 2)[0];
  assert.strictEqual(testimony.id, testimonyId);
  assert.strictEqual(testimony.claims.location, "home");
  assert.strictEqual(testimony.claims.exclusive, true);
  assert.strictEqual(testimony.claims.truthfulness, "contradicted_by_route");
  assert.strictEqual(testimony.claims.deliberateLie, true);
  assert.strictEqual(Continuity.observedEvent(state.continuity, "player", "night:2:route:rosa"), false, "hearing a false alibi never becomes firsthand sight");
  assert.strictEqual(RunContinuity.recordAlibiTestimony(state, "rosa", 2, { day: 2, question: "where", claim: "home" }), testimonyId, "the same answer cannot duplicate after reload");
  var reloaded = Continuity.upgradeRun(JSON.parse(JSON.stringify(state)));
  assert.strictEqual(RunContinuity.rememberedNightRoute(reloaded, "rosa", 2).location, "Graveyard", "private route memory survives serialization");
  assert.strictEqual(RunContinuity.alibiTestimonies(reloaded, "rosa", 2)[0].claims.location, "home", "the spoken cover story survives separately from the truth");
  assert.deepStrictEqual(Continuity.validateLedger(reloaded.continuity), []);
})();

(function relationshipConsequencesAreAcknowledgedExactlyOnce() {
  var state = run("relationship-acknowledgement");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:director:intervene:2", type: "intervention", phase: "night", night: 2,
    location: "Graveyard", actorIds: ["player", "rosa"], truth: { data: { id: "intervene:2", succeeded: true } }
  });
  assert.strictEqual(RunContinuity.unacknowledgedRelationship(state, "rosa"), null, "a truth event alone cannot invent Rosa's memory");
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:director:intervene:2", observerId: "rosa", actorIdsRecognised: ["player"]
  });
  var relationship = RunContinuity.unacknowledgedRelationship(state, "rosa");
  assert(relationship && relationship.kind === "rescued");
  RunContinuity.acknowledgeRelationship(state, relationship.eventId, { day: 2 });
  assert.strictEqual(RunContinuity.unacknowledgedRelationship(state, "rosa"), null);
  var before = state.continuity.events.length;
  RunContinuity.acknowledgeRelationship(state, relationship.eventId, { day: 2 });
  assert.strictEqual(state.continuity.events.length, before, "reopening the interview cannot duplicate the acknowledgement");
})();

(function deliberateSacrificeIsNotOrdinaryAbandonment() {
  var state = run("relationship-betrayal");
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:director:abandon:2:rosa", type: "abandonment", phase: "night", night: 2,
    location: "Dark Forest", actorIds: ["player", "rosa"], truth: { data: { id: "abandon:2:rosa", victimId: "rosa", action: "SACRIFICE" } }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:director:abandon:2:rosa", observerId: "rosa", actorIdsRecognised: ["player"]
  });
  var relationship = RunContinuity.relationshipHistory(state, { actorId: "rosa" })[0];
  assert(relationship && relationship.kind === "betrayed", "pushing a neighbour into the attack remains a distinct continuity consequence");
})();

(function earnedDramaticScenesBecomeDurablePromises() {
  var state = run("dramatic-promises");
  state.monster = { vid: "hazel", type: "hag" };
  state.bond = 2;
  state.offerMade = false;
  RunContinuity.recordMonsterAwareness(state, "hazel", {
    id: "night:2:mutual-recognition", type: "monster_recognition", night: 2,
    location: "Old Church", playerRecognisedHost: true, hostRecognisedPlayer: true
  });
  RunContinuity.ensureDramaticPromises(state, 3, { offerBondMin: 2, offerMinNight: 3 });
  var threshold = RunContinuity.pendingDramaticPromise(state, "threshold_consequence", 3);
  var offer = RunContinuity.pendingDramaticPromise(state, "monster_offer", 3);
  assert(threshold && threshold.dueByNight === 4, "a known home owes a threshold consequence within two nights");
  assert(offer && offer.dueByNight === 3, "earned interest owes an offer at the next eligible encounter");
  var offerEvent = RunContinuity.recordDramaticFulfillment(state, "monster_offer", {
    night: 3, location: "Dark Forest", playerObserved: true
  });
  assert.strictEqual(RunContinuity.pendingDramaticPromise(state, "monster_offer", 3), null);
  assert.strictEqual(Continuity.observedEvent(state.continuity, "player", offerEvent), true);
  var thresholdEvent = RunContinuity.recordDramaticFulfillment(state, "threshold_consequence", {
    night: 3, location: "Home"
  });
  assert.strictEqual(Continuity.observedEvent(state.continuity, "player", thresholdEvent), false, "scheduling a knock cannot reveal the host before the player recognises the visitor");
  var saved = Continuity.upgradeRun(JSON.parse(JSON.stringify(state)));
  RunContinuity.ensureDramaticPromises(saved, 4, { offerBondMin: 2, offerMinNight: 3 });
  assert.strictEqual(saved.continuity.promises.filter(function (row) { return row.kind === "monster_offer"; }).length, 1, "reload cannot schedule the same offer twice");
  assert.deepStrictEqual(Continuity.validateLedger(saved.continuity), []);
})();

(function aNightTimelineCanHoldAnErrandAndALaterDoorstepVisit() {
  var state = run("multi-stop-night");
  state.monster = { vid: "hazel", type: "hag" };
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:route:rosa", type: "night_route", phase: "night", night: 2,
    location: "Village Square", subjectIds: ["rosa"],
    truth: { actorId: "rosa", primaryLocation: "Village Square", locations: ["Village Square", "home"], slots: ["Village Square", "home", "home", "home"] }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:route:rosa", observerId: "rosa", mode: "memory", actorIdsRecognised: ["rosa"]
  });
  state.continuity = Continuity.appendEvent(state.continuity, {
    id: "night:2:guided:rosa", type: "threshold_guided_search", phase: "night", night: 2,
    location: "Old Church", actorIds: ["player", "rosa"], truth: { actorId: "rosa", slot: 4 }
  });
  state.continuity = Continuity.recordObservation(state.continuity, {
    eventId: "night:2:guided:rosa", observerId: "rosa", mode: "memory", actorIdsRecognised: ["player"]
  });
  var timeline = RunContinuity.actorNightTimeline(state, "rosa", 2);
  assert(timeline.some(function (row) { return row.location === "Village Square"; }));
  assert(timeline.some(function (row) { return row.location === "Old Church" && row.slot === 4; }), "a late shared visit is preserved beside the earlier route");
  RunContinuity.recordAlibiTestimony(state, "rosa", 2, { day: 2, question: "where", claim: "Village Square" });
  assert.strictEqual(RunContinuity.alibiTestimonies(state, "rosa", 2)[0].claims.truthfulness, "consistent", "one truthful stop is not contradicted by a later stop");

  var homeId = RunContinuity.recordAlibiTestimony(state, "rosa", 2, { day: 2, question: "saw", claim: "home" });
  var homeClaim = RunContinuity.alibiTestimonies(state, "rosa", 2).find(function (row) { return row.id === homeId; });
  assert.strictEqual(homeClaim.claims.truthfulness, "consistent", "being home for part of a night does not deny earlier stops");

  var exclusiveId = RunContinuity.recordAlibiTestimony(state, "rosa", 2, { day: 3, question: "where", claim: "home", exclusive: true });
  var exclusiveHome = RunContinuity.alibiTestimonies(state, "rosa", 2).find(function (row) { return row.id === exclusiveId; });
  assert.strictEqual(exclusiveHome.claims.truthfulness, "contradicted_by_route", "only an explicit all-night home claim excludes the rest of the route");
})();

(function everyRecordedInterviewAnswerNamesItsProvenance() {
  var state = run("testimony-provenance");
  var id = RunContinuity.recordInterviewTestimony(state, "rosa", {
    day: 2, night: 1, question: "opinion", targetId: "hazel",
    quote: "I trust her.", provenance: "opinion"
  });
  var row = state.continuity.testimonies.find(function (entry) { return entry.id === id; });
  assert(row);
  assert.strictEqual(row.claims.provenance, "opinion");
  assert.strictEqual(RunContinuity.recordInterviewTestimony(state, "rosa", {
    day: 2, night: 1, question: "opinion", targetId: "hazel", quote: "Changed text", provenance: "opinion"
  }), id, "reload or a double tap cannot duplicate the same answer");
})();

(function resolvedOutcomesAreRememberedByEveryParticipant() {
  var state = run("evacuation-memory");
  var id = RunContinuity.recordResolvedOutcome(state, {
    eventId: "day:4:village-evacuated", day: 4, location: "Village Square",
    kind: "village_evacuated", actorIds: ["hazel", "wilhelm", "rosa"],
    truth: { survivorCount: 3 }
  });
  assert.strictEqual(id, "day:4:village-evacuated");
  ["player", "hazel", "wilhelm", "rosa"].forEach(function (observerId) {
    assert.strictEqual(Continuity.observedEvent(state.continuity, observerId, id), true, observerId + " remembers leaving together");
  });
  var count = state.continuity.events.length;
  RunContinuity.recordResolvedOutcome(state, {
    eventId: id, day: 4, location: "Village Square", kind: "village_evacuated", actorIds: ["hazel"]
  });
  assert.strictEqual(state.continuity.events.length, count, "reloading an ending cannot duplicate it");
  assert.deepStrictEqual(Continuity.validateLedger(state.continuity), []);
})();

(function runStatusEventsAreDurableObservedAndIdempotent() {
  var state = run("public-hanging");
  var eventId = RunContinuity.recordStatusChange(state, "rosa", "dead", {
    id: "first-light:3:rosa:hanged",
    type: "wrongful_hanging",
    phase: "firstlight",
    night: 3,
    location: "Village Square",
    observedBy: ["player"]
  });
  var eventCount = state.continuity.events.length;
  assert.strictEqual(eventId, "first-light:3:rosa:hanged");
  assert.strictEqual(state.npcs.find(function (npc) { return npc.id === "rosa"; }).alive, false);
  assert.strictEqual(RunContinuity.playerOutcomeKnowledge(state, 3, "rosa").kind, "witnessed_death");
  RunContinuity.recordStatusChange(state, "rosa", "dead", { id: eventId, night: 3 });
  assert.strictEqual(state.continuity.events.length, eventCount, "replaying settlement does not duplicate the death");
  assert.deepStrictEqual(Continuity.validateLedger(state.continuity), []);
})();

(function legacyRunsStillHaveAStatusFallback() {
  var state = { npcs: [{ id: "hazel", alive: false }, { id: "rosa", alive: true, turned: true }] };
  assert.strictEqual(RunContinuity.actorStatus(state, "hazel"), "dead");
  assert.strictEqual(RunContinuity.actorStatus(state, "rosa"), "changed");
})();

(function playableAndBuiltPagesLoadTheRunBridgeAfterItsDependencies() {
  var source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var adapter = source.indexOf('<script src="v6-director-adapter.js?v=1"></script>');
  var bridge = source.indexOf('<script src="v6-run-continuity.js?v=1"></script>');
  var game = source.indexOf('<script type="text/babel" data-presets="react">');
  assert(adapter > 0 && adapter < bridge && bridge < game);
  assert(source.includes("const HE_V6_RUN_CONTINUITY"));
  assert(source.includes('v6OutcomeKnowledge.kind === "witnessed_death"'), "the recap distinguishes a death lived on screen");
  assert(source.includes('v6OutcomeKnowledge.kind === "found_body"'), "the recap distinguishes reaching an aftermath");
  assert(source.includes('v6OutcomeKnowledge.kind === "last_seen_alive"'), "the recap only says the player left someone alive after a recorded prior sighting");
  assert(source.includes("v6Run.sharedDiscoveryForActor"), "shared interview memories come from canonical mutual observation");
  assert(source.includes("runContinuity.encounterRecognition"), "interview sightings come from directional canonical observations");
  assert(source.includes("HE_V6_RUN_CONTINUITY.thresholdVisitCount"), "door visit totals come from canonical visit chains");
  assert(source.includes("canonicalMonsterAwareness(s)"), "night planning receives canonical mutual monster awareness");
  assert(source.includes("HE_V6_RUN_CONTINUITY.unacknowledgedRelationship"), "interview consequences come from canonical relationship history");
  assert(source.includes("HE_V6_RUN_CONTINUITY.acknowledgeRelationship"), "opening an interview durably acknowledges its relationship consequence");
  assert(!source.includes('kind: "shared_body_discovery",\n          location:'), "daylight no longer writes a duplicate shared-discovery memory");
  var deathWrites = source.split("\n").reduce(function (rows, line, index, lines) {
    if (!line.includes("s.deaths.push")) return rows;
    rows.push(lines.slice(Math.max(0, index - 5), index).join("\n"));
    return rows;
  }, []);
  deathWrites.forEach(function (lead) {
    assert(lead.includes("recordActorStatus"), "every compatibility death is now preceded by a canonical status event");
  });
})();

console.log("v6-run-continuity: all tests passed");
