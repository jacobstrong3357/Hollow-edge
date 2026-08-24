"use strict";

var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var source = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");

function between(start, end) {
  var a = source.indexOf(start);
  var b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "expected source section: " + start);
  return source.slice(a, b);
}

var context = {
  console: console,
  stableIdx: function (text, len) {
    var h = 0;
    text = String(text);
    for (var i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return len ? h % len : 0;
  },
  npcById: function (state, id) { return state.npcs.find(function (npc) { return npc.id === id; }); },
};
vm.createContext(context);
vm.runInContext(between("const NIGHT_REMAIN_SCENES", "/* ---------- the raised dead"), context);

(function nightCreatesPhysicalAndHumanScenes() {
  var state = {
    gameId: "remains-test",
    npcs: [
      { id: "ansel", name: "Father Ansel", alive: true },
      { id: "rosa", name: "Rosa", alive: false },
    ],
    nightRemains: [],
  };
  context.recordMonsterNightRemain(state, 2, "Dark Forest", "bite", "frost");
  assert.strictEqual(state.nightRemains.length, 1);
  assert.strictEqual(state.nightRemains[0].sign, "bite");
  assert(/dead|bite|puncture/i.test(state.nightRemains[0].text), "monster scene is concrete");

  var director = {
    seed: "mourning-test",
    weather: "fog",
    schedules: {
      ansel: {
        actorId: "ansel",
        motive: { id: "grave_prayer", family: "grief", destination: "Graveyard", reason: "mourn Rosa", object: "a prayer ribbon" },
      },
    },
  };
  context.recordDirectorHumanRemains(state, director, { outMap: { ansel: "Graveyard" }, griefOut: { ansel: "rosa" } }, 2);
  assert.strictEqual(state.nightRemains.length, 2);
  assert.strictEqual(state.nightRemains[1].actorId, "ansel");
  assert(/Rosa's grave/.test(state.nightRemains[1].text), "mourning trace names the grave it belongs to");
})();

(function namedNotesSometimesSurviveUntilMorning() {
  var found = 0;
  var missed = 0;
  for (var i = 0; i < 100; i += 1) {
    var state = { gameId: "note-test-" + i, npcs: [{ id: "ansel", name: "Father Ansel", alive: true }], nightRemains: [] };
    var director = {
      seed: "note-test-" + i,
      weather: "storm",
      schedules: {
        ansel: {
          actorId: "ansel",
          motive: { id: "late_confession", family: "faith", destination: "Old Church", reason: "answer a confession", object: "a sealed note" },
        },
      },
    };
    context.recordDirectorHumanRemains(state, director, { outMap: { ansel: "Old Church" }, griefOut: {} }, 3);
    if (state.nightRemains.length) {
      found += 1;
      assert(/Father Ansel's name/.test(state.nightRemains[0].text));
    } else missed += 1;
  }
  assert(found > 0, "a dropped named note can remain for daylight");
  assert(missed > 0, "a carried note is not falsely dropped every night");
})();

context.monsterOf = function () { return { id: "ghoul", hunts: ["Dark Forest"] }; };
context.ev = function (text, pid, pri) { return { t: text, pid: pid, pri: pri == null ? 1 : pri }; };
context.evPlaque = function (event, rule, sign) { event.plaque = { rule: rule, sign: sign }; return event; };
context.chance = function () { return false; };
context.SIGNS = { bite: "Bite Marks" };
vm.runInContext(between("function actSearch(prev, loc)", "function actDefend(prev)"), context);

(function daylightSearchConsumesAndStampsMonsterScene() {
  var state = {
    nightNum: 2, dayNum: 2, ap: 2,
    searchCount: {}, planted: [], deaths: [], foundSigns: [], clues: [], dayEvents: [],
    nightRemains: [{ id: "monster", night: 2, location: "Dark Forest", kind: "monster", sign: "bite", weather: "frost", text: "A dead rabbit lies beside the path. Two deep punctures mark its throat." }],
    npcs: [], monster: { type: "ghoul", vid: "ansel" }, worldEvents: [], observations: [],
  };
  var next = context.actSearch(state, "Dark Forest");
  assert.strictEqual(next.ap, 1);
  assert.strictEqual(next.foundSigns.join(","), "bite");
  assert.strictEqual(next.nightRemains.length, 0, "the same carcass cannot be collected twice");
  assert.strictEqual(next.dayEvents[0].plaque.rule, "amber");
  assert.strictEqual(next.dayEvents[0].plaque.sign, "bite");
})();

(function daylightHumanFindBecomesAnInterviewThread() {
  var state = {
    nightNum: 3, dayNum: 3, ap: 2,
    searchCount: {}, planted: [], deaths: [], foundSigns: [], clues: [], dayEvents: [],
    nightRemains: [{ id: "note", night: 3, location: "Old Church", kind: "dropped", actorId: "ansel", object: "a folded note", weather: "storm", text: "Near the Old Church, you find a folded note. Father Ansel's name is written inside." }],
    npcs: [{ id: "ansel", name: "Father Ansel", alive: true }],
    monster: { type: "ghoul", vid: "greta" }, worldEvents: [], observations: [],
  };
  var next = context.actSearch(state, "Old Church");
  assert.strictEqual(next.nightRemains.length, 0);
  assert.strictEqual(next.worldEvents.length, 1);
  assert.strictEqual(next.worldEvents[0].kind, "director_finding");
  assert.strictEqual(next.worldEvents[0].actorIds.join(","), "ansel");
  assert(/Why was it there/.test(next.worldEvents[0].question));
})();

console.log("night-remains: all tests passed");
