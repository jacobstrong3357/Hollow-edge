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

  var VERSION = 5;
  var DEFAULT_SLOTS = 7;
  var HOME = "Home";
  var SIGNS = ["claw", "tracks", "bite", "cold", "flora", "hex", "graves", "wail"];
  var GROUND_SIGNS = ["claw", "tracks", "bite", "cold", "flora", "hex", "graves"];

  /* Weather is a rule of the night, not a decorative label. These values are
     consumed by the same deterministic seed as routes and attacks, so a foggy
     silhouette cannot become a named witness at dawn and a storm cannot wash
     away a mark in prose while leaving the full search odds untouched. */
  var WEATHER_PROFILES = {
    still: { visibility: 0.94, stampChance: 0.28, clueChance: 0.19, whisperChance: 0.12 },
    fog: { visibility: 0.44, stampChance: 0.22, clueChance: 0.15, whisperChance: 0.15 },
    storm: { visibility: 0.64, stampChance: 0.12, clueChance: 0.12, whisperChance: 0.04 },
    frost: { visibility: 0.97, stampChance: 0.43, clueChance: 0.23, whisperChance: 0.08 }
  };

  function weatherProfile(state) {
    return WEATHER_PROFILES[state && state.weather] || WEATHER_PROFILES.still;
  }

  function weatherDiscoveryText(state, beat) {
    if (!beat || !state || state.weather === "still") return beat && beat.text;
    var lead = {
      fog: {
        stamp: "You almost pass it: the fog has flattened the ground to grey.",
        clue: "You find it only when the lantern is nearly over it.",
        whisper: "The fog brings the voice close and leaves its direction behind.",
        delusion: "In the fog, hedges and gateposts resemble figures until the lantern is close."
      },
      storm: {
        stamp: "Under the lee of the wall, one mark has survived the rain.",
        clue: "The rain has worried at it, but not erased it.",
        whisper: "Between two thunderclaps, a few words reach you.",
        delusion: "Lightning fixes the sight in white, then takes it away."
      },
      frost: {
        stamp: "Frost outlines every edge of the mark.",
        clue: "Frost rims the object where a warm hand set it down.",
        whisper: "In the brittle silence, the smallest voice carries.",
        delusion: "Your breath crosses the lantern and the shape changes behind it."
      }
    }[state.weather];
    return ((lead && lead[beat.type]) ? lead[beat.type] + " " : "") + (beat.text || "");
  }

  function weatherEncounterText(state, villager, acknowledged) {
    if (acknowledged) {
      if (state.weather === "storm") return villager.name + " has to come beneath your lantern and raise their voice over the rain before the greeting can be understood.";
      if (state.weather === "fog") return villager.name + " comes close enough for you to see their face. They answer your greeting without lowering their hood.";
      if (state.weather === "frost") return villager.name + " stops in the blue light, breath showing between you, and answers your greeting.";
      return villager.name + " stops beneath your lantern and answers your greeting.";
    }
    if (state.weather === "fog") return "A familiar-sized silhouette crosses the lantern's blurred edge. You cannot see the face before the figure is gone.";
    if (state.weather === "storm") return "Lightning gives you a familiar coat and a bowed head for one white instant. Rain takes the face before you can name it.";
    if (state.weather === "frost") return villager.name + " crosses the hard blue lane. Their breath and bootprints remain visible after the rest of them has passed.";
    return "A familiar figure crosses your lantern at the edge of the road.";
  }

  function weatherMonsterText(state, mode, distance) {
    var near = distance === "near";
    if (state.weather === "fog") return near
      ? "The fog presses inward. A silhouette forms inside it much too close, while breathing sounds closer still."
      : "The far lane is hidden by fog. Something large moves through it without showing a whole shape.";
    if (state.weather === "storm") return near
      ? "Thunder breaks directly overhead. In the flash, something is between you and home; the rain has hidden every sound of its approach."
      : "A gate slams under the thunder. Whatever moves beyond it is drowned by rain before you can judge its pace.";
    if (state.weather === "frost") return near
      ? "The frozen road creaks under weight that is not yours. A second breath clouds behind you, then stops."
      : "Across the frost, a new line of prints appears one by one. No body stands above them.";
    return mode === "beast"
      ? "Wet breath sounds beyond the lantern, followed by a low growl."
      : mode === "speaker" ? "A voice moves along the hedge without showing who carries it." : "The village sound thins around an unseen passing.";
  }

  var DEFAULT_GRAPH = {
    /* Every named place has its own back-lane approach. Choosing a destination
       begins the lived night there; intermediate map nodes are reserved for
       events the player elects to pursue, never imposed as silent transit. */
    Home: ["Village Square", "Old Church", "Graveyard", "Dark Forest", "Old Mill", "Tavern"],
    "Village Square": [HOME, "Old Church", "Graveyard", "Dark Forest", "Old Mill", "Tavern"],
    "Old Church": [HOME, "Village Square", "Graveyard", "Dark Forest", "Old Mill", "Tavern"],
    Graveyard: [HOME, "Village Square", "Old Church", "Dark Forest", "Old Mill", "Tavern"],
    "Dark Forest": [HOME, "Village Square", "Old Church", "Graveyard", "Old Mill", "Tavern"],
    "Old Mill": [HOME, "Village Square", "Old Church", "Graveyard", "Dark Forest", "Tavern"],
    Tavern: [HOME, "Village Square", "Old Church", "Graveyard", "Dark Forest", "Old Mill"]
  };

  /* Search modes remain mechanical underneath so evidence can obey consistent
     rules. The player-facing choices name only the parts of the place they can
     actually explore; they never announce the category of clue being rolled. */
  var SITE_SEARCH_CHOICES = {
    "Village Square": {
      ground: "Circle the well and market stalls",
      edges: "Check the alleys and shuttered doorways",
      onward: "Make another circuit of the Square"
    },
    "Old Church": {
      ground: "Walk the churchyard paths and outer wall",
      edges: "Circle the locked church: porch, vestry latch, low windows",
      onward: "Circle the church once more"
    },
    Graveyard: {
      ground: "Walk the newer graves and narrow paths",
      edges: "Check the old plots and boundary wall",
      onward: "Take another row of graves"
    },
    "Dark Forest": {
      ground: "Follow the game trail between the trees",
      edges: "Push through the bracken beside the path",
      onward: "Go farther beneath the trees"
    },
    "Old Mill": {
      ground: "Trace the millrace through the wheel-yard",
      edges: "Check the wheel, store shed, and barred doors",
      onward: "Make another turn around the mill"
    },
    Tavern: {
      ground: "Cross the stable yard and wagon shelter",
      edges: "Check the cellar hatch and back windows",
      onward: "Search the yard once more"
    }
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

  var DELUSION_SEQUENCES = [
    [
      "Your footprints continue six paces ahead of you.",
      "The last print turns sideways. Its toe points directly at you.",
      "You raise the lantern. There are no prints ahead, only your own behind. The road is unbroken mud. It was not real."
    ],
    [
      "Every shutter on the lane opens together.",
      "A face waits in each black square, all of them wearing the same expression.",
      "A cart rattles through the lane. The shutters are closed and dust lies thick on every latch. No one was there."
    ],
    [
      "Someone you buried is standing beneath the next tree.",
      "They lift one hand and point behind you.",
      "You turn back. The road is empty. When you face the tree again, it is only a torn coat caught on a branch. You did not see the dead."
    ],
    [
      "The church bell swings above you without making a sound.",
      "For one breath you remember being inside it while something struck the bronze around you.",
      "Then sound returns: insects, wind, your own pulse. The bell is still. The memory was not yours, and it was not real."
    ]
  ];

  var THRESHOLD_EVENTS = [
    {
      kind: "knock",
      text: "Three knocks touch the door. When you reach the shutter, the fourth does not come.",
      look: "You ease the shutter wide enough for one eye. The step is empty. Something moves away only after you stop looking for movement.",
      answer: "‘Who is there?’ The words leave your mouth. From the other side, in your own voice: ‘Nobody now.’"
    },
    {
      kind: "breath",
      text: "Slow breathing sounds against the door. Between breaths, something shifts its weight against the wood.",
      look: "The breathing stops when the shutter moves. The frost on the outer latch is already melting.",
      answer: "You ask what it wants. The breath takes the shape of a laugh and moves to the window beside you."
    },
    {
      kind: "latch",
      text: "The outer latch lifts once, settles, then lifts again with exquisite care. The bolt does not move.",
      look: "Nothing stands on the step. The latch hangs perfectly still until you turn your back on it.",
      answer: "You tell it the door is barred. Something outside tests the sentence with one gentle push, then leaves."
    },
    {
      kind: "familiar_voice",
      text: "A familiar voice says your name from the step. It belongs to somebody you left alive in the village. It does not ask to come in.",
      look: "The step is empty. Far down the lane, a figure reaches the corner without making the walk between.",
      answer: "You answer the voice by name. It repeats each syllable slowly, then goes quiet."
    }
  ];

  var THRESHOLD_ITEMS = [
    "your glove",
    "a button from your coat",
    "your scarf pin",
    "a strip of your lantern wick"
  ];

  var STAMP_TEXT = {
    claw: "Four deep scores rake the wood. They were torn into it, not cut.",
    tracks: "Heavy prints cross the soft ground and stop where nothing could have leapt.",
    bite: "A dead fox lies beside the path. One bite broke its ribs; no ordinary jaw set those teeth.",
    cold: "Frost rims one patch of earth while the grass around it stays wet.",
    flora: "Everything growing within one long stride has greyed from the root.",
    hex: "A cramped working is scored into the stone. Looking at its angles makes your teeth ache.",
    graves: "Old grave earth lies on top of the road mud, fresh enough to hold a thumbprint."
  };

  /* Watching the revealed host earns a sign by showing the action that made
     it. Search copy describes evidence already left behind; these lines show
     the monster producing that evidence in front of the player. */
  var MONSTER_WORK_TEXT = {
    claw: "It braces one hand against a gate. Four claws open through its fingers and score the wood.",
    tracks: "It crosses soft ground on feet too heavy for its body. Each print sinks deep.",
    bite: "It pins a dead fox and bites once through the ribs. The jaw is far too wide.",
    cold: "It presses one palm to the road. Frost spreads from its fingers across the wet earth.",
    flora: "It passes through the weeds. Every stem it touches greys and folds at the root.",
    hex: "It scratches a cramped symbol into the stone with one nail. The finished angles make your teeth ache.",
    graves: "It digs bare hands into the verge. Fresh grave earth spills from beneath its nails."
  };

  var LAST_WORDS = [
    "‘I knew the voice.’",
    "‘It was already waiting.’",
    "‘Do not follow the breathing.’",
    "‘The lantern went out first.’",
    "‘It came from behind me.’",
    "‘Tell them I tried to run.’"
  ];

  var CHANGED_AFTERMATH_REPLIES = [
    function (name) { return name + " turns at their name. Their mouth forms an answer, but no voice comes."; },
    function (name) { return name + " looks at you without recognition, then slowly gets to their feet."; },
    function (name) { return name + " whispers, ‘Go home.’ The voice is theirs. The empty stare is not."; },
    function (name) { return name + " flinches from the lantern, but not from the blood beside them."; },
    function (name) { return name + " says your name once, without recognition, and turns toward the road."; }
  ];

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
      /* Most sampled destinations use the shortest direct lane. A deliberate
         corridor lead may supply one intermediate location so the player can
         meet the villager before deciding whether to follow. */
      result.route = villager.motive && villager.motive.route ? villager.motive.route.slice() : null;
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
      /* Some monsters have a rhythm the player may redirect but never cancel.
         The werewolf's third-night hunt is the first such hard law. */
      relentless: monster.relentless == null ? monster.id === "werewolf" : !!monster.relentless,
      reach: monster.reach || "out",
      voice: clone(monster.voice || { mode: "silent" }),
      revealText: monster.revealText || null,
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
      add(makeBeat(raw.id || "forced:" + index, raw.type, raw.slot, raw.location, raw.text || (raw.type === "stamp" ? STAMP_TEXT[raw.sign] : "You find a mark you cannot identify."), raw));
    });
    for (var slot = 0; slot < stateLike.slots; slot += 1) {
      var locs = Object.keys(stateLike.graph).filter(function (x) { return x !== HOME; });
      for (var l = 0; l < locs.length; l += 1) {
        var location = locs[l];
        var key = slot + "|" + location;
        if (table[key] && table[key].length) continue;
        var present = stateLike.cast.filter(function (v) {
          var schedule = stateLike.schedules[v.id];
          if (!schedule || schedule.slots[slot] !== location) return false;
          /* A private errand is not automatically a discoverable secret.
             It enters the clue pool only when the legacy night's own
             secret-catch roll authorised a real reveal. */
          return schedule.motive.family !== "secret" || !!(v.dialogue && v.dialogue.revealsSecret);
        });
        var wxProfile = weatherProfile(stateLike);
        if (present.length && keyedNumber(seed, "clue:" + key) < wxProfile.clueChance) {
          var clueActor = rng.pick(present);
          add(roleClue(clueActor, stateLike.schedules[clueActor.id], slot, location));
        }
        if (stateLike.monsterSchedule.active && location === stateLike.monsterSchedule.huntLoc && keyedNumber(seed, "stamp:" + key) < wxProfile.stampChance) {
          var real = stateLike.monsterSchedule.signs.filter(function (x) { return GROUND_SIGNS.indexOf(x) >= 0; });
          var sign = rng.pick(real);
          if (sign) add(makeBeat("stamp:" + key, "stamp", slot, location, STAMP_TEXT[sign], { sign: sign }));
        }
        if (keyedNumber(seed, "whisper:" + key) < wxProfile.whisperChance) add(makeBeat("whisper:" + key, "whisper", slot, location, rng.pick(WHISPERS)));
        if (stateLike.player.afflicted && keyedNumber(seed, "delusion:" + key) < 0.24) {
          var sequence = rng.pick(DELUSION_SEQUENCES);
          add(makeBeat("delusion:" + key, "delusion", slot, location, sequence.join(" "), { reliability: "unresolved", meta: { fragments: sequence.slice(), requiresResponse: true, unresolvedSight: true } }));
        }
      }
    }
    return table;
  }

  function createNight(config) {
    config = config || {};
    var seed = config.seed == null ? "hollows-edge-night" : config.seed;
    var rng = createRng(seed);
    var slots = Math.max(3, Number(config.slots || DEFAULT_SLOTS));
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
      openingIntent: clone(config.openingIntent || null),
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
        armedGuess: clone(config.player && config.player.armedGuess || null),
        route: [{ slot: -1, location: HOME }]
      },
      currentFacts: facts,
      gathering: config.gathering ? Object.assign({ shown: false }, clone(config.gathering)) : null,
      presentedActorIds: [],
      followedActorIds: [],
      encounterBudget: config.encounterBudget == null ? 2 : Math.max(0, Number(config.encounterBudget)),
      beats: [],
      currentBeat: null,
      pendingThreat: null,
      ledgers: { truth: [], observations: [], memories: {} },
      found: { stamps: [], clues: [], whispers: [], delusions: [] },
      recentSignatures: recent,
      usedSignatures: used,
      actionHistory: [],
      outcomes: {},
      visibility: {},
      discoverySchedule: {}
    };
    cast.forEach(function (v) { state.ledgers.memories[v.id] = []; });
    for (var s = 0; s < slots; s += 1) {
      state.visibility[s] = {};
      cast.forEach(function (villager) {
        var clearChance = weatherProfile(state).visibility;
        state.visibility[s][villager.id] = keyedNumber(seed, "visibility:" + s + ":" + villager.id) < clearChance;
      });
      state.outcomes[s] = {
        flee: keyedNumber(seed, "outcome:" + s + ":flee"),
        hide: keyedNumber(seed, "outcome:" + s + ":hide"),
        intervene: keyedNumber(seed, "outcome:" + s + ":intervene"),
        sign: keyedNumber(seed, "outcome:" + s + ":sign"),
        conceal: {
          cover: { survive: keyedNumber(seed, "outcome:" + s + ":conceal:cover:survive"), reveal: keyedNumber(seed, "outcome:" + s + ":conceal:cover:reveal") },
          shadow: { survive: keyedNumber(seed, "outcome:" + s + ":conceal:shadow:survive"), reveal: keyedNumber(seed, "outcome:" + s + ":conceal:shadow:reveal") },
          still: { survive: keyedNumber(seed, "outcome:" + s + ":conceal:still:survive"), reveal: keyedNumber(seed, "outcome:" + s + ":conceal:still:reveal") }
        },
        chase: {
          run: [0, 1, 2].map(function (step) { return keyedNumber(seed, "outcome:" + s + ":chase:run:" + step); }),
          breakLine: [0, 1, 2].map(function (step) { return keyedNumber(seed, "outcome:" + s + ":chase:break:" + step); }),
          hide: [0, 1, 2].map(function (step) { return keyedNumber(seed, "outcome:" + s + ":chase:hide:" + step); }),
          distract: [0, 1, 2].map(function (step) { return keyedNumber(seed, "outcome:" + s + ":chase:distract:" + step); })
        }
      };
    }
    state.chase = null;
    state.thresholdEvent = Object.assign({
      roll: keyedNumber(seed, "threshold:appears"),
      visitorRoll: keyedNumber(seed, "threshold:visitor"),
      dialogueRoll: keyedNumber(seed, "threshold:dialogue"),
      purposeRoll: keyedNumber(seed, "threshold:purpose"),
      targetRoll: keyedNumber(seed, "threshold:target"),
      requestRoll: keyedNumber(seed, "threshold:request"),
      resolved: false
    }, clone(THRESHOLD_EVENTS[Math.floor(keyedNumber(seed, "threshold:kind") * THRESHOLD_EVENTS.length) % THRESHOLD_EVENTS.length]));
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
    var critical = !!(beat.meta && beat.meta.critical);
    if (sig && !critical && (state.recentSignatures.indexOf(sig) >= 0 || state.usedSignatures.indexOf(sig) >= 0)) return null;
    if (!critical && beat.type === "clue" && state.beats.some(function (shown) {
      return shown.type === "clue" && String(shown.text || "").trim().toLowerCase() === String(beat.text || "").trim().toLowerCase();
    })) return null;
    state.beats.push(beat);
    state.currentBeat = beat;
    if (sig && state.usedSignatures.indexOf(sig) < 0) state.usedSignatures.push(sig);
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

  function playerCanSeeActor(state, actorId, slot) {
    /* Version-one saves predate visibility. Treat their already-lived roads
       as clear instead of retroactively hiding people the player could hail. */
    if (!state.visibility || !state.visibility[slot] || state.visibility[slot][actorId] == null) return true;
    return !!state.visibility[slot][actorId];
  }

  function recordEncounter(state, villager, slot, acknowledged, kind, playerSaw) {
    var seen = acknowledged || playerSaw !== false;
    var id = "encounter:" + slot + ":" + villager.id + ":" + (acknowledged ? "met" : seen ? "seen" : "unseen");
    if (state.ledgers.truth.some(function (x) { return x.id === id; })) return;
    var truth = appendTruth(state, { id: id, slot: slot, kind: seen ? (kind || "crossed_paths") : "passed_unseen", location: state.player.location, actors: ["player", villager.id], acknowledged: !!acknowledged, playerSaw: seen });
    var sightClarity = acknowledged || state.weather === "frost" ? "clear" : state.weather === "fog" ? "obscured" : "partial";
    if (seen) appendObservation(state, { eventId: truth.id, slot: slot, kind: acknowledged ? "meeting" : "sighting", location: state.player.location, actors: [villager.id], clarity: sightClarity, reliability: "direct", weather: state.weather });
    state.ledgers.memories[villager.id].push({ eventId: truth.id, slot: slot, subject: "player", kind: acknowledged ? "meeting" : "sighting", location: state.player.location, clarity: seen ? sightClarity : "one_sided", acknowledged: !!acknowledged, weather: state.weather, interpretation: memoryInterpretation(villager, acknowledged) });
    if (!seen) return;
    var changedAftermath = !!(villager.changed && state.ledgers.truth.some(function (event) {
      return event.kind === "investigated_attack" && event.victimId === villager.id;
    }));
    var encounterText = changedAftermath
      ? CHANGED_AFTERMATH_REPLIES[Math.floor(keyedNumber(state.seed, "changed-aftermath-reply:" + villager.id) * CHANGED_AFTERMATH_REPLIES.length) % CHANGED_AFTERMATH_REPLIES.length](villager.name)
      : weatherEncounterText(state, villager, acknowledged);
    appendBeat(state, makeBeat(id, "encounter", slot, state.player.location,
      encounterText, {
        actorId: villager.id,
        truthEventId: truth.id,
        meta: { changedAftermath: changedAftermath, critical: changedAftermath },
        signature: semanticSignature({ family: "encounter", actorId: villager.id, location: state.player.location, interaction: acknowledged ? "hail" : "glimpse", outcome: "mutual" })
      }));
  }

  function discoveryReveals(beat, action) {
    var requiredSearch = beat.meta && beat.meta.searchMode;
    var isSearch = action.type === "SEARCH" || action.type === "SEARCH_ON";
    return beat.type === "atmosphere" ? true
      : (beat.type === "stamp" || beat.type === "clue") ? isSearch && (!requiredSearch || !action.searchMode || requiredSearch === action.searchMode)
      : beat.type === "whisper" ? action.type === "LISTEN"
        : beat.type === "encounter" ? ["LEAVE", "MOVE", "WAIT", "KEEP_WATCH"].indexOf(action.type) >= 0
        : beat.type === "watch" ? (action.type === "WAIT" || action.type === "KEEP_WATCH")
          : beat.type === "delusion";
  }

  function processDiscoveries(state, action, slot) {
    /* A public gathering is the scene on first arrival. Do not let a random
       private sensation overwrite it and leave the player hearing testimony
       tomorrow about an event the interface never showed. */
    if (state.currentBeat && state.currentBeat.type === "atmosphere" && state.gathering && state.gathering.shown) return;
    var key = slot + "|" + state.player.location;
    var entries = (state.discoverySchedule[key] || []).concat(state.discoverySchedule[slot + "|*"] || []).sort(function (a, b) {
      /* The watched door is the player's chosen purpose for this hour. Show
         its result after coincident weather and atmosphere so a thunderclap
         cannot conceal the fact that the suspect left or stayed. */
      var aPriority = a.meta && a.meta.affliction ? 3 : a.type === "watch" ? 2 : a.meta && a.meta.secretLead ? 1 : 0;
      var bPriority = b.meta && b.meta.affliction ? 3 : b.type === "watch" ? 2 : b.meta && b.meta.secretLead ? 1 : 0;
      return aPriority - bPriority;
    });
    entries.forEach(function (beat) {
      var reveal = discoveryReveals(beat, action);
      if (!reveal) return;
      if (beat.type === "stamp" && state.found.stamps.length) return;
      var presented = clone(beat);
      if (presented.location === "*") presented.location = state.player.location;
      presented.text = weatherDiscoveryText(state, presented);
      var shown = appendBeat(state, presented);
      if (!shown) return;
      if (beat.type === "stamp") state.found.stamps.push({ sign: beat.sign, slot: slot, location: beat.location, beatId: beat.id });
      if (beat.type === "clue") state.found.clues.push(clone(presented));
      if (beat.type === "whisper") state.found.whispers.push(clone(presented));
      if (beat.type === "delusion" && !(beat.meta && beat.meta.requiresResponse)) state.found.delusions.push(clone(presented));
      appendObservation(state, { eventId: beat.truthEventId || null, beatId: beat.id, slot: slot, kind: beat.type === "delusion" && beat.meta && beat.meta.requiresResponse ? "strange_sight" : beat.type, location: presented.location, actors: beat.actorId ? [beat.actorId] : [], clarity: beat.type === "delusion" ? "unstable" : state.weather === "storm" && beat.type === "whisper" ? "fragmentary" : "clear", reliability: beat.type === "delusion" && beat.meta && beat.meta.requiresResponse ? "unresolved" : beat.type === "delusion" ? "unreliable" : "direct", sign: beat.sign || null, text: presented.text, weather: state.weather });
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

  function killVillager(state, victimId, slot, witnessed, locationOverride) {
    var victim = state.cast.find(function (x) { return x.id === victimId; });
    if (!victim || !victim.alive) return;
    var turned = state.monsterSchedule.attackMode === "turn";
    if (turned) {
      victim.changed = true;
      victim.afflicted = true;
    } else victim.alive = false;
    var sign = actualSign(state, slot);
    var event = appendTruth(state, { id: "attack:" + slot + ":" + victimId, slot: slot, kind: turned ? "changed" : "slain", location: locationOverride || state.monsterSchedule.huntLoc, actors: [state.monsterSchedule.hostId, victimId].filter(Boolean), victimId: victimId, sign: sign, witnessed: !!witnessed });
    if (witnessed) {
      appendObservation(state, { eventId: event.id, slot: slot, kind: "attack_aftermath", location: event.location, actors: [victimId], clarity: "partial", reliability: "direct", sign: sign });
      appendBeat(state, makeBeat("aftermath:" + slot + ":" + victimId, "aftermath", slot, event.location,
        victim.name + " falls beyond the lantern. The attacker is gone. One fresh mark remains on the ground.", { actorId: victimId, sign: sign, truthEventId: event.id }));
    } else if (state.player.location !== HOME) {
      /* An unwitnessed attack must still disturb the lived night. This is
         intentionally sensory rather than evidential: the player hears the
         village react, but dawn is still where a victim and place are named. */
      var canInvestigate = event.location !== "home" && !!state.graph[event.location];
      var farText = event.location === "home"
        ? "A dog begins barking behind the houses. One by one the other dogs join it. Then every one of them stops."
        : "A scream tears out from the " + event.location + " and ends abruptly. For one breath, the road in that direction is perfectly still.";
      appendBeat(state, makeBeat("distant-attack:" + slot + ":" + victimId, "atmosphere", slot, state.player.location, farText, {
        truthEventId: event.id,
        meta: { heardOnly: true, investigable: canInvestigate, disturbanceLocation: canInvestigate ? event.location : null, victimId: victimId, attackEventId: event.id }
      }));
      appendObservation(state, { eventId: event.id, slot: slot, kind: "heard", location: state.player.location, actors: [], clarity: "sensory", reliability: "direct", text: farText });
    }
  }

  function exposedFallback(state, slot, excluded) {
    excluded = excluded || [];
    var candidates = state.cast.filter(function (villager) {
      var location = actorLocation(state, villager.id, slot);
      return villager.alive && !villager.changed && villager.id !== state.monsterSchedule.hostId && excluded.indexOf(villager.id) < 0 && location && location !== HOME;
    }).map(function (villager) { return villager.id; });
    var victimId = chooseVictim(state, candidates, slot);
    return victimId ? { victimId: victimId, location: actorLocation(state, victimId, slot) } : null;
  }

  function retargetRelentlessHunt(state, threat) {
    if (!state.monsterSchedule.relentless || !threat || !threat.fallbackVictimId) return false;
    var victim = state.cast.find(function (villager) { return villager.id === threat.fallbackVictimId; });
    if (!victim || !victim.alive) return false;
    appendTruth(state, {
      id: "retarget:" + threat.slot + ":" + threat.fallbackVictimId,
      slot: threat.slot,
      kind: "relentless_retarget",
      location: threat.fallbackLocation || state.monsterSchedule.huntLoc,
      actors: [state.monsterSchedule.hostId, "player", threat.fallbackVictimId].filter(Boolean),
      escapedId: threat.victimId === "player" ? "player" : null,
      sparedId: threat.victimId,
      victimId: threat.fallbackVictimId
    });
    killVillager(state, threat.fallbackVictimId, threat.slot, false, threat.fallbackLocation);
    return true;
  }

  function processAttack(state, slot) {
    var monster = state.monsterSchedule;
    if (!monster.active || slot !== monster.attackSlot || state.resolvedAttackSlots.indexOf(slot) >= 0) return;
    var location = monster.huntLoc;
    var villagers = actorsAt(state, location, slot).filter(function (v) { return v.id !== monster.hostId && v.alive && !v.changed; }).map(function (v) { return v.id; });
    /* A curse, dream-rider or other home-reaching horror does not require its
       victim to stand on the host's hunting ground. Its hunt location is the
       source of the night, not a collision tile. */
    if (monster.reach === "home") {
      villagers = state.cast.filter(function (v) {
        return v.alive && !v.changed && v.id !== monster.hostId;
      }).map(function (v) { return v.id; });
    }
    var playerHere = state.player.alive && state.player.location === location && state.player.location !== HOME;
    var candidates = villagers.concat(playerHere ? ["player"] : []);
    var victim = chooseVictim(state, candidates, slot);
    /* A relentless hunt may leave its promised ground and take another
       exposed villager, but it cannot dissolve into hunt_empty. */
    if (!victim && monster.relentless) {
      var remoteVictim = exposedFallback(state, slot, []);
      if (remoteVictim) {
        state.resolvedAttackSlots.push(slot);
        killVillager(state, remoteVictim.victimId, slot, false, remoteVictim.location);
        return;
      }
    }
    if (!victim) {
      state.resolvedAttackSlots.push(slot);
      var emptyTruth = appendTruth(state, { id: "hunt-empty:" + slot, slot: slot, kind: "hunt_empty", location: location, actors: [monster.hostId].filter(Boolean) });
      if (state.player.location !== HOME) {
        var nearby = state.player.location === location;
        var voiceMode = monster.voice && monster.voice.mode;
        var weatherMiss = weatherMonsterText(state, voiceMode, nearby ? "near" : "far");
        var missText = nearby
          ? (voiceMode === "beast"
            ? "The crickets stop together. Wet breath sounds once beyond the lantern, followed by a low growl and the scrape of weight turning away. It found no body here."
            : voiceMode === "speaker"
              ? "The crickets stop together. A small laugh moves along the hedge, disappointed, and a voice says, ‘Nobody, then.’ It moves on."
              : "The crickets stop together. Something crosses the far boundary of your lantern, finds no living body there, and moves on without a sound.")
          : (voiceMode === "speaker"
            ? "Far off, a gate turns. A laugh answers it from somewhere else, then the village noise slowly returns."
            : voiceMode === "beast"
              ? "Far off, dogs erupt into barking. Beneath them is one deep, breathless growl. Both sounds move away from the houses."
              : "The village sound thins. Far off, a gate gives one long complaint, then the dogs begin answering something you cannot hear.");
        if (state.weather !== "still") missText = weatherMiss + " It finds no living body there and moves on.";
        appendBeat(state, makeBeat("hunt-empty-beat:" + slot, "atmosphere", slot, state.player.location, missText, {
          truthEventId: emptyTruth.id,
          meta: { nearMiss: nearby }
        }));
        appendObservation(state, { eventId: emptyTruth.id, slot: slot, kind: "heard", location: state.player.location, actors: [], clarity: nearby ? "partial" : "sensory", reliability: "direct", text: missText });
      }
      return;
    }
    var victimAtHunt = victim === "player" || actorLocation(state, victim, slot) === location;
    if (playerHere && victimAtHunt) {
      var fallback = monster.relentless ? exposedFallback(state, slot, [victim]) : null;
      state.pendingThreat = { id: "threat:" + slot + ":" + victim, slot: slot, location: location, victimId: victim, kind: victim === "player" ? "player" : "witness", sign: actualSign(state, slot), fallbackVictimId: fallback && fallback.victimId, fallbackLocation: fallback && fallback.location };
      state.phase = "threat";
      state.player.monsterSawYou = true;
      var threatVoice = monster.voice && monster.voice.mode;
      var playerThreatText = threatVoice === "beast"
        ? "The village sound cuts out. Wet breath gathers behind you; a growl starts so low you feel it through the road. Something is between you and home."
        : threatVoice === "speaker"
          ? "The village sound cuts out. A soft giggle comes from the road behind you. ‘There you are,’ something says."
          : "The village sound cuts out. Something is between you and the road home. It makes no breath, no tread, nothing you can follow.";
      if (state.weather !== "still") playerThreatText = weatherMonsterText(state, threatVoice, "near");
      appendBeat(state, makeBeat(state.pendingThreat.id, "threat", slot, location,
        victim === "player" ? playerThreatText : "A shape closes the distance behind " + (state.cast.find(function (x) { return x.id === victim; }) || { name: "your neighbour" }).name + ". It has not seen your choice yet.",
        { actorId: victim === "player" ? null : victim, sign: state.pendingThreat.sign }));
      return;
    }
    state.resolvedAttackSlots.push(slot);
    var victimLocation = actorLocation(state, victim, slot);
    if (monster.reach === "home" && victimLocation === HOME) victimLocation = "home";
    killVillager(state, victim, slot, false, victimLocation || location);
  }

  function triggerDelusionApproachThreat(state, slot, location, fragments) {
    var fallback = state.monsterSchedule.relentless ? exposedFallback(state, slot, ["player"]) : null;
    state.pendingThreat = {
      id: "delusion-approach-threat:" + slot,
      slot: slot,
      location: location,
      victimId: "player",
      kind: "player",
      sign: actualSign(state, slot),
      fallbackVictimId: fallback && fallback.victimId,
      fallbackLocation: fallback && fallback.location,
      source: "delusion_approach"
    };
    state.phase = "threat";
    state.player.monsterSawYou = true;
    var resolution = (fragments || []).slice(1).join(" ");
    var voiceMode = state.monsterSchedule.voice && state.monsterSchedule.voice.mode;
    var proximity = weatherMonsterText(state, voiceMode, "near");
    appendBeat(state, makeBeat(state.pendingThreat.id, "threat", slot, location,
      (resolution ? resolution + " " : "") + proximity,
      { sign: state.pendingThreat.sign, meta: { source: "delusion_approach", critical: true } }));
  }

  function triggerSearchThreat(state, slot, location, searchMode) {
    state.pendingThreat = {
      id: "search-threat:" + slot + ":" + searchMode,
      slot: slot,
      location: location,
      victimId: "player",
      kind: "player",
      sign: actualSign(state, slot),
      source: "search"
    };
    state.phase = "threat";
    state.player.monsterSawYou = true;
    var opening = searchMode === "edges"
      ? "Your lantern is still beneath the hedge when something moves on the other side of it."
      : "Bent over the ground, you hear weight settle into the road behind you.";
    var voiceMode = state.monsterSchedule.voice && state.monsterSchedule.voice.mode;
    appendBeat(state, makeBeat(state.pendingThreat.id, "threat", slot, location,
      opening + " " + weatherMonsterText(state, voiceMode, "near"),
      { sign: state.pendingThreat.sign, meta: { source: "search", searchMode: searchMode, critical: true } }));
  }

  function resolveAttackInvestigation(state, action, slot) {
    var event = (state.ledgers.truth || []).find(function (row) { return row.id === action.investigateEventId; });
    if (!event || (event.kind !== "slain" && event.kind !== "changed")) return null;
    var victim = state.cast.find(function (row) { return row.id === event.victimId; });
    var victimName = victim && victim.name || "Your neighbour";
    var wxClue = state.weather === "frost" ? 0.72 : state.weather === "fog" ? 0.52 : state.weather === "storm" ? 0.36 : 0.58;
    var clueFound = !!event.sign && keyedNumber(state.seed, "investigate-clue:" + event.id) < wxClue;
    var wordChance = state.weather === "storm" ? 0.18 : state.weather === "fog" ? 0.32 : 0.4;
    var heardLastWords = event.kind === "slain" && keyedNumber(state.seed, "investigate-words:" + event.id) < wordChance;
    var lastWords = heardLastWords ? LAST_WORDS[Math.floor(keyedNumber(state.seed, "investigate-words-line:" + event.id) * LAST_WORDS.length) % LAST_WORDS.length] : null;
    var possibleWitnesses = state.cast.filter(function (row) {
      return row.alive && !row.changed && row.id !== state.monsterSchedule.hostId && row.id !== event.victimId;
    }).sort(function (a, b) {
      return keyedNumber(state.seed, "body-witness:" + event.id + ":" + a.id) - keyedNumber(state.seed, "body-witness:" + event.id + ":" + b.id);
    });
    var suspicious = possibleWitnesses.length > 0 && keyedNumber(state.seed, "body-suspicion:" + event.id) < 0.48;
    var witnessIds = suspicious ? possibleWitnesses.slice(0, Math.min(2, possibleWitnesses.length)).map(function (row) { return row.id; }) : [];
    var text = event.kind === "changed"
      ? "You reach the " + event.location + ". " + victimName + " is alive, but the attack has changed them. They do not answer their name or react when you touch their shoulder."
      : "You reach the " + event.location + ". " + victimName + " lies where the cry ended.";
    if (lastWords) text += " They are breathing just long enough to catch your sleeve and say, " + lastWords;
    else if (event.kind === "slain") text += " You are too late for an answer.";
    if (clueFound) text += event.kind === "changed"
      ? " Beside them, one physical mark remains clear enough to stamp into the Journal."
      : " Close to the body, one physical mark remains clear enough to stamp into the Journal.";
    if (suspicious) text += event.kind === "changed"
      ? " Footsteps arrive behind you. What they see first is you beside " + victimName + "."
      : " Footsteps arrive behind you. What they see first is you beside the body.";
    var truth = appendTruth(state, {
      id: "investigated:" + event.id,
      slot: slot,
      kind: "investigated_attack",
      location: event.location,
      actors: ["player", event.victimId].concat(witnessIds),
      victimId: event.victimId,
      attackEventId: event.id,
      clueFound: clueFound,
      sign: clueFound ? event.sign : null,
      heardLastWords: heardLastWords,
      lastWords: lastWords,
      recognizedChanged: event.kind === "changed",
      suspicious: suspicious,
      witnessIds: witnessIds
    });
    witnessIds.forEach(function (witnessId) {
      state.ledgers.memories[witnessId] = state.ledgers.memories[witnessId] || [];
      state.ledgers.memories[witnessId].push({
        eventId: truth.id, slot: slot, subject: "player", kind: "found_near_body", location: event.location,
        clarity: "clear", acknowledged: false, interpretation: "They arrived to find the player alone beside the fresh body."
      });
    });
    var beat = appendBeat(state, makeBeat("body-investigation:" + slot + ":" + event.victimId, clueFound ? "stamp" : "aftermath", slot, event.location, text, {
      actorId: event.victimId,
      sign: clueFound ? event.sign : null,
      truthEventId: truth.id,
      meta: { bodyInvestigation: true, recognizedChanged: event.kind === "changed", lastWords: lastWords, suspicious: suspicious, witnessIds: witnessIds, critical: true }
    }));
    if (clueFound && beat && !state.found.stamps.some(function (stamp) { return stamp.sign === event.sign; })) {
      state.found.stamps.push({ sign: event.sign, slot: slot, location: event.location, beatId: beat.id });
    }
    appendObservation(state, {
      eventId: truth.id, beatId: beat && beat.id, slot: slot, kind: "attack_aftermath", location: event.location,
      actors: [event.victimId], clarity: clueFound ? "clear" : "partial", reliability: "direct",
      sign: clueFound ? event.sign : null, text: text, weather: state.weather
    });
    return beat;
  }

  function recordFollow(state, actorId, slot) {
    var villager = state.cast.find(function (v) { return v.id === actorId; });
    var schedule = state.schedules[actorId];
    if (!villager || !schedule) return;
    var dialogue = villager.dialogue || {};
    var destination = schedule.motive.destination === HOME ? state.player.location : schedule.motive.destination;
    var changedAftermath = !!(villager.changed && state.ledgers.truth.some(function (row) {
      return row.kind === "investigated_attack" && row.victimId === villager.id;
    }));
    var event = appendTruth(state, {
      id: "followed:" + slot + ":" + actorId,
      slot: slot,
      kind: "followed",
      location: destination,
      actors: ["player", actorId],
      actorId: actorId,
      acknowledged: false,
      playerSaw: true,
      motiveFamily: schedule.motive.family,
      revealedSecret: !changedAftermath && !!dialogue.revealsSecret,
      secretSummary: changedAftermath ? null : (dialogue.secretSummary || null),
      changedAftermath: changedAftermath
    });
    var routePlace = destination === HOME ? "door" : destination;
    var fallbackLead = state.weather === "fog" ? "You follow " + villager.name + "'s lantern through the fog to the " + routePlace + "."
      : state.weather === "storm" ? "By lightning, you follow " + villager.name + " to the " + routePlace + "."
        : state.weather === "frost" ? "You follow " + villager.name + "'s fresh tracks to the " + routePlace + "."
          : "You follow " + villager.name + " to the " + routePlace + ".";
    var followText = changedAftermath
      ? "You follow " + villager.name + ". They never look back. At the " + routePlace + ", they stop and wait in silence. The attack changed them."
      : dialogue.follow || (fallbackLead + " There, " + villager.name + " finishes an ordinary errand and leaves.");
    appendObservation(state, { eventId: event.id, slot: slot, kind: !changedAftermath && dialogue.revealsSecret ? "evidence" : "seen", location: destination, actors: [actorId], clarity: state.weather === "storm" ? "weathered" : "clear", reliability: "direct", text: followText, weather: state.weather });
    state.ledgers.memories[actorId].push({ eventId: event.id, slot: slot, subject: "player", kind: "followed", location: destination, clarity: "uncertain", acknowledged: false, interpretation: "They may not know whether the lantern behind them was yours." });
    appendBeat(state, makeBeat("follow-beat:" + slot + ":" + actorId, "follow", slot, destination,
      followText, {
        actorId: actorId,
        truthEventId: event.id,
        meta: { motiveFamily: schedule.motive.family, revealedSecret: !changedAftermath && !!dialogue.revealsSecret, changedAftermath: changedAftermath, critical: changedAftermath || (state.monsterSchedule.active && actorId === state.monsterSchedule.hostId) }
      }));
    if (state.followedActorIds.indexOf(actorId) < 0) state.followedActorIds.push(actorId);
    return event;
  }

  function resolveFollow(state, action) {
    var schedule = state.schedules[action.actorId];
    if (!schedule) return invalid(state, action, "There is nobody there to follow.");
    var destination = schedule.motive.destination;
    var targetSlot = Math.min(state.slots - 1, state.cursor + 1);
    for (var probe = state.cursor + 1; probe < state.slots; probe += 1) {
      targetSlot = probe;
      if (actorLocation(state, action.actorId, probe) === destination) break;
    }
    for (var slot = state.cursor + 1; slot <= targetSlot; slot += 1) {
      var actorLoc = actorLocation(state, action.actorId, slot);
      if (actorLoc && actorLoc !== HOME) state.player.location = actorLoc;
      state.cursor = slot;
      state.player.route.push({ slot: slot, location: state.player.location, action: "FOLLOW", actorId: action.actorId });
      processAttack(state, slot);
      if (state.phase !== "active") return state;
    }
    /* A sighting can happen in the last sampled hour. Following then resolves
       inside that hour instead of advancing beyond the outcome tape. */
    if (state.cursor >= state.slots - 1 && destination !== HOME && state.player.location !== destination) {
      state.player.location = destination;
      state.player.route.push({ slot: state.cursor, location: destination, action: "FOLLOW", actorId: action.actorId });
    }
    state.actionHistory.push({ slot: state.cursor, type: "FOLLOW", to: state.player.location, actorId: action.actorId });
    appendTruth(state, { id: "player:" + state.cursor + ":follow", slot: state.cursor, kind: "player_action", action: "FOLLOW", location: state.player.location, actorId: action.actorId });
    var followedEvent = recordFollow(state, action.actorId, state.cursor);
    /* Discovering the active host ends the social scene immediately. The
       player is still hidden for one breath, as in the established walk,
       but may only flee, risk staying to learn, or confront it. */
    if (state.monsterSchedule.active && action.actorId === state.monsterSchedule.hostId) {
      state.pendingThreat = {
        id: "recognition:" + state.cursor + ":" + action.actorId,
        slot: state.cursor,
        location: state.player.location,
        victimId: "player",
        actorId: action.actorId,
        kind: "recognition",
        sign: actualSign(state, state.cursor),
        truthEventId: followedEvent && followedEvent.id
      };
      state.phase = "threat";
      var host = state.cast.find(function (villager) { return villager.id === action.actorId; });
      var recognitionText = state.monsterSchedule.revealText
        || ((host && host.name || "Your neighbour") + " turns close enough for the lantern to catch the human shape still trapped inside the monster.");
      if (state.weather === "fog") recognitionText = "Fog hides the face until it is close. " + recognitionText;
      else if (state.weather === "storm") recognitionText = "Lightning shows the face. " + recognitionText;
      else if (state.weather === "frost") recognitionText = "Its breath crosses yours. " + recognitionText;
      appendBeat(state, makeBeat("recognition-beat:" + state.cursor + ":" + action.actorId, "threat", state.cursor, state.player.location,
        recognitionText, { actorId: action.actorId, sign: state.pendingThreat.sign, truthEventId: followedEvent && followedEvent.id, meta: { recognition: true, critical: true } }));
    }
    finishIfNeeded(state);
    return state;
  }

  function arrive(state, action, slot) {
    state.player.route.push({ slot: slot, location: state.player.location, action: action.type, searchMode: action.searchMode || null, investigateEventId: action.investigateEventId || null });
    appendTruth(state, { id: "player:" + slot + ":" + action.type.toLowerCase(), slot: slot, kind: "player_action", action: action.type, searchMode: action.searchMode || null, investigateEventId: action.investigateEventId || null, location: state.player.location, actorId: action.actorId || null });
    var watchedId = state.openingIntent && state.openingIntent.kind === "watch" ? state.openingIntent.id : null;
    var present = actorsAt(state, state.player.location, slot).filter(function (v) {
      if (v.id === state.monsterSchedule.hostId && slot === state.monsterSchedule.attackSlot) return false;
      /* Someone still inside the house being watched is not a passer-by in
         the lane. Their authored door departure owns the moment they emerge. */
      if (watchedId && v.id === watchedId && action.type !== "HAIL" && action.type !== "FOLLOW") return false;
      return true;
    });
    var gatheringShown = false;
    if (state.gathering && !state.gathering.shown && state.gathering.location === state.player.location) {
      state.gathering.shown = true;
      gatheringShown = true;
      var gatheringTruth = appendTruth(state, {
        id: "gathering:" + slot + ":" + state.gathering.id,
        slot: slot,
        kind: "gathering_seen",
        location: state.player.location,
        actors: present.map(function (villager) { return villager.id; }),
        gatheringId: state.gathering.id
      });
      appendObservation(state, { eventId: gatheringTruth.id, slot: slot, kind: "gathering", location: state.player.location, actors: [], clarity: "clear", reliability: "direct", text: state.gathering.text });
      appendBeat(state, makeBeat("gathering-beat:" + slot + ":" + state.gathering.id, "atmosphere", slot, state.player.location, state.gathering.text, {
        truthEventId: gatheringTruth.id,
        meta: { gatheringId: state.gathering.id, gatheringName: state.gathering.name }
      }));
    }
    var framedId = null;
    var visible = present.filter(function (villager) { return playerCanSeeActor(state, villager.id, slot); });
    var hiddenByWeather = present.filter(function (villager) { return !playerCanSeeActor(state, villager.id, slot); });
    var discoveryKey = slot + "|" + state.player.location;
    var priorityDiscovery = (state.discoverySchedule[discoveryKey] || []).some(function (beat) { return discoveryReveals(beat, action); });
    if (!gatheringShown && !priorityDiscovery && action.actorId && visible.some(function (villager) { return villager.id === action.actorId; })) framedId = action.actorId;
    else if (!gatheringShown && !priorityDiscovery && ["LEAVE", "MOVE", "WAIT", "KEEP_WATCH"].indexOf(action.type) >= 0 && state.presentedActorIds.length < state.encounterBudget) {
      framedId = visible.filter(function (villager) { return state.presentedActorIds.indexOf(villager.id) < 0; }).sort(function (a, b) {
        var aSecretLead = a.dialogue && a.dialogue.revealsSecret ? 0 : 1;
        var bSecretLead = b.dialogue && b.dialogue.revealsSecret ? 0 : 1;
        return aSecretLead - bSecretLead || (state.attackPriorities[slot][a.id] || 1) - (state.attackPriorities[slot][b.id] || 1);
      }).map(function (villager) { return villager.id; })[0] || null;
    }
    if (framedId && state.presentedActorIds.indexOf(framedId) < 0) state.presentedActorIds.push(framedId);
    present.forEach(function (v) {
      var acknowledged = action.type === "HAIL" && action.actorId === v.id;
      recordEncounter(state, v, slot, acknowledged, acknowledged ? "hailed" : "crossed_paths", acknowledged || v.id === framedId);
    });
    if (!gatheringShown && !priorityDiscovery && !framedId && hiddenByWeather.length && ["LEAVE", "MOVE", "WAIT", "KEEP_WATCH"].indexOf(action.type) >= 0) {
      appendBeat(state, makeBeat("weather-hidden:" + slot + ":" + state.player.location, "atmosphere", slot, state.player.location,
        state.weather === "frost" ? "A figure crosses the blue lane beyond clear recognition. Breath and bootprints remain after it has gone." : weatherEncounterText(state, hiddenByWeather[0], false),
        { meta: { weatherHidden: true, weather: state.weather } }));
    }
    processDiscoveries(state, action, slot);
    var earnedFinding = state.currentBeat && (state.currentBeat.type === "stamp" || state.currentBeat.type === "clue") ? state.currentBeat : null;
    if (action.type === "FOLLOW" && action.actorId) recordFollow(state, action.actorId, slot);
    processAttack(state, slot);
    /* A distant, unidentified attack still enters the truth and observation
       ledgers, but it must not erase a stamp the player is holding in their
       lantern. A nearby threat keeps priority because it requires a choice. */
    if (earnedFinding && state.phase === "active" && state.currentBeat && state.currentBeat.meta && state.currentBeat.meta.heardOnly) {
      state.currentBeat = earnedFinding;
    }
  }

  function completeNight(state) {
    state.phase = "complete";
    state.player.location = HOME;
    if (!state.ledgers.truth.some(function (e) { return e.id === "night-complete"; })) {
      appendTruth(state, { id: "night-complete", slot: state.cursor, kind: "returned_home", location: HOME });
    }
    return state;
  }

  function thresholdActor(state, actorId) {
    return (state.cast || []).find(function (actor) { return actor.id === actorId; }) || null;
  }

  function thresholdNeighbour(state) {
    var hostId = state.monsterSchedule && state.monsterSchedule.hostId;
    var ordered = [];
    var watchedId = state.openingIntent && state.openingIntent.kind === "watch" ? state.openingIntent.id : null;
    if (watchedId) ordered.push(watchedId);
    (state.followedActorIds || []).forEach(function (id) { ordered.push(id); });
    (state.presentedActorIds || []).forEach(function (id) { ordered.push(id); });
    (state.cast || []).forEach(function (actor) { ordered.push(actor.id); });
    var eligible = ordered.filter(function (id, index) {
      var actor = thresholdActor(state, id);
      return ordered.indexOf(id) === index && actor && actor.alive && !actor.changed && id !== hostId;
    });
    if (!eligible.length) return null;
    var roll = state.thresholdEvent && state.thresholdEvent.visitorRoll || 0;
    return thresholdActor(state, eligible[Math.floor(roll * eligible.length) % eligible.length]);
  }

  function prepareThresholdVisitor(state, neighbour) {
    var threshold = state.thresholdEvent;
    var monsterAvailable = !!(state.monsterSchedule && state.monsterSchedule.active);
    var chooseMonster = threshold.visitorKind === "monster" || (!threshold.visitorKind && monsterAvailable && (!neighbour || threshold.visitorRoll < (state.player.monsterSawYou ? 0.68 : 0.42)));
    threshold.visitorKind = threshold.visitorKind || (chooseMonster ? "monster" : "neighbour");
    threshold.actorId = threshold.actorId || (chooseMonster ? state.monsterSchedule.hostId : neighbour && neighbour.id);
    threshold.canEnter = chooseMonster && state.monsterSchedule.reach === "home";
    threshold.item = threshold.item || THRESHOLD_ITEMS[Math.floor(threshold.dialogueRoll * THRESHOLD_ITEMS.length) % THRESHOLD_ITEMS.length];
    if (chooseMonster) {
      threshold.purpose = "lure";
      threshold.requestMode = state.monsterSchedule.id === "vampire" ? "inside" : "outside";
    } else {
      var purposes = ["return_item", "concern", "question", "sign", "rumour", "refuge"];
      threshold.purpose = threshold.purpose || purposes[Math.floor(threshold.purposeRoll * purposes.length) % purposes.length];
      threshold.requestMode = threshold.purpose === "refuge" ? "inside" : "outside";
      var possibleTargets = (state.cast || []).filter(function (candidate) {
        return candidate.alive && !candidate.changed && candidate.id !== threshold.actorId;
      });
      var host = thresholdActor(state, state.monsterSchedule && state.monsterSchedule.hostId);
      if (possibleTargets.length) {
        threshold.concernId = threshold.concernId || ((host && host.id !== threshold.actorId && threshold.targetRoll < 0.28)
          ? host.id
          : possibleTargets[Math.floor(threshold.targetRoll * possibleTargets.length) % possibleTargets.length].id);
      }
      var realSigns = (state.monsterSchedule.signs || []).filter(function (sign) { return sign !== "wail"; });
      threshold.sign = threshold.sign || (realSigns.length ? realSigns[Math.floor(threshold.targetRoll * realSigns.length) % realSigns.length] : null);
      threshold.clueLocation = threshold.clueLocation || state.monsterSchedule.huntLoc || (state.openingIntent && state.openingIntent.loc) || "Village Square";
    }
    return threshold;
  }

  function thresholdTarget(state) {
    return thresholdActor(state, state.thresholdEvent && state.thresholdEvent.concernId);
  }

  function thresholdRequestText(state, revealed) {
    var threshold = state.thresholdEvent;
    var actor = thresholdActor(state, threshold.actorId);
    var target = thresholdTarget(state);
    var name = revealed && actor ? actor.name : "A neighbour";
    var place = threshold.clueLocation || "Village Square";
    function choose(lines) {
      return lines[Math.floor(threshold.requestRoll * lines.length) % lines.length];
    }
    if (threshold.visitorKind === "monster") {
      if (state.monsterSchedule.id === "vampire") {
        return (revealed ? name : "A familiar voice") + " says, " + choose([
          "‘Please. May I come in? I am frightened.’",
          "‘It is me. Invite me in before it comes back.’",
          "‘Open the door. Say I may enter.’"
        ]);
      }
      var mode = state.monsterSchedule.voice && state.monsterSchedule.voice.mode;
      if (mode === "beast") return choose([
        "A neighbour's voice says, ‘Come outside. Someone is hurt.’ A growl catches beneath the last word.",
        "A neighbour calls, ‘Quickly. Help me lift them.’ Something sniffs along the sill.",
        "A frightened voice says, ‘I cannot carry them alone.’ Claws scrape once against the step."
      ]);
      if (mode === "speaker") return choose([
        "A familiar voice says, ‘Come outside. I found something for you.’ A small laugh follows.",
        "A neighbour calls, ‘Come see what followed you home.’ They giggle, then catch themself.",
        "A soft voice says, ‘Just one step outside.’ It sounds amused by the request."
      ]);
      return choose([
        "A familiar voice says, ‘Come outside. I need your help.’",
        "A neighbour whispers, ‘Bring your lantern. Do not make me wait here.’",
        "Someone you know says, ‘There is something in the lane you must see.’"
      ]);
    }
    if (threshold.purpose === "return_item") return name + " says, " + choose(["‘I found something of yours. Come outside and take it.’", "‘You dropped this tonight. Open the door and I will return it.’"]);
    if (threshold.purpose === "concern") return name + " says, ‘" + (target ? target.name : "Someone") + choose([" has not come home. Please help me look.’", " is missing. Will you come and help?’"]);
    if (threshold.purpose === "question") return name + " says, " + choose(["‘Were you near the " + place + " tonight? I need to ask you something.’", "‘What did you see at the " + place + "? Come outside and tell me.’"]);
    if (threshold.purpose === "sign") return name + " says, " + choose(["‘I found something at the " + place + ". Bring your lantern outside.’", "‘There is a mark at the " + place + ". You need to see it.’"]);
    if (threshold.purpose === "rumour") return name + " says, ‘I saw " + (target ? target.name : "someone") + choose([" near the " + place + ". Come outside. Keep quiet.’", " leaving the " + place + ". I do not want the street to hear.’"]);
    return name + " says, " + choose(["‘Please let me in. Something followed me.’", "‘May I come in? I heard steps behind me.’", "‘Open the door. I do not want to stand out here alone.’"]);
  }

  function thresholdNeighbourAnswer(state, neighbour) {
    var threshold = state.thresholdEvent;
    var name = neighbour ? neighbour.name : "A neighbour";
    var item = threshold.item || "your glove";
    var intent = state.openingIntent || {};
    var watched = intent.kind === "watch" ? thresholdActor(state, intent.id) : null;
    var lines;
    if (threshold.purpose && threshold.purpose !== "return_item") return thresholdRequestText(state, true);
    if (watched && neighbour && watched.id === neighbour.id) {
      lines = [
        "“You left " + item + " outside my door,” " + name + " says. “You were watching me.”",
        name + " answers from the step. “I found " + item + " by my door. How long were you there?”",
        "“This was beside my window,” " + name + " says, holding " + item + ". “You followed me home.”",
        name + " keeps their voice low. “You dropped " + item + " outside my house. I know you were watching.”",
        "“I brought back " + item + ",” " + name + " says. “Next time, knock instead of hiding.”",
        name + " answers plainly. “You watched my door and left " + item + " behind. I want to know why.”"
      ];
    } else if (watched) {
      lines = [
        "“I found " + item + " outside " + watched.name + "'s door,” " + name + " says. “Were you watching them?”",
        name + " answers from the step. “You dropped " + item + " near " + watched.name + "'s house. Why were you hiding there?”",
        "“This was by " + watched.name + "'s window,” " + name + " says. “What were you waiting to see?”",
        name + " holds up " + item + ". “I found it outside " + watched.name + "'s door. They should know.”"
      ];
    } else if (intent.kind === "search" && intent.loc) {
      lines = [
        name + " answers from the step. “You dropped " + item + " at the " + intent.loc + ". What were you searching for?”",
        "“I found " + item + " at the " + intent.loc + ",” " + name + " says. “You were there after dark.”",
        name + " holds up " + item + ". “This was at the " + intent.loc + ". I thought you would want it back.”",
        "“You left " + item + " at the " + intent.loc + ",” " + name + " says. “I will not ask why tonight.”",
        name + " answers quietly. “I found " + item + " where you were searching. Be more careful next time.”",
        "“This belongs to you,” " + name + " says. “I found it at the " + intent.loc + " after you left.”"
      ];
    } else {
      lines = [
        name + " answers from the step. “You dropped " + item + " on the road. I brought it back.”",
        "“This is yours,” " + name + " says, holding " + item + ". “I found it before the rain did.”",
        name + " keeps their distance. “You left " + item + " in the lane. I thought you should know.”"
      ];
    }
    return lines[Math.floor(threshold.dialogueRoll * lines.length) % lines.length];
  }

  function thresholdLookText(state) {
    var threshold = state.thresholdEvent;
    var actor = thresholdActor(state, threshold.actorId);
    var name = actor ? actor.name : "Someone you know";
    var weatherLead = state.weather === "storm" ? "Rain runs from " + name + "'s coat. "
      : state.weather === "fog" ? "Fog parts enough to show " + name + " on the step. "
        : state.weather === "frost" ? name + "'s breath hangs white above the step. " : "";
    if (threshold.visitorKind === "neighbour") {
      var neighbourDetail = threshold.purpose === "return_item" ? "They hold " + (threshold.item || "your glove") + "."
        : threshold.purpose === "sign" ? "They carry a covered lantern and keep pointing down the lane."
          : threshold.purpose === "refuge" ? "They keep looking over one shoulder."
            : "They are alone.";
      return weatherLead + neighbourDetail + " " + thresholdRequestText(state, true);
    }
    if (state.monsterSchedule.id === "vampire") return weatherLead + name + " waits beyond the lintel. No breath clouds the air. It asks again to be invited in.";
    if (threshold.canEnter) return weatherLead + (weatherLead ? "Their" : name + " stands on the step. Their") + " shadow already lies inside your hall. The monster followed you home.";
    return weatherLead + (weatherLead ? "Their" : name + " stands on the step. Their") + " face is still, but claws rest against the shutter. The monster followed you home.";
  }

  function beginThresholdOrComplete(state) {
    var threshold = state.thresholdEvent;
    var neighbour = threshold && thresholdNeighbour(state);
    var preselected = threshold && !!threshold.visitorKind;
    var monsterVisit = state.monsterSchedule && state.monsterSchedule.active && threshold && threshold.roll < (state.player.monsterSawYou ? 0.62 : 0.28);
    var neighbourVisit = neighbour && threshold && threshold.roll < 0.16;
    var eligible = state.player.alive && threshold && !threshold.resolved && (preselected ? threshold.roll < 0.48 : monsterVisit || neighbourVisit);
    if (!eligible) return completeNight(state);
    prepareThresholdVisitor(state, neighbour);
    state.phase = "threshold";
    state.player.location = HOME;
    appendTruth(state, { id: "threshold-arrival:" + state.cursor, slot: state.cursor, kind: "threshold_arrival", location: HOME, thresholdKind: threshold.kind, visitorKind: threshold.visitorKind, actorId: threshold.actorId || null });
    var thresholdOpening = state.weather === "storm" ? "Rain rattles the door. "
      : state.weather === "fog" ? "Fog presses against every crack. "
        : state.weather === "frost" ? "Cold grips the door in its frame. " : "";
    thresholdOpening += thresholdRequestText(state, false);
    var shown = appendBeat(state, makeBeat("threshold:" + state.cursor + ":" + threshold.kind, "doorstep", state.cursor, HOME, thresholdOpening, {
      signature: semanticSignature({ family: "threshold", location: HOME, interaction: threshold.kind, outcome: "unanswered" })
    }));
    if (!shown) {
      threshold.resolved = true;
      threshold.suppressed = true;
      return completeNight(state);
    }
    return state;
  }

  function finishIfNeeded(state) {
    if (state.phase !== "active" || state.cursor < state.slots - 1) return;
    /* A required sight or sound owns the screen until the player answers it.
       Completing here used to strand a final-slot delusion beneath a single
       morning button: its response actions disappeared and the location was
       rewritten as Home. Once the last beat is resolved, dawn starts the
       journey home; reaching the threshold remains its own explicit action. */
    if (state.currentBeat && state.currentBeat.meta && state.currentBeat.meta.requiresResponse) return;
    state.phase = "returning";
    if (!state.ledgers.truth.some(function (event) { return event.id === "dawn-return:" + state.cursor; })) {
      appendTruth(state, { id: "dawn-return:" + state.cursor, slot: state.cursor, kind: "started_home", location: state.player.location, reason: "dawn" });
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
    return beginThresholdOrComplete(state);
  }

  function invalid(state, action, reason) {
    var copy = clone(state);
    copy.lastError = { action: action && action.type, reason: reason };
    return copy;
  }

  function upgradeStateInPlace(state) {
    if (!state) return state;
    state.player = state.player || { location: HOME, alive: true, route: [] };
    if (!Object.prototype.hasOwnProperty.call(state.player, "armedGuess")) state.player.armedGuess = null;
    if (state.monsterSchedule && state.monsterSchedule.relentless == null) state.monsterSchedule.relentless = state.monsterSchedule.id === "werewolf";
    if (!Object.prototype.hasOwnProperty.call(state, "gathering")) state.gathering = null;
    state.presentedActorIds = state.presentedActorIds || [];
    state.followedActorIds = state.followedActorIds || [];
    if (state.encounterBudget == null) state.encounterBudget = 2;
    state.visibility = state.visibility || {};
    state.outcomes = state.outcomes || {};
    state.ledgers = state.ledgers || { truth: [], observations: [], memories: {} };
    state.ledgers.truth = state.ledgers.truth || [];
    state.ledgers.observations = state.ledgers.observations || [];
    state.ledgers.memories = state.ledgers.memories || {};
    (state.cast || []).forEach(function (villager) { state.ledgers.memories[villager.id] = state.ledgers.memories[villager.id] || []; });
    state.cursor = Math.max(-1, Math.min(state.slots - 1, Number(state.cursor == null ? -1 : state.cursor)));
    if (state.pendingThreat && (state.pendingThreat.slot < 0 || state.pendingThreat.slot >= state.slots)) state.pendingThreat.slot = state.cursor;
    if (state.chase && (state.chase.slot < 0 || state.chase.slot >= state.slots)) state.chase.slot = state.cursor;
    for (var slot = 0; slot < state.slots; slot += 1) {
      state.visibility[slot] = state.visibility[slot] || {};
      (state.cast || []).forEach(function (villager) {
        if (state.visibility[slot][villager.id] == null) state.visibility[slot][villager.id] = true;
      });
      state.outcomes[slot] = state.outcomes[slot] || {};
      ["flee", "hide", "intervene", "sign"].forEach(function (kind) {
        if (typeof state.outcomes[slot][kind] !== "number") state.outcomes[slot][kind] = keyedNumber(state.seed, "outcome:" + slot + ":" + kind);
      });
      if (!state.outcomes[slot].chase) {
        state.outcomes[slot].chase = {
          run: [0, 1, 2].map(function (step) { return keyedNumber(state.seed, "outcome:" + slot + ":chase:run:" + step); }),
          breakLine: [0, 1, 2].map(function (step) { return keyedNumber(state.seed, "outcome:" + slot + ":chase:break:" + step); }),
          hide: [0, 1, 2].map(function (step) { return keyedNumber(state.seed, "outcome:" + slot + ":chase:hide:" + step); }),
          distract: [0, 1, 2].map(function (step) { return keyedNumber(state.seed, "outcome:" + slot + ":chase:distract:" + step); })
        };
      }
      if (!state.outcomes[slot].conceal) {
        state.outcomes[slot].conceal = {
          cover: { survive: keyedNumber(state.seed, "outcome:" + slot + ":conceal:cover:survive"), reveal: keyedNumber(state.seed, "outcome:" + slot + ":conceal:cover:reveal") },
          shadow: { survive: keyedNumber(state.seed, "outcome:" + slot + ":conceal:shadow:survive"), reveal: keyedNumber(state.seed, "outcome:" + slot + ":conceal:shadow:reveal") },
          still: { survive: keyedNumber(state.seed, "outcome:" + slot + ":conceal:still:survive"), reveal: keyedNumber(state.seed, "outcome:" + slot + ":conceal:still:reveal") }
        };
      }
    }
    if (!Object.prototype.hasOwnProperty.call(state, "chase")) state.chase = null;
    if (!state.thresholdEvent) {
      state.thresholdEvent = Object.assign({
        roll: keyedNumber(state.seed, "threshold:appears"),
        visitorRoll: keyedNumber(state.seed, "threshold:visitor"),
        dialogueRoll: keyedNumber(state.seed, "threshold:dialogue"),
        purposeRoll: keyedNumber(state.seed, "threshold:purpose"),
        targetRoll: keyedNumber(state.seed, "threshold:target"),
        requestRoll: keyedNumber(state.seed, "threshold:request"),
        resolved: false
      }, clone(THRESHOLD_EVENTS[Math.floor(keyedNumber(state.seed, "threshold:kind") * THRESHOLD_EVENTS.length) % THRESHOLD_EVENTS.length]));
    }
    if (state.thresholdEvent.visitorRoll == null) state.thresholdEvent.visitorRoll = keyedNumber(state.seed, "threshold:visitor");
    if (state.thresholdEvent.dialogueRoll == null) state.thresholdEvent.dialogueRoll = keyedNumber(state.seed, "threshold:dialogue");
    if (state.thresholdEvent.purposeRoll == null) state.thresholdEvent.purposeRoll = keyedNumber(state.seed, "threshold:purpose");
    if (state.thresholdEvent.targetRoll == null) state.thresholdEvent.targetRoll = keyedNumber(state.seed, "threshold:target");
    if (state.thresholdEvent.requestRoll == null) state.thresholdEvent.requestRoll = keyedNumber(state.seed, "threshold:request");
    state.version = VERSION;
    return state;
  }

  function upgradeState(state) {
    return upgradeStateInPlace(clone(state));
  }

  function chaseDistanceWord(distance) {
    return distance <= 1 ? "at your shoulder" : distance === 2 ? "closing" : "losing ground";
  }

  function pursuitText(state, moment, distance, gained) {
    var voice = state.monsterSchedule.voice || { mode: "silent" };
    if (moment === "start") {
      if (voice.mode === "beast") return "You run. Claws strike the road behind you; one vast breath breaks into a growl and gathers speed.";
      if (voice.mode === "speaker") return "You run. A quiet laugh sounds close behind you. Then the voice calls your name.";
      return "You run. No footfall follows, but your shadow shortens ahead of you with every stride.";
    }
    if (voice.mode === "beast") return gained
      ? "The panting falls back for three breaths, then the claws find the road again. It is " + chaseDistanceWord(distance) + "."
      : "The turn costs you. Hot breath and the scrape of claws are " + chaseDistanceWord(distance) + ".";
    if (voice.mode === "speaker") return gained
      ? "The laughter falls back, then your name arrives clearly from the next turning. It is " + chaseDistanceWord(distance) + "."
      : "The voice behind you says, ‘Wrong road.’ It is " + chaseDistanceWord(distance) + ", delighted and unhurried.";
    return gained
      ? "For three heartbeats your shadow belongs to you again. Then it stretches forward. The silence is " + chaseDistanceWord(distance) + "."
      : "The lane is perfectly silent. Something without tread or breath is " + chaseDistanceWord(distance) + ".";
  }

  function startChase(state, threat) {
    state.resolvedAttackSlots.push(threat.slot);
    state.pendingThreat = null;
    state.phase = "chase";
    state.chase = { slot: threat.slot, step: 0, distance: 2, location: threat.location, history: [], fallbackVictimId: threat.fallbackVictimId || null, fallbackLocation: threat.fallbackLocation || null };
    appendTruth(state, { id: "chase-start:" + threat.slot, slot: threat.slot, kind: "chase_started", location: threat.location, actors: [state.monsterSchedule.hostId, "player"].filter(Boolean) });
    appendBeat(state, makeBeat("chase-start-beat:" + threat.slot, "flee", threat.slot, threat.location,
      pursuitText(state, "start"), { outcome: "closing", meta: { voiceMode: (state.monsterSchedule.voice || {}).mode || "silent" } }));
    return state;
  }

  function finishChaseEscape(state, action, outcome) {
    var chase = state.chase;
    appendTruth(state, { id: "escape:" + chase.slot + ":" + action.type.toLowerCase(), slot: chase.slot, kind: "escape", method: action.type.toLowerCase(), location: chase.location, succeeded: true, chaseSteps: chase.step });
    appendBeat(state, makeBeat("chase-escape:" + chase.slot + ":" + chase.step, "flee", chase.slot, chase.location, outcome, { outcome: "escaped" }));
    retargetRelentlessHunt(state, chase);
    state.chase = null;
    state.phase = "returning";
    return state;
  }

  function finishChaseDeath(state, action) {
    var chase = state.chase;
    appendTruth(state, { id: "escape:" + chase.slot + ":" + action.type.toLowerCase(), slot: chase.slot, kind: "escape", method: action.type.toLowerCase(), location: chase.location, succeeded: false, chaseSteps: chase.step });
    appendBeat(state, makeBeat("chase-caught:" + chase.slot + ":" + chase.step, "flee", chase.slot, chase.location,
      "You manage one more stride. The thing behind you catches you before the next.", { outcome: "caught" }));
    state.player.alive = false;
    state.phase = "dead";
    state.chase = null;
    appendTruth(state, { id: "player-death:" + chase.slot, slot: chase.slot, kind: "player_slain", location: chase.location, actors: [state.monsterSchedule.hostId, "player"].filter(Boolean) });
    return state;
  }

  function resolveChase(state, action) {
    var chase = state.chase;
    if (!chase) return invalid(state, action, "There is no pursuit to resolve.");
    var legal = availableActions(state).some(function (x) { return x.type === action.type && (!x.to || x.to === action.to); });
    if (!legal) return invalid(state, action, "That escape route is not open.");
    var step = Math.min(chase.step, 2);
    var tape = state.outcomes[chase.slot].chase;
    var key = action.type === "BREAK_LINE" ? "breakLine" : action.type === "DISTRACT" ? "distract" : action.type.toLowerCase();
    var roll = tape[key][step];
    var delta = 0;
    if (action.type === "RUN") delta = roll >= 0.3 ? 1 : -1;
    else if (action.type === "BREAK_LINE") delta = roll >= 0.45 ? 2 : -1;
    else if (action.type === "HIDE") delta = roll >= 0.55 ? 3 : -2;
    else if (action.type === "DISTRACT") delta = roll >= 0.4 ? 1 : -1;
    chase.step += 1;
    chase.distance += delta;
    if (action.to) {
      state.player.location = action.to;
      chase.location = action.to;
      state.player.route.push({ slot: chase.slot, location: action.to, action: action.type, chaseStep: chase.step });
    }
    chase.history.push({ step: chase.step, action: action.type, to: action.to || null, delta: delta });
    appendTruth(state, { id: "chase-step:" + chase.slot + ":" + chase.step, slot: chase.slot, kind: "chase_step", action: action.type, location: chase.location, distance: chase.distance, result: delta > 0 ? "gained" : "lost" });
    if (chase.distance >= 4) {
      var escapedText = action.type === "HIDE"
        ? "You fold into a gap between wall and hedge. Breathing passes close enough to move your hair, then carries on without you."
        : action.type === "BREAK_LINE"
          ? "You cut through a yard, vault a low wall and leave your lantern burning on the wrong road. The tread follows the light."
          : action.type === "DISTRACT"
            ? "The thing follows the sound you made instead of the body that made it. By the time it learns the difference, your door is near."
            : "You choose a road without looking and reach the first barred gate with one breath left. Nothing crosses into the light behind you.";
      return finishChaseEscape(state, action, escapedText);
    }
    if (chase.distance <= 0 || chase.step >= 3) return finishChaseDeath(state, action);
    appendBeat(state, makeBeat("chase-beat:" + chase.slot + ":" + chase.step, "flee", chase.slot, chase.location,
      pursuitText(state, "step", chase.distance, delta > 0),
      { outcome: delta > 0 ? "distance_gained" : "distance_lost", meta: { voiceMode: (state.monsterSchedule.voice || {}).mode || "silent" } }));
    return state;
  }

  function resolveThreshold(state, action) {
    var threshold = state.thresholdEvent;
    if (!threshold || threshold.resolved) return invalid(state, action, "Nothing is waiting at the threshold.");
    var actor = thresholdActor(state, threshold.actorId);
    if (action.type === "LOOK_THROUGH") {
      if (threshold.looked) return invalid(state, action, "You already know who is outside.");
      var lookText = thresholdLookText(state);
      threshold.looked = true;
      threshold.look = lookText;
      appendTruth(state, { id: "threshold-look:" + state.cursor, slot: state.cursor, kind: "threshold_look", action: action.type, location: HOME, thresholdKind: threshold.kind, visitorKind: threshold.visitorKind, actorId: threshold.actorId || null, actors: ["player", threshold.actorId].filter(Boolean) });
      var lookBeat = appendBeat(state, makeBeat("threshold-look-beat:" + state.cursor, threshold.visitorKind === "monster" ? "threat" : "doorstep", state.cursor, HOME, lookText, {
        actorId: threshold.actorId || null,
        signature: semanticSignature({ family: "threshold", actorId: threshold.actorId, location: HOME, interaction: "look", outcome: threshold.visitorKind }),
        meta: { thresholdLook: true, recognition: threshold.visitorKind === "monster", critical: true }
      }));
      appendObservation(state, { eventId: "threshold-look:" + state.cursor, beatId: lookBeat && lookBeat.id, slot: state.cursor, kind: "threshold", location: HOME, actors: threshold.actorId ? [threshold.actorId] : [], clarity: "clear", reliability: "direct", text: lookText });
      return state;
    }
    if (action.type === "ANSWER_DOOR") {
      if (threshold.spoken) return invalid(state, action, "The visitor is waiting for your decision.");
      var spokenText = threshold.visitorKind === "neighbour"
        ? thresholdNeighbourAnswer(state, actor)
        : thresholdRequestText(state, !!threshold.looked);
      threshold.spoken = true;
      threshold.answer = spokenText;
      appendTruth(state, { id: "threshold-spoken:" + state.cursor, slot: state.cursor, kind: "threshold_spoken", action: action.type, location: HOME, visitorKind: threshold.visitorKind, actorId: threshold.actorId || null, purpose: threshold.purpose, requestMode: threshold.requestMode, looked: !!threshold.looked, text: spokenText });
      if (threshold.visitorKind === "neighbour" && threshold.purpose === "return_item" && actor) {
        appendTruth(state, { id: "threshold-confrontation:" + state.cursor + ":" + actor.id, slot: state.cursor, kind: "threshold_confrontation", location: HOME, actorId: actor.id, actors: ["player", actor.id], acknowledged: true });
        state.ledgers.memories[actor.id] = state.ledgers.memories[actor.id] || [];
        state.ledgers.memories[actor.id].push({ eventId: "threshold-confrontation:" + state.cursor + ":" + actor.id, slot: state.cursor, subject: "player", kind: "threshold_confrontation", location: HOME, clarity: "clear", acknowledged: true, interpretation: "They confronted the player about what was left behind during the night's watch." });
      }
      var spokenBeat = appendBeat(state, makeBeat("threshold-spoken-beat:" + state.cursor, threshold.visitorKind === "monster" ? "threat" : "doorstep", state.cursor, HOME, spokenText, {
        actorId: threshold.looked || threshold.visitorKind === "neighbour" ? threshold.actorId || null : null,
        signature: semanticSignature({ family: "threshold", actorId: threshold.actorId, location: HOME, interaction: "answer", outcome: threshold.requestMode }),
        meta: { thresholdAnswer: true, visitorKind: threshold.visitorKind, requestMode: threshold.requestMode, critical: true }
      }));
      appendObservation(state, { eventId: "threshold-spoken:" + state.cursor, beatId: spokenBeat && spokenBeat.id, slot: state.cursor, kind: "threshold", location: HOME, actors: threshold.visitorKind === "neighbour" && threshold.actorId ? [threshold.actorId] : [], clarity: threshold.looked || threshold.visitorKind === "neighbour" ? "clear" : "heard", reliability: "sensory", text: spokenText });
      return state;
    }
    var text;
    var killed = false;
    if (action.type === "KEEP_BARRED") {
      if (threshold.visitorKind === "neighbour") {
        text = threshold.spoken
          ? "You refuse. " + (actor ? actor.name : "Your neighbour") + " waits, then leaves before dawn."
          : "You keep silent. The visitor waits, then leaves before dawn.";
        if (threshold.purpose === "return_item") text += " " + (threshold.item || "Your glove") + " rests on the step.";
      } else if (state.monsterSchedule.id === "vampire") {
        text = "You give no invitation. The voice asks once more, then stops. At dawn, the step is empty.";
      } else {
        text = "You keep one hand on the bolt. The voice tries anger, fear and tears. You do not open the door.";
      }
    } else if (action.type === "STEP_OUTSIDE" || action.type === "INVITE_IN") {
      if (threshold.visitorKind === "monster") {
        killed = !!state.monsterSchedule.active;
        if (!killed) {
          text = "You open the door. The familiar face smiles, steps back into the dark and leaves you alive. It did not hunt tonight.";
        } else if (action.type === "INVITE_IN") {
          text = "You name " + (actor ? actor.name : "the visitor") + " and give permission. They cross the threshold smiling. No bolt can help you now.";
        } else {
          text = "You open the door and step out. The neighbour's face changes before you can call for help. The thing was waiting for this.";
        }
      } else if (threshold.purpose === "sign" && threshold.sign) {
        text = (actor ? actor.name : "Your neighbour") + " leads you to the " + threshold.clueLocation + ". " + STAMP_TEXT[threshold.sign] + " You stamp the mark into your Journal.";
        if (!state.found.stamps.some(function (stamp) { return stamp.sign === threshold.sign; })) {
          state.found.stamps.push({ sign: threshold.sign, slot: state.cursor, location: threshold.clueLocation, beatId: "threshold-result:" + state.cursor + ":" + action.type.toLowerCase(), source: "threshold_neighbour" });
        }
      } else if (threshold.purpose === "concern") {
        text = "You step outside. " + (actor ? actor.name : "Your neighbour") + " says " + (thresholdTarget(state) ? thresholdTarget(state).name : "someone") + " missed an expected return from the " + threshold.clueLocation + ". It may be fear, or it may be useful.";
        state.found.clues.push({ id: "threshold-concern:" + state.cursor, slot: state.cursor, location: HOME, text: text, source: "threshold_neighbour" });
      } else if (threshold.purpose === "rumour") {
        text = (actor ? actor.name : "Your neighbour") + " saw " + (thresholdTarget(state) ? thresholdTarget(state).name : "someone") + " near the " + threshold.clueLocation + " after dark. They cannot say why. You write down the lead, not a conclusion.";
        state.found.clues.push({ id: "threshold-rumour:" + state.cursor, slot: state.cursor, location: HOME, text: text, source: "threshold_neighbour" });
      } else if (threshold.purpose === "refuge") {
        text = "You let " + (actor ? actor.name : "your neighbour") + " inside. They heard footsteps behind them, but saw no face. You bar the door together until dawn.";
        state.found.clues.push({ id: "threshold-refuge:" + state.cursor, slot: state.cursor, location: HOME, text: text, source: "threshold_neighbour" });
      } else if (threshold.purpose === "question") {
        text = "You step outside. " + (actor ? actor.name : "Your neighbour") + " asks what you saw near the " + threshold.clueLocation + ". They listen, thank you, and leave.";
      } else {
        text = "You step outside. " + (actor ? actor.name : "Your neighbour") + " returns " + (threshold.item || "what you dropped") + " and leaves you with an uncomfortable question about the night's watch.";
      }
    } else return invalid(state, action, "The door remains between you and it.");
    threshold.resolved = true;
    threshold.choice = action.type;
    appendTruth(state, { id: "threshold-choice:" + state.cursor, slot: state.cursor, kind: "threshold_choice", action: action.type, location: HOME, thresholdKind: threshold.kind, visitorKind: threshold.visitorKind, actorId: threshold.actorId || null, looked: !!threshold.looked, killed: killed, text: text });
    var beatType = killed ? "flee" : "doorstep";
    var beat = appendBeat(state, makeBeat("threshold-result:" + state.cursor + ":" + action.type.toLowerCase(), beatType, state.cursor, HOME, text, {
      actorId: action.type === "KEEP_BARRED" ? null : threshold.actorId || null,
      outcome: killed ? "caught" : "safe",
      signature: semanticSignature({ family: "threshold", actorId: threshold.actorId, location: HOME, interaction: threshold.kind, outcome: action.type.toLowerCase() }),
      meta: { thresholdDecision: true, visitorKind: threshold.visitorKind, killed: killed, critical: true }
    }));
    appendObservation(state, { eventId: "threshold-choice:" + state.cursor, beatId: beat && beat.id, slot: state.cursor, kind: "threshold", location: HOME, actors: action.type !== "KEEP_BARRED" && threshold.actorId ? [threshold.actorId] : [], clarity: action.type === "KEEP_BARRED" ? "partial" : "clear", reliability: "sensory", text: text });
    if (killed) {
      state.player.alive = false;
      state.phase = "dead";
      appendTruth(state, { id: "player-death-threshold:" + state.cursor, slot: state.cursor, kind: "player_slain", location: HOME, actors: [threshold.actorId, "player"].filter(Boolean), source: "threshold" });
      return state;
    }
    return completeNight(state);
  }

  function resolveReturn(state, action) {
    if (action.type !== "REACH_HOME") return invalid(state, action, "Only your own door matters now.");
    state.player.location = HOME;
    state.player.route.push({ slot: state.cursor, location: HOME, action: "REACH_HOME" });
    appendTruth(state, { id: "reached-home:" + state.cursor, slot: state.cursor, kind: "returned_home", location: HOME });
    return settleAfterReturn(state);
  }

  function resolveThreat(state, action) {
    var threat = state.pendingThreat;
    if (!threat) return invalid(state, action, "There is no threat to resolve.");
    var outcome = state.outcomes[threat.slot];
    if (threat.kind === "recognition") {
      if (["FLEE", "WATCH_MONSTER", "CONFRONT_MONSTER"].indexOf(action.type) < 0) {
        return invalid(state, action, "There is no conversation left to have. Choose whether to flee, watch, or confront it.");
      }
      var armed = state.player.armedGuess;
      var correctName = action.type === "CONFRONT_MONSTER" && armed && armed.id === state.monsterSchedule.id;
      var wrongName = action.type === "CONFRONT_MONSTER" && armed && armed.id !== state.monsterSchedule.id;
      var survival = correctName || (action.type === "FLEE"
        ? outcome.flee >= 0.15
        : action.type === "WATCH_MONSTER"
          ? outcome.hide >= 0.35
          : outcome.intervene >= (wrongName ? 0.70 : 0.60));
      var groundSigns = state.monsterSchedule.signs.filter(function (sign) { return GROUND_SIGNS.indexOf(sign) >= 0; });
      var learnedSign = action.type === "WATCH_MONSTER" && groundSigns.length
        ? groundSigns[Math.floor(outcome.sign * groundSigns.length) % groundSigns.length]
        : null;
      var seenByMonster = action.type !== "FLEE" || outcome.flee < 0.4;
      appendTruth(state, {
        id: "monster-reveal-choice:" + threat.slot,
        slot: threat.slot,
        kind: "monster_reveal_choice",
        action: action.type,
        location: threat.location,
        actorId: threat.actorId,
        actors: ["player", threat.actorId],
        armedGuessId: armed && armed.id || null,
        correctName: !!correctName,
        wrongName: !!wrongName,
        succeeded: !!survival,
        caught: !survival,
        learnedSign: learnedSign,
        seenByMonster: seenByMonster
      });
      state.player.monsterSawYou = state.player.monsterSawYou || seenByMonster;
      state.pendingThreat = null;
      if (correctName) {
        state.monsterSchedule.active = false;
        appendTruth(state, { id: "monster-slain:" + threat.slot, slot: threat.slot, kind: "monster_slain", location: threat.location, actorId: threat.actorId, monsterId: state.monsterSchedule.id, actors: ["player", threat.actorId] });
        appendBeat(state, makeBeat("monster-slain-beat:" + threat.slot, "aftermath", threat.slot, threat.location,
          "You step from hiding with the true name and its answering rite. For the first time tonight, the thing wearing your neighbour's face is afraid.", { actorId: threat.actorId, outcome: "named" }));
        return completeNight(state);
      }
      if (!survival) {
        appendBeat(state, makeBeat("reveal-caught:" + threat.slot, "flee", threat.slot, threat.location,
          wrongName
            ? "You say the wrong name. The rite has no effect. It charges before you can speak again."
            : "It turns before you finish moving. You manage three strides. It catches you in two.",
          { actorId: threat.actorId, outcome: "caught" }));
        state.player.alive = false;
        state.phase = "dead";
        appendTruth(state, { id: "player-death:" + threat.slot, slot: threat.slot, kind: "player_slain", location: threat.location, actors: [threat.actorId, "player"] });
        return state;
      }
      var resultText = action.type === "FLEE"
        ? "You step backward while it is bent to its work. At the first barred gate, you turn and run."
        : action.type === "WATCH_MONSTER"
          ? "You stay hidden. " + (learnedSign ? MONSTER_WORK_TEXT[learnedSign] : "You learn its gait and shape, but it leaves no mark you can stamp.")
          : wrongName
            ? "The rite is wrong. It laughs. While its head is thrown back, you reach the wall and climb."
            : "You step out and say the human name. It turns. You survive the answer, but it has seen you clearly now.";
      appendBeat(state, makeBeat("reveal-escape:" + threat.slot + ":" + action.type.toLowerCase(), "flee", threat.slot, threat.location,
        resultText, { actorId: threat.actorId, sign: learnedSign, outcome: "escaped" }));
      state.phase = "returning";
      return state;
    }
    if (threat.kind === "witness") {
      if (action.type === "INTERVENE") {
        var saved = outcome.intervene < 0.35;
        appendTruth(state, { id: "intervene:" + threat.slot, slot: threat.slot, kind: "intervention", location: threat.location, actors: ["player", threat.victimId], succeeded: saved });
        appendBeat(state, makeBeat("intervene-beat:" + threat.slot, "flee", threat.slot, threat.location,
          saved ? "You shout. Your neighbour runs for the wall. The figure turns toward you instead." : "You shout. Your neighbour runs, but the figure reaches them before the wall.", { actorId: threat.victimId, outcome: saved ? "saved" : "failed" }));
        if (!saved) killVillager(state, threat.victimId, threat.slot, true);
        else if (state.monsterSchedule.relentless) {
          /* The warning saves the neighbour from the first rush by making the
             player the new quarry. If the player then escapes, the original
             victim remains the deterministic second target. */
          return startChase(state, {
            slot: threat.slot,
            location: threat.location,
            victimId: "player",
            fallbackVictimId: threat.victimId,
            fallbackLocation: threat.location
          });
        }
      } else if (action.type === "IGNORE" || action.type === "FLEE") {
        appendTruth(state, { id: "abandon:" + threat.slot + ":" + threat.victimId, slot: threat.slot, kind: "abandonment", action: action.type, location: threat.location, actors: ["player", threat.victimId], victimId: threat.victimId });
        killVillager(state, threat.victimId, threat.slot, true);
        appendBeat(state, makeBeat("flee-witness:" + threat.slot, "flee", threat.slot, threat.location, "You run while the sound behind you becomes an event the village must survive in the morning.", { actorId: threat.victimId, outcome: "abandoned" }));
      } else return invalid(state, action, "Choose whether to intervene or leave.");
      state.resolvedAttackSlots.push(threat.slot);
      state.pendingThreat = null;
      state.phase = "active";
      if (action.type === "FLEE") state.phase = "returning";
      return state;
    }
    if (action.type !== "FLEE" && action.type !== "HIDE") return invalid(state, action, "Run or hide.");
    if (action.type === "FLEE") return startChase(state, threat);
    var hideMode = action.hideMode || "legacy";
    if (["legacy", "cover", "shadow", "still"].indexOf(hideMode) < 0) return invalid(state, action, "That hiding place is not open.");
    var conceal = outcome.conceal && outcome.conceal[hideMode];
    var roll = conceal ? conceal.survive : outcome.hide;
    var threshold = hideMode === "shadow" ? 0.16 : hideMode === "cover" ? 0.30 : hideMode === "still" ? 0.48 : 0.25;
    var survival = roll >= threshold;
    var revealRoll = conceal ? conceal.reveal : 1;
    var learnedIdentity = survival && (hideMode === "still" ? revealRoll < 0.56 : hideMode === "cover" ? revealRoll < 0.18 : hideMode === "shadow" ? revealRoll < 0.03 : false);
    var learnedBuild = survival && (learnedIdentity || (hideMode === "still" ? revealRoll < 0.82 : hideMode === "cover" ? revealRoll < 0.48 : hideMode === "shadow" ? revealRoll < 0.10 : false));
    var learnedSign = survival && (learnedIdentity || (hideMode === "still" ? revealRoll < 0.92 : hideMode === "cover" ? revealRoll < 0.68 : hideMode === "shadow" ? revealRoll < 0.20 : false)) ? threat.sign : null;
    var host = state.cast.find(function (villager) { return villager.id === state.monsterSchedule.hostId; });
    var hostBuild = host && host.build || null;
    var hostName = host && host.name || "someone you know";
    var methodText = hideMode === "cover"
      ? "You press into the nearest cover and let it pass within arm's reach."
      : hideMode === "shadow"
        ? "You lower the lantern and crouch behind the deepest part of the wall's shadow."
        : hideMode === "still"
          ? "You stand without moving while it comes close enough to share your breath."
          : "You crouch behind the nearest cover and keep still while breathing passes close enough to warm your hair.";
    var readingText = learnedIdentity
      ? (state.monsterSchedule.revealText || ("The shape and gait resolve into " + hostName + "."))
      : learnedBuild
        ? "At the lantern's edge you fix one human fact: the build is " + (hostBuild || "familiar") + "."
        : learnedSign ? STAMP_TEXT[learnedSign] : "It passes beyond the lantern before you can see its face.";
    var resultText = survival ? methodText + " " + readingText : "It checks the hiding place before you have finished becoming still.";
    var closeRead = appendTruth(state, {
      id: "monster-close-read:" + threat.slot + ":" + hideMode,
      slot: threat.slot,
      kind: "monster_close_read",
      action: action.type,
      hideMode: hideMode,
      location: threat.location,
      actors: ["player"].concat(learnedIdentity && state.monsterSchedule.hostId ? [state.monsterSchedule.hostId] : []),
      actorId: learnedIdentity ? state.monsterSchedule.hostId : null,
      hostBuild: learnedBuild ? hostBuild : null,
      learnedIdentity: !!learnedIdentity,
      learnedBuild: !!learnedBuild,
      learnedSign: learnedSign,
      succeeded: survival
    });
    appendTruth(state, { id: "escape:" + threat.slot + ":hide:" + hideMode, slot: threat.slot, kind: "escape", method: "hide:" + hideMode, location: threat.location, succeeded: survival });
    var escapeBeat = appendBeat(state, makeBeat("escape-beat:" + threat.slot + ":hide:" + hideMode, "flee", threat.slot, threat.location,
      resultText, { actorId: learnedIdentity ? state.monsterSchedule.hostId : null, sign: learnedSign, outcome: survival ? "escaped" : "caught", meta: { hideMode: hideMode, learnedIdentity: !!learnedIdentity, learnedBuild: !!learnedBuild, learnedSign: !!learnedSign, critical: true } }));
    if (survival) appendObservation(state, { eventId: closeRead.id, beatId: escapeBeat && escapeBeat.id, slot: threat.slot, kind: "monster_close_read", location: threat.location, actors: learnedIdentity && state.monsterSchedule.hostId ? [state.monsterSchedule.hostId] : [], clarity: learnedIdentity ? "clear" : learnedBuild || learnedSign ? "partial" : "sensory", reliability: "direct", sign: learnedSign, build: learnedBuild ? hostBuild : null, text: resultText });
    if (learnedSign) state.found.stamps.push({ sign: learnedSign, slot: threat.slot, location: threat.location, beatId: escapeBeat && escapeBeat.id, source: "monster_close_read" });
    state.resolvedAttackSlots.push(threat.slot);
    state.pendingThreat = null;
    if (survival) {
      retargetRelentlessHunt(state, threat);
      state.phase = "returning";
    } else {
      state.player.alive = false;
      state.phase = "dead";
      appendTruth(state, { id: "player-death:" + threat.slot, slot: threat.slot, kind: "player_slain", location: threat.location, actors: [state.monsterSchedule.hostId, "player"].filter(Boolean) });
    }
    return state;
  }

  function reduce(state, action) {
    if (!state || !action || !action.type) return invalid(state || {}, action || {}, "An action type is required.");
    var next = upgradeStateInPlace(clone(state));
    var presentingBeat = next.currentBeat;
    /* currentBeat is a one-action presentation payload, not a sticky scene.
       Clear it before advancing so an uneventful move cannot repeat the last
       villager's words or discovery on the following screen. */
    next.currentBeat = null;
    next.lastError = null;
    if (next.phase === "dead" || next.phase === "complete") return invalid(next, action, "The night has ended.");
    if (next.phase === "threshold") return resolveThreshold(next, action);
    if (next.phase === "returning") return resolveReturn(next, action);
    if (next.phase === "chase") return resolveChase(next, action);
    if (next.phase === "threat") return resolveThreat(next, action);
    var forcedWatchFollow = presentingBeat && presentingBeat.type === "watch" && presentingBeat.meta && presentingBeat.meta.departure
      && action.type === "FOLLOW" && action.actorId === presentingBeat.actorId;
    var legal = forcedWatchFollow || availableActions(next).some(function (x) { return x.type === action.type && (!x.actorId || x.actorId === action.actorId) && (!x.to || x.to === action.to); });
    if (!legal) return invalid(next, action, "That action is not available now.");
    if (action.type === "GO_HOME") {
      next.phase = "returning";
      next.player.route.push({ slot: next.cursor, location: next.player.location, action: "GO_HOME" });
      appendTruth(next, { id: "go-home:" + next.cursor, slot: next.cursor, kind: "started_home", location: next.player.location });
      return next;
    }
    if (action.ignoreDelusion && presentingBeat && presentingBeat.type === "delusion" && presentingBeat.meta && presentingBeat.meta.requiresResponse) {
      appendTruth(next, { id: "strange-sight-ignored:" + Math.max(0, next.cursor), slot: Math.max(0, next.cursor), kind: "strange_sight_ignored", location: next.player.location });
    }
    if (action.approachDelusion && presentingBeat && presentingBeat.type === "delusion" && presentingBeat.meta && presentingBeat.meta.requiresResponse) {
      /* Looking closer is an answer to the thing already in front of you, not
         another hour of travel. Resolve it in the current slot so a sight at
         the edge of dawn cannot step beyond the sampled night. */
      var responseSlot = Math.max(0, next.cursor);
      var approachFragments = presentingBeat.meta.fragments || [];
      var approachRisk = keyedNumber(next.seed, "delusion-approach-risk:" + (presentingBeat.id || responseSlot));
      next.actionHistory.push({ slot: responseSlot, type: "SEARCH", to: null, actorId: null, approachDelusion: true });
      appendTruth(next, { id: "delusion-approach:" + responseSlot, slot: responseSlot, kind: "delusion_approach", location: next.player.location, risk: approachRisk, attractedThreat: next.monsterSchedule.active && approachRisk < 0.4 });
      if (next.monsterSchedule.active && approachRisk < 0.4) {
        triggerDelusionApproachThreat(next, responseSlot, next.player.location, approachFragments);
      } else {
        var resolutionRoll = keyedNumber(next.seed, "strange-sight-resolution:" + (presentingBeat.id || responseSlot));
        var present = actorsAt(next, next.player.location, responseSlot).filter(function (villager) {
          return villager.alive && next.presentedActorIds.indexOf(villager.id) < 0;
        }).sort(function (a, b) {
          return keyedNumber(next.seed, "strange-sight-person:" + responseSlot + ":" + a.id) - keyedNumber(next.seed, "strange-sight-person:" + responseSlot + ":" + b.id);
        });
        var unusedSigns = next.monsterSchedule.signs.filter(function (sign) {
          return GROUND_SIGNS.indexOf(sign) >= 0 && !next.found.stamps.some(function (stamp) { return stamp.sign === sign; });
        });
        if (present.length && resolutionRoll < 0.34) {
          var person = present[0];
          recordEncounter(next, person, responseSlot, false, "crossed_paths", true);
          if (next.currentBeat && next.currentBeat.actorId === person.id) {
            next.currentBeat.text = "You lift the lantern. It is " + person.name + ", crossing the lane alone. They keep walking.";
            next.currentBeat.meta = { strangeSightResolution: "person", soundCue: "bustle", critical: true };
          }
          if (next.presentedActorIds.indexOf(person.id) < 0) next.presentedActorIds.push(person.id);
          appendTruth(next, { id: "strange-sight-person:" + responseSlot + ":" + person.id, slot: responseSlot, kind: "strange_sight_person", location: next.player.location, actorId: person.id, actors: ["player", person.id] });
        } else if (unusedSigns.length && resolutionRoll < 0.70 && !next.found.stamps.length) {
          var sign = unusedSigns[Math.floor(resolutionRoll * unusedSigns.length) % unusedSigns.length];
          var signTruth = appendTruth(next, { id: "strange-sight-sign:" + responseSlot + ":" + sign, slot: responseSlot, kind: "strange_sight_sign", location: next.player.location, sign: sign });
          var signBeat = appendBeat(next, makeBeat("strange-sight-sign-beat:" + responseSlot + ":" + sign, "stamp", responseSlot, next.player.location,
            "You lift the lantern and go closer. " + STAMP_TEXT[sign], { sign: sign, truthEventId: signTruth.id, meta: { strangeSightResolution: "sign", soundCue: sign === "hex" || sign === "graves" ? "earth" : sign === "flora" ? "leaves" : "breath_close", critical: true } }));
          next.found.stamps.push({ sign: sign, slot: responseSlot, location: next.player.location, beatId: signBeat && signBeat.id, source: "strange_sight" });
          appendObservation(next, { eventId: signTruth.id, beatId: signBeat && signBeat.id, slot: responseSlot, kind: "evidence", location: next.player.location, actors: [], clarity: "clear", reliability: "direct", sign: sign, text: signBeat && signBeat.text, weather: next.weather });
        } else {
          var falseTruth = appendTruth(next, { id: "strange-sight-false:" + responseSlot, slot: responseSlot, kind: "strange_sight_false", location: next.player.location });
          var falseBeat = appendBeat(next, makeBeat("delusion-resolution:" + responseSlot, "delusion", responseSlot, next.player.location,
            approachFragments.slice(1).join(" "), { truthEventId: falseTruth.id, meta: { fragments: approachFragments.slice(1), resolvedAsUnreal: true, requiresResponse: false, strangeSightResolution: "false", soundCue: "leaves", critical: true } }));
          if (falseBeat) next.found.delusions.push(clone(falseBeat));
          appendObservation(next, { eventId: falseTruth.id, beatId: falseBeat && falseBeat.id, slot: responseSlot, kind: "false_sight", location: next.player.location, actors: [], clarity: "clear", reliability: "direct", text: falseBeat && falseBeat.text, weather: next.weather });
        }
      }
      finishIfNeeded(next);
      return next;
    }
    if (action.type === "HAIL") {
      /* Conversation is a reaction inside the current scene, not another
         hour of night. It can change the villager's later timing without
         stealing one of the player's few route beats. */
      var hailed = next.cast.find(function (villager) { return villager.id === action.actorId; });
      if (!hailed) return invalid(next, action, "There is nobody there to answer.");
      appendTruth(next, { id: "player:" + next.cursor + ":hail:" + action.actorId, slot: next.cursor, kind: "player_action", action: "HAIL", location: next.player.location, actorId: action.actorId });
      next.actionHistory.push({ slot: next.cursor, type: "HAIL", to: null, actorId: action.actorId });
      recordEncounter(next, hailed, next.cursor, true, "hailed", true);
      if (next.presentedActorIds.indexOf(hailed.id) < 0) next.presentedActorIds.push(hailed.id);
      next.delays[action.actorId] = (next.delays[action.actorId] || 0) + 1;
      return next;
    }
    if (action.type === "KEEP_WATCH" || action.type === "SEARCH_ON") {
      /* Watching or maintaining a methodical search is a dramatic skip, not
         a seven-click tax. The hidden village continues slot by slot; control
         returns at the next encounter, finding, disturbance, threat, or dawn. */
      var startingBeats = next.beats.length;
      while (next.phase === "active" && next.cursor < next.slots - 1) {
        var watchSlot = next.cursor + 1;
        next.cursor = watchSlot;
        next.actionHistory.push({ slot: watchSlot, type: action.type, to: null, actorId: null, searchMode: action.searchMode || null });
        arrive(next, { type: action.type, searchMode: action.searchMode || null }, watchSlot);
        finishIfNeeded(next);
        if (next.phase !== "active" || next.beats.length > startingBeats) break;
      }
      return next;
    }
    if (action.type === "FOLLOW") return resolveFollow(next, action);
    var slot = next.cursor + 1;
    if (action.type === "LEAVE") {
      next.phase = "active";
      next.player.location = action.to || "Village Square";
    } else if (action.type === "MOVE") {
      next.player.location = action.to;
    }
    next.cursor = slot;
    next.actionHistory.push({ slot: slot, type: action.type, to: action.to || null, actorId: action.actorId || null, searchMode: action.searchMode || null, investigateEventId: action.investigateEventId || null });
    arrive(next, action, slot);
    if (action.investigateEventId && next.phase === "active") {
      resolveAttackInvestigation(next, action, slot);
    }
    if (presentingBeat && presentingBeat.meta && presentingBeat.meta.quietPresence && action.type === "LISTEN" && next.phase === "active") {
      var quietResponse = presentingBeat.meta.responseText || "You turn toward it. The movement stops and does not come closer.";
      var quietTruth = appendTruth(next, {
        id: "quiet-presence-response:" + presentingBeat.id,
        slot: slot,
        kind: "quiet_monster_presence",
        location: next.player.location,
        actors: [],
        voiceMode: presentingBeat.meta.voiceMode || "silent",
        activeHunt: false
      });
      var quietBeat = appendBeat(next, makeBeat("quiet-presence-response-beat:" + presentingBeat.id, "atmosphere", slot, next.player.location,
        quietResponse, { truthEventId: quietTruth.id, meta: { quietPresenceResolution: true, voiceMode: presentingBeat.meta.voiceMode || "silent", critical: true } }));
      appendObservation(next, { eventId: quietTruth.id, beatId: quietBeat && quietBeat.id, slot: slot, kind: "temperament", location: next.player.location, actors: [], clarity: "sensory", reliability: "direct", text: quietResponse, weather: next.weather });
    }
    if (action.type === "SEARCH" && action.searchMode && next.phase === "active" && !next.currentBeat && next.monsterSchedule.active) {
      var monsterNearSearch = next.monsterSchedule.huntLoc === next.player.location
        || next.monsterSchedule.locations[slot] === next.player.location;
      var searchRisk = action.searchMode === "edges" ? 0.34 : 0.24;
      if (monsterNearSearch && keyedNumber(next.seed, "search-risk:" + slot + ":" + action.searchMode) < searchRisk) {
        triggerSearchThreat(next, slot, next.player.location, action.searchMode);
      }
    }
    finishIfNeeded(next);
    return next;
  }

  function action(type, label, tone, extra) {
    var result = { type: type, label: label, tone: tone || "bone" };
    Object.keys(extra || {}).forEach(function (key) { result[key] = extra[key]; });
    return result;
  }

  function concealmentActions(location) {
    var places = {
      "Village Square": ["Press into a shuttered doorway", "Drop behind the well trough", "Stand still beneath the lantern"],
      "Old Church": ["Press into the porch recess", "Drop behind the churchyard wall", "Stand still on the path"],
      Graveyard: ["Fold behind a headstone", "Drop below the boundary wall", "Stand still between the graves"],
      "Dark Forest": ["Press beneath the exposed roots", "Drop into the bracken", "Stand very still on the path"],
      "Old Mill": ["Press behind the wheel housing", "Drop beside the millrace wall", "Stand still in the wheel-yard"],
      Tavern: ["Press into the stable doorway", "Drop behind the rain barrels", "Stand still in the yard"]
    };
    var labels = places[location] || ["Press into the nearest cover", "Drop into shadow", "Stand very still"];
    return [
      action("HIDE", labels[0], "amber", { hideMode: "cover" }),
      action("HIDE", labels[1], "quiet", { hideMode: "shadow" }),
      action("HIDE", labels[2], "danger", { hideMode: "still" }),
      action("FLEE", "Back away toward home", "danger")
    ];
  }

  function availableActions(state) {
    if (!state || state.phase === "dead" || state.phase === "complete") return [];
    if (state.phase === "planned") {
      return (state.graph[HOME] || ["Village Square"]).map(function (to) { return action("LEAVE", "Step into the night", "amber", { to: to }); });
    }
    if (state.phase === "threat") {
      if (state.pendingThreat.kind === "recognition") return [
        action("FLEE", "Flee, quietly, while it is busy", "danger"),
        action("WATCH_MONSTER", "Stay hidden. Watch it. Learn it", "amber"),
        action("CONFRONT_MONSTER", state.player.armedGuess ? "Step out. Name it. End it here" : "Step out and say the name", "danger")
      ];
      if (state.pendingThreat.kind === "witness") return [
        action("INTERVENE", "Shout a warning", "danger"),
        action("IGNORE", "Stay silent", "quiet"),
        action("FLEE", "Run for home", "danger")
      ];
      return concealmentActions(state.player.location);
    }
    if (state.phase === "chase") {
      var chaseActions = [];
      (state.graph[state.player.location] || []).filter(function (to) { return to !== HOME; }).forEach(function (to) {
        chaseActions.push(action("RUN", "Run for the " + to, "danger", { to: to }));
      });
      chaseActions.push(action("BREAK_LINE", "Cut through a yard and break sight", "danger"));
      chaseActions.push(action("HIDE", "Leave the lantern and hide", "quiet"));
      chaseActions.push(action("DISTRACT", "Throw something down the other road", "quiet"));
      return chaseActions;
    }
    if (state.phase === "threshold") {
      var thresholdActions = [action("KEEP_BARRED", state.thresholdEvent.spoken ? "Refuse. Keep the door barred" : "Keep silent. Keep the door barred", "quiet")];
      if (!state.thresholdEvent.looked) thresholdActions.push(action("LOOK_THROUGH", "Look through the shutter", "quiet"));
      var thresholdVisitor = thresholdActor(state, state.thresholdEvent.actorId);
      if (!state.thresholdEvent.spoken) {
        var answerLabel = !state.thresholdEvent.looked ? "Answer without looking"
          : state.thresholdEvent.visitorKind === "monster" ? "Answer the monster through the closed door"
            : "Answer " + (thresholdVisitor ? thresholdVisitor.name : "your neighbour") + " through the closed door";
        thresholdActions.push(action("ANSWER_DOOR", answerLabel, state.thresholdEvent.looked && state.thresholdEvent.visitorKind === "neighbour" ? "bone" : "danger"));
      } else if (state.thresholdEvent.requestMode === "inside") {
        thresholdActions.push(action("INVITE_IN", "Unbar the door. Invite " + (thresholdVisitor ? thresholdVisitor.name : "them") + " inside", "danger"));
      } else {
        thresholdActions.push(action("STEP_OUTSIDE", "Unbar the door. Step outside", "danger"));
      }
      return thresholdActions;
    }
    if (state.phase === "returning") return [action("REACH_HOME", "Reach your door and throw the bolt", "amber")];
    var result = [];
    (state.graph[state.player.location] || []).filter(function (to) { return to !== HOME; }).forEach(function (to) {
      result.push(action("MOVE", "Go to the " + to, "bone", { to: to }));
    });
    result.push(action("WAIT", "Wait and watch", "quiet"));
    result.push(action("KEEP_WATCH", "Keep watch until something changes", "quiet"));
    result.push(action("SEARCH", "Search by lantern", "amber"));
    result.push(action("SEARCH_ON", "Continue the search", "amber"));
    result.push(action("LISTEN", "Lower the lantern and listen", "quiet"));
    actorsAt(state, state.player.location, state.cursor).filter(function (v) { return playerCanSeeActor(state, v.id, state.cursor); }).forEach(function (v) {
      result.push(action("HAIL", "Hail " + v.name, "bone", { actorId: v.id }));
      result.push(action("FOLLOW", "Follow " + v.name, "amber", { actorId: v.id }));
    });
    result.push(action("GO_HOME", "Go home and bar the door", "bone"));
    return result;
  }

  /* The simulation remains a complete village graph, but the night screen is
     a directed dramatic corridor. The player may continue their declared
     errand, interrupt the person presently framed by the scene, accept the
     diversion of following them, stay once the errand is done, or go home.
     Other legal roads continue to exist for schedules and monster movement;
     they are deliberately not exposed as a permanent fast-travel menu. */
  function guidedActions(state, guide) {
    guide = guide || {};
    var all = availableActions(state);
    if (!state || state.phase === "dead" || state.phase === "complete") return [];
    if (["threat", "chase", "threshold", "returning"].indexOf(state.phase) >= 0) return all;
    var target = guide.target;
    if (state.phase === "planned") {
      var openingPath = target ? shortestPath(state.graph, HOME, target) : [];
      var openingStep = openingPath[1];
      var leave = all.find(function (item) { return item.type === "LEAVE" && item.to === openingStep; }) || all[0];
      if (!leave) return [];
      if (guide.kind === "watch") {
        leave.label = "Take the direct back lane to watch " + (guide.actorName || "their") + "'s door";
      } else leave.label = "Take the back lanes straight to the " + target;
      return [leave];
    }
    var result = [];
    var used = {};
    function add(candidate, label) {
      if (!candidate) return;
      var key = candidate.type + "|" + (candidate.to || "") + "|" + (candidate.actorId || "") + "|" + (candidate.searchMode || "");
      if (used[key]) return;
      used[key] = true;
      var copy = clone(candidate);
      if (label) copy.label = label;
      result.push(copy);
    }
    var beat = state.currentBeat;
    if (beat && beat.type === "watch" && beat.meta && beat.meta.departure) {
      var departureName = guide.actorName || (state.cast.find(function (villager) { return villager.id === beat.actorId; }) || {}).name || "them";
      add(all.find(function (item) { return item.type === "FOLLOW" && item.actorId === beat.actorId; }) || action("FOLLOW", "Follow " + departureName, "amber", { actorId: beat.actorId }), "Follow " + departureName);
      return result.slice(0, 1);
    }
    if (beat && beat.type === "watch" && beat.meta && beat.meta.noDeparture) {
      add(all.find(function (item) { return item.type === "GO_HOME"; }), "They do not leave. Head home at dawn");
      return result.slice(0, 2);
    }
    if (beat && beat.type === "delusion" && beat.meta && beat.meta.requiresResponse) {
      var approach = all.find(function (item) { return item.type === "SEARCH"; });
      if (approach) {
        approach = clone(approach);
        approach.approachDelusion = true;
      }
      add(approach, "Move closer and see what it is");
      var ignore = guide.kind === "search"
        ? all.find(function (item) { return item.type === "SEARCH_ON"; })
        : all.find(function (item) { return item.type === "KEEP_WATCH"; });
      if (!guide.intentDone && target && state.player.location !== target) {
        var ignorePath = shortestPath(state.graph, state.player.location, target);
        ignore = all.find(function (item) { return item.type === "MOVE" && item.to === ignorePath[1]; }) || ignore;
      }
      if (ignore) {
        ignore = clone(ignore);
        ignore.ignoreDelusion = true;
      }
      var ignoreLabel = !guide.intentDone && target && state.player.location !== target
        ? "Do not look. Continue to the " + target
        : guide.kind === "search" ? "Do not look. Continue your search" : "Do not look. Keep watching";
      add(ignore, ignoreLabel);
      add(all.find(function (item) { return item.type === "GO_HOME"; }), "Leave it. Head for home");
      return result.slice(0, 3);
    }
    if (beat && beat.type === "delusion" && beat.meta && beat.meta.strangeSightResolution === "false") {
      add(all.find(function (item) { return item.type === (guide.kind === "search" ? "SEARCH_ON" : "KEEP_WATCH"); }), guide.kind === "search" ? "Continue your search" : "Continue your watch");
      if (guide.intentDone) add(all.find(function (item) { return item.type === "GO_HOME"; }), "Head for home");
      return result.slice(0, 2);
    }
    if (beat && beat.type === "atmosphere" && beat.meta && beat.meta.investigable && beat.meta.disturbanceLocation) {
      var investigate = all.find(function (item) { return item.type === "MOVE" && item.to === beat.meta.disturbanceLocation; });
      if (investigate) {
        investigate = clone(investigate);
        investigate.investigateEventId = beat.meta.attackEventId || beat.truthEventId;
        investigate.investigateVictimId = beat.meta.victimId;
      }
      add(investigate, "Investigate the scream from the " + beat.meta.disturbanceLocation);
      if (guide.kind === "search") add(all.find(function (item) { return item.type === "SEARCH_ON"; }), "Stay and continue searching the " + (guide.target || state.player.location));
      else add(all.find(function (item) { return item.type === "KEEP_WATCH"; }), "Stay where you are");
      add(all.find(function (item) { return item.type === "GO_HOME"; }), "Leave it. Head for home");
      return result.slice(0, 3);
    }
    if (beat && beat.type === "atmosphere" && beat.meta && beat.meta.requiresResponse) {
      add(all.find(function (item) { return item.type === "LISTEN"; }), state.weather === "storm" ? "Hold still. Listen for the voice again" : "Turn toward the sound and listen");
      add(all.find(function (item) { return item.type === "GO_HOME"; }), "Run. Head for home");
      return result.slice(0, 2);
    }
    if (beat && beat.meta && beat.meta.bodyInvestigation && beat.actorId) {
      var changedVictim = state.cast.find(function (villager) { return villager.id === beat.actorId && villager.changed; });
      if (changedVictim) {
        add(all.find(function (item) { return item.type === "HAIL" && item.actorId === beat.actorId; }), "Speak to " + changedVictim.name);
        add(all.find(function (item) { return item.type === "FOLLOW" && item.actorId === beat.actorId; }), "Follow " + changedVictim.name + " when they move");
        if (target && state.player.location !== target) {
          var returnPath = shortestPath(state.graph, state.player.location, target);
          add(all.find(function (item) { return item.type === "MOVE" && item.to === returnPath[1]; }), "Return to the " + target);
        } else add(all.find(function (item) { return item.type === "GO_HOME"; }), "Leave them. Head for home");
        return result.slice(0, 3);
      }
    }
    /* A person presently framed by the scene is the immediate dramatic
       choice. Put both social reactions ahead of routine location work so
       the three-button corridor cannot silently cut Follow off as item four. */
    if (guide.actorId) {
      var hailKey = guide.actorId + "|HAIL";
      var followKey = guide.actorId + "|FOLLOW";
      if (!(guide.interacted || {})[hailKey]) add(all.find(function (item) { return item.type === "HAIL" && item.actorId === guide.actorId; }));
      if (!(guide.interacted || {})[followKey]) add(all.find(function (item) { return item.type === "FOLLOW" && item.actorId === guide.actorId; }));
    }
    var atTarget = !!target && state.player.location === target;
    if (target && !atTarget) {
      var path = shortestPath(state.graph, state.player.location, target);
      var nextLocation = path[1];
      var moveLabel = guide.intentDone ? "Return to the " + target
        : state.player.location === "Old Church" && target === "Graveyard"
        ? "Follow the churchyard lane to the Graveyard"
        : state.player.location === "Village Square" && target !== "Village Square"
          ? "Keep to the back lanes toward the " + target
          : "Continue to the " + target;
      add(all.find(function (item) { return item.type === "MOVE" && item.to === nextLocation; }), moveLabel);
    }
    if (atTarget && guide.kind === "search") {
      var baseSearch = all.find(function (item) { return item.type === "SEARCH"; });
      var searches = guide.searches || {};
      var siteChoices = SITE_SEARCH_CHOICES[target] || {};
      if (baseSearch && !searches.ground) {
        var groundSearch = clone(baseSearch);
        groundSearch.searchMode = "ground";
        add(groundSearch, siteChoices.ground || "Explore the open ground");
      }
      if (baseSearch && !searches.edges) {
        var edgeSearch = clone(baseSearch);
        edgeSearch.searchMode = "edges";
        add(edgeSearch, siteChoices.edges || "Explore the boundary");
      }
      if (guide.intentDone) add(all.find(function (item) { return item.type === "SEARCH_ON"; }), siteChoices.onward || "Make another circuit");
    } else if (atTarget && !guide.intentDone && guide.kind === "watch") {
      add(all.find(function (item) { return item.type === "WAIT"; }), "Take up watch near " + (guide.actorName || "their") + " door");
    }
    if (guide.actorId) {
      if (guide.intentDone && (guide.kind !== "search" || atTarget)) add(all.find(function (item) { return item.type === (guide.kind === "search" ? "SEARCH_ON" : "KEEP_WATCH"); }));
    } else if (atTarget && guide.intentDone) {
      add(all.find(function (item) { return item.type === (guide.kind === "search" ? "SEARCH_ON" : "KEEP_WATCH"); }));
    }
    if (guide.intentDone) add(all.find(function (item) { return item.type === "GO_HOME"; }), "Head for home");
    if (!result.length) add(all.find(function (item) { return item.type === "KEEP_WATCH"; }) || all.find(function (item) { return item.type === "GO_HOME"; }));
    return result.slice(0, 3);
  }

  function safeId(value) {
    return String(value || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
  }

  /* The simulation records every occupied time-slot because timing matters
     to attacks and alibis. Dawn and interviews need a human-sized projection:
     one thread per person and place, with the strongest mutual recognition
     retained. This prevents three adjacent clock ticks from becoming three
     versions of the same question. */
  function consequenceProjection(state) {
    var groups = {};
    var encounterKinds = ["hailed", "crossed_paths", "passed_unseen", "followed"];
    (state.ledgers.truth || []).filter(function (event) { return encounterKinds.indexOf(event.kind) >= 0; }).forEach(function (event) {
      var actorId = (event.actors || []).find(function (id) { return id !== "player"; });
      if (!actorId) return;
      var key = actorId + "|" + event.location;
      if (!groups[key]) groups[key] = {
        eventId: "n" + state.night + ":encounter:" + safeId(actorId) + ":" + safeId(event.location),
        actorId: actorId,
        location: event.location,
        firstSlot: event.slot,
        lastSlot: event.slot,
        acknowledged: false,
        playerSaw: false,
        sourceEventIds: [],
        seenSlots: [],
        unseenSlots: []
      };
      var group = groups[key];
      group.firstSlot = Math.min(group.firstSlot, event.slot);
      group.lastSlot = Math.max(group.lastSlot, event.slot);
      group.acknowledged = group.acknowledged || !!event.acknowledged;
      group.playerSaw = group.playerSaw || event.playerSaw !== false;
      group.followed = group.followed || event.kind === "followed";
      group.sourceEventIds.push(event.id);
      (event.playerSaw === false ? group.unseenSlots : group.seenSlots).push(event.slot);
    });
    var encounters = Object.keys(groups).map(function (key) {
      var group = groups[key];
      var memories = (state.ledgers.memories[group.actorId] || []).filter(function (memory) { return group.sourceEventIds.indexOf(memory.eventId) >= 0; });
      var strongest = memories.find(function (memory) { return memory.acknowledged; }) || memories[memories.length - 1] || null;
      group.kind = group.acknowledged ? "hailed" : group.followed ? "followed" : group.playerSaw ? "crossed_paths" : "passed_unseen";
      group.weather = state.weather;
      group.clarity = group.acknowledged ? "clear" : group.playerSaw ? (state.weather === "frost" ? "clear" : state.weather === "fog" ? "obscured" : "partial") : "one_sided";
      group.weatherEffect = state.weather === "fog" ? (group.playerSaw ? "The face was recovered only at close range." : "Fog hid the villager from the player, though the villager saw the player's lantern.")
        : state.weather === "storm" ? "Rain and thunder reduced sight and hearing."
          : state.weather === "frost" ? "Breath and prints preserved the route." : null;
      group.interpretation = strongest && strongest.interpretation || null;
      return group;
    });
    /* If the player deliberately followed someone, that complete scene is
       the interview memory. Do not also ask about an incidental glimpse of
       the same person on the road unless they openly hailed each other. */
    var followedActors = {};
    encounters.forEach(function (group) { if (group.followed) followedActors[group.actorId] = true; });
    encounters = encounters.filter(function (group) {
      return group.followed || group.acknowledged || !followedActors[group.actorId];
    }).sort(function (a, b) { return a.firstSlot - b.firstSlot || a.actorId.localeCompare(b.actorId); });

    var relationships = [];
    (state.ledgers.truth || []).forEach(function (event) {
      if (event.kind === "intervention") {
        var rescuedId = (event.actors || []).find(function (id) { return id !== "player"; });
        if (rescuedId) relationships.push({ eventId: event.id, actorId: rescuedId, kind: event.succeeded ? "rescued" : "attempted_rescue", succeeded: !!event.succeeded, slot: event.slot, location: event.location });
      } else if (event.kind === "abandonment") {
        relationships.push({ eventId: event.id, actorId: event.victimId, kind: "abandoned", action: event.action, slot: event.slot, location: event.location });
      } else if (event.kind === "threshold_confrontation") {
        relationships.push({ eventId: event.id, actorId: event.actorId, kind: "caught_watching", slot: event.slot, location: event.location });
      }
    });

    var findings = (state.found.clues || []).filter(function (beat) { return !!beat.actorId; }).map(function (beat) {
      return { eventId: "n" + state.night + ":finding:" + safeId(beat.id), actorId: beat.actorId, location: beat.location, slot: beat.slot, text: beat.text, beatId: beat.id };
    });
    var secrets = (state.ledgers.truth || []).filter(function (event) {
      return event.kind === "followed" && event.revealedSecret;
    }).map(function (event) {
      return { eventId: event.id, actorId: event.actorId, location: event.location, slot: event.slot, summary: event.secretSummary || null };
    });
    (state.beats || []).filter(function (beat) {
      return beat.type === "watch" && beat.actorId && beat.meta && beat.meta.revealsSecret;
    }).forEach(function (beat) {
      secrets.push({ eventId: beat.id, actorId: beat.actorId, location: beat.location, slot: beat.slot, summary: beat.meta.secretSummary || null });
    });
    var investigations = (state.ledgers.truth || []).filter(function (event) {
      return event.kind === "investigated_attack";
    }).map(function (event) {
      return {
        eventId: event.id,
        attackEventId: event.attackEventId,
        victimId: event.victimId,
        location: event.location,
        slot: event.slot,
        clueFound: !!event.clueFound,
        sign: event.sign || null,
        heardLastWords: !!event.heardLastWords,
        lastWords: event.lastWords || null,
        recognizedChanged: !!event.recognizedChanged,
        suspicious: !!event.suspicious,
        witnessIds: (event.witnessIds || []).slice()
      };
    });
    return { weather: state.weather, encounters: encounters, relationships: relationships, findings: findings, secrets: secrets, investigations: investigations };
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
      pendingThreat: state.pendingThreat ? { kind: state.pendingThreat.kind, victimId: state.pendingThreat.victimId, location: state.pendingThreat.location } : null,
      chase: state.chase ? { step: state.chase.step, distance: state.chase.distance, location: state.chase.location } : null,
      threshold: state.phase === "threshold" && state.thresholdEvent ? { kind: state.thresholdEvent.kind } : null
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
    WEATHER_PROFILES: clone(WEATHER_PROFILES),
    semanticSignature: semanticSignature,
    noveltyScore: noveltyScore,
    livingCast: livingCast,
    createNight: createNight,
    fromExistingFacts: fromExistingFacts,
    upgradeState: upgradeState,
    consequenceProjection: consequenceProjection,
    reduce: reduce,
    availableActions: availableActions,
    guidedActions: guidedActions,
    actorAt: actorLocation,
    actorsAt: actorsAt,
    visibleState: visibleState,
    validateNight: validateNight
  });
});
