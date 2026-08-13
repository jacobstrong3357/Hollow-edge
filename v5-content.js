/* Hollow's Edge V5 authored content.
   Plain JavaScript on purpose: the game must still boot from file:// without
   a bundler. Engine code lives in index.html; this file contains only data. */
(function () {
  var scenarios = [
    {
      id: "watcher_in_yews", authorLabel: "The watcher in the yews", actorPool: "out_here", when: "out_here", weight: 5,
      monsterTags: ["cunning", "haunt", "church"], perceptions: ["clear", "partial", "heard"],
      audio: ["gate_turn", "crickets_cut", "breathing_far"],
      opening: "The iron gate gives beneath your hand. Beyond it, the yews lean over the graves as though conferring. One upstairs window in the village goes dark when you step through.",
      silence: "The wind stops. The grass stops. Even your coat seems to know better than to move. The village has not gone to sleep. It has gone quiet.",
      reveal: {
        clear: "For one instant, {actor} stands beyond the last stone, watching you rather than the church. You blink. The place is empty.",
        partial: "Someone stands beyond the last stone. Familiar height. Familiar coat. The face never turns far enough, and then there is only yew shadow.",
        heard: "A measured breath comes from beyond the last stone. When you raise the lantern there is nobody there, but one yew branch is still moving.",
      },
      question: "I saw you beyond the last grave. Why were you watching me?",
      honest: "I saw your lantern enter the churchyard and wanted to know whether it came out again. That is all. You have made watchers of us.",
      evasive: "You saw a coat and decided it had my face. The churchyard is full of shapes after dark. Some of them are even people.",
      memory: "watched you enter the Old Church grounds after the bell",
    },
    {
      id: "grief_at_grave", authorLabel: "An hour with the dead", actorPool: "griever", when: "recent_death", weight: 7,
      monsterTags: ["grave", "haunt"], perceptions: ["clear", "partial", "heard"],
      audio: ["wet_grass", "cloth_move", "bell_single"],
      opening: "A lantern is already moving between the graves, kept low under a coat. Whoever carries it knows exactly which stone they came for.",
      silence: "The lantern stops. So does the quiet sound of someone speaking to a person who cannot answer.",
      reveal: {
        clear: "{actor} kneels at {dead}'s grave with both hands pressed into the loose earth. They look up and see you seeing them.",
        partial: "A kneeling figure bends over {dead}'s grave. Grief makes every body look alike at a distance. The lantern goes out before the face lifts.",
        heard: "From {dead}'s grave comes one broken sentence: a promise, or an apology. Footsteps leave by the wall before you can place the voice.",
      },
      question: "I saw you at {dead}'s grave. What were you doing with the earth?",
      honest: "Saying what I should have said while {dead} could hear it. The ground was loose. I put it back. Must grief answer questions now?",
      evasive: "Half this village has reason to kneel there. You saw sorrow and came looking for guilt because guilt is easier to use.",
      memory: "found you watching them grieve in the churchyard",
    },
    {
      id: "ansel_bell_rope", authorLabel: "The bell without a hand", actorPool: "ansel", when: "actor_available", weight: 5,
      monsterTags: ["voice", "haunt", "cunning"], perceptions: ["clear", "partial", "heard"],
      audio: ["bell_rope", "bell_single", "crickets_cut"],
      opening: "The bell rope hangs through the open vestry window. It moves once, slowly, although the bell above makes no sound.",
      silence: "Fibres complain against the beam. Someone inside catches the rope before it can swing again.",
      reveal: {
        clear: "Father Ansel steps into the doorway with the rope wound around one wrist. He looks less surprised to see you than he should.",
        partial: "A narrow figure crosses behind the vestry glass and takes the rope with them. The sleeve might be a cassock. The fog refuses the rest.",
        heard: "From inside, Father Ansel's voice says, very softly, ‘Not tonight.’ Whether he is speaking to the bell is less clear.",
      },
      question: "Why were you holding the bell rope after midnight?",
      honest: "Because it had begun moving by itself. I held it so the whole village would not wake to a bell nobody rang.",
      evasive: "You heard rope and made a story of the hand on it. Bells move in old towers. Fear supplies the rest.",
      memory: "saw you beneath the vestry window after midnight",
    },
    {
      id: "tobias_fresh_earth", authorLabel: "The gravedigger's measure", actorPool: "tobias", when: "actor_available", weight: 5,
      monsterTags: ["grave", "beast", "hunter"], perceptions: ["clear", "partial"],
      audio: ["spade_dirt", "wet_grass", "breathing_far"],
      opening: "Metal touches stone somewhere ahead: once, twice, then careful scraping. Not digging. Measuring.",
      silence: "The spade stops. A second scrape answers from three graves farther on.",
      reveal: {
        clear: "Old Tobias stands with his spade laid across a grave that was level yesterday. ‘Ground does not rise by itself,’ he says before you ask.",
        partial: "A broad figure leans on a spade beside newly lifted earth. When your lantern finds the stone, the figure has already gone.",
        heard: "A spade edge works under wet soil beyond the fog. The rhythm stops whenever your own boots stop.",
      },
      question: "What had lifted the earth you were measuring?",
      honest: "Something worked upward, or something opened it and put it back badly. I know graves. I do not know this.",
      evasive: "Old ground shifts. Roots rise. Rain sinks one side and lifts another. You want the earth to accuse somebody for you.",
      memory: "caught you reading the ground over their shoulder",
    },
    {
      id: "healer_cuts_yew", authorLabel: "What the healer gathers", actorPool: "healer", when: "actor_available", weight: 4,
      monsterTags: ["flora", "cunning", "turner"], perceptions: ["clear", "partial", "heard"],
      audio: ["branch_cut", "cloth_move", "owl_far"],
      opening: "A blade clips softly among the yews. Whoever works there has wrapped their lantern until it gives no more light than a coal.",
      silence: "The cutting stops. A bitter green smell reaches you before the person does.",
      reveal: {
        clear: "{actor} emerges with yew bound in cloth and grave moss under one thumbnail. ‘Medicine,’ they say, too quickly.",
        partial: "A slim figure carries a wrapped bundle out through the side gate. One cut branch keeps nodding after them.",
        heard: "Shears close three times in the dark. A bottle touches another bottle. Footsteps take the apothecary road.",
      },
      question: "Why were you cutting yew in the churchyard?",
      honest: "For fever, and for the heart when it races itself sick. Both are plentiful now. I went at night because frightened people call every remedy witchcraft.",
      evasive: "You heard shears. You did not see what they cut, or whose hand held them. Be careful what you promote into memory.",
      memory: "noticed you following the smell of cut yew through the graves",
    },
    {
      id: "secret_exchange", authorLabel: "Two lanterns meet", actorPool: "pair_out_here", when: "pair_available", weight: 4,
      monsterTags: ["cunning", "home", "turner"], perceptions: ["clear", "partial", "heard"],
      audio: ["boots_gravel", "whisper_pan", "gate_latch"],
      opening: "Two hooded lanterns approach the churchyard from opposite lanes. Both are covered before they meet.",
      silence: "A hand passes something small between them. Neither person speaks above breath.",
      reveal: {
        clear: "{actor} and {other} separate beneath the porch. Each sees your lantern. Each pretends not to.",
        partial: "Two familiar figures part under the porch, but the fog trades their faces before you can keep either one.",
        heard: "Two voices bargain under the porch. You catch one sentence: ‘Before the next bell.’ Then two sets of steps leave by different gates.",
      },
      question: "What passed between you and {other} beneath the church porch?",
      honest: "Something private and human. In another week I might have trusted you with it. Not while every confidence becomes evidence.",
      evasive: "Name the object you saw. Name the hand. You cannot, because darkness met darkness and you supplied our faces afterward.",
      memory: "saw you witness a private meeting beneath the church porch",
    },
    {
      id: "changed_at_font", authorLabel: "Thirst at the dry font", actorPool: "changed", when: "changed_available", weight: 8,
      monsterTags: ["turner", "haunt", "voice"], perceptions: ["clear", "partial", "heard"],
      audio: ["stone_touch", "breathing_close", "crickets_cut"],
      opening: "Something inside the ruined porch is breathing in careful counts. Four in. Nothing out. Four in again.",
      silence: "Fingers move over the dry font with the patience of someone reading raised letters.",
      reveal: {
        clear: "{actor} bends over the empty font, mouth almost touching the stone. They straighten when your light reaches them and smile as though interrupted at prayer.",
        partial: "A neighbour-shaped silhouette rises from the font. Its head turns farther than the shoulders do. The porch swallows the face.",
        heard: "Stone rasps under fingernails. A familiar voice repeats your name from inside the porch, trying several ways of saying it.",
      },
      question: "What were you doing at the empty font?",
      honest: "Praying badly. Is there a correct way left? You saw a frightened neighbour and wanted a stranger.",
      evasive: "The font is dry. The church is open. I stood where anybody might stand and you made the rest from shadow.",
      memory: "heard your lantern scrape the porch while they stood at the font",
    },
    {
      id: "fresh_grave_active_night", authorLabel: "The ground is writing back", actorPool: "out_here", when: "active_night", weight: 6,
      monsterTags: ["grave", "cunning", "beast"], perceptions: ["partial", "heard"],
      audio: ["spade_dirt", "breathing_far", "silence_drop"],
      opening: "Fresh earth moves beyond the wall in short, deliberate strokes. Whatever works there pauses whenever the bell rope creaks.",
      silence: "Your lantern finds a grave opened no deeper than a handspan, its soil arranged in a neat ring around one untouched stone.",
      reveal: {
        clear: "{actor} straightens beyond the grave with earth black to both wrists. They leave without hurry.",
        partial: "A hooded shape closes the grave with bare hands. Its build could fit more than one person you know. That may be deliberate.",
        heard: "Hands press wet soil flat on the far side of the stone. When you circle round, only the print of two knees remains.",
      },
      question: "Were you the figure closing a grave with bare hands?",
      honest: "I was. The earth had lifted and I put it back. I used my hands because a spade carries farther than a bell after dark.",
      evasive: "A shape in fog, and now my name. That is not deduction. It is appetite.",
      memory: "saw your lantern while they closed the lifted grave soil",
    },
    {
      id: "ansel_expected_absent", authorLabel: "The duty left undone", actorPool: "ansel_absent", when: "ansel_absent", weight: 5,
      monsterTags: ["cunning", "home", "hunter"], perceptions: ["not_seen"],
      audio: ["bell_single", "empty_room", "gate_latch"],
      opening: "The church stands unlocked on the night Father Ansel promised to keep vigil. His lamp is cold. The prayer book lies open where he should be.",
      silence: "You watch the only gate long enough for frost to silver the latch. Nobody enters. Nobody leaves.",
      reveal: { not_seen: "Whatever kept Father Ansel from his vigil, it was not here. The certainty is small, clean, and deeply unhelpful." },
      question: "You promised to keep vigil. I watched the gate and you never came. Where were you?",
      honest: "At a bedside that needed a priest more than an empty church did. I told no one because the family asked me not to.",
      evasive: "You watched one gate. The church has a vestry door, a crypt stair, and windows a thin man can use. Absence is a poor witness.",
      memory: "knows you checked whether they kept the church vigil",
    },
    {
      id: "lantern_beyond_wall", authorLabel: "The light outside the wall", actorPool: "out_here", when: "out_here", weight: 5,
      monsterTags: ["hunter", "beast", "voice"], perceptions: ["clear", "partial", "heard"],
      audio: ["wet_grass", "boots_gravel", "wolf_far"],
      opening: "A lantern moves outside the churchyard wall where there is no path, keeping pace with you between the yew trunks.",
      silence: "It stops when you stop. Somewhere beyond it, an animal gives one short warning cry and is quiet.",
      reveal: {
        clear: "{actor} steps through the broken place in the wall, coat wet to the thigh. They look back once at the field behind them.",
        partial: "The lantern lifts high enough to show a familiar coat and no face. Then it drops below the wall and does not rise again.",
        heard: "Wet steps approach the broken wall and turn aside at the last moment. A lantern shutter clicks closed.",
      },
      question: "Why were you outside the churchyard wall where there is no path?",
      honest: "Because something followed the road and I did not want to meet it there. The field seemed the less foolish choice at the time.",
      evasive: "You saw a lantern beyond a wall. Half the village owns one. Fear has begun signing names to everything.",
      memory: "saw your light tracking theirs along the churchyard wall",
    },
    {
      id: "mourning_token", authorLabel: "What was left on the stone", actorPool: "griever", when: "recent_death", weight: 4,
      monsterTags: ["grave", "flora", "haunt"], perceptions: ["clear", "partial", "heard"],
      audio: ["cloth_move", "branch_cut", "bell_single"],
      opening: "Someone has set a household object on {dead}'s grave: ordinary, intimate, and wrong beneath the moon.",
      silence: "A figure approaches carrying a second object wrapped in cloth. They freeze when your lantern touches the stone.",
      reveal: {
        clear: "{actor} lays the bundle beside the first offering. It is something {dead} used every day. Their anger at being seen arrives before their shame.",
        partial: "The mourner hides the bundle against their chest and leaves by the narrow gate. The grave keeps the first offering and their identity.",
        heard: "Cloth touches stone. Someone whispers {dead}'s name once, then runs before you can clear the row of graves.",
      },
      question: "What did you leave on {dead}'s grave?",
      honest: "Something that belonged to them. Something the village would inventory, discuss, and ruin if I named it. Let one thing stay ours.",
      evasive: "You found grief arranged strangely and decided arrangement meant design. The dead collect objects because the living cannot keep holding them.",
      memory: "remembers you interrupting a private offering at the grave",
    },
    {
      id: "gate_answers", authorLabel: "The gate answers", actorPool: "none", when: "always", weight: 3,
      monsterTags: ["haunt", "voice", "home"], perceptions: ["heard"],
      audio: ["gate_turn", "gate_latch", "breathing_far"],
      opening: "The churchyard gate turns inward after you have already latched it. Slowly. The hinges make no sound.",
      silence: "You pull it shut. Three breaths later it opens the same width again, as if something on the other side has learned the weight.",
      reveal: { heard: "No figure waits beyond it. Only the lane, one set of your own prints, and a second latch-click from behind you." },
      question: null, honest: null, evasive: null, memory: null,
    },
  ];

  var audio = {
    bell_single: { bus: "foley", fallback: "bell", intendedPath: "assets/audio-v5/bell-single-01.ogg", caption: "A single distant bell." },
    bell_rope: { bus: "foley", fallback: "rope", intendedPath: "assets/audio-v5/bell-rope-creak-01.ogg", caption: "A rope strains overhead." },
    gate_turn: { bus: "foley", fallback: "gate", intendedPath: "assets/audio-v5/iron-gate-turn-01.ogg", caption: "The iron gate turns." },
    gate_latch: { bus: "foley", fallback: "latch", intendedPath: "assets/audio-v5/gate-latch-01.ogg", caption: "An iron latch settles." },
    wet_grass: { bus: "foley", fallback: "leaves", intendedPath: "assets/audio-v5/wet-grass-steps-01.ogg", caption: "Steps press through wet grass." },
    dry_leaves: { bus: "foley", fallback: "leaves", intendedPath: "assets/audio-v5/dry-leaves-crunch-01.ogg", caption: "Dry leaves break under a careful foot." },
    boots_gravel: { bus: "foley", fallback: "leaves", intendedPath: "assets/audio-v5/boots-gravel-01.ogg", caption: "Boots cross loose gravel." },
    spade_dirt: { bus: "foley", fallback: "earth", intendedPath: "assets/audio-v5/spade-in-earth-01.ogg", caption: "Metal works through wet soil." },
    branch_cut: { bus: "foley", fallback: "branch", intendedPath: "assets/audio-v5/yew-branch-cut-01.ogg", caption: "A branch is cut nearby." },
    cloth_move: { bus: "foley", fallback: "cloth", intendedPath: "assets/audio-v5/heavy-cloth-move-01.ogg", caption: "Heavy cloth shifts." },
    stone_touch: { bus: "foley", fallback: "stone", intendedPath: "assets/audio-v5/fingers-on-stone-01.ogg", caption: "Fingers scrape over stone." },
    breathing_far: { bus: "threat", fallback: "breath", intendedPath: "assets/audio-v5/breathing-distant-01.ogg", caption: "Something breathes beyond the light." },
    breathing_close: { bus: "threat", fallback: "breath_close", intendedPath: "assets/audio-v5/breathing-close-01.ogg", caption: "Breathing, very close." },
    whisper_pan: { bus: "threat", fallback: "whisper", intendedPath: "assets/audio-v5/whisper-pass-01.ogg", caption: "A whisper crosses from one side to the other." },
    unearthly_wail: { bus: "threat", fallback: "howl", intendedPath: "assets/audio-v5/unearthly-wail-01.ogg", caption: "A long cry rises beyond the houses." },
    wolf_far: { bus: "threat", fallback: "howl", intendedPath: "assets/audio-v5/howl-distant-01.ogg", caption: "A distant animal call." },
    owl_far: { bus: "ambience", fallback: "owl", intendedPath: "assets/audio-v5/owl-distant-01.ogg", caption: "An owl calls beyond the wall." },
    crickets_cut: { bus: "ambience", fallback: "silence", intendedPath: "assets/audio-v5/crickets-stop-01.ogg", caption: "The insects stop together." },
    crickets_loop: { bus: "ambience", fallback: "crickets", intendedPath: "assets/audio-v5/crickets-night-loop-01.ogg", caption: "Crickets pulse in the grass." },
    village_bustle: { bus: "ambience", fallback: "bustle", intendedPath: "assets/audio-v5/village-day-bustle-loop-01.ogg", caption: "Work and low voices carry across the square." },
    empty_room: { bus: "ambience", fallback: "room", intendedPath: "assets/audio-v5/empty-church-roomtone-01.ogg", caption: "The empty church holds its breath." },
    silence_drop: { bus: "threat", fallback: "silence", intendedPath: "assets/audio-v5/village-silence-drop-01.ogg", caption: "The village sound falls away." }
  };

  /* Keep authoring failures visible while this catalogue grows. This is a
     deliberately small runtime validator, not game logic: content can be
     checked from file:// and without a build step. */
  var issues = [];
  var seenIds = {};
  var actorPools = ["none", "out_here", "pair_out_here", "changed", "ansel", "ansel_absent", "tobias", "healer", "griever"];
  scenarios.forEach(function (scene, index) {
    var at = "churchyardScenarios[" + index + "]";
    if (!scene.id || seenIds[scene.id]) issues.push(at + ": id is missing or duplicated");
    seenIds[scene.id] = true;
    if (!scene.authorLabel || !scene.opening || !scene.silence) issues.push(at + ": authorLabel/opening/silence are required");
    if (actorPools.indexOf(scene.actorPool) < 0) issues.push(at + ": unknown or unsafe actorPool " + scene.actorPool);
    (scene.perceptions || []).forEach(function (mode) {
      if (!scene.reveal || !scene.reveal[mode]) issues.push(at + ": missing reveal text for " + mode);
    });
    (scene.audio || []).forEach(function (cue) {
      if (!audio[cue]) issues.push(at + ": unknown audio cue " + cue);
    });
    if (scene.actorPool !== "none" && (!scene.question || !scene.honest || !scene.evasive || !scene.memory)) {
      issues.push(at + ": participant scenes require question/honest/evasive/memory text");
    }
  });
  if (issues.length && typeof console !== "undefined") console.warn("Hollow's Edge V5 content issues", issues);
  window.HE_V5_CONTENT = Object.freeze({ version: 1, churchyardScenarios: scenarios, audioCues: audio, issues: issues });
})();
