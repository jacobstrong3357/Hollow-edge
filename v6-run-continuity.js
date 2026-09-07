/* Hollow's Edge V6 Run Continuity
 *
 * Projects canonical actor status into the legacy NPC cards and classifies
 * what the player actually knows about a night outcome. Dawn, interviews and
 * the day hub can therefore read one event instead of reconstructing it from
 * unrelated flags.
 */
(function (root, factory) {
  var continuity = typeof module === "object" && module.exports
    ? require("./v6-continuity.js")
    : root && root.HE_CONTINUITY;
  var api = factory(continuity);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HE_V6_RUN_CONTINUITY = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Continuity) {
  "use strict";

  if (!Continuity) throw new Error("V6 run continuity requires HE_CONTINUITY");

  var PLAYER_ID = Continuity.PLAYER_ID;
  var PRESENT_STATUSES = { alive: true, changed: true };

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function unique(values) {
    return Array.from(new Set(list(values).filter(Boolean)));
  }

  function slug(value) {
    return String(value == null ? "unknown" : value).trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
  }

  function legacyStatus(actor) {
    if (!actor) return null;
    if (actor.fled) return "fled";
    if (actor.alive === false) return "dead";
    if (actor.turned) return "changed";
    return "alive";
  }

  function actorStatus(run, actorId) {
    var canonical = run && run.continuity
      ? Continuity.currentActorStatus(run.continuity, actorId)
      : null;
    if (canonical) return canonical;
    return legacyStatus(list(run && run.npcs).find(function (actor) { return actor.id === actorId; }));
  }

  function actorCanAppear(run, actorId) {
    return !!PRESENT_STATUSES[actorStatus(run, actorId)];
  }

  function projectActor(actor, status) {
    if (!actor || !status) return actor;
    if (status === "alive") return Object.assign({}, actor, { alive: true, turned: false, fled: false });
    if (status === "changed") return Object.assign({}, actor, { alive: true, turned: true, fled: false });
    if (status === "dead") return Object.assign({}, actor, { alive: false });
    if (status === "fled" || status === "missing") return Object.assign({}, actor, { fled: true });
    return actor;
  }

  function syncActor(run, actorId) {
    if (!run || !Array.isArray(run.npcs)) return run;
    var status = actorStatus(run, actorId);
    run.npcs = run.npcs.map(function (actor) {
      return actor.id === actorId ? projectActor(actor, status) : actor;
    });
    return run;
  }

  function syncRunActors(run) {
    if (!run || !Array.isArray(run.npcs)) return run;
    run.npcs = run.npcs.map(function (actor) {
      return projectActor(actor, actorStatus(run, actor.id));
    });
    return run;
  }

  function statusEventId(run, actorId, status, spec) {
    spec = spec || {};
    if (spec.id) return spec.id;
    var phase = spec.phase || (spec.day != null ? "day" : "night");
    var when = spec.night != null ? "night-" + spec.night
      : spec.day != null ? "day-" + spec.day
        : "turn-" + ((run.continuity && run.continuity.sequence) || 0);
    return ["run", phase, when, spec.type || "status", actorId, status].map(slug).join(":");
  }

  /* Record first, project second. A Director import may already have written
     the transition; then this is idempotent and only refreshes old UI fields. */
  function recordStatusChange(run, actorId, status, spec) {
    spec = spec || {};
    if (!run || !actorId) throw new Error("a run and actor are required");
    run.continuity = Continuity.ensureActors(run.continuity, run.npcs || []);
    var current = Continuity.currentActorStatus(run.continuity, actorId);
    var eventId = null;
    if (current !== status) {
      eventId = statusEventId(run, actorId, status, spec);
      if (!Continuity.eventById(run.continuity, eventId)) {
        run.continuity = Continuity.appendEvent(run.continuity, {
          id: eventId,
          type: spec.type || (status === "dead" ? "death" : status === "changed" ? "transformation" : "status_change"),
          phase: spec.phase || null,
          night: spec.night == null ? null : spec.night,
          day: spec.day == null ? null : spec.day,
          location: spec.location || null,
          actorIds: unique(spec.actorIds),
          subjectIds: [actorId],
          statusChanges: [{ actorId: actorId, status: status }],
          truth: Object.assign({}, spec.truth || {}, { source: spec.source || "playable-run" }),
          tags: unique(["run-status"].concat(spec.tags || []))
        });
        unique(spec.observedBy).forEach(function (observerId) {
          run.continuity = Continuity.recordObservation(run.continuity, {
            id: eventId + ":observation:" + slug(observerId),
            eventId: eventId,
            observerId: observerId,
            mode: spec.observationMode || "direct",
            certainty: spec.certainty || "certain",
            factKeys: unique(["status:" + status].concat(spec.factKeys || [])),
            actorIdsRecognised: spec.actorRecognised === false ? [] : [actorId],
            locationRecognised: spec.locationRecognised !== false
          });
        });
      }
    }
    syncActor(run, actorId);
    return eventId;
  }

  function rawEvent(event) {
    return event && event.truth && event.truth.data || event && event.truth || {};
  }

  function eventSlot(event) {
    var raw = rawEvent(event);
    return Number.isFinite(raw.slot) ? raw.slot : event.sequence;
  }

  function outcomeEvent(run, night, actorId) {
    return list(run && run.continuity && run.continuity.events).filter(function (event) {
      return event.night === night && list(event.statusChanges).some(function (change) {
        return change.actorId === actorId && (change.status === "dead" || change.status === "changed");
      });
    }).sort(function (a, b) { return a.sequence - b.sequence; })[0] || null;
  }

  function playerObservations(run) {
    return list(run && run.continuity && run.continuity.observations).filter(function (row) {
      return row.observerId === PLAYER_ID;
    });
  }

  function observedByPlayer(run, eventId) {
    return playerObservations(run).filter(function (row) { return row.eventId === eventId; });
  }

  function canonicalEvents(run, type, night) {
    return list(run && run.continuity && run.continuity.events).filter(function (event) {
      return (!type || event.type === type) && (night == null || event.night === night);
    }).sort(function (a, b) { return a.sequence - b.sequence; });
  }

  function observationsForEvent(run, eventId) {
    return list(run && run.continuity && run.continuity.observations).filter(function (row) {
      return row.eventId === eventId;
    });
  }

  /* Recognition is directional. Two people occupying the same truth event
     does not mean either identified the other, and one clear sighting does
     not manufacture the reverse memory. Every interview-facing sighting
     query goes through the observer's own observation rows. */
  function recognitionEvents(run, observerId, targetId, options) {
    options = options || {};
    if (!run || !run.continuity || !observerId || !targetId) return [];
    return list(run.continuity.observations).map(function (observation) {
      if (observation.observerId !== observerId
        || list(observation.actorIdsRecognised).indexOf(targetId) < 0) return null;
      var event = Continuity.eventById(run.continuity, observation.eventId);
      if (!event || (options.night != null && event.night !== options.night)
        || (options.location && event.location !== options.location)) return null;
      var raw = rawEvent(event);
      return {
        eventId: event.id,
        observationId: observation.id,
        night: event.night,
        location: event.location || raw.location || null,
        type: event.type,
        kind: raw.kind || event.type,
        slot: eventSlot(event),
        mode: observation.mode,
        certainty: observation.certainty,
        acknowledged: !!raw.acknowledged || event.type === "hailed" || raw.kind === "hailed"
      };
    }).filter(Boolean).sort(function (a, b) {
      return a.slot - b.slot || String(a.eventId).localeCompare(String(b.eventId));
    });
  }

  function encounterRecognition(run, actorId, options) {
    options = options || {};
    var playerRows = recognitionEvents(run, PLAYER_ID, actorId, options);
    var actorRows = recognitionEvents(run, actorId, PLAYER_ID, options);
    var actorByEvent = {};
    actorRows.forEach(function (row) { actorByEvent[row.eventId] = row; });
    var mutual = playerRows.map(function (playerRow) {
      var actorRow = actorByEvent[playerRow.eventId];
      if (!actorRow) return null;
      return {
        eventId: playerRow.eventId,
        night: playerRow.night,
        location: playerRow.location || actorRow.location,
        slot: playerRow.slot,
        kind: playerRow.kind,
        acknowledged: !!(playerRow.acknowledged || actorRow.acknowledged)
      };
    }).filter(Boolean);
    return {
      playerSawActor: playerRows,
      actorSawPlayer: actorRows,
      mutual: mutual,
      acknowledged: mutual.filter(function (row) { return row.acknowledged; })
    };
  }

  /* A visit is a chain, not three unrelated flags. The arrival, anything
     said through the door and the final choice share a night/slot and are
     returned together. Player recognition comes only from observations. */
  function thresholdVisits(run, night) {
    var arrivals = canonicalEvents(run, "threshold_arrival", night);
    return arrivals.map(function (arrival) {
      var arrivalRaw = rawEvent(arrival);
      var slot = eventSlot(arrival);
      var related = canonicalEvents(run, null, arrival.night).filter(function (event) {
        return eventSlot(event) === slot && [
          "threshold_look", "threshold_spoken", "threshold_choice",
          "threshold_monster_visit", "threshold_missing_report",
          "threshold_watched_item_report", "threshold_confrontation"
        ].indexOf(event.type) >= 0;
      });
      var choice = related.find(function (event) { return event.type === "threshold_choice"; }) || null;
      var report = related.find(function (event) {
        return ["threshold_monster_visit", "threshold_missing_report", "threshold_watched_item_report"].indexOf(event.type) >= 0;
      }) || null;
      var choiceRaw = rawEvent(choice);
      var reportRaw = rawEvent(report);
      var observed = [arrival].concat(related).some(function (event) {
        return observedByPlayer(run, event.id).length > 0;
      });
      var recognisedIds = unique([arrival].concat(related).reduce(function (ids, event) {
        observationsForEvent(run, event.id).filter(function (row) {
          return row.observerId === PLAYER_ID;
        }).forEach(function (row) { ids = ids.concat(row.actorIdsRecognised); });
        return ids;
      }, []));
      return {
        eventId: arrival.id,
        night: arrival.night,
        slot: slot,
        visitorId: arrivalRaw.actorId || choiceRaw.actorId || reportRaw.actorId || reportRaw.reporterId || null,
        visitorKind: arrivalRaw.visitorKind || choiceRaw.visitorKind || null,
        thresholdKind: arrivalRaw.thresholdKind || choiceRaw.thresholdKind || null,
        action: choiceRaw.action || null,
        opened: !!choiceRaw.opened,
        killed: !!choiceRaw.killed,
        location: choice && choice.location || arrival.location,
        choiceEventId: choice && choice.id || null,
        reportEventId: report && report.id || null,
        subjectId: reportRaw.subjectId || null,
        recognisedActorIds: recognisedIds,
        playerObserved: observed
      };
    });
  }

  function thresholdVisitCount(run) {
    return thresholdVisits(run).filter(function (visit) { return visit.playerObserved; }).length;
  }

  /* A shared discovery exists only when the investigation says it happened
     and both the player and companion observed that same canonical event. */
  function sharedDiscoveries(run, options) {
    options = options || {};
    return canonicalEvents(run, "investigated_attack", options.night).map(function (event) {
      var raw = rawEvent(event);
      if (!raw.sharedDiscovery) return null;
      var victimId = raw.victimId || list(event.subjectIds)[0] || null;
      var candidates = unique([raw.rescueReporterId].concat(raw.corroboratingWitnessIds || [], event.actorIds || []))
        .filter(function (actorId) { return actorId !== PLAYER_ID && actorId !== victimId; });
      var companions = candidates.filter(function (actorId) {
        return Continuity.sharedObservation(run.continuity, PLAYER_ID, actorId, event.id);
      });
      if (!companions.length) return null;
      return {
        eventId: event.id,
        night: event.night,
        location: event.location,
        victimId: victimId,
        companionIds: companions,
        attackEventId: raw.attackEventId || null
      };
    }).filter(Boolean).filter(function (discovery) {
      return !options.actorId || discovery.companionIds.indexOf(options.actorId) >= 0;
    });
  }

  function sharedDiscoveryForActor(run, actorId, night) {
    var rows = sharedDiscoveries(run, { actorId: actorId, night: night });
    return rows.length ? rows[rows.length - 1] : null;
  }

  var MONSTER_KNOWLEDGE_TYPES = {
    monster_reveal_choice: true,
    monster_close_read: true,
    monster_spared_player: true,
    chase_started: true,
    monster_unmasked: true,
    monster_slain: true,
    monster_recognition: true,
    failed_rite: true,
    hailed: true
  };

  function monsterAwareness(run, hostId) {
    var ledger = run && run.continuity;
    var result = {
      hostId: hostId || null,
      playerRecognisedHost: false,
      hostRecognisedPlayer: false,
      failedRiteCount: 0,
      recognitionEventIds: [],
      mutualEventIds: []
    };
    if (!ledger || !hostId) return result;
    canonicalEvents(run).forEach(function (event) {
      var raw = rawEvent(event);
      var relevant = !!MONSTER_KNOWLEDGE_TYPES[event.type]
        && (list(event.actorIds).indexOf(hostId) >= 0 || list(event.subjectIds).indexOf(hostId) >= 0 || raw.actorId === hostId);
      if (!relevant) return;
      var rows = observationsForEvent(run, event.id);
      var playerRecognisesActor = rows.some(function (row) {
        return row.observerId === PLAYER_ID && list(row.actorIdsRecognised).indexOf(hostId) >= 0;
      });
      var revealsHost = ["monster_reveal_choice", "monster_close_read", "monster_unmasked", "monster_slain", "monster_recognition", "failed_rite"].indexOf(event.type) >= 0;
      var playerKnows = revealsHost && playerRecognisesActor;
      var hostKnows = rows.some(function (row) {
        return row.observerId === hostId && list(row.actorIdsRecognised).indexOf(PLAYER_ID) >= 0;
      });
      if (playerKnows) {
        result.playerRecognisedHost = true;
        result.recognitionEventIds.push(event.id);
      }
      if (hostKnows) result.hostRecognisedPlayer = true;
      if (playerKnows && hostKnows) result.mutualEventIds.push(event.id);
      if (raw.wrongName || raw.failedRite || event.type === "failed_rite") result.failedRiteCount += 1;
    });
    result.recognitionEventIds = unique(result.recognitionEventIds);
    result.mutualEventIds = unique(result.mutualEventIds);
    return result;
  }

  function recordMonsterAwareness(run, hostId, spec) {
    spec = spec || {};
    if (!run || !hostId) throw new Error("a run and monster host are required");
    run.continuity = Continuity.ensureActors(run.continuity, run.npcs || []);
    var id = spec.id || ["run", "night-" + (spec.night == null ? "unknown" : spec.night), spec.type || "monster-recognition", hostId].map(slug).join(":");
    if (!Continuity.eventById(run.continuity, id)) {
      var hostCanAct = Continuity.actorCanAct(run.continuity, hostId);
      run.continuity = Continuity.appendEvent(run.continuity, {
        id: id,
        type: spec.type || "monster_recognition",
        phase: spec.phase || "night",
        night: spec.night == null ? null : spec.night,
        location: spec.location || null,
        actorIds: unique([PLAYER_ID].concat(hostCanAct ? [hostId] : [])),
        subjectIds: hostCanAct ? [] : [hostId],
        truth: Object.assign({}, spec.truth || {}, {
          actorId: hostId,
          playerRecognisedHost: !!spec.playerRecognisedHost,
          hostRecognisedPlayer: !!spec.hostRecognisedPlayer,
          failedRite: !!spec.failedRite,
          source: spec.source || "playable-run"
        }),
        tags: unique(["monster-awareness"].concat(spec.tags || []))
      });
      if (spec.playerRecognisedHost) run.continuity = Continuity.recordObservation(run.continuity, {
        id: id + ":observation:player",
        eventId: id,
        observerId: PLAYER_ID,
        mode: "direct",
        certainty: "certain",
        factKeys: ["monster-host:" + hostId],
        actorIdsRecognised: [hostId],
        locationRecognised: spec.locationRecognised !== false
      });
      if (spec.hostRecognisedPlayer) run.continuity = Continuity.recordObservation(run.continuity, {
        id: id + ":observation:" + slug(hostId),
        eventId: id,
        observerId: hostId,
        mode: "direct",
        certainty: "certain",
        factKeys: ["player-recognised"],
        actorIdsRecognised: [PLAYER_ID],
        locationRecognised: spec.locationRecognised !== false
      });
    }
    return id;
  }

  var RELATIONSHIP_TYPES = {
    intervention: true,
    abandonment: true,
    threshold_confrontation: true,
    intrusion_witnessed: true,
    restraint_witnessed: true
  };

  function relationshipKind(event, raw) {
    if (event.type === "intervention") return raw.succeeded ? "rescued" : "attempted_rescue";
    if (event.type === "abandonment") return "abandoned";
    if (event.type === "threshold_confrontation") return "caught_watching";
    if (event.type === "intrusion_witnessed") return "intrusion";
    if (event.type === "restraint_witnessed") return "restraint";
    return null;
  }

  function relationshipHistory(run, options) {
    options = options || {};
    var acknowledgements = {};
    canonicalEvents(run, "relationship_acknowledged").forEach(function (event) {
      var raw = rawEvent(event);
      if (raw.relationshipEventId) acknowledgements[raw.relationshipEventId] = event.id;
    });
    return canonicalEvents(run, null, options.night).map(function (event) {
      if (!RELATIONSHIP_TYPES[event.type]) return null;
      var raw = rawEvent(event);
      var kind = relationshipKind(event, raw);
      var actorId = raw.actorId || raw.victimId || list(event.actorIds).find(function (id) { return id !== PLAYER_ID; }) || null;
      if (!actorId || !Continuity.observedEvent(run.continuity, actorId, event.id)) return null;
      return {
        eventId: event.id,
        night: event.night,
        actorId: actorId,
        kind: kind,
        location: event.location,
        succeeded: raw.succeeded == null ? null : !!raw.succeeded,
        acknowledged: !!acknowledgements[event.id],
        acknowledgementEventId: acknowledgements[event.id] || null
      };
    }).filter(Boolean).filter(function (event) {
      return !options.actorId || event.actorId === options.actorId;
    });
  }

  function unacknowledgedRelationship(run, actorId) {
    var rows = relationshipHistory(run, { actorId: actorId }).filter(function (event) { return !event.acknowledged; });
    return rows.length ? rows[rows.length - 1] : null;
  }

  function acknowledgeRelationship(run, relationshipEventId, spec) {
    spec = spec || {};
    if (!run || !run.continuity || !Continuity.eventById(run.continuity, relationshipEventId)) return null;
    var id = relationshipEventId + ":acknowledged";
    if (Continuity.eventById(run.continuity, id)) return id;
    var source = Continuity.eventById(run.continuity, relationshipEventId);
    run.continuity = Continuity.appendEvent(run.continuity, {
      id: id,
      type: "relationship_acknowledged",
      phase: "day",
      day: spec.day == null ? null : spec.day,
      location: spec.location || source.location,
      actorIds: [PLAYER_ID],
      subjectIds: list(source.actorIds).filter(function (actorId) { return actorId !== PLAYER_ID; }).slice(0, 1),
      truth: { relationshipEventId: relationshipEventId, source: "interview" },
      tags: ["relationship", "acknowledgement"]
    });
    return id;
  }

  /* A shared destination is not a meeting. Witness answers may name only
     people present in an event this speaker observed and recognised. This
     deliberately ignores the hidden schedule: two villagers can use the
     graveyard at different hours without seeing one another. */
  function observedCompanionIds(run, observerId, night, location) {
    if (!run || !run.continuity || !observerId || !location) return [];
    var ids = [];
    Continuity.observationsFor(run.continuity, observerId).forEach(function (observation) {
      var event = Continuity.eventById(run.continuity, observation.eventId);
      if (!event || event.night !== night || event.location !== location || observation.locationRecognised === false) return;
      var participants = unique(list(event.actorIds).concat(list(event.subjectIds)));
      list(observation.actorIdsRecognised).forEach(function (actorId) {
        if (actorId !== observerId && actorId !== PLAYER_ID && participants.indexOf(actorId) >= 0 && run.continuity.actors[actorId]) ids.push(actorId);
      });
    });
    return unique(ids);
  }

  function rememberedNightRoute(run, actorId, night) {
    if (!run || !run.continuity || !actorId) return null;
    var route = canonicalEvents(run, "night_route", night).filter(function (event) {
      var raw = rawEvent(event);
      return (raw.actorId || list(event.subjectIds)[0]) === actorId
        && Continuity.observedEvent(run.continuity, actorId, event.id);
    }).slice(-1)[0];
    if (!route) return null;
    var raw = rawEvent(route);
    return {
      eventId: route.id,
      actorId: actorId,
      night: route.night,
      location: raw.primaryLocation || route.location || "home",
      locations: unique(raw.locations),
      slots: list(raw.slots).slice(),
      depart: raw.depart == null ? null : raw.depart,
      duration: raw.duration == null ? null : raw.duration,
      motiveId: raw.motiveId || null
    };
  }

  function alibiTestimonies(run, speakerId, night) {
    return list(run && run.continuity && run.continuity.testimonies).filter(function (row) {
      return row.speakerId === speakerId && row.listenerId === PLAYER_ID
        && row.claims && row.claims.kind === "alibi"
        && (night == null || row.claims.night === night);
    });
  }

  function recordAlibiTestimony(run, speakerId, night, spec) {
    spec = spec || {};
    if (!run || !run.continuity || !speakerId || night == null || !spec.claim) return null;
    var route = rememberedNightRoute(run, speakerId, night);
    if (!route) return null;
    var id = spec.id || ["interview", "day-" + (spec.day == null ? "unknown" : spec.day), "alibi", speakerId, "night-" + night, spec.question || "where"].map(slug).join(":");
    var existing = list(run.continuity.testimonies).find(function (row) { return row.id === id; });
    if (existing) return existing.id;
    run.continuity = Continuity.recordTestimony(run.continuity, {
      id: id,
      speakerId: speakerId,
      listenerId: PLAYER_ID,
      aboutEventId: route.eventId,
      claims: {
        kind: "alibi",
        night: night,
        location: spec.claim,
        question: spec.question || "where",
        namedActorIds: unique(spec.namedActorIds),
        truthfulness: spec.claim === route.location ? "consistent" : "contradicted_by_route",
        deliberateLie: !!spec.deliberateLie
      }
    });
    return id;
  }

  /* A secret is knowledge, not a boolean on its owner. The truth event says
     which secret was learned and from what scene; the player observation is
     the only thing that makes it available to interviews and endings. */
  function secretKnowledge(run, actorId) {
    if (!run || !run.continuity || !actorId) return null;
    var rows = canonicalEvents(run, "secret_learned").map(function (event) {
      var raw = rawEvent(event);
      var ownerId = raw.actorId || list(event.subjectIds)[0] || null;
      if (ownerId !== actorId || !Continuity.observedEvent(run.continuity, PLAYER_ID, event.id)) return null;
      return {
        eventId: event.id,
        actorId: ownerId,
        night: event.night,
        day: event.day,
        location: event.location,
        source: raw.source || null,
        sourceEventId: raw.sourceEventId || null,
        secretIndex: raw.secretIndex == null ? null : raw.secretIndex,
        summary: raw.summary || null
      };
    }).filter(Boolean);
    return rows.length ? rows[rows.length - 1] : null;
  }

  function recordSecretLearned(run, actorId, spec) {
    spec = spec || {};
    if (!run || !actorId) throw new Error("a run and secret owner are required");
    run.continuity = Continuity.ensureActors(run.continuity, run.npcs || []);
    if (!run.continuity.actors[actorId]) throw new Error("unknown secret owner: " + actorId);
    if (["confession", "followed_scene", "watched_scene", "watched_door"].indexOf(spec.source) >= 0
      && !Continuity.actorCanAct(run.continuity, actorId)) {
      throw new Error("an inactive character cannot reveal a live secret: " + actorId);
    }
    var existing = secretKnowledge(run, actorId);
    if (existing && (spec.secretIndex == null || existing.secretIndex == null || existing.secretIndex === spec.secretIndex)) return existing.eventId;
    var when = spec.night != null ? "night-" + spec.night : spec.day != null ? "day-" + spec.day : "turn-" + run.continuity.sequence;
    var id = spec.id || ["run", when, "secret-learned", actorId, spec.source || "observation"].map(slug).join(":");
    if (!Continuity.eventById(run.continuity, id)) {
      run.continuity = Continuity.appendEvent(run.continuity, {
        id: id,
        type: "secret_learned",
        phase: spec.phase || (spec.day != null ? "day" : "night"),
        night: spec.night == null ? null : spec.night,
        day: spec.day == null ? null : spec.day,
        location: spec.location || null,
        actorIds: [PLAYER_ID],
        subjectIds: [actorId],
        truth: {
          actorId: actorId,
          secretIndex: spec.secretIndex == null ? null : spec.secretIndex,
          summary: spec.summary || null,
          source: spec.source || "observation",
          sourceEventId: spec.sourceEventId || null
        },
        tags: ["secret", "player-knowledge"]
      });
    }
    var observationId = id + ":observation:player";
    if (!list(run.continuity.observations).some(function (row) { return row.id === observationId; })) {
      run.continuity = Continuity.recordObservation(run.continuity, {
        id: observationId,
        eventId: id,
        observerId: PLAYER_ID,
        mode: spec.mode || "direct",
        certainty: "certain",
        factKeys: ["secret:" + actorId],
        actorIdsRecognised: [actorId],
        locationRecognised: spec.locationRecognised !== false
      });
    }
    return id;
  }

  function playerOutcomeKnowledge(run, night, actorId) {
    var outcome = outcomeEvent(run, night, actorId);
    if (!outcome) return null;
    var statusChange = list(outcome.statusChanges).find(function (change) { return change.actorId === actorId; });
    var status = statusChange && statusChange.status;
    var direct = observedByPlayer(run, outcome.id);
    var recognised = direct.find(function (row) { return list(row.actorIdsRecognised).indexOf(actorId) >= 0; });
    if (recognised) return {
      kind: status === "changed" ? "witnessed_change" : "witnessed_death",
      eventId: outcome.id, status: status, location: outcome.location, observationId: recognised.id
    };

    var outcomeRaw = rawEvent(outcome);
    var rawOutcomeId = outcomeRaw.id || outcomeRaw.directorEventId || (outcome.truth && outcome.truth.directorEventId);
    var related = list(run.continuity.events).filter(function (event) {
      if (event.night !== night || event.type !== "investigated_attack") return false;
      return rawEvent(event).attackEventId === rawOutcomeId;
    }).sort(function (a, b) { return a.sequence - b.sequence; });
    for (var i = 0; i < related.length; i += 1) {
      var investigation = related[i];
      var investigationObs = observedByPlayer(run, investigation.id).find(function (row) {
        return list(row.actorIdsRecognised).indexOf(actorId) >= 0;
      });
      if (!investigationObs) continue;
      var investigationRaw = rawEvent(investigation);
      return {
        kind: investigationRaw.sharedDiscovery ? "shared_discovery"
          : investigationRaw.heardLastWords && status === "dead" ? "witnessed_death"
            : status === "changed" ? "witnessed_change" : "found_body",
        eventId: outcome.id,
        investigationEventId: investigation.id,
        status: status,
        location: outcome.location,
        heardLastWords: !!investigationRaw.heardLastWords,
        sharedDiscovery: !!investigationRaw.sharedDiscovery
      };
    }

    var priorSight = list(run.continuity.events).filter(function (event) {
      if (event.night !== night || event.sequence >= outcome.sequence || event.id === outcome.id) return false;
      var mentionsActor = list(event.actorIds).indexOf(actorId) >= 0 || list(event.subjectIds).indexOf(actorId) >= 0;
      if (!mentionsActor || eventSlot(event) > eventSlot(outcome)) return false;
      return observedByPlayer(run, event.id).some(function (row) {
        return list(row.actorIdsRecognised).indexOf(actorId) >= 0;
      });
    }).sort(function (a, b) { return b.sequence - a.sequence; })[0];
    if (priorSight) return {
      kind: "last_seen_alive", eventId: outcome.id, priorEventId: priorSight.id,
      status: status, location: outcome.location, priorLocation: priorSight.location
    };

    if (direct.length) return {
      kind: "heard_only", eventId: outcome.id, status: status, location: outcome.location,
      observationId: direct[0].id
    };
    return { kind: "unknown", eventId: outcome.id, status: status, location: outcome.location };
  }

  return Object.freeze({
    legacyStatus: legacyStatus,
    actorStatus: actorStatus,
    actorCanAppear: actorCanAppear,
    syncActor: syncActor,
    syncRunActors: syncRunActors,
    recordStatusChange: recordStatusChange,
    outcomeEvent: outcomeEvent,
    playerOutcomeKnowledge: playerOutcomeKnowledge,
    thresholdVisits: thresholdVisits,
    thresholdVisitCount: thresholdVisitCount,
    sharedDiscoveries: sharedDiscoveries,
    sharedDiscoveryForActor: sharedDiscoveryForActor,
    recognitionEvents: recognitionEvents,
    encounterRecognition: encounterRecognition,
    monsterAwareness: monsterAwareness,
    recordMonsterAwareness: recordMonsterAwareness,
    relationshipHistory: relationshipHistory,
    unacknowledgedRelationship: unacknowledgedRelationship,
    acknowledgeRelationship: acknowledgeRelationship,
    observedCompanionIds: observedCompanionIds,
    rememberedNightRoute: rememberedNightRoute,
    alibiTestimonies: alibiTestimonies,
    recordAlibiTestimony: recordAlibiTestimony,
    secretKnowledge: secretKnowledge,
    recordSecretLearned: recordSecretLearned
  });
});
