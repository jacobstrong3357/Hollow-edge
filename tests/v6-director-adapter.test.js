"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Director = require("../v5-night-director.js");
var Continuity = require("../v6-continuity.js");
var Adapter = require("../v6-director-adapter.js");

var actors = [
  { id: "hazel", name: "Hazel", alive: true },
  { id: "tobias", name: "Old Tobias", alive: true },
  { id: "rosa", name: "Rosa", alive: true }
];

function config(seed) {
  return {
    seed: seed,
    night: 2,
    slots: 4,
    villagers: actors.map(function (actor, index) {
      return {
        id: actor.id,
        name: actor.name,
        role: "the Villager",
        alive: true,
        home: index === 0 ? "Dark Forest" : index === 1 ? "Graveyard" : "Old Mill",
        motive: {
          id: "motive-" + actor.id,
          family: "work",
          destination: index === 0 ? "Dark Forest" : index === 1 ? "Graveyard" : "Old Mill",
          reason: "finish an errand",
          object: "a wrapped tool",
          depart: 0,
          duration: 4
        }
      };
    }),
    player: {},
    monster: {
      id: "ghoul",
      hostId: "hazel",
      active: false,
      signs: ["tracks", "graves", "bite"],
      hunts: ["Graveyard"],
      attack: "kill",
      reach: "out",
      huntSlot: 2
    },
    currentFacts: { weather: "fog", active: false, outMap: { hazel: "Dark Forest", tobias: "Graveyard", rosa: "Old Mill" } },
    forcedBeats: []
  };
}

function take(state, wanted) {
  var legal = Director.availableActions(state).find(function (action) {
    return action.type === wanted.type && (wanted.to == null || action.to === wanted.to) && (wanted.actorId == null || action.actorId === wanted.actorId);
  });
  assert(legal, "expected action " + JSON.stringify(wanted));
  return Director.reduce(state, wanted);
}

(function aCompletedNightBecomesDurableCanonicalHistory() {
  var state = Director.createNight(config("v6-adapter-complete"));
  state = take(state, { type: "LEAVE", to: "Village Square" });
  state = take(state, { type: "GO_HOME" });
  state = take(state, { type: "REACH_HOME" });
  if (state.phase === "threshold") state = take(state, { type: "KEEP_BARRED" });
  assert.strictEqual(state.phase, "complete");
  var ledger = Adapter.projectDirectorNight(null, state, { runId: "run-adapter", actors: actors });
  state.ledgers.truth.forEach(function (event) {
    assert(Continuity.eventById(ledger, Adapter.eventIdFor(state, event.id)), "truth event is imported: " + event.id);
  });
  assert.deepStrictEqual(Continuity.validateLedger(ledger), []);
})();

(function oneSidedSightingsNeverBecomePlayerKnowledge() {
  var state = Director.createNight(config("v6-adapter-one-sided"));
  state.ledgers.truth.push({
    id: "encounter:0:tobias:unseen",
    slot: 0,
    kind: "passed_unseen",
    location: "Old Church",
    actors: ["player", "tobias"],
    acknowledged: false,
    playerSaw: false
  });
  state.ledgers.memories.tobias.push({
    eventId: "encounter:0:tobias:unseen",
    slot: 0,
    subject: "player",
    kind: "sighting",
    location: "Old Church",
    clarity: "one_sided",
    acknowledged: false
  });
  state.phase = "complete";
  var ledger = Adapter.projectDirectorNight(null, state, { runId: "run-one-sided", actors: actors });
  var eventId = Adapter.eventIdFor(state, "encounter:0:tobias:unseen");
  assert.strictEqual(Continuity.observedEvent(ledger, "tobias", eventId), true);
  assert.strictEqual(Continuity.observedEvent(ledger, "player", eventId), false);
  assert.strictEqual(Continuity.playerCanRaiseEvent(ledger, eventId), false);
  assert.strictEqual(Adapter.playerCanRaiseLegacyEvent(ledger, {
    eventId: "n2:encounter:tobias:old-church",
    sourceEventIds: ["encounter:0:tobias:unseen"],
    night: 2,
    kind: "director_encounter"
  }), false, "the compatibility interview tray obeys V6 knowledge instead of its copied playerSaw flag");
})();

(function aSeenEncounterCanStillBecomeAnInterviewQuestion() {
  var state = Director.createNight(config("v6-adapter-seen"));
  state.ledgers.truth.push({
    id: "encounter:0:tobias:seen",
    slot: 0,
    kind: "crossed_paths",
    location: "Old Church",
    actors: ["player", "tobias"],
    acknowledged: false,
    playerSaw: true
  });
  state.ledgers.observations.push({
    eventId: "encounter:0:tobias:seen",
    slot: 0,
    kind: "sighting",
    location: "Old Church",
    actors: ["tobias"],
    clarity: "partial",
    reliability: "direct"
  });
  state.phase = "complete";
  var ledger = Adapter.projectDirectorNight(null, state, { runId: "run-seen", actors: actors });
  assert.strictEqual(Adapter.playerCanRaiseLegacyEvent(ledger, {
    eventId: "n2:encounter:tobias:old-church",
    sourceEventIds: ["encounter:0:tobias:seen"],
    night: 2,
    kind: "director_encounter"
  }), true);
})();

