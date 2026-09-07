/* Hollow's Edge V6 Director Adapter
 *
 * Imports a completed V5 Night Director trace into the canonical V6 ledger.
 * The legacy daylight projection remains in place during V6.1 so this adapter
 * can be parity-tested without changing player-facing presentation.
 */
(function (root, factory) {
  var continuity = typeof module === "object" && module.exports
    ? require("./v6-continuity.js")
    : root && root.HE_CONTINUITY;
  var api = factory(continuity);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HE_V6_DIRECTOR_ADAPTER = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Continuity) {
  "use strict";

  if (!Continuity) throw new Error("V6 Director adapter requires HE_CONTINUITY");

  var PLAYER_ID = Continuity.PLAYER_ID;
  var PLAYER_ACTION_KINDS = {
    player_action: true,
    chase_step: true,
    chase_started: true,
    started_home: true,
    returned_home: true,
    ended_at_scene: true,
    clue_inspected: true,
    clue_left_closed: true,
    site_clue_inspected: true,
    body_defence: true,
    monster_reveal_choice: true,
    monster_close_read: true,
    threshold_choice: true,
    threshold_look: true,
    threshold_spoken: true,
    strange_sight_false: true,
    strange_sight_ignored: true,
    strange_sight_person: true,
    strange_sight_sign: true,
    hidden_figure_identified: true,
    hidden_figure_passed: true,
    hidden_figure_unidentified: true,
    delusion_approach: true,
    disturbance_ignored: true,
    crisis_response: true,
    follow_pause: true,
    intervention: true,
    abandonment: true,
    investigated_attack: true
  };
  var PLAYER_LIVED_KINDS = {
    threshold_arrival: true,
    threshold_monster_visit: true,
    threshold_missing_report: true,
    threshold_watched_item_report: true,
    threshold_confrontation: true
  };

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function unique(values) {
    return Array.from(new Set(list(values).filter(Boolean)));
  }

  function slug(value) {
    return String(value == null ? "unknown" : value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
  }

  function prefixFor(director) {
    return "night:" + director.night + ":director";
  }

  function eventIdFor(director, rawId) {
    return prefixFor(director) + ":" + String(rawId || "event");
  }

  function eventExists(ledger, id) {
    return !!Continuity.eventById(ledger, id);
  }

  function observationExists(ledger, id) {
    return list(ledger.observations).some(function (row) { return row.id === id; });
  }

  function evidenceExists(ledger, id) {
    return !!Continuity.evidenceById(ledger, id);
  }

  function subjectIdsFor(event, director) {
    var subjects = [];
    if (event.victimId) subjects.push(event.victimId);
    if (event.subjectId) subjects.push(event.subjectId);
    if (event.kind === "player_slain") subjects.push(PLAYER_ID);
    if (event.kind === "monster_slain") subjects.push(event.actorId || (director.monsterSchedule && director.monsterSchedule.hostId));
    return unique(subjects);
  }

  function actorIdsFor(event, subjects, ledger) {
    var actors = list(event.actors).concat(event.actorId ? [event.actorId] : [], event.reporterId ? [event.reporterId] : []);
    if ((event.action || PLAYER_ACTION_KINDS[event.kind]) && subjects.indexOf(PLAYER_ID) < 0) actors.push(PLAYER_ID);
    return unique(actors).filter(function (id) {
      return subjects.indexOf(id) < 0 && !!ledger.actors[id];
    });
  }

  function statusChangesFor(event, director) {
    if (event.kind === "slain" && event.victimId) return [{ actorId: event.victimId, status: "dead" }];
    if (event.kind === "changed" && event.victimId) return [{ actorId: event.victimId, status: "changed" }];
    if (event.kind === "player_slain") return [{ actorId: PLAYER_ID, status: "dead" }];
    if (event.kind === "monster_slain") {
      var hostId = event.actorId || (director.monsterSchedule && director.monsterSchedule.hostId);
      return hostId ? [{ actorId: hostId, status: "dead" }] : [];
    }
    return [];
  }

  function appendDirectorEvent(ledger, director, event) {
    var id = eventIdFor(director, event.id);
    if (eventExists(ledger, id)) return ledger;
    var subjects = subjectIdsFor(event, director);
    return Continuity.appendEvent(ledger, {
      id: id,
      type: event.kind || "director_event",
      phase: "night",
      night: director.night,
      location: event.location || null,
      actorIds: actorIdsFor(event, subjects, ledger),
      subjectIds: subjects.filter(function (actorId) { return !!ledger.actors[actorId]; }),
      statusChanges: statusChangesFor(event, director).filter(function (change) { return !!ledger.actors[change.actorId]; }),
      truth: { directorEventId: event.id, slot: event.slot == null ? null : event.slot, data: event },
      tags: ["director", "night-" + director.night]
    });
  }

  function routeLocation(schedule) {
    var motive = schedule && schedule.motive || {};
    var destination = motive.destination || list(schedule && schedule.slots).find(function (location) {
      return location && String(location).toLowerCase() !== "home";
    }) || "home";
    return String(destination).toLowerCase() === "home" ? "home" : destination;
  }

  /* The hidden schedule is truth, but not public knowledge. Give each actor
     one private memory of their own route before importing outcomes that may
     kill or change them. Interviews can then consult the speaker's memory
     without reading omniscient simulation state. */
  function importActorRoutes(ledger, director) {
    Object.keys(director.schedules || {}).sort().forEach(function (actorId) {
      var schedule = director.schedules[actorId];
      if (!ledger.actors[actorId]) return;
      var id = prefixFor(director) + ":route:" + slug(actorId);
      var location = routeLocation(schedule);
      var slots = list(schedule.slots).map(function (entry) {
        return String(entry).toLowerCase() === "home" ? "home" : entry;
      });
      if (!eventExists(ledger, id)) {
        ledger = Continuity.appendEvent(ledger, {
          id: id,
          type: "night_route",
          phase: "night",
          night: director.night,
          location: location,
          subjectIds: [actorId],
          truth: {
            actorId: actorId,
            primaryLocation: location,
            locations: unique(slots),
            slots: slots,
            depart: schedule.depart == null ? null : schedule.depart,
            duration: schedule.duration == null ? null : schedule.duration,
            motiveId: schedule.motive && schedule.motive.id || null,
            source: "director_schedule"
          },
          tags: ["director", "night-" + director.night, "route", "private-memory"]
        });
      }
      var observationId = id + ":observation:" + slug(actorId);
      if (!observationExists(ledger, observationId)) {
        ledger = Continuity.recordObservation(ledger, {
          id: observationId,
          eventId: id,
          observerId: actorId,
          mode: "memory",
          certainty: "certain",
          factKeys: ["own-route", "location:" + slug(location)],
          actorIdsRecognised: [actorId],
          locationRecognised: true
        });
      }
    });
    return ledger;
  }

  function appendSyntheticSource(ledger, director, id, type, source) {
    if (eventExists(ledger, id)) return ledger;
    return Continuity.appendEvent(ledger, {
      id: id,
      type: type,
      phase: "night",
      night: director.night,
      location: source.location || null,
      truth: { adapterGenerated: true, source: source },
      tags: ["director", "adapter-source", "night-" + director.night]
    });
  }

  function sourceEventForObservation(ledger, director, observation, index) {
    var canonical = observation.eventId ? eventIdFor(director, observation.eventId) : null;
    if (canonical && eventExists(ledger, canonical)) return { ledger: ledger, eventId: canonical };
    var fallback = prefixFor(director) + ":perception:" + slug(observation.beatId || observation.eventId || index);
    ledger = appendSyntheticSource(ledger, director, fallback, observation.reliability === "unreliable" ? "unreliable_perception" : "perceived_event", observation);
    return { ledger: ledger, eventId: fallback };
  }

  function importPlayerObservations(ledger, director) {
    list(director.ledgers && director.ledgers.observations).forEach(function (observation, index) {
      var source = sourceEventForObservation(ledger, director, observation, index);
      ledger = source.ledger;
      var id = prefixFor(director) + ":observation:player:" + index + ":" + slug(observation.beatId || observation.eventId);
      if (observationExists(ledger, id)) return;
      var recognised = unique(observation.actors).filter(function (actorId) { return !!ledger.actors[actorId]; });
      var factKeys = ["kind:" + (observation.kind || "observation")];
      if (observation.sign) factKeys.push("sign:" + observation.sign);
      if (observation.location) factKeys.push("location:" + observation.location);
      recognised.forEach(function (actorId) { factKeys.push("actor:" + actorId); });
      ledger = Continuity.recordObservation(ledger, {
        id: id,
        eventId: source.eventId,
        observerId: PLAYER_ID,
        mode: observation.reliability === "unreliable" ? "affliction" : "direct",
        certainty: observation.clarity || (observation.reliability === "unreliable" ? "uncertain" : "certain"),
        factKeys: factKeys,
        actorIdsRecognised: recognised,
        locationRecognised: !!observation.location
      });
    });
    return ledger;
  }

  /* Some doorstep facts are produced after the spoken beat they describe.
     They are still lived by the player, but V5 did not attach a second
     observation row to the derived interview fact. Canonical V6 does. */
  function importLivedPlayerEvents(ledger, director) {
    list(director.ledgers && director.ledgers.truth).filter(function (event) {
      return !!PLAYER_LIVED_KINDS[event.kind] || (event.kind === "investigated_attack" && event.sharedDiscovery);
    }).forEach(function (event) {
      var canonicalId = eventIdFor(director, event.id);
      if (!eventExists(ledger, canonicalId) || Continuity.observedEvent(ledger, PLAYER_ID, canonicalId)) return;
      var recognised = unique([event.actorId, event.reporterId, event.subjectId, event.victimId]).filter(function (actorId) {
        return actorId && actorId !== PLAYER_ID && !!ledger.actors[actorId];
      });
      /* Arrival alone may be an unidentified voice. Later explicit reports
         and identified visits carry the names the player actually heard. */
      if (event.kind === "threshold_arrival") recognised = [];
      ledger = Continuity.recordObservation(ledger, {
        id: canonicalId + ":observation:player:lived",
        eventId: canonicalId,
        observerId: PLAYER_ID,
        mode: event.kind === "threshold_arrival" ? "heard" : "direct",
        certainty: event.kind === "threshold_arrival" ? "sensory" : "certain",
        factKeys: unique(["kind:" + event.kind].concat(event.location ? ["location:" + event.location] : [])),
        actorIdsRecognised: recognised,
        locationRecognised: !!event.location
      });
    });
    return ledger;
  }

  function observerRecognised(ledger, eventId, observerId, actorId) {
    return list(ledger.observations).some(function (row) {
      return row.eventId === eventId && row.observerId === observerId
        && list(row.actorIdsRecognised).indexOf(actorId) >= 0;
    });
  }

  function addRecognitionObservation(ledger, eventId, observerId, actorId, suffix) {
    if (!eventExists(ledger, eventId) || observerRecognised(ledger, eventId, observerId, actorId)) return ledger;
    return Continuity.recordObservation(ledger, {
      id: eventId + ":observation:" + slug(observerId) + ":" + suffix,
      eventId: eventId,
      observerId: observerId,
      mode: "direct",
      certainty: "certain",
      factKeys: [actorId === PLAYER_ID ? "player-recognised" : "monster-host:" + actorId],
      actorIdsRecognised: [actorId],
      locationRecognised: true
    });
  }

  function importMonsterAwareness(ledger, director) {
    var hostId = director.monsterSchedule && director.monsterSchedule.hostId;
    if (!hostId || !ledger.actors[hostId]) return ledger;
    list(director.ledgers && director.ledgers.truth).forEach(function (event) {
      var eventId = eventIdFor(director, event.id);
      var playerLearnsHost = (event.kind === "monster_reveal_choice" && (event.learnedIdentity || event.identityVisible))
        || (event.kind === "monster_close_read" && event.learnedIdentity)
        || (event.kind === "monster_slain" && (event.actorId || hostId) === hostId);
      var hostLearnsPlayer = (event.kind === "monster_reveal_choice" && event.seenByMonster)
        || event.kind === "chase_started"
        || event.kind === "monster_spared_player"
        || (event.kind === "hailed" && list(event.actors).indexOf(hostId) >= 0);
      if (playerLearnsHost) ledger = addRecognitionObservation(ledger, eventId, PLAYER_ID, hostId, "monster-face");
      if (hostLearnsPlayer) ledger = addRecognitionObservation(ledger, eventId, hostId, PLAYER_ID, "player-face");
    });
    return ledger;
  }

  function importVillagerMemories(ledger, director) {
    var memories = director.ledgers && director.ledgers.memories || {};
    Object.keys(memories).sort().forEach(function (observerId) {
      if (!ledger.actors[observerId]) return;
      list(memories[observerId]).forEach(function (memory, index) {
        var canonical = memory.eventId ? eventIdFor(director, memory.eventId) : null;
        if (!canonical || !eventExists(ledger, canonical)) {
          canonical = prefixFor(director) + ":memory-source:" + slug(observerId) + ":" + slug(memory.eventId || index);
          ledger = appendSyntheticSource(ledger, director, canonical, "remembered_event", memory);
        }
        var id = prefixFor(director) + ":observation:" + slug(observerId) + ":" + index + ":" + slug(memory.eventId);
        if (observationExists(ledger, id)) return;
        var recognised = memory.subject && ledger.actors[memory.subject] ? [memory.subject] : [];
        ledger = Continuity.recordObservation(ledger, {
          id: id,
          eventId: canonical,
          observerId: observerId,
          mode: "memory",
          certainty: memory.clarity || "uncertain",
          factKeys: ["kind:" + (memory.kind || "memory")].concat(memory.location ? ["location:" + memory.location] : []),
          actorIdsRecognised: recognised,
          locationRecognised: !!memory.location
        });
      });
    });
    return ledger;
  }

  function importRelationshipObservations(ledger, director) {
    var kinds = { intervention: true, abandonment: true, threshold_confrontation: true, intrusion_witnessed: true, restraint_witnessed: true };
    list(director.ledgers && director.ledgers.truth).filter(function (event) {
      return !!kinds[event.kind];
    }).forEach(function (event) {
      var actorId = event.actorId || event.victimId || list(event.actors).find(function (id) { return id !== PLAYER_ID; });
      if (!actorId || !ledger.actors[actorId]) return;
      var eventId = eventIdFor(director, event.id);
      ledger = addRecognitionObservation(ledger, eventId, actorId, PLAYER_ID, "relationship");
    });
    return ledger;
  }

  function sourceForBeat(ledger, director, beat, index, type) {
    var observation = list(director.ledgers && director.ledgers.observations).find(function (row) {
      return beat.beatId && row.beatId === beat.beatId;
    });
    if (observation && observation.eventId) {
      var observedEventId = eventIdFor(director, observation.eventId);
      if (eventExists(ledger, observedEventId)) return { ledger: ledger, eventId: observedEventId };
    }
    var id = prefixFor(director) + ":evidence-source:" + slug(beat.beatId || beat.id || (type + "-" + index));
    ledger = appendSyntheticSource(ledger, director, id, type, beat);
    return { ledger: ledger, eventId: id };
  }

  function importEvidence(ledger, director) {
    list(director.found && director.found.stamps).forEach(function (stamp, index) {
      var source = sourceForBeat(ledger, director, stamp, index, "physical_mark_discovered");
      ledger = source.ledger;
      var id = prefixFor(director) + ":evidence:sign:" + slug(stamp.beatId || (stamp.sign + "-" + stamp.slot + "-" + stamp.location));
      if (evidenceExists(ledger, id)) return;
      ledger = Continuity.addEvidence(ledger, {
        id: id,
        objectKey: "sign:" + stamp.sign,
        imageKey: "sign:" + stamp.sign,
        sign: stamp.sign,
        sourceEventId: source.eventId,
        location: stamp.location,
        authenticity: "genuine",
        discoveredBy: [PLAYER_ID],
        inspectedBy: [PLAYER_ID]
      });
    });

    list(director.found && director.found.clues).forEach(function (clue, index) {
      var object = clue.meta && clue.meta.object;
      if (!object) return;
      var source = sourceForBeat(ledger, director, clue, index, "object_discovered");
      ledger = source.ledger;
      var id = prefixFor(director) + ":evidence:item:" + slug(clue.beatId || clue.id || (object + "-" + index));
      if (evidenceExists(ledger, id)) return;
      var objectKey = "item:" + slug(object);
      ledger = Continuity.addEvidence(ledger, {
        id: id,
        objectKey: objectKey,
        imageKey: objectKey,
        sourceEventId: source.eventId,
        location: clue.location,
        authenticity: "uncertain",
        discoveredBy: [PLAYER_ID],
        inspectedBy: [PLAYER_ID]
      });
    });

    list(director.ledgers && director.ledgers.truth).filter(function (event) {
      return event.kind === "planted_false_mark";
    }).forEach(function (event) {
      var sourceEventId = eventIdFor(director, event.id);
      var id = prefixFor(director) + ":evidence:planted:" + slug(event.id);
      if (evidenceExists(ledger, id)) return;
      ledger = Continuity.addEvidence(ledger, {
        id: id,
        objectKey: "sign:" + event.sign,
        imageKey: "sign:" + event.sign,
        sign: event.sign,
        sourceEventId: sourceEventId,
        location: event.location,
        authenticity: "planted",
        discoveredBy: [],
        inspectedBy: []
      });
    });
    return ledger;
  }

  function importSecrets(ledger, director, config) {
    /* Reconstruct the same small projection locally so this adapter remains
       usable in the browser without importing another module. */
    var projection = list(director.ledgers.truth).filter(function (event) {
      return event.kind === "followed" && event.revealedSecret;
    }).map(function (event) {
      return { eventId: event.id, actorId: event.actorId, location: event.location, summary: event.secretSummary || null };
    });
    list(director.beats).filter(function (beat) {
      return beat.type === "watch" && beat.actorId && beat.meta && beat.meta.revealsSecret;
    }).forEach(function (beat) {
      projection.push({ eventId: beat.id, actorId: beat.actorId, location: beat.location, summary: beat.meta.secretSummary || null, beat: beat });
    });
    projection.forEach(function (secret, index) {
      if (!secret.actorId || !ledger.actors[secret.actorId]) return;
      var sourceEventId = eventIdFor(director, secret.eventId);
      if (!eventExists(ledger, sourceEventId)) {
        sourceEventId = prefixFor(director) + ":secret-source:" + slug(secret.eventId || index);
        ledger = appendSyntheticSource(ledger, director, sourceEventId, "secret_witnessed", secret.beat || secret);
      }
      var id = prefixFor(director) + ":secret-learned:" + slug(secret.actorId) + ":" + slug(secret.eventId || index);
      if (!eventExists(ledger, id)) {
        ledger = Continuity.appendEvent(ledger, {
          id: id,
          type: "secret_learned",
          phase: "night",
          night: director.night,
          location: secret.location || null,
          subjectIds: [secret.actorId],
          truth: {
            actorId: secret.actorId,
            secretIndex: config.secretPick && config.secretPick[secret.actorId] != null ? config.secretPick[secret.actorId] : null,
            summary: secret.summary,
            source: "director",
            sourceEventId: sourceEventId
          },
          tags: ["director", "night-" + director.night, "secret", "player-knowledge"]
        });
      }
      var observationId = id + ":observation:player";
      if (!observationExists(ledger, observationId)) {
        ledger = Continuity.recordObservation(ledger, {
          id: observationId,
          eventId: id,
          observerId: PLAYER_ID,
          mode: "direct",
          certainty: "certain",
          factKeys: ["secret:" + secret.actorId],
          actorIdsRecognised: [secret.actorId],
          locationRecognised: !!secret.location
        });
      }
    });
    return ledger;
  }

  function projectDirectorNight(input, director, config) {
    if (!director || !director.ledgers) throw new Error("a completed Director state is required");
    if (director.phase !== "complete" && director.phase !== "dead") throw new Error("only a terminal Director night can enter continuity");
    config = config || {};
    var ledger = input || Continuity.createLedger({
      runId: config.runId,
      seed: config.seed || director.seed,
      actors: config.actors || director.cast
    });
    ledger = Continuity.ensureActors(ledger, config.actors || director.cast);
    ledger = importActorRoutes(ledger, director);
    list(director.ledgers.truth).forEach(function (event) {
      ledger = appendDirectorEvent(ledger, director, event);
    });
    ledger = importPlayerObservations(ledger, director);
    ledger = importLivedPlayerEvents(ledger, director);
    ledger = importMonsterAwareness(ledger, director);
    ledger = importVillagerMemories(ledger, director);
    ledger = importRelationshipObservations(ledger, director);
    ledger = importEvidence(ledger, director);
    ledger = importSecrets(ledger, director, config);
    ledger.lastImportedDirectorNight = {
      night: director.night,
      seed: director.seed,
      phase: director.phase,
      truthEvents: list(director.ledgers.truth).length,
      observations: list(director.ledgers.observations).length
    };
    var issues = Continuity.validateLedger(ledger);
    if (issues.length) throw new Error("V6 continuity projection failed: " + issues.join("; "));
    return ledger;
  }

  function hasImportedNight(ledger, night) {
    var tag = "night-" + night;
    return list(ledger && ledger.events).some(function (event) {
      return list(event.tags).indexOf("director") >= 0 && list(event.tags).indexOf(tag) >= 0;
    });
  }

  function canonicalIdsForLegacyEvent(event) {
    if (!event || event.night == null) return [];
    var fakeDirector = { night: event.night };
    return unique(list(event.sourceEventIds).concat(event.eventId ? [event.eventId] : []).map(function (rawId) {
      return eventIdFor(fakeDirector, rawId);
    }));
  }

  /* Compatibility screens may keep their existing labels and answer prose,
     but V6 decides whether the player has standing to raise the underlying
     event. A pre-V6 night is left alone until a real migration imports it. */
  function playerCanRaiseLegacyEvent(ledger, event) {
    if (!ledger || !event || event.night == null || !hasImportedNight(ledger, event.night)) return true;
    var ids = canonicalIdsForLegacyEvent(event);
    if (ids.some(function (id) { return Continuity.playerCanRaiseEvent(ledger, id); })) return true;
    return list(ledger.evidence).some(function (evidence) {
      return ids.indexOf(evidence.sourceEventId) >= 0 && list(evidence.discoveredBy).indexOf(PLAYER_ID) >= 0;
    });
  }

  /* Direct interview prompts (“I saw you…”, “I found…”) have a stricter
     threshold than general raiseability. Testimony permits a hearsay topic,
     but must never be rewritten as the player's own sight or discovery. */
  function playerDirectlyKnowsLegacyEvent(ledger, event) {
    if (!ledger || !event || event.night == null || !hasImportedNight(ledger, event.night)) return true;
    var ids = canonicalIdsForLegacyEvent(event);
    if (ids.some(function (id) { return Continuity.observedEvent(ledger, PLAYER_ID, id); })) return true;
    return list(ledger.evidence).some(function (evidence) {
      return ids.indexOf(evidence.sourceEventId) >= 0 && list(evidence.discoveredBy).indexOf(PLAYER_ID) >= 0;
    });
  }

  return Object.freeze({
    projectDirectorNight: projectDirectorNight,
    eventIdFor: eventIdFor,
    hasImportedNight: hasImportedNight,
    canonicalIdsForLegacyEvent: canonicalIdsForLegacyEvent,
    playerCanRaiseLegacyEvent: playerCanRaiseLegacyEvent,
    playerDirectlyKnowsLegacyEvent: playerDirectlyKnowsLegacyEvent
  });
});
