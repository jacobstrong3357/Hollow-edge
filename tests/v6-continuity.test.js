"use strict";

var assert = require("assert");
var Continuity = require("../v6-continuity.js");

function baseLedger() {
  return Continuity.createLedger({
    runId: "v6-test-run",
    seed: "v6-test-seed",
    actors: [
      { id: "hazel", name: "Hazel", alive: true },
      { id: "tobias", name: "Old Tobias", alive: true },
      { id: "rosa", name: "Rosa", alive: true }
    ]
  });
}

(function playerAndVillagerKnowledgeRemainSeparate() {
  var ledger = baseLedger();
  ledger = Continuity.appendEvent(ledger, {
    id: "night:1:tobias-crossing",
    type: "route_crossing",
    night: 1,
    location: "Old Church",
    actorIds: ["tobias"],
    truth: { coat: "black", destination: "Graveyard" }
  });
  ledger = Continuity.recordObservation(ledger, {
    eventId: "night:1:tobias-crossing",
    observerId: "tobias",
    factKeys: ["player_lantern"]
  });
  assert.strictEqual(Continuity.observedEvent(ledger, "tobias", "night:1:tobias-crossing"), true);
  assert.strictEqual(Continuity.observedEvent(ledger, "player", "night:1:tobias-crossing"), false);
  assert.strictEqual(Continuity.playerCanRaiseEvent(ledger, "night:1:tobias-crossing"), false, "a one-sided sighting cannot become a player interview prompt");
  assert.strictEqual(Continuity.canPresent(ledger, { requiresObservedEvents: ["night:1:tobias-crossing"] }).ok, false);
})();

(function testimonyCreatesAClaimRatherThanRetroactiveSight() {
  var ledger = baseLedger();
  ledger = Continuity.appendEvent(ledger, {
    id: "night:1:graveyard",
    type: "secret_visit",
    night: 1,
    location: "Graveyard",
    actorIds: ["hazel"]
  });
  ledger = Continuity.recordObservation(ledger, { eventId: "night:1:graveyard", observerId: "tobias" });
  ledger = Continuity.recordTestimony(ledger, {
    speakerId: "tobias",
    listenerId: "player",
    aboutEventId: "night:1:graveyard",
    claims: { actorId: "hazel", location: "Graveyard" }
  });
  assert.strictEqual(Continuity.playerCanRaiseEvent(ledger, "night:1:graveyard"), true, "the player may discuss a claim they were told");
  assert.strictEqual(Continuity.observedEvent(ledger, "player", "night:1:graveyard"), false, "hearsay never becomes firsthand observation");
})();

(function sharedScenesAreExplicitAndDurable() {
  var ledger = baseLedger();
  ledger = Continuity.appendEvent(ledger, {
    id: "night:2:find-rosa",
    type: "shared_body_discovery",
    night: 2,
    location: "Old Mill",
    actorIds: ["hazel"],
    subjectIds: ["rosa"],
    statusChanges: [{ actorId: "rosa", status: "dead" }]
  });
  ledger = Continuity.recordObservation(ledger, { eventId: "night:2:find-rosa", observerId: "player" });
  ledger = Continuity.recordObservation(ledger, { eventId: "night:2:find-rosa", observerId: "hazel" });
  assert.strictEqual(Continuity.sharedObservation(ledger, "player", "hazel", "night:2:find-rosa"), true);
  assert.strictEqual(Continuity.currentActorStatus(ledger, "rosa"), "dead");
  assert.throws(function () {
    Continuity.appendEvent(ledger, { type: "doorstep_visit", actorIds: ["rosa"] });
  }, /inactive character cannot act/, "a dead villager cannot appear in a later scene");
})();

(function evidenceHasProvenanceAndStampingIsManual() {
  var ledger = baseLedger();
  ledger = Continuity.appendEvent(ledger, {
    id: "night:3:grave-mark",
    type: "physical_mark_left",
    night: 3,
    location: "Graveyard"
  });
  ledger = Continuity.addEvidence(ledger, {
    id: "evidence:grave-dirt:1",
    objectKey: "grave-dirt",
    imageKey: "grave-dirt",
    sign: "graves",
    sourceEventId: "night:3:grave-mark",
    authenticity: "genuine"
  });
  ledger = Continuity.discoverEvidence(ledger, "evidence:grave-dirt:1", "player");
  assert.deepStrictEqual(ledger.journal.stamps, [], "discovering evidence must not auto-stamp the Journal");
  assert.throws(function () { Continuity.stampEvidence(ledger, "evidence:grave-dirt:1"); }, /inspect evidence/);
  ledger = Continuity.inspectEvidence(ledger, "evidence:grave-dirt:1", "player");
  ledger = Continuity.stampEvidence(ledger, "evidence:grave-dirt:1");
  assert.deepStrictEqual(Continuity.countedSigns(ledger), ["graves"]);
  assert.deepStrictEqual(Continuity.validateLedger(ledger), []);
})();

(function plantedEvidenceNeverCountsAsARealSign() {
  var ledger = baseLedger();
  ledger = Continuity.appendEvent(ledger, {
    id: "night:3:false-hex",
    type: "monster_plants_evidence",
    night: 3,
    location: "Old Church"
  });
  ledger = Continuity.addEvidence(ledger, {
    id: "evidence:false-hex:1",
    objectKey: "chalk-hex",
    sign: "hex",
    sourceEventId: "night:3:false-hex",
    authenticity: "planted"
  });
  ledger = Continuity.discoverEvidence(ledger, "evidence:false-hex:1", "player");
  ledger = Continuity.inspectEvidence(ledger, "evidence:false-hex:1", "player");
  ledger = Continuity.stampEvidence(ledger, "evidence:false-hex:1");
  assert.deepStrictEqual(Continuity.countedSigns(ledger), [], "a planted mark remains false even if the player records it");
})();