(function preV6NightsRemainCompatibleUntilTheyAreImported() {
  var ledger = Continuity.createLedger({ runId: "migrated-v5", actors: actors });
  assert.strictEqual(Adapter.playerCanRaiseLegacyEvent(ledger, {
    eventId: "legacy-event",
    night: 1,
    kind: "director_encounter"
  }), true, "an empty migration ledger cannot erase questions earned in an older build");
})();

(function physicalAndPlantedMarksKeepDifferentTruth() {
  var state = Director.createNight(config("v6-adapter-evidence"));
  state.ledgers.truth.push({
    id: "real-mark",
    slot: 1,
    kind: "investigated_attack",
    location: "Graveyard",
    actors: ["player", "rosa"],
    victimId: "rosa",
    clueFound: true,
    sign: "graves"
  });
  state.ledgers.observations.push({
    eventId: "real-mark",
    beatId: "grave-dirt-beat",
    slot: 1,
    kind: "attack_aftermath",
    location: "Graveyard",
    actors: ["rosa"],
    clarity: "clear",
    reliability: "direct",
    sign: "graves"
  });
  state.found.stamps.push({ sign: "graves", slot: 1, location: "Graveyard", beatId: "grave-dirt-beat" });
  state.ledgers.truth.push({
    id: "false-mark",
    slot: 2,
    kind: "planted_false_mark",
    location: "Old Church",
    sign: "hex",
    night: 2,
    actors: ["hazel"]
  });
  state.phase = "complete";
  var ledger = Adapter.projectDirectorNight(null, state, { runId: "run-evidence", actors: actors });
  var genuine = ledger.evidence.find(function (evidence) { return evidence.sign === "graves"; });
  var planted = ledger.evidence.find(function (evidence) { return evidence.sign === "hex"; });
  assert(genuine && genuine.authenticity === "genuine" && genuine.discoveredBy.includes("player"));
  assert(planted && planted.authenticity === "planted" && !planted.discoveredBy.includes("player"));
  assert.deepStrictEqual(ledger.journal.stamps, [], "Director discoveries remain unstamped until the player chooses to write them down");
})();

(function inspectedObjectsCarryTheirCanonicalSourceIntoInterviews() {
  var state = Director.createNight(config("v6-adapter-object"));
  state.ledgers.truth.push({
    id: "clue-inspected:wrapped-tool",
    slot: 1,
    kind: "clue_inspected",
    location: "Graveyard",
    actors: ["player", "tobias"],
    actorId: "tobias"
  });
  state.ledgers.observations.push({
    eventId: "clue-inspected:wrapped-tool",
    beatId: "wrapped-tool:inspected",
    slot: 1,
    kind: "evidence",
    location: "Graveyard",
    actors: ["tobias"],
    clarity: "clear",
    reliability: "direct"
  });
  state.found.clues.push({
    id: "wrapped-tool:inspected",
    beatId: "wrapped-tool:inspected",
    slot: 1,
    location: "Graveyard",
    actorId: "tobias",
    text: "The folding rule carries Tobias's initials.",
    meta: { object: "chalk and a folding rule", inspected: true }
  });
  state.phase = "complete";
  var projection = Director.consequenceProjection(state);
  var finding = projection.findings.find(function (entry) { return entry.actorId === "tobias"; });
  assert.deepStrictEqual(finding.sourceEventIds, ["clue-inspected:wrapped-tool"]);
  var ledger = Adapter.projectDirectorNight(null, state, { runId: "run-object", actors: actors });
  assert.strictEqual(Adapter.playerCanRaiseLegacyEvent(ledger, finding), true, "an inspected object's interview question is backed by the observation that identified it");
})();

(function derivedDoorstepFactsRemainPlayerKnowledge() {
  var state = Director.createNight(config("v6-adapter-threshold-memory"));
  state.ledgers.truth.push(
    { id: "threshold-arrival:4", slot: 4, kind: "threshold_arrival", location: "Home", actorId: "hazel", visitorKind: "monster", thresholdKind: "knock" },
    { id: "threshold-monster-visit:4:hazel", slot: 4, kind: "threshold_monster_visit", location: "Home", actorId: "hazel", subjectId: "hazel", actors: ["player", "hazel"], text: "Hazel came to the door." },
    { id: "threshold-missing-report:4", slot: 4, kind: "threshold_missing_report", location: "Home", actorId: "hazel", reporterId: "hazel", subjectId: "rosa", actors: ["player", "hazel", "rosa"], text: "Hazel said Rosa was missing." }
  );
  state.phase = "complete";
  var ledger = Adapter.projectDirectorNight(null, state, { runId: "run-threshold-memory", actors: actors });
  ["threshold-arrival:4", "threshold-monster-visit:4:hazel", "threshold-missing-report:4"].forEach(function (rawId) {
    assert.strictEqual(Continuity.playerCanRaiseEvent(ledger, Adapter.eventIdFor(state, rawId)), true, rawId + " is remembered by the player");
  });
  var reportEvent = Continuity.eventById(ledger, Adapter.eventIdFor(state, "threshold-missing-report:4"));
  assert(reportEvent.actorIds.includes("hazel"), "the reporter participates in the canonical event");
})();

