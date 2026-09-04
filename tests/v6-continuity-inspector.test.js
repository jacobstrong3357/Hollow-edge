"use strict";

var assert = require("assert");
var Continuity = require("../v6-continuity.js");
var Inspector = require("../v6-continuity-inspector.js");

function observedRun() {
  var run = {
    gameId: "inspector-run",
    seed: "inspector-seed",
    npcs: [
      { id: "hazel", name: "Hazel", alive: true },
      { id: "tobias", name: "Old Tobias", alive: true }
    ]
  };
  run = Continuity.upgradeRun(run);
  run.continuity = Continuity.appendEvent(run.continuity, {
    id: "night:1:graveyard",
    type: "secret_visit",
    phase: "night",
    night: 1,
    location: "Graveyard",
    actorIds: ["hazel"],
    truth: { purpose: "mourning" }
  });
  run.continuity = Continuity.recordObservation(run.continuity, {
    eventId: "night:1:graveyard",
    observerId: "tobias",
    actorIdsRecognised: ["hazel"],
    factKeys: ["location", "actor"]
  });
  return run;
}

(function inspectorSeparatesTruthFromEveryObserver() {
  var run = observedRun();
  var before = JSON.stringify(run);
  var snap = Inspector.snapshot(run);
  assert.strictEqual(snap.truth.length, 1);
  assert.strictEqual(snap.observers.tobias.observations.length, 1);
  assert.strictEqual(snap.observers.player.observations.length, 0, "the player cannot inherit Tobias's sighting");
  assert.strictEqual(snap.observers.hazel.observations.length, 0, "being present is not silently converted into a recorded memory");
  assert.deepStrictEqual(snap.issues, []);
  assert.strictEqual(JSON.stringify(run), before, "opening the inspector cannot mutate the game");
})();

(function aSerializedRunProducesTheSameInspection() {
  var run = observedRun();
  var audit = Inspector.serializationAudit(run);
  assert.strictEqual(audit.ok, true);
  assert.deepStrictEqual(audit.after, audit.before);
})();

(function legacyProseRemainsOutsideCanonicalKnowledge() {
  var legacy = {
    gameId: "legacy-inspector-run",
    npcs: [{ id: "hazel", name: "Hazel", alive: false }],
    observations: [{ text: "You definitely saw Hazel at the church." }],
    memories: [{ text: "Hazel knows your secret." }],
    clues: [{ text: "The old prose says this is proof." }]
  };
  var snap = Inspector.snapshot(legacy);
  assert.strictEqual(snap.migration.importedLegacyFacts, false);
  assert.deepStrictEqual(snap.truth, [], "unproven legacy prose cannot create a truth event");
  assert.deepStrictEqual(snap.observers.player.observations, [], "unproven legacy prose cannot become player knowledge");
  assert.strictEqual(snap.observers.hazel.actor.status, "dead", "safe actor-state migration is still preserved");
})();

console.log("v6-continuity-inspector: observer and reload gates passed");
