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
    playerOutcomeKnowledge: playerOutcomeKnowledge
  });
});