(function aSharedRescueGivesBothParticipantsTheSameMemory() {
  var state = Director.createNight(config("v6-adapter-shared-rescue"));
  state.ledgers.truth.push({
    id: "investigated:rescue:rosa", slot: 4, kind: "investigated_attack", location: "Old Mill",
    actors: ["player", "tobias"], victimId: "rosa", attackEventId: "attack:rosa",
    sharedDiscovery: true, rescueReporterId: "tobias", corroboratingWitnessIds: ["tobias"]
  });
  state.ledgers.memories.tobias.push({
    eventId: "investigated:rescue:rosa", slot: 4, subject: "player", kind: "shared_body_discovery",
    location: "Old Mill", clarity: "clear", acknowledged: true
  });
  state.phase = "complete";
  var ledger = Adapter.projectDirectorNight(null, state, { runId: "run-shared-rescue", actors: actors });
  var eventId = Adapter.eventIdFor(state, "investigated:rescue:rosa");
  assert.strictEqual(Continuity.sharedObservation(ledger, "player", "tobias", eventId), true);
  assert.strictEqual(Continuity.playerCanRaiseEvent(ledger, eventId), true);
})();

(function recognitionAndRelationshipKnowledgeRemainActorSpecific() {
  var state = Director.createNight(config("v6-adapter-awareness"));
  state.ledgers.truth.push(
    { id: "hailed:hazel", slot: 1, kind: "hailed", location: "Village Square", actors: ["player", "hazel"] },
    { id: "monster-reveal-choice:2", slot: 2, kind: "monster_reveal_choice", location: "Graveyard", actorId: "hazel", actors: ["player", "hazel"], learnedIdentity: true, identityVisible: false, seenByMonster: true, wrongName: true },
    { id: "site-intrusion:parcel", slot: 3, kind: "intrusion_witnessed", location: "Old Mill", actorId: "tobias", actors: ["player", "tobias"] }
  );
  state.ledgers.observations.push({
    eventId: "hailed:hazel", slot: 1, kind: "meeting", location: "Village Square", actors: ["hazel"], clarity: "clear", reliability: "direct"
  });
  state.phase = "complete";
  var ledger = Adapter.projectDirectorNight(null, state, { runId: "run-awareness", actors: actors });
  var revealId = Adapter.eventIdFor(state, "monster-reveal-choice:2");
  var intrusionId = Adapter.eventIdFor(state, "site-intrusion:parcel");
  assert.strictEqual(Continuity.sharedObservation(ledger, "player", "hazel", revealId), true, "the reveal is mutual");
  assert.strictEqual(Continuity.observedEvent(ledger, "tobias", intrusionId), true, "the witness owns the intrusion memory");
  assert.strictEqual(Continuity.observedEvent(ledger, "rosa", intrusionId), false, "unrelated villagers do not inherit it");
})();

(function playerDeathAndVillagerDeathProjectAsStatuses() {
  var state = Director.createNight(config("v6-adapter-deaths"));
  state.ledgers.truth.push({ id: "rosa-dies", slot: 1, kind: "slain", location: "Old Mill", actors: ["hazel", "rosa"], victimId: "rosa", sign: "bite" });
  state.ledgers.truth.push({ id: "player-dies", slot: 2, kind: "player_slain", location: "Old Mill", actors: ["hazel", "player"] });
  state.phase = "dead";
  state.player.alive = false;
  var ledger = Adapter.projectDirectorNight(null, state, { runId: "run-deaths", actors: actors });
  assert.strictEqual(Continuity.currentActorStatus(ledger, "rosa"), "dead");
  assert.strictEqual(Continuity.currentActorStatus(ledger, "player"), "dead");
  assert.deepStrictEqual(Continuity.validateLedger(ledger), []);
})();

(function thePlayableBuildRunsV6BeforeTheLegacyDaylightProjection() {
  var source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var continuityScript = source.indexOf('<script src="v6-continuity.js?v=1"></script>');
  var adapterScript = source.indexOf('<script src="v6-director-adapter.js?v=1"></script>');
  var gameScript = source.indexOf('<script type="text/babel" data-presets="react">');
  assert(continuityScript > 0 && continuityScript < adapterScript && adapterScript < gameScript, "the continuity dependencies load before the playable game");
  var v6Write = source.indexOf("HE_V6_DIRECTOR_ADAPTER.projectDirectorNight");
  var legacyWrite = source.indexOf("HE_DIRECTOR.consequenceProjection(director)");
  assert(v6Write > 0 && v6Write < legacyWrite, "the canonical V6 history is written before the temporary V5 daylight adapter");
  assert(/run = HE_CONTINUITY\.upgradeRun\(run\)/.test(source), "saved V5 runs receive a conservative V6 ledger on load");
  assert(/s\.continuity = HE_CONTINUITY\.createLedger/.test(source), "new playable runs begin with canonical continuity");
})();

console.log("v6-director-adapter: all tests passed");
