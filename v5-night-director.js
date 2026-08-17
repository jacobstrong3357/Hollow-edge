/* Hollow's Edge V5 Night Director
 *
 * A deterministic, presentation-agnostic night simulation. The Director
 * samples the hidden night once, then reduce() only reveals or modifies that
 * plan. It has no dependency on React, the DOM, localStorage, or Math.random.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HE_NIGHT_DIRECTOR = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = 1;
  var DEFAULT_SLOTS = 7;
  var HOME = "Home";
  var SIGNS = ["claw", "tracks", "bite", "cold", "flora", "hex", "graves", "wail"];
  var GROUND_SIGNS = ["claw", "tracks", "bite", "cold", "flora", "hex", "graves"];

  var DEFAULT_GRAPH = {
    Home: ["Village Square"],
    "Village Square": [HOME, "Old Church", "Tavern", "Old Mill", "Dark Forest"],
    "Old Church": ["Village Square", "Graveyard"],
    Graveyard: ["Old Church", "Dark Forest"],
    "Dark Forest": ["Graveyard", "Old Mill", "Village Square"],
    "Old Mill": ["Dark Forest", "Village Square"],
    Tavern: ["Village Square"]
  };

  var ROLE_MOTIVES = {
    baker: [
      motive("late_bread", "work", "Village Square", "carry bread to a house where nobody has eaten", "a flour cloth and a cooling loaf"),
      motive("oven_ash", "work", "Old Mill", "fetch dry kindling before the ovens fail", "ash and split kindling"),
      motive("wake_basket", "grief", "Old Church", "leave a wake basket before the mourners arrive", "a covered basket warm through the cloth"),
      motive("borrowed_flour", "debt", "Tavern", "collect flour Liesel hid when the storehouse spoiled", "an empty flour sack and a tally")
    ],
    gravedigger: [
      motive("settle_grave", "grief", "Graveyard", "put back earth that rose after rain", "a spade and grave soil"),
      motive("measure_wall", "work", "Old Church", "measure the cracked churchyard wall", "chalk and a folding rule"),
      motive("mill_coffin_boards", "work", "Old Mill", "judge whether the new boards are dry enough for a coffin", "a carpenter's awl and wood shavings"),
      motive("return_keepsake", "personal", "Village Square", "return a keepsake found in a grave coat", "a stopped watch wrapped in rag")
    ],
    priest: [
      motive("keep_vigil", "faith", "Old Church", "keep a vigil nobody else would attend", "a prayer book and lamp oil"),
      motive("grave_prayer", "grief", "Graveyard", "finish words left unsaid at a burial", "a prayer ribbon"),
      motive("late_confession", "faith", "Village Square", "answer a confession requested through a third party", "a sealed note tucked into the prayer book"),
      motive("parish_ledger", "secret", "Tavern", "compare the parish ledger with Liesel's account of who slept there", "two pages copied from the parish ledger")
    ],
    herbalist: [
      motive("gather_yew", "medicine", "Old Church", "cut yew for a remedy before first light", "green cuttings wrapped in cloth"),
      motive("night_herbs", "medicine", "Dark Forest", "gather a plant that opens only after dark", "a bitter bundle of roots"),
      motive("fever_draught", "medicine", "Village Square", "take a fever draught to a child whose breathing worsened", "three stoppered bottles in a reed basket"),
      motive("mill_ward", "ward", "Old Mill", "replace a rowan ward somebody tore from the mill door", "red thread and a forked rowan twig")
    ],
    blacksmith: [
      motive("mend_gate", "work", "Village Square", "repair a gate whose latch keeps lifting", "iron pins and a small hammer"),
      motive("mill_fitting", "work", "Old Mill", "replace a cracked fitting before the wheel turns", "an iron collar wrapped in sacking"),
      motive("church_bolts", "work", "Old Church", "fit new bolts to a door the priest says opened by itself", "a pouch of square-headed nails"),
      motive("find_a_boy", "bond", "Dark Forest", "look for one of his boys after a dare went too far", "a boy's wool cap crushed in one fist")
    ],
    innkeeper: [
      motive("fetch_cask", "work", "Old Mill", "collect a cask hidden before the road spoiled", "a tally stick and cellar key"),
      motive("close_tavern", "work", "Tavern", "check the shutters after a frightened guest fled", "a ring of heavy keys"),
      motive("count_them_home", "duty", "Village Square", "count the last drinkers to their own doors", "a hooded lantern and a list of names"),
      motive("wake_ale", "grief", "Old Church", "leave ale for a wake before the family sees the bill", "a small cask with the mark scraped off")
    ],
    physician: [
      motive("sickbed", "medicine", "Village Square", "visit a patient whose fever worsens at night", "a black medical bag"),
      motive("meet_priest", "secret", "Old Church", "ask the priest to conceal a family's illness", "a folded medical note"),
      motive("examine_livestock", "medicine", "Old Mill", "examine an animal that stopped eating after sunset", "a leather roll of instruments"),
      motive("seek_greta", "medicine", "Dark Forest", "find Greta before a patient's lungs close", "an empty bottle labelled in his own hand")
    ],
    seamstress: [
      motive("mourning_cloth", "grief", "Graveyard", "leave repaired mourning cloth at a grave", "black cloth tied with pale thread"),
      motive("late_delivery", "work", "Village Square", "deliver a coat needed before dawn", "a paper parcel tied with red thread"),
      motive("measure_shroud", "work", "Old Church", "measure a shroud before the body stiffens", "a linen tape and a packet of pins"),
      motive("post_pages", "secret", "Tavern", "leave written pages for the carrier before he rides", "a flat parcel addressed in a man's name")
    ],
    generic: [
      motive("lost_keepsake", "personal", "Village Square", "look for a keepsake lost during the day", "a small empty pouch"),
      motive("cannot_sleep", "fear", "Old Church", "walk where the bell can still be heard", "nothing but an unlit lantern"),
      motive("check_neighbour", "bond", "Village Square", "make certain a frightened neighbour is safe", "a covered bowl and a note")
    ]
  };

  var WHISPERS = [
    "A whisper crosses behind you using your name, then tries it again in a voice you almost know.",
    "Two voices trade a single sentence beyond the hedge. One is pleading. The other only counts.",
    "Someone close to your left says, ‘Not that road.’ There is nobody close to your left.",
    "A child's rhyme comes through the shuttered houses, missing every final word.",
    "Your own voice answers a question you did not ask. The answer is, ‘Too late.’"
  ];

  var DELUSIONS = [
    "The lane narrows until the houses seem to lean together above you. One blink puts them back.",
    "Every shutter opens at once. Faces watch from each dark square. When you raise the lantern, there is only glass.",
    "A familiar figure waits ahead with their back to you. You reach the place and find a pollarded tree.",
    "Your footprints continue ahead of you for six steps, wet and fresh. They end when you stop looking at them.",
    "The church bell swings without sound. For a moment you remember being inside it. The memory is not yours."
  ];

  var STAMP_TEXT = {
    claw: "Four deep scores rake the wood. They were torn into it, not cut.",
    tracks: "Heavy prints cross the soft ground and stop where nothing could have leapt.",
    bite: "One clean bite marks what was left here. No ordinary jaw set those teeth.",
    cold: "Frost rims one patch of earth while the grass around it stays wet.",
    flora: "Everything growing within one long stride has greyed from the root.",
    hex: "A cramped working is scored into the stone. Looking at its angles makes your teeth ache.",
    graves: "Old grave earth lies on top of the road mud, fresh enough to hold a thumbprint."
  };

  function motive(id, family, destination, reason, object) {
    return { id: id, family: family, destination: destination, reason: reason, object: object };
  }

  function hashSeed(seed) {
    var text = String(seed == null ? "hollows-edge" : seed);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    return h >>> 0;
  }

  function createRng(seed) {
    var value = hashSeed(seed);
    return {
      next: function () {
        value += 0x6D2B79F5;
        var t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      int: function (min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
      },
      pick: function (items) {
        return items.length ? items[Math.floor(this.next() * items.length)] : null;
      },
      shuffle: function (items) {
        var copy = items.slice();
        for (var i = copy.length - 1; i > 0; i -= 1) {
          var j = Math.floor(this.next() * (i + 1));
          var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
        }
        return copy;
      }
    };
  }

  function keyedNumber(seed, key) {
    return createRng(String(seed) + "::" + String(key)).next();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function roleKey(villager) {
    var text = ((villager.role || "") + " " + (villager.id || "")).toLowerCase();
    var keys = Object.keys(ROLE_MOTIVES).filter(function (x) { return x !== "generic"; });
    for (var i = 0; i < keys.length; i += 1) if (text.indexOf(keys[i]) >= 0) return keys[i];
    if (villager.id === "marta") return "baker";
    if (villager.id === "tobias") return "gravedigger";
    if (villager.id === "ansel") return "priest";
    if (villager.id === "greta") return "herbalist";
    if (villager.id === "wilhelm") return "blacksmith";
    if (villager.id === "liesel") return "innkeeper";
    if (villager.id === "falk") return "physician";
    if (villager.id === "rosa") return "seamstress";
    return "generic";
  }

  function semanticSignature(parts) {
    var p = parts || {};
    var actors = (p.actors || (p.actorId ? [p.actorId] : [])).slice().sort().join("+") || "none";
    return [p.family || p.type || "event", actors, p.location || "unknown", p.interaction || "passive", p.outcome || "open"].join("|");
  }

  function noveltyScore(signature, recent) {
    var bits = signature.split("|");
    var score = 100;
    (recent || []).forEach(function (old) {
      var other = String(old).split("|");
      if (old === signature) score -= 1000;
      if (other[0] === bits[0]) score -= 16;
      if (other[2] === bits[2]) score -= 7;
      if (other[3] === bits[3]) score -= 5;
      if (other[4] === bits[4]) score -= 3;
    });
    return score;
  }

  function chooseNovel(items, signatureOf, recent, rng) {
    if (!items.length) return null;
    var ranked = rng.shuffle(items).map(function (item) {
      return { item: item, score: noveltyScore(signatureOf(item), recent) };
    });
    ranked.sort(function (a, b) { return b.score - a.score; });
    return ranked[0].item;
  }

  function shortestPath(graph, from, to) {
    if (from === to) return [from];
    var queue = [[from]];
    var seen = {}; seen[from] = true;
    while (queue.length) {
      var path = queue.shift();
      var at = path[path.length - 1];
      var next = graph[at] || [];
      for (var i = 0; i < next.length; i += 1) {
        if (seen[next[i]]) continue;
        var candidate = path.concat(next[i]);
        if (next[i] === to) return candidate;
        seen[next[i]] = true;
        queue.push(candidate);
      }
    }
    return [from, to];
  }

  function livingCast(villagers) {
    return (villagers || []).filter(function (v) { return v && v.alive !== false && !v.fled; }).map(function (v) {
      var copy = clone(v);
      copy.alive = true;
      copy.disposition = Number(copy.disposition || 0);
      return copy;
    });
  }

  function homeLocation(villager) {
    if (villager.home && DEFAULT_GRAPH[villager.home]) return villager.home;
    if (villager.id === "ansel") return "Old Church";
    if (villager.id === "liesel") return "Tavern";
    return "Village Square";
  }

  function normaliseMotive(raw, fallback) {
    if (!raw) return clone(fallback);
    return {
      id: raw.id || fallback.id,
      family: raw.family || fallback.family,
      destination: raw.destination || fallback.destination,
      reason: raw.reason || fallback.reason,
      object: raw.object || fallback.object,
      depart: raw.depart,
      duration: raw.duration,
      route: raw.route ? raw.route.slice() : null,
      claim: raw.claim || null,
      secret: !!raw.secret
    };
  }

  function motiveFor(villager, config, facts, recent, used, rng) {
    var outMap = facts.outMap || {};
    var forcedDestination = outMap[villager.id];
    var griefId = typeof facts.griefOut === "string" ? facts.griefOut : facts.griefOut && facts.griefOut.id;
    var isGrieving = !!(facts.griefOut && typeof facts.griefOut === "object" && facts.griefOut[villager.id]);
    var secretIds = Array.isArray(facts.secretOut) ? facts.secretOut : Object.keys(facts.secretOut || {}).filter(function (id) { return facts.secretOut[id]; });
    var pool = (ROLE_MOTIVES[roleKey(villager)] || ROLE_MOTIVES.generic).concat(ROLE_MOTIVES.generic);
    var specialMotive = griefId === villager.id || isGrieving || secretIds.indexOf(villager.id) >= 0;
    if (griefId === villager.id || isGrieving) pool = [motive("grief_errand", "grief", "Graveyard", "visit a grave before anyone can watch them mourn", "a private mourning token")];
    if (secretIds.indexOf(villager.id) >= 0) pool = [motive("secret_errand", "secret", forcedDestination || "Old Church", "keep a private meeting promised before the bell", "a small wrapped object")];
    if (forcedDestination && forcedDestination !== "home" && forcedDestination !== HOME) {
      var exact = specialMotive ? pool.map(function (m) { var c = clone(m); c.destination = forcedDestination; return c; }) : pool.filter(function (m) { return m.destination === forcedDestination; });
      if (exact.length) pool = exact;
      else {
        var flexible = {
          Graveyard: ["leave a private token where somebody was buried", "a small parcel wrapped against the soil"],
          "Dark Forest": ["retrieve something lost before daylight exposes the errand", "a hooded lantern and an empty satchel"],
          "Old Church": ["meet somebody beneath the bell before the village wakes", "a folded note with no name outside"],
          "Village Square": ["deliver something a frightened household needs before dawn", "a covered parcel held close"],
          Tavern: ["collect a message left with Liesel and answer none of her questions", "a sealed message and a door key"],
          "Old Mill": ["collect supplies promised before the road became unsafe", "a sacking bundle smelling of rain"]
        }[forcedDestination] || ["finish a private errand before dawn", "a small wrapped object"];
        pool = [motive("adapted_errand_" + String(forcedDestination).toLowerCase().replace(/[^a-z]+/g, "_"), "personal", forcedDestination, flexible[0], flexible[1])];
      }
    }
    if (forcedDestination === "home" || forcedDestination === HOME) {
      return motive("stays_home", "home", HOME, "remain behind a barred door", "nothing");
    }
    var picked = chooseNovel(pool, function (m) {
      return semanticSignature({ family: m.family, actorId: villager.id, location: m.destination, interaction: "errand", outcome: "unresolved" });
    }, recent.concat(used), rng) || ROLE_MOTIVES.generic[0];
    var result = normaliseMotive(villager.motive, picked);
    /* Existing sampleNight facts are the authority. An authored agenda may
       enrich the reason and prop, but it cannot move somebody away from the
       place already promised to resolveNight and the morning ledger. */
    if (forcedDestination && forcedDestination !== "home" && forcedDestination !== HOME) {
      result.destination = forcedDestination;
      result.route = null;
    }
    return result;
  }

  function buildSchedule(villager, selected, slots, graph, rng) {
    var schedule = [];
    var origin = homeLocation(villager);
    if (selected.destination === HOME) {
      for (var h = 0; h < slots; h += 1) schedule.push(HOME);
      return { actorId: villager.id, motive: selected, origin: origin, route: [HOME], depart: slots, duration: slots, slots: schedule };
    }
    var route = selected.route && selected.route.length ? selected.route.slice() : shortestPath(graph, origin, selected.destination);
    var depart = selected.depart == null ? rng.int(0, Math.min(2, slots - 1)) : Math.max(0, Math.min(slots - 1, selected.depart));
    var duration = selected.duration == null ? rng.int(1, 2) : Math.max(1, selected.duration);
    var outward = route.slice(1);
    var returnPath = route.slice(0, -1).reverse();
    for (var slot = 0; slot < slots; slot += 1) {
      /* A villager who has not left yet still occupies their real house or
         workplace. HOME is reserved for somebody wholly unavailable behind
         a barred door; it must not make an active villager vanish from the
         physical village before their errand begins. */
      if (slot < depart) schedule.push(origin);
      else {
        var step = slot - depart;
        if (step < outward.length) schedule.push(outward[step]);
        else if (step < outward.length + duration) schedule.push(selected.destination);
        else {
          var returnStep = step - outward.length - duration;
          schedule.push(returnPath[returnStep] || origin);
        }
      }
    }
    return { actorId: villager.id, motive: selected, origin: origin, route: route, depart: depart, duration: duration, slots: schedule };
  }

  function actorLocation(state, actorId, slot) {
    var schedule = state.schedules[actorId];
    if (!schedule) return null;
    var delay = (state.delays && state.delays[actorId]) || 0;
    var at = Math.max(0, Math.min(state.slots - 1, slot - delay));
    if (state.monsterSchedule.hostId === actorId && state.monsterSchedule.maskedHostSlots.indexOf(slot) >= 0) return null;
    return schedule.slots[at] || HOME;
  }

  function actorsAt(state, location, slot) {
    return state.cast.filter(function (v) { return v.alive && actorLocation(state, v.id, slot) === location; });
  }

  function makeMonsterSchedule(config, facts, slots, graph, rng) {
    var monster = clone(config.monster || {});
    var active = facts.active == null ? monster.active !== false : !!facts.active;
    var hunts = (monster.hunts || ["Graveyard", "Dark Forest", "Old Church"]).slice();
    var huntLoc = facts.huntLoc || monster.huntLocation || rng.pick(hunts);
    var attackSlot = facts.attackSlot == null ? (monster.huntSlot == null ? rng.int(Math.min(2, slots - 1), Math.max(2, slots - 2)) : monster.huntSlot) : facts.attackSlot;
    attackSlot = Math.max(0, Math.min(slots - 1, attackSlot));
    var origin = HOME;
    var route = active ? shortestPath(graph, origin, huntLoc) : [HOME];
    var locations = [];
    for (var i = 0; i < slots; i += 1) locations.push(null);
    if (active) {
      locations[attackSlot] = huntLoc;
      if (attackSlot > 0 && route.length > 2) locations[attackSlot - 1] = route[route.length - 2];
      if (attackSlot + 1 < slots && route.length > 2) locations[attackSlot + 1] = route[route.length - 2];
    }
    return {
      id: monster.id || "unknown",
      hostId: monster.hostId || monster.vid || null,
      active: active,
      signs: (monster.signs || []).filter(function (x) { return SIGNS.indexOf(x) >= 0; }),
      hunts: hunts,
      huntLoc: huntLoc,
      attackSlot: attackSlot,
      attack: monster.attack || "kill",
      attackMode: monster.attack === "both" ? (rng.next() < 0.5 ? "kill" : "turn") : (monster.attack || "kill"),
      reach: monster.reach || "out",
      route: route,
      locations: locations,
      maskedHostSlots: active ? [attackSlot] : []
    };
  }

  function makeBeat(id, type, slot, location, text, extra) {
    var beat = {
      id: id,
      type: type,
      slot: slot,
      location: location,
      text: text,
      tone: type === "threat" || type === "flee" ? "danger" : type === "stamp" ? "amber" : type === "delusion" ? "unstable" : "bone"
    };
    Object.keys(extra || {}).forEach(function (key) { beat[key] = extra[key]; });
    if (!beat.signature) beat.signature = semanticSignature({ family: type, actorId: beat.actorId, location: location, interaction: type, outcome: beat.sign || "shown" });
    return beat;
  }

  function roleClue(villager, schedule, slot, location) {
    return makeBeat("clue:" + slot + ":" + location + ":" + villager.id, "clue", slot, location,
      "You find " + schedule.motive.object + ". It suggests why someone came here, not what they are.", {
        actorId: villager.id,
        tone: "bone",
        meta: { motiveFamily: schedule.motive.family },
        signature: semanticSignature({ family: schedule.motive.family, actorId: villager.id, location: location, interaction: "find", outcome: "object" })
      });
  }

  function makeDiscoverySchedule(seed, stateLike, config, rng) {
    var table = {};
    function add(beat) {
      var key = beat.slot + "|" + beat.location;
      if (!table[key]) table[key] = [];
      table[key].push(beat);
    }
    var forced = config.forcedBeats || [];
    forced.forEach(function (raw, index) {
      if (raw.type === "stamp" && (stateLike.monsterSchedule.signs.indexOf(raw.sign) < 0 || raw.sign === "wail")) return;
      add(makeBeat(raw.id || "forced:" + index, raw.type, raw.slot, raw.location, raw.text || (raw.type === "stamp" ? STAMP_TEXT[raw.sign] : "Something in the dark refuses a simple explanation."), raw));
    });
    for (var slot = 0; slot < stateLike.slots; slot += 1) {
      var locs = Object.keys(stateLike.graph).filter(function (x) { return x !== HOME; });
      for (var l = 0; l < locs.length; l += 1) {
        var location = locs[l];
        var key = slot + "|" + location;
        if (table[key] && table[key].length) continue;
        var present = stateLike.cast.filter(function (v) { return stateLike.schedules[v.id].slots[slot] === location; });
        if (present.length && keyedNumber(seed, "clue:" + key) < 0.19) {
          var clueActor = rng.pick(present);
          add(roleClue(clueActor, stateLike.schedules[clueActor.id], slot, location));
        }
        if (stateLike.monsterSchedule.active && location === stateLike.monsterSchedule.huntLoc && keyedNumber(seed, "stamp:" + key) < 0.28) {
          var real = stateLike.monsterSchedule.signs.filter(function (x) { return GROUND_SIGNS.indexOf(x) >= 0; });
          var sign = rng.pick(real);
          if (sign) add(makeBeat("stamp:" + key, "stamp", slot, location, STAMP_TEXT[sign], { sign: sign }));
        }
        if (keyedNumber(seed, "whisper:" + key) < 0.12) add(makeBeat("whisper:" + key, "whisper", slot, location, rng.pick(WHISPERS)));
        if (stateLike.player.afflicted && keyedNumber(seed, "delusion:" + key) < 0.24) add(makeBeat("delusion:" + key, "delusion", slot, location, rng.pick(DELUSIONS), { reliability: "unreliable" }));
      }
    }
    return table;
  }

  function createNight(config) {
    config = config || {};
    var seed = config.seed == null ? "hollows-edge-night" : config.seed;
    var rng = createRng(seed);
    var slots = Math.max(4, Number(config.slots || DEFAULT_SLOTS));
    var facts = clone(config.currentFacts || {});
    var graph = clone(config.graph || DEFAULT_GRAPH);
    var cast = livingCast(config.villagers || []);
    var recent = (config.recentSignatures || []).slice();
    var used = [];
    var schedules = {};
    cast.forEach(function (villager) {
      var selected = motiveFor(villager, config, facts, recent, used, rng);
      var schedule = buildSchedule(villager, selected, slots, graph, rng);
      schedules[villager.id] = schedule;
      used.push(semanticSignature({ family: selected.family, actorId: villager.id, location: selected.destination, interaction: "errand", outcome: "unresolved" }));
    });
    var monsterSchedule = makeMonsterSchedule(config, facts, slots, graph, rng);
    var priorities = {};
    for (var slot = 0; slot < slots; slot += 1) {
      priorities[slot] = { player: keyedNumber(seed, "attack:" + slot + ":player") };
      cast.forEach(function (v) { priorities[slot][v.id] = keyedNumber(seed, "attack:" + slot + ":" + v.id); });
    }
    var state = {
      version: VERSION,
      seed: String(seed),
      night: Number(config.night || 1),
      slots: slots,
      weather: facts.weather || config.weather || "still",
      phase: "planned",
      cursor: -1,
      graph: graph,
      cast: cast,
      schedules: schedules,
      delays: {},
      monsterSchedule: monsterSchedule,
      attackPriorities: priorities,
      resolvedAttackSlots: [],
      player: {
        location: HOME,
        alive: true,
        afflicted: !!(config.player && config.player.afflicted),
        affliction: config.player && config.player.affliction || null,
        monsterSawYou: !!(config.player && config.player.monsterSawYou),
        route: [{ slot: -1, location: HOME }]
      },
      currentFacts: facts,
      beats: [],
      currentBeat: null,
      pendingThreat: null,
      ledgers: { truth: [], observations: [], memories: {} },
      found: { stamps: [], clues: [], whispers: [], delusions: [] },
      recentSignatures: recent,
      usedSignatures: used,
      actionHistory: [],
      outcomes: {},
      discoverySchedule: {}
    };
    cast.forEach(function (v) { state.ledgers.memories[v.id] = []; });
    for (var s = 0; s < slots; s += 1) {
      state.outcomes[s] = {
        flee: keyedNumber(seed, "outcome:" + s + ":flee"),
        hide: keyedNumber(seed, "outcome:" + s + ":hide"),
        intervene: keyedNumber(seed, "outcome:" + s + ":intervene"),
        sign: keyedNumber(seed, "outcome:" + s + ":sign")
      };
    }
    state.discoverySchedule = makeDiscoverySchedule(seed, state, config, rng);
    state.ledgers.truth.push({ id: "night-plan", slot: -1, kind: "plan", weather: state.weather, active: monsterSchedule.active, huntLoc: monsterSchedule.huntLoc, attackSlot: monsterSchedule.attackSlot });
    return state;
  }

  function fromExistingFacts(config, facts) {
    var merged = clone(config || {});
    merged.currentFacts = clone(facts || {});
    return createNight(merged);
  }

  function appendTruth(state, event) {
    state.ledgers.truth.push(event);
    return event;
  }

  function appendObservation(state, observation) {
    state.ledgers.observations.push(observation);
    return observation;
  }

  function appendBeat(state, beat) {
    if (!beat) return null;
    var sig = beat.signature;
    if (sig && (state.recentSignatures.indexOf(sig) >= 0 || state.usedSignatures.indexOf(sig) >= 0)) return null;
    state.beats.push(beat);
    state.currentBeat = beat;
    if (sig) state.usedSignatures.push(sig);
    return beat;
  }

  function memoryInterpretation(villager, acknowledged) {
    if (acknowledged && villager.disposition >= 1) return "They can place you here and are inclined to say so.";
    if (acknowledged && villager.disposition <= -1) return "They can place you here, but distrust why you came.";
    if (acknowledged) return "They can place you here if they choose to speak.";
    if (villager.disposition <= -1) return "They remember you lingering and supply their own reason for it.";
    if (villager.disposition >= 1) return "They remember your lantern and may defend the timing.";
    return "They remember a familiar lantern but cannot swear what you intended.";
  }

  function recordEncounter(state, villager, slot, acknowledged, kind) {
    var id = "encounter:" + slot + ":" + villager.id + ":" + (acknowledged ? "met" : "seen");
    if (state.ledgers.truth.some(function (x) { return x.id === id; })) return;
    var truth = appendTruth(state, { id: id, slot: slot, kind: kind || "crossed_paths", location: state.player.location, actors: ["player", villager.id], acknowledged: !!acknowledged });
    appendObservation(state, { eventId: truth.id, slot: slot, kind: acknowledged ? "meeting" : "sighting", location: state.player.location, actors: [villager.id], clarity: acknowledged ? "clear" : "partial", reliability: "direct" });
    state.ledgers.memories[villager.id].push({ eventId: truth.id, slot: slot, subject: "player", kind: acknowledged ? "meeting" : "sighting", location: state.player.location, clarity: acknowledged ? "clear" : "partial", acknowledged: !!acknowledged, interpretation: memoryInterpretation(villager, acknowledged) });
    appendBeat(state, makeBeat(id, "encounter", slot, state.player.location,
      acknowledged ? villager.name + " stops beneath your lantern and answers your greeting." : "A familiar figure crosses your lantern at the edge of the road.", {
        actorId: villager.id,
        truthEventId: truth.id,
        signature: semanticSignature({ family: "encounter", actorId: villager.id, location: state.player.location, interaction: acknowledged ? "hail" : "glimpse", outcome: "mutual" })
      }));
  }

  function processDiscoveries(state, action, slot) {
    var key = slot + "|" + state.player.location;
    var entries = state.discoverySchedule[key] || [];
    entries.forEach(function (beat) {
      var reveal = (beat.type === "stamp" || beat.type === "clue") ? action.type === "SEARCH" : beat.type === "whisper" ? action.type === "LISTEN" : beat.type === "delusion";
      if (!reveal) return;
      if (beat.type === "stamp" && state.found.stamps.length) return;
      var shown = appendBeat(state, clone(beat));
      if (!shown) return;
      if (beat.type === "stamp") state.found.stamps.push({ sign: beat.sign, slot: slot, location: beat.location, beatId: beat.id });
      if (beat.type === "clue") state.found.clues.push(clone(beat));
      if (beat.type === "whisper") state.found.whispers.push(clone(beat));
      if (beat.type === "delusion") state.found.delusions.push(clone(beat));
      appendObservation(state, { eventId: beat.truthEventId || null, beatId: beat.id, slot: slot, kind: beat.type, location: beat.location, actors: beat.actorId ? [beat.actorId] : [], clarity: beat.type === "delusion" ? "unstable" : "clear", reliability: beat.type === "delusion" ? "unreliable" : "direct", sign: beat.sign || null, text: beat.text });
    });
  }

  function chooseVictim(state, candidates, slot) {
    var priorities = state.attackPriorities[slot] || {};
    return candidates.slice().sort(function (a, b) { return (priorities[a] || 1) - (priorities[b] || 1); })[0] || null;
  }

  function actualSign(state, slot) {
    var signs = state.monsterSchedule.signs.filter(function (x) { return x !== "wail"; });
    if (!signs.length) signs = state.monsterSchedule.signs.slice();
    if (!signs.length) return null;
    return signs[Math.floor((state.outcomes[slot].sign || 0) * signs.length) % signs.length];
  }

  function killVillager(state, victimId, slot, witnessed) {
    var victim = state.cast.find(function (x) { return x.id === victimId; });
    if (!victim || !victim.alive) return;
    var turned = state.monsterSchedule.attackMode === "turn";
    if (turned) {
      victim.changed = true;
      victim.afflicted = true;
    } else victim.alive = false;
    var sign = actualSign(state, slot);
    var event = appendTruth(state, { id: "attack:" + slot + ":" + victimId, slot: slot, kind: turned ? "changed" : "slain", location: state.monsterSchedule.huntLoc, actors: [state.monsterSchedule.hostId, victimId].filter(Boolean), victimId: victimId, sign: sign, witnessed: !!witnessed });
    if (witnessed) {
      appendObservation(state, { eventId: event.id, slot: slot, kind: "attack_aftermath", location: event.location, actors: [victimId], clarity: "partial", reliability: "direct", sign: sign });
      appendBeat(state, makeBeat("aftermath:" + slot + ":" + victimId, "aftermath", slot, event.location,
        victim.name + " falls beyond the lantern. What moved there is already gone, but the ground keeps one mark.", { actorId: victimId, sign: sign, truthEventId: event.id }));
    }
  }

  function processAttack(state, slot) {
    var monster = state.monsterSchedule;
    if (!monster.active || slot !== monster.attackSlot || state.resolvedAttackSlots.indexOf(slot) >= 0) return;
    var location = monster.huntLoc;
    var villagers = actorsAt(state, location, slot).filter(function (v) { return v.id !== monster.hostId && v.alive && !v.changed; }).map(function (v) { return v.id; });
    var playerHere = state.player.alive && state.player.location === location && state.player.location !== HOME;
    var candidates = villagers.concat(playerHere ? ["player"] : []);
    var victim = chooseVictim(state, candidates, slot);
    if (!victim) {
      state.resolvedAttackSlots.push(slot);
      appendTruth(state, { id: "hunt-empty:" + slot, slot: slot, kind: "hunt_empty", location: location, actors: [monster.hostId].filter(Boolean) });
      return;
    }
    if (playerHere) {
      state.pendingThreat = { id: "threat:" + slot + ":" + victim, slot: slot, location: location, victimId: victim, kind: victim === "player" ? "player" : "witness", sign: actualSign(state, slot) };
      state.phase = "threat";
      state.player.monsterSawYou = true;
      appendBeat(state, makeBeat(state.pendingThreat.id, "threat", slot, location,
        victim === "player" ? "The village sound cuts out. Something is between you and the road home." : "A shape closes the distance behind " + (state.cast.find(function (x) { return x.id === victim; }) || { name: "your neighbour" }).name + ". It has not seen your choice yet.",
        { actorId: victim === "player" ? null : victim, sign: state.pendingThreat.sign }));
      return;
    }
    state.resolvedAttackSlots.push(slot);
    killVillager(state, victim, slot, false);
  }

  function arrive(state, action, slot) {
    state.player.route.push({ slot: slot, location: state.player.location, action: action.type });
    appendTruth(state, { id: "player:" + slot + ":" + action.type.toLowerCase(), slot: slot, kind: "player_action", action: action.type, location: state.player.location, actorId: action.actorId || null });
    actorsAt(state, state.player.location, slot).filter(function (v) { return v.id !== state.monsterSchedule.hostId || slot !== state.monsterSchedule.attackSlot; }).forEach(function (v) {
      recordEncounter(state, v, slot, action.type === "HAIL" && action.actorId === v.id, action.type === "HAIL" ? "hailed" : "crossed_paths");
    });
    processDiscoveries(state, action, slot);
    processAttack(state, slot);
  }

  function finishIfNeeded(state) {
    if (state.phase === "active" && state.cursor >= state.slots - 1) {
      state.phase = "complete";
      state.player.location = HOME;
      appendTruth(state, { id: "night-complete", slot: state.cursor, kind: "returned_home", location: HOME });
    }
  }

  function settleAfterReturn(state) {
    /* Going home ends the player's access to the lanes, not the village's
       night. Advance the remaining clock with the player safely behind the
       abstract Home boundary so scheduled meetings, empty hunts and attacks
       still become truth for dawn. */
    state.player.location = HOME;
    for (var slot = state.cursor + 1; slot < state.slots; slot += 1) {
      state.cursor = slot;
      processAttack(state, slot);
      /* With the player at Home, processAttack cannot create a player-facing
         threat. Keep this guard for malformed imported plans. */
      if (state.phase === "threat") {
        state.pendingThreat = null;
        state.phase = "active";
      }
    }
    state.phase = "complete";
    return state;
  }

  function invalid(state, action, reason) {
    var copy = clone(state);
    copy.lastError = { action: action && action.type, reason: reason };
    return copy;
  }

  function resolveThreat(state, action) {
    var threat = state.pendingThreat;
    if (!threat) return invalid(state, action, "There is no threat to resolve.");
    var outcome = state.outcomes[threat.slot];
    if (threat.kind === "witness") {
      if (action.type === "INTERVENE") {
        var saved = outcome.intervene < 0.35;
        appendTruth(state, { id: "intervene:" + threat.slot, slot: threat.slot, kind: "intervention", location: threat.location, actors: ["player", threat.victimId], succeeded: saved });
        appendBeat(state, makeBeat("intervene-beat:" + threat.slot, "flee", threat.slot, threat.location,
          saved ? "You shout. Your neighbour breaks for the wall, and the dark follows the louder courage instead of the easier body." : "You shout. The figure turns, but not quickly enough. The night takes the distance back.", { actorId: threat.victimId, outcome: saved ? "saved" : "failed" }));
        if (!saved) killVillager(state, threat.victimId, threat.slot, true);
      } else if (action.type === "IGNORE" || action.type === "FLEE") {
        killVillager(state, threat.victimId, threat.slot, true);
        appendBeat(state, makeBeat("flee-witness:" + threat.slot, "flee", threat.slot, threat.location, "You run while the sound behind you becomes an event the village must survive in the morning.", { actorId: threat.victimId, outcome: "abandoned" }));
      } else return invalid(state, action, "Choose whether to intervene or leave.");
      state.resolvedAttackSlots.push(threat.slot);
      state.pendingThreat = null;
      state.phase = "active";
      state.player.location = action.type === "FLEE" ? HOME : state.player.location;
      if (action.type === "FLEE") state.phase = "complete";
      return state;
    }
    if (action.type !== "FLEE" && action.type !== "HIDE") return invalid(state, action, "Run or hide.");
    var roll = action.type === "FLEE" ? outcome.flee : outcome.hide;
    var survival = action.type === "FLEE" ? roll >= 0.18 : roll >= 0.25;
    appendTruth(state, { id: "escape:" + threat.slot + ":" + action.type.toLowerCase(), slot: threat.slot, kind: "escape", method: action.type.toLowerCase(), location: threat.location, succeeded: survival });
    appendBeat(state, makeBeat("escape-beat:" + threat.slot + ":" + action.type.toLowerCase(), "flee", threat.slot, threat.location,
      survival ? (action.type === "FLEE" ? "You run without choosing a road. Branches strike your face. The tread behind you stops only at the first barred door." : "You fold into the dark and keep still while breathing passes close enough to warm your hair.") : "The path gives you three strides. Something behind you needs only two.", { outcome: survival ? "escaped" : "caught" }));
    state.resolvedAttackSlots.push(threat.slot);
    state.pendingThreat = null;
    if (survival) {
      state.player.location = HOME;
      state.player.route.push({ slot: threat.slot, location: HOME, action: action.type });
      state.phase = "complete";
    } else {
      state.player.alive = false;
      state.phase = "dead";
      appendTruth(state, { id: "player-death:" + threat.slot, slot: threat.slot, kind: "player_slain", location: threat.location, actors: [state.monsterSchedule.hostId, "player"].filter(Boolean) });
    }
    return state;
  }

  function reduce(state, action) {
    if (!state || !action || !action.type) return invalid(state || {}, action || {}, "An action type is required.");
    var next = clone(state);
    /* currentBeat is a one-action presentation payload, not a sticky scene.
       Clear it before advancing so an uneventful move cannot repeat the last
       villager's words or discovery on the following screen. */
    next.currentBeat = null;
    next.lastError = null;
    if (next.phase === "dead" || next.phase === "complete") return invalid(next, action, "The night has ended.");
    if (next.phase === "threat") return resolveThreat(next, action);
    var legal = availableActions(next).some(function (x) { return x.type === action.type && (!x.actorId || x.actorId === action.actorId) && (!x.to || x.to === action.to); });
    if (!legal) return invalid(next, action, "That action is not available now.");
    if (action.type === "GO_HOME") {
      next.player.location = HOME;
      next.player.route.push({ slot: next.cursor, location: HOME, action: "GO_HOME" });
      appendTruth(next, { id: "go-home:" + next.cursor, slot: next.cursor, kind: "returned_home", location: HOME });
      return settleAfterReturn(next);
    }
    var slot = next.cursor + 1;
    if (action.type === "LEAVE") {
      next.phase = "active";
      next.player.location = action.to || "Village Square";
    } else if (action.type === "MOVE") {
      next.player.location = action.to;
    } else if (action.type === "FOLLOW") {
      var destination = actorLocation(next, action.actorId, slot);
      next.player.location = destination && destination !== HOME ? destination : next.player.location;
    } else if (action.type === "HAIL") {
      next.delays[action.actorId] = (next.delays[action.actorId] || 0) + 1;
    }
    next.cursor = slot;
    next.actionHistory.push({ slot: slot, type: action.type, to: action.to || null, actorId: action.actorId || null });
    arrive(next, action, slot);
    finishIfNeeded(next);
    return next;
  }

  function action(type, label, tone, extra) {
    var result = { type: type, label: label, tone: tone || "bone" };
    Object.keys(extra || {}).forEach(function (key) { result[key] = extra[key]; });
    return result;
  }

  function availableActions(state) {
    if (!state || state.phase === "dead" || state.phase === "complete") return [];
    if (state.phase === "planned") {
      return (state.graph[HOME] || ["Village Square"]).map(function (to) { return action("LEAVE", "Step into the night", "amber", { to: to }); });
    }
    if (state.phase === "threat") {
      if (state.pendingThreat.kind === "witness") return [
        action("INTERVENE", "Shout a warning", "danger"),
        action("IGNORE", "Stay silent", "quiet"),
        action("FLEE", "Run for home", "danger")
      ];
      return [action("FLEE", "Run", "danger"), action("HIDE", "Hide and hold your breath", "quiet")];
    }
    var result = [];
    (state.graph[state.player.location] || []).filter(function (to) { return to !== HOME; }).forEach(function (to) {
      result.push(action("MOVE", "Go to the " + to, "bone", { to: to }));
    });
    result.push(action("WAIT", "Wait and watch", "quiet"));
    result.push(action("SEARCH", "Search by lantern", "amber"));
    result.push(action("LISTEN", "Lower the lantern and listen", "quiet"));
    actorsAt(state, state.player.location, state.cursor).forEach(function (v) {
      result.push(action("HAIL", "Hail " + v.name, "bone", { actorId: v.id }));
      result.push(action("FOLLOW", "Follow " + v.name, "quiet", { actorId: v.id }));
    });
    result.push(action("GO_HOME", "Go home and bar the door", "bone"));
    return result;
  }

  function visibleState(state) {
    return {
      version: state.version,
      night: state.night,
      weather: state.weather,
      phase: state.phase,
      slot: state.cursor,
      location: state.player.location,
      currentBeat: state.currentBeat,
      beats: state.beats.slice(),
      actions: availableActions(state),
      found: clone(state.found),
      observations: clone(state.ledgers.observations),
      pendingThreat: state.pendingThreat ? { kind: state.pendingThreat.kind, victimId: state.pendingThreat.victimId, location: state.pendingThreat.location } : null
    };
  }

  function validateNight(state) {
    var issues = [];
    var living = {};
    state.cast.forEach(function (v) { living[v.id] = true; });
    Object.keys(state.schedules).forEach(function (id) {
      if (!living[id]) issues.push("A dead or fled villager was scheduled: " + id);
      if (state.schedules[id].slots.length !== state.slots) issues.push("Schedule length does not match night slots: " + id);
      if (!state.schedules[id].motive || !state.schedules[id].motive.reason) issues.push("Schedule has no motive: " + id);
    });
    Object.keys(state.discoverySchedule).forEach(function (key) {
      state.discoverySchedule[key].forEach(function (beat) {
        if (beat.type === "stamp" && beat.sign === "wail") issues.push("Unearthly Wailing was placed on the ground: " + beat.id);
        if (beat.type === "stamp" && state.monsterSchedule.signs.indexOf(beat.sign) < 0) issues.push("A stamped sign is not left by the real monster: " + beat.id);
      });
    });
    var duplicates = {};
    state.usedSignatures.forEach(function (sig) { duplicates[sig] = (duplicates[sig] || 0) + 1; });
    Object.keys(duplicates).forEach(function (sig) { if (duplicates[sig] > 1) issues.push("Repeated semantic signature: " + sig); });
    if (state.monsterSchedule.active && !state.monsterSchedule.huntLoc) issues.push("An active monster has no hunting location.");
    return issues;
  }

  return Object.freeze({
    version: VERSION,
    SIGNS: SIGNS.slice(),
    GROUND_SIGNS: GROUND_SIGNS.slice(),
    DEFAULT_GRAPH: clone(DEFAULT_GRAPH),
    createRng: createRng,
    semanticSignature: semanticSignature,
    noveltyScore: noveltyScore,
    livingCast: livingCast,
    createNight: createNight,
    fromExistingFacts: fromExistingFacts,
    reduce: reduce,
    availableActions: availableActions,
    actorAt: actorLocation,
    actorsAt: actorsAt,
    visibleState: visibleState,
    validateNight: validateNight
  });
});
