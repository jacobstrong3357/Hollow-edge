"use strict";

var assert = require("assert");
var Director = require("../v5-night-director.js");
var Continuity = require("../v6-continuity.js");
var Adapter = require("../v6-director-adapter.js");
var RunContinuity = require("../v6-run-continuity.js");

var LOCATIONS = ["Village Square", "Old Church", "Graveyard", "Dark Forest", "Old Mill", "Tavern"];
var CAST = [
  ["rosa", "Rosa", "the Seamstress", "Village Square"],
  ["falk", "Doctor Falk", "the Physician", "Village Square"],
  ["ansel", "Father Ansel", "the Priest", "Old Church"],
  ["tobias", "Old Tobias", "the Gravedigger", "Graveyard"],
  ["liesel", "Liesel", "the Innkeeper", "Tavern"],
  ["marta", "Marta", "the Baker", "Village Square"],
  ["wilhelm", "Wilhelm", "the Miller", "Old Mill"],
  ["greta", "Greta", "the Herbalist", "Dark Forest"]
].map(function (row, index) {
  return { id: row[0], name: row[1], role: row[2], home: row[3], build: ["slight", "stout", "tall", "stooped"][index % 4], alive: true, disposition: index % 3 - 1 };
});

var CAMPAIGNS = [
  { name: "careful homebody", monster: "wraith", signs: ["cold", "tracks", "wail"], attack: "kill", reach: "out", choices: ["KEEP_BARRED", "FLEE", "HIDE", "GO_HOME", "REACH_HOME", "WAIT", "KEEP_WATCH"] },
  { name: "methodical investigator", monster: "vampire", signs: ["bite", "claw", "graves"], attack: "turn", reach: "invite", choices: ["INSPECT_CLUE", "SEARCH", "SEARCH_ON", "HAIL", "FOLLOW", "RESPOND_ATTACK_SETUP", "INTERVENE", "INVESTIGATE_HERE", "SHOW_BODY_EVIDENCE", "GO_HOME", "REACH_HOME", "KEEP_BARRED"] },
  { name: "door watcher", monster: "doppel", signs: ["claw", "bite", "wail"], attack: "turn", reach: "home", choices: ["FOLLOW", "KEEP_WATCH", "HAIL", "RESPOND_ATTACK_SETUP", "INTERVENE", "INVESTIGATE_HERE", "GO_HOME", "REACH_HOME", "KEEP_BARRED"] },
  { name: "reckless witness", monster: "werewolf", signs: ["claw", "bite", "tracks"], attack: "kill", reach: "out", relentless: true, choices: ["FOLLOW", "WATCH_MONSTER", "CONFRONT_MONSTER", "SACRIFICE", "RESPOND_ATTACK_SETUP", "RUN", "BREAK_LINE", "HIDE", "STEP_OUTSIDE", "ANSWER_DOOR", "GO_HOME", "REACH_HOME"] },
  { name: "social truth-tester", monster: "witch", signs: ["flora", "hex", "graves"], attack: "turn", reach: "home", choices: ["HAIL", "RESPOND_ATTACK_SETUP", "FOLLOW", "LINGER_AFTER_FOLLOW", "IDENTIFY_FIGURE", "LISTEN", "SEARCH", "SEARCH_ON", "INTERVENE", "INVESTIGATE_HERE", "GO_HOME", "REACH_HOME", "KEEP_BARRED"] }
];

function livingCast(run, night) {
  if (!run) return CAST.map(function (actor) { return Object.assign({}, actor); });
  var projected = { npcs: CAST.map(function (actor) { return Object.assign({}, actor, { alive: true, turned: false, changed: false, fled: false }); }), continuity: run };
  RunContinuity.syncRunActors(projected);
  return projected.npcs.filter(function (actor) { return actor.alive && !actor.fled && !actor.turned; }).map(function (actor, index) {
    return Object.assign({}, actor, {
      disposition: actor.disposition == null ? index % 3 - 1 : actor.disposition,
      motive: {
        id: "campaign-motive-" + night + "-" + actor.id,
        family: index % 2 ? "work" : "grief",
        destination: LOCATIONS[(night + index * 2) % LOCATIONS.length],
        reason: index % 2 ? "finish an errand before dawn" : "leave a token for the dead",
        object: index % 2 ? "a wrapped tool" : "a sprig of yew",
        depart: index % 3,
        duration: 4
      }
    });
  });
}

