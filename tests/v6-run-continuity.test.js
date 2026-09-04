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