(function narrativeContractsRejectImpossibleLines() {
  var ledger = baseLedger();
  ledger = Continuity.appendEvent(ledger, {
    id: "night:4:hazel-door",
    type: "doorstep_visit",
    night: 4,
    location: "Home",
    actorIds: ["hazel"]
  });
  var contract = {
    requiresObservedEvents: ["night:4:hazel-door"],
    actorsCanAct: ["hazel"],
    location: "Home"
  };
  assert.strictEqual(Continuity.canPresent(ledger, contract, { location: "Home" }).ok, false, "the door question stays hidden until the player witnesses it");
  ledger = Continuity.recordObservation(ledger, { eventId: "night:4:hazel-door", observerId: "player" });
  assert.strictEqual(Continuity.canPresent(ledger, contract, { location: "Home" }).ok, true);
})();

(function keyedOutcomesAreStableAndOrderIndependent() {
  var first = Continuity.roll("run-17", "night:2|offer|hazel");
  Continuity.roll("run-17", "unrelated-outcome");
  var second = Continuity.roll("run-17", "night:2|offer|hazel");
  assert.strictEqual(first, second);
  assert.strictEqual(Continuity.pick("run-17", "night:2|victim", ["hazel", "rosa", "tobias"]), Continuity.pick("run-17", "night:2|victim", ["hazel", "rosa", "tobias"]));
  assert.notStrictEqual(Continuity.roll("run-17", "night:2|offer|hazel"), Continuity.roll("run-18", "night:2|offer|hazel"));
  assert.throws(function () { Continuity.roll("run-17"); }, /outcome key is required/);
})();

(function dramaticPromisesCannotDisappearIntoBadLuck() {
  var ledger = baseLedger();
  ledger = Continuity.appendEvent(ledger, {
    id: "night:2:home-learned",
    type: "monster_learns_home",
    night: 2,
    location: "Home",
    actorIds: ["hazel"]
  });
  ledger = Continuity.schedulePromise(ledger, {
    id: "promise:threshold:hazel",
    kind: "threshold_visit",
    actorId: "hazel",
    createdByEventId: "night:2:home-learned",
    eligibleNight: 3,
    dueByNight: 4
  });
  assert.deepStrictEqual(Continuity.pendingPromises(ledger, { night: 2 }), []);
  assert.strictEqual(Continuity.pendingPromises(ledger, { night: 3 })[0].overdue, false);
  assert.strictEqual(Continuity.pendingPromises(ledger, { night: 5 })[0].overdue, true, "an unplayed threshold scene remains visibly owed instead of vanishing");
  ledger = Continuity.appendEvent(ledger, {
    id: "night:4:threshold",
    type: "threshold_visit",
    night: 4,
    location: "Home",
    actorIds: ["hazel"]
  });
  ledger = Continuity.fulfillPromise(ledger, "promise:threshold:hazel", "night:4:threshold");
  assert.deepStrictEqual(Continuity.pendingPromises(ledger, { night: 5 }), []);
  assert.deepStrictEqual(Continuity.validateLedger(ledger), []);
})();

(function migrationIsExplicitConservativeAndIdempotent() {
  var legacy = {
    gameId: "legacy-42",
    seed: "legacy-seed",
    npcs: [
      { id: "hazel", name: "Hazel", alive: false },
      { id: "tobias", name: "Old Tobias", alive: true }
    ],
    observations: [{ text: "legacy prose without provenance" }]
  };
  var upgraded = Continuity.upgradeRun(legacy);
  assert.strictEqual(upgraded.schemaVersion, 6);
  assert.strictEqual(upgraded.legacySchemaVersion, 5);
  assert.strictEqual(upgraded.continuity.migration.importedLegacyFacts, false, "migration never invents authoritative V6 observations from loose legacy prose");
  assert.strictEqual(Continuity.currentActorStatus(upgraded.continuity, "hazel"), "dead");
  assert.deepStrictEqual(Continuity.upgradeRun(upgraded), upgraded, "running migrations twice must not change the save");
})();

(function ledgerSurvivesSerializationExactly() {
  var ledger = baseLedger();
  ledger = Continuity.appendEvent(ledger, { id: "day:1:well", type: "village_crisis", day: 1, location: "Village Square", actorIds: ["hazel", "tobias"] });
  ledger = Continuity.recordObservation(ledger, { eventId: "day:1:well", observerId: "player" });
  var restored = Continuity.upgradeLedger(JSON.parse(JSON.stringify(ledger)));
  assert.deepStrictEqual(restored, ledger);
  assert.deepStrictEqual(Continuity.validateLedger(restored), []);
})();

(function validationDetectsAnInactiveActorInTamperedHistory() {
  var ledger = baseLedger();
  ledger = Continuity.appendEvent(ledger, {
    id: "night:1:rosa-dies",
    type: "death",
    night: 1,
    subjectIds: ["rosa"],
    statusChanges: [{ actorId: "rosa", status: "dead" }]
  });
  ledger.events.push({
    id: "day:2:rosa-speaks",
    sequence: 1,
    type: "interview_answer",
    phase: "day",
    night: null,
    day: 2,
    location: "Village Square",
    actorIds: ["rosa"],
    subjectIds: [],
    truth: {},
    statusChanges: [],
    tags: []
  });
  ledger.sequence = 2;
  assert(Continuity.validateLedger(ledger).some(function (error) { return /inactive character rosa acts/.test(error); }));
})();

console.log("v6-continuity: all tests passed");