function intentFor(campaignIndex, night, villagers) {
  if (campaignIndex === 2) {
    var watched = villagers.find(function (actor) { return actor.id === "wilhelm"; }) || villagers.find(function (actor) { return actor.id !== "greta"; });
    return watched ? { kind: "watch", id: watched.id, target: watched.home, actorName: watched.name } : { kind: "search", loc: "Old Mill", target: "Old Mill" };
  }
  var target = LOCATIONS[(campaignIndex + night * 2) % LOCATIONS.length];
  return { kind: "search", loc: target, target: target };
}

function makeConfig(campaign, campaignIndex, night, villagers, intent) {
  var host = villagers.find(function (actor) { return actor.id === "greta"; }) || villagers[0];
  var quarry = villagers.find(function (actor) { return actor.id !== host.id && (!intent.id || actor.id === intent.id); })
    || villagers.find(function (actor) { return actor.id !== host.id; });
  var active = night !== 2;
  var huntLoc = intent.kind === "watch" ? intent.target : intent.target;
  var outMap = {};
  villagers.forEach(function (actor, index) { outMap[actor.id] = active && (actor.id === quarry.id || index % 3 === night % 3) ? huntLoc : "home"; });
  var forcedBeats = [];
  if (intent.kind === "watch" && quarry) {
    forcedBeats.push({ id: "watch-setup:" + night + ":" + quarry.id, type: "watch", slot: 0, location: intent.target, actorId: quarry.id, text: "You settle outside " + quarry.name + "'s door.", meta: { setup: true, critical: true } });
    if (active) forcedBeats.push({ id: "watch-departure:" + night + ":" + quarry.id, type: "watch", slot: 1, location: intent.target, actorId: quarry.id, text: quarry.name + "'s door opens. They step into the lane.", meta: { departure: true, critical: true } });
  } else {
    forcedBeats.push({ id: "search-find:" + night, type: "clue", slot: 1, location: intent.target, text: "A broken clasp lies beneath the wall.", meta: { inspectable: true, siteObject: true, object: "a broken clasp", critical: true } });
  }
  return {
    seed: "readiness-" + campaignIndex + "-night-" + night,
    night: night,
    slots: 6,
    villagers: villagers,
    openingIntent: intent.kind === "watch" ? { kind: "watch", id: intent.id } : { kind: "search", loc: intent.loc },
    player: { targeted: campaignIndex === 3 && active, monsterSawYou: campaignIndex === 3 && night > 1 },
    monster: { id: campaign.monster, hostId: host.id, active: active, signs: campaign.signs, hunts: [huntLoc], attack: campaign.attack, reach: campaign.reach, relentless: !!campaign.relentless, huntSlot: 2, rescueDoor: true },
    currentFacts: { weather: ["still", "fog", "storm", "frost"][(campaignIndex + night) % 4], active: active, huntLoc: active ? huntLoc : null, attackSlot: active ? 2 : null, guaranteedVictimId: active && quarry ? quarry.id : null, outMap: outMap },
    forcedBeats: forcedBeats,
    thresholdEvent: night === 3 ? { roll: 0.1, rescueRoll: 0.8, visitorRoll: 0.2, visitorKind: campaignIndex === 3 ? "monster" : "neighbour", purpose: campaignIndex === 3 ? "lure" : "concern" } : null
  };
}

function choiceFor(actions, campaign, step) {
  for (var index = 0; index < campaign.choices.length; index += 1) {
    var type = campaign.choices[index];
    var candidates = actions.filter(function (action) { return action.type === type; });
    if (candidates.length) return candidates[step % candidates.length];
  }
  return actions[step % actions.length];
}

function textAudit(state, label) {
  var beat = state.currentBeat;
  if (!beat) return;
  assert(!/\b(undefined|null|NaN)\b|\[object Object\]/.test(beat.text || ""), label + " has malformed visible prose: " + beat.text);
  assert(beat.text && beat.text.trim().length > 0, label + " has an empty visible beat");
  if (state.phase === "attack_setup") {
    var actor = state.cast.find(function (entry) { return entry.id === beat.actorId; });
    assert(actor && actor.alive && !actor.changed, label + " opens an ordinary conversation on an unavailable actor");
  }
  if (beat.meta && beat.meta.witnessedMethod) {
    assert(!new RegExp(state.monsterSchedule.id, "i").test(beat.text), label + " names the hidden creature in witnessed attack prose");
  }
}

function uniqueAudit(state, label) {
  var truthIds = state.ledgers.truth.map(function (entry) { return entry.id; });
  var beatIds = state.beats.map(function (entry) { return entry.id; });
  assert.strictEqual(new Set(truthIds).size, truthIds.length, label + " duplicates a truth event id");
  assert.strictEqual(new Set(beatIds).size, beatIds.length, label + " duplicates a visible beat id");
}

