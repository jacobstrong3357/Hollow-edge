"use strict";

var assert = require("assert");
var Director = require("../v5-night-director.js");

var locations = ["Village Square", "Old Church", "Graveyard", "Dark Forest", "Old Mill", "Tavern"];
var weathers = ["still", "fog", "storm", "frost"];
var monsters = [
  { id: "werewolf", signs: ["tracks", "claw", "bite"] },
  { id: "vampire", signs: ["bite", "cold", "graves"] },
  { id: "night-hag", signs: ["hex", "cold", "claw"] },
  { id: "ghoul", signs: ["tracks", "graves", "bite"] },
  { id: "wraith", signs: ["cold", "hex", "graves"] }
];

var cast = [
  ["rosa", "Rosa", "the Seamstress", "Village Square"],
  ["falk", "Doctor Falk", "the Physician", "Old Mill"],
  ["ansel", "Father Ansel", "the Priest", "Old Church"],
  ["tobias", "Old Tobias", "the Gravedigger", "Graveyard"],
  ["liesel", "Liesel", "the Innkeeper", "Tavern"],
  ["marta", "Marta", "the Baker", "Village Square"],
  ["wilhelm", "Wilhelm", "the Blacksmith", "Old Mill"],
  ["greta", "Greta", "the Herbalist", "Dark Forest"]
].map(function (entry, index) {
  return {
    id: entry[0], name: entry[1], role: entry[2], home: entry[3], alive: true,
    disposition: index % 3 - 1,
    motive: {
      id: "stress-motive-" + entry[0],
      family: index % 2 ? "work" : "grief",
      destination: locations[(index + 2) % locations.length],
      reason: index % 2 ? "finish a task before dawn" : "leave something for the dead",
      object: index % 2 ? "a wrapped tool" : "a sprig of yew",
      depart: index % 3,
      duration: 3 + index % 3
    }
  };
});

var policy = [
  "SEARCH", "SEARCH_ON", "INSPECT_CLUE", "IDENTIFY_FIGURE", "HAIL", "FOLLOW",
  "LISTEN", "KEEP_WATCH", "WAIT", "INVESTIGATE_HERE", "INTERVENE",
  "SHOW_BODY_EVIDENCE", "PLEAD_INNOCENCE", "RESPOND_ATTACK_SETUP",
  "WATCH_MONSTER", "DISTRACT", "CONFRONT_MONSTER", "RUN", "HIDE", "FLEE",
  "LOOK_THROUGH", "ANSWER_DOOR", "STEP_OUTSIDE", "INVITE_IN", "KEEP_BARRED",
  "LINGER_AFTER_FOLLOW", "GO_HOME", "REACH_HOME", "MOVE", "LEAVE"
];

function configFor(run) {
  var monster = monsters[run % monsters.length];
  var active = run % 4 !== 0;
  var huntLoc = locations[(run * 5 + 1) % locations.length];
  return {
    seed: "qa-playthrough-" + run,
    night: 1 + run % 12,
    slots: 5 + run % 4,
    villagers: cast,
    player: {
      afflicted: run % 7 === 0,
      affliction: run % 7 === 0 ? "echoes" : null,
      targeted: active && run % 9 === 0,
      monsterSawYou: active && run % 11 === 0
    },
    monster: {
      id: monster.id,
      hostId: cast[(run * 3) % cast.length].id,
      active: active,
      signs: monster.signs,
      hunts: [huntLoc],
      attack: run % 3 === 0 ? "turn" : "kill",
      reach: run % 2 ? "out" : "any",
      huntSlot: 1 + run % 3
    },
    currentFacts: {
      weather: weathers[run % weathers.length],
      active: active,
      huntLoc: active ? huntLoc : null,
      attackSlot: active ? 1 + run % 3 : null
    },
    gathering: run % 5 === 0 ? {
      id: "stress-market-" + run,
      name: "market eve",
      location: locations[(run + 3) % locations.length],
      text: "Market eve gathers the village beneath a line of lamps.",
      distantText: "Market eve is underway across the village."
    } : null,
    forcedBeats: run % 6 === 0 ? [{
      id: "stress-whisper-" + run,
      type: "whisper",
      slot: 1,
      location: locations[run % locations.length],
      text: "A voice on the far side of the wall repeats your last footstep."
    }] : []
  };
}

function chooseAction(state, actions, run, step) {
  if (state.phase === "planned") return actions[(run * 7) % actions.length];
  if (step > 70) {
    var exit = actions.find(function (action) { return action.type === "GO_HOME" || action.type === "REACH_HOME" || action.type === "KEEP_BARRED"; });
    if (exit) return exit;
  }
  var start = (run * 11 + step * 7) % policy.length;
  for (var offset = 0; offset < policy.length; offset += 1) {
    var wanted = policy[(start + offset) % policy.length];
    var candidates = actions.filter(function (action) { return action.type === wanted; });
    if (candidates.length) return candidates[(run + step) % candidates.length];
  }
  return actions[(run + step) % actions.length];
}

(function oneHundredSerializedPlaythroughs() {
  var terminal = { complete: 0, dead: 0 };
  var coverage = new Set();

  for (var run = 0; run < 100; run += 1) {
    var state = Director.createNight(configFor(run));
    assert.deepStrictEqual(Director.validateNight(state), [], "run " + run + " starts valid");

    var step = 0;
    while (state.phase !== "complete" && state.phase !== "dead" && step < 100) {
      var actions = Director.availableActions(state);
      assert(actions.length > 0, "run " + run + " has a legal continuation in phase " + state.phase);
      var selected = chooseAction(state, actions, run, step);
      coverage.add(selected.type);
      state = Director.reduce(state, selected);
      assert.strictEqual(state.lastError, null, "run " + run + " accepted advertised action " + selected.type);
      assert.deepStrictEqual(Director.validateNight(state), [], "run " + run + " remains valid after " + selected.type);

      if (step % 4 === 2) {
        state = Director.upgradeState(JSON.parse(JSON.stringify(state)));
        assert.deepStrictEqual(Director.validateNight(state), [], "run " + run + " survives save/restore at step " + step);
      }
      step += 1;
    }

    assert(step < 100, "run " + run + " reaches an ending without looping");
    assert(state.phase === "complete" || state.phase === "dead", "run " + run + " ends in a terminal phase");
    terminal[state.phase] += 1;
    var projection = Director.consequenceProjection(state);
    ["encounters", "relationships", "findings", "secrets", "investigations"].forEach(function (key) {
      assert(Array.isArray(projection[key]), "run " + run + " produces a " + key + " ledger");
    });
  }

  assert.strictEqual(terminal.complete + terminal.dead, 100, "all 100 runs terminate");
  assert(coverage.size >= 12, "the stress pass covers varied choices rather than one happy path");
})();

console.log("night-director: 100 serialized playthroughs passed");