function guideFor(intent, state, intentDone, searches, interacted) {
  var actor = state.currentBeat && state.currentBeat.actorId ? state.cast.find(function (entry) { return entry.id === state.currentBeat.actorId; }) : null;
  return { kind: intent.kind, target: intent.target, actorId: actor && actor.id, actorName: intent.actorName || null, intentDone: intentDone, searches: searches, interacted: interacted };
}

var report = [];
CAMPAIGNS.forEach(function (campaign, campaignIndex) {
  var continuity = null;
  var totals = { name: campaign.name, nights: 0, completed: 0, dead: 0, choices: 0, scenes: new Set(), relationships: 0, findings: 0, investigations: 0 };
  for (var night = 1; night <= 4; night += 1) {
    var villagers = livingCast(continuity, night);
    if (villagers.length < 2) break;
    var intent = intentFor(campaignIndex, night, villagers);
    var state = Director.createNight(makeConfig(campaign, campaignIndex, night, villagers, intent));
    var intentDone = false;
    var searches = {};
    var interacted = {};
    var step = 0;
    while (state.phase !== "complete" && state.phase !== "dead" && step < 80) {
      var guide = guideFor(intent, state, intentDone, searches, interacted);
      var actions = Director.guidedActions(state, guide);
      assert(actions.length, campaign.name + " Night " + night + " has no guided continuation in phase " + state.phase);
      var actionKeys = actions.map(function (action) { return action.type + "|" + action.label; });
      assert.strictEqual(new Set(actionKeys).size, actionKeys.length, campaign.name + " Night " + night + " repeats a visible choice");
      var chosen = choiceFor(actions, campaign, step);
      var before = JSON.parse(JSON.stringify(state));
      state = Director.reduce(state, chosen);
      assert.strictEqual(state.lastError, null, campaign.name + " Night " + night + " rejected visible choice " + chosen.label);
      assert.deepStrictEqual(Director.validateNight(state), [], campaign.name + " Night " + night + " became invalid after " + chosen.label);
      textAudit(state, campaign.name + " Night " + night);
      uniqueAudit(state, campaign.name + " Night " + night);
      if (state.currentBeat) totals.scenes.add(state.currentBeat.type);
      totals.choices += 1;
      if (state.player.location === intent.target && (chosen.type === "SEARCH" || chosen.type === "SEARCH_ON" || chosen.type === "KEEP_WATCH" || chosen.type === "FOLLOW" || chosen.type === "WAIT")) intentDone = true;
      if (chosen.type === "SEARCH" && chosen.searchMode) searches[chosen.searchMode] = true;
      if (chosen.actorId) interacted[chosen.actorId + "|" + chosen.type] = true;
      if (step % 3 === 1 && state.phase !== "complete" && state.phase !== "dead") {
        var restored = Director.upgradeState(JSON.parse(JSON.stringify(state)));
        assert.deepStrictEqual(restored, JSON.parse(JSON.stringify(state)), campaign.name + " Night " + night + " changes during save migration");
        assert.deepStrictEqual(Director.guidedActions(restored, guideFor(intent, restored, intentDone, searches, interacted)), Director.guidedActions(state, guideFor(intent, state, intentDone, searches, interacted)), campaign.name + " Night " + night + " changes visible choices after reload");
        state = restored;
      }
      assert.notDeepStrictEqual(state, before, campaign.name + " Night " + night + " visible choice had no effect");
      step += 1;
    }
    assert(step < 80, campaign.name + " Night " + night + " loops without reaching an ending");
    assert(state.phase === "complete" || state.phase === "dead", campaign.name + " Night " + night + " did not terminate");
    totals.nights += 1;
    totals[state.phase === "complete" ? "completed" : "dead"] += 1;
    var projection = Director.consequenceProjection(state);
    totals.relationships += projection.relationships.length;
    totals.findings += projection.findings.length;
    totals.investigations += projection.investigations.length;
    continuity = Adapter.projectDirectorNight(continuity, state, { runId: "readiness-campaign-" + campaignIndex, actors: CAST });
    assert.deepStrictEqual(Continuity.validateLedger(continuity), [], campaign.name + " Night " + night + " produced invalid continuity");
    if (state.phase === "dead") break;
  }
  totals.scenes = Array.from(totals.scenes).sort();
  report.push(totals);
});

console.log(JSON.stringify(report, null, 2));
