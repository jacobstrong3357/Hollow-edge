/* Hollow's Edge V6 Continuity Ledger
 *
 * The ledger is the canonical memory shared by night, daylight, interviews,
 * the Journal and endings. It is deliberately presentation-agnostic and has
 * no dependency on React, the DOM, localStorage or Math.random.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HE_CONTINUITY = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = 6;
  var PLAYER_ID = "player";
  var ACTIVE_STATUSES = { alive: true, changed: true };
  var ACTOR_STATUSES = { alive: true, changed: true, dead: true, fled: true, missing: true };
  var AUTHENTICITY = { genuine: true, planted: true, uncertain: true };
  var EVIDENCE_STATES = { present: true, carried: true, destroyed: true, lost: true };

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function unique(values) {
    return Array.from(new Set(list(values).filter(Boolean)));
  }

  function requireText(value, label) {
    if (typeof value !== "string" || !value.trim()) throw new Error(label + " is required");
    return value.trim();
  }

  function actorMap(actors) {
    var result = {};
    list(actors).forEach(function (actor) {
      if (!actor || !actor.id) return;
      var status = actor.status || (actor.fled ? "fled" : actor.alive === false ? "dead" : actor.turned ? "changed" : "alive");
      result[actor.id] = {
        id: actor.id,
        name: actor.name || actor.id,
        initialStatus: ACTOR_STATUSES[status] ? status : "alive",
        status: ACTOR_STATUSES[status] ? status : "alive"
      };
    });
    return result;
  }

  function createLedger(config) {
    config = config || {};
    return {
      version: VERSION,
      runId: config.runId || "run",
      seed: config.seed || config.runId || "hollows-edge",
      sequence: 0,
      actors: actorMap(config.actors),
      events: [],
      observations: [],
      testimonies: [],
      evidence: [],
      promises: [],
      journal: { stamps: [] },
      migration: config.migration ? clone(config.migration) : null
    };
  }

  function eventById(ledger, eventId) {
    return list(ledger && ledger.events).find(function (event) { return event.id === eventId; }) || null;
  }

  function evidenceById(ledger, evidenceId) {
    return list(ledger && ledger.evidence).find(function (evidence) { return evidence.id === evidenceId; }) || null;
  }

  function currentActorStatus(ledger, actorId) {
    var actor = ledger && ledger.actors && ledger.actors[actorId];
    return actor ? actor.status : null;
  }

  function actorCanAct(ledger, actorId) {
    return !!ACTIVE_STATUSES[currentActorStatus(ledger, actorId)];
  }

  function appendEvent(input, spec) {
    var ledger = upgradeLedger(input);
    spec = spec || {};
    var type = requireText(spec.type, "event type");
    var actorIds = unique(spec.actorIds);
    var subjectIds = unique(spec.subjectIds);

    actorIds.forEach(function (actorId) {
      if (!ledger.actors[actorId]) throw new Error("unknown acting character: " + actorId);
      if (!actorCanAct(ledger, actorId)) throw new Error("inactive character cannot act: " + actorId);
    });
    subjectIds.forEach(function (actorId) {
      if (!ledger.actors[actorId]) throw new Error("unknown subject character: " + actorId);
    });

    var id = spec.id || "event:" + ledger.sequence + ":" + type;
    if (eventById(ledger, id)) throw new Error("duplicate event id: " + id);

    var changes = list(spec.statusChanges).map(function (change) {
      if (!change || !ledger.actors[change.actorId]) throw new Error("status change references an unknown character");
      if (!ACTOR_STATUSES[change.status]) throw new Error("invalid character status: " + change.status);
      return { actorId: change.actorId, status: change.status };
    });

    var event = {
      id: id,
      sequence: ledger.sequence,
      type: type,
      phase: spec.phase || null,
      night: spec.night == null ? null : spec.night,
      day: spec.day == null ? null : spec.day,
      location: spec.location || null,
      actorIds: actorIds,
      subjectIds: subjectIds,
      truth: clone(spec.truth || {}),
      statusChanges: changes,
      tags: unique(spec.tags)
    };

    ledger.events.push(event);
    ledger.sequence += 1;
    changes.forEach(function (change) { ledger.actors[change.actorId].status = change.status; });
    return ledger;
  }

  function recordObservation(input, spec) {
    var ledger = upgradeLedger(input);
    spec = spec || {};
    var event = eventById(ledger, spec.eventId);
    if (!event) throw new Error("observation references an unknown event: " + spec.eventId);
    var observerId = spec.observerId || PLAYER_ID;
    if (observerId !== PLAYER_ID && !ledger.actors[observerId]) throw new Error("unknown observer: " + observerId);
    var id = spec.id || "observation:" + observerId + ":" + event.id;
    if (ledger.observations.some(function (row) { return row.id === id; })) throw new Error("duplicate observation id: " + id);
    ledger.observations.push({
      id: id,
      eventId: event.id,
      observerId: observerId,
      mode: spec.mode || "direct",
      certainty: spec.certainty || "certain",
      factKeys: unique(spec.factKeys),
      actorIdsRecognised: unique(spec.actorIdsRecognised),
      locationRecognised: spec.locationRecognised !== false
    });
    return ledger;
  }

  function recordTestimony(input, spec) {
    var ledger = upgradeLedger(input);
    spec = spec || {};
    var speakerId = requireText(spec.speakerId, "testimony speaker");
    var listenerId = spec.listenerId || PLAYER_ID;
    if (!actorCanAct(ledger, speakerId)) throw new Error("inactive character cannot give testimony: " + speakerId);
    if (listenerId !== PLAYER_ID && !ledger.actors[listenerId]) throw new Error("unknown testimony listener: " + listenerId);
    if (spec.aboutEventId && !eventById(ledger, spec.aboutEventId)) throw new Error("testimony references an unknown event: " + spec.aboutEventId);
    if (spec.heardAtEventId && !eventById(ledger, spec.heardAtEventId)) throw new Error("testimony hearing references an unknown event: " + spec.heardAtEventId);
    var id = spec.id || "testimony:" + ledger.testimonies.length + ":" + speakerId;
    if (ledger.testimonies.some(function (row) { return row.id === id; })) throw new Error("duplicate testimony id: " + id);
    ledger.testimonies.push({
      id: id,
      speakerId: speakerId,
      listenerId: listenerId,
      aboutEventId: spec.aboutEventId || null,
      claims: clone(spec.claims || {}),
      heardAtEventId: spec.heardAtEventId || null
    });
    return ledger;
  }

  function addEvidence(input, spec) {
    var ledger = upgradeLedger(input);
    spec = spec || {};
    var id = requireText(spec.id, "evidence id");
    if (evidenceById(ledger, id)) throw new Error("duplicate evidence id: " + id);
    if (!eventById(ledger, spec.sourceEventId)) throw new Error("evidence requires a source event");
    var authenticity = spec.authenticity || "uncertain";
    var state = spec.state || "present";
    if (!AUTHENTICITY[authenticity]) throw new Error("invalid evidence authenticity: " + authenticity);
    if (!EVIDENCE_STATES[state]) throw new Error("invalid evidence state: " + state);
    ledger.evidence.push({
      id: id,
      objectKey: requireText(spec.objectKey, "evidence objectKey"),
      sign: spec.sign || null,
      sourceEventId: spec.sourceEventId,
      location: spec.location || eventById(ledger, spec.sourceEventId).location || null,
      authenticity: authenticity,
      state: state,
      discoveredBy: unique(spec.discoveredBy),
      inspectedBy: unique(spec.inspectedBy),
      imageKey: spec.imageKey || spec.objectKey
    });
    return ledger;
  }

  function updateEvidence(input, evidenceId, changes) {
    var ledger = upgradeLedger(input);
    var evidence = evidenceById(ledger, evidenceId);
    if (!evidence) throw new Error("unknown evidence: " + evidenceId);
    changes = changes || {};
    if (changes.state && !EVIDENCE_STATES[changes.state]) throw new Error("invalid evidence state: " + changes.state);
    if (Object.prototype.hasOwnProperty.call(changes, "authenticity")) throw new Error("evidence authenticity is immutable");
    Object.keys(changes).forEach(function (key) {
      if (key === "id" || key === "sourceEventId") return;
      evidence[key] = clone(changes[key]);
    });
    return ledger;
  }

  function discoverEvidence(input, evidenceId, observerId) {
    var ledger = upgradeLedger(input);
    var evidence = evidenceById(ledger, evidenceId);
    observerId = observerId || PLAYER_ID;
    if (!evidence) throw new Error("unknown evidence: " + evidenceId);
    evidence.discoveredBy = unique(evidence.discoveredBy.concat([observerId]));
    return ledger;
  }

  function inspectEvidence(input, evidenceId, observerId) {
    var ledger = upgradeLedger(input);
    var evidence = evidenceById(ledger, evidenceId);
    observerId = observerId || PLAYER_ID;
    if (!evidence) throw new Error("unknown evidence: " + evidenceId);
    if (!evidence.discoveredBy.includes(observerId)) throw new Error("evidence must be discovered before it can be inspected");
    evidence.inspectedBy = unique(evidence.inspectedBy.concat([observerId]));
    return ledger;
  }

  function stampEvidence(input, evidenceId) {
    var ledger = upgradeLedger(input);
    var evidence = evidenceById(ledger, evidenceId);
    if (!evidence) throw new Error("unknown evidence: " + evidenceId);
    if (!evidence.discoveredBy.includes(PLAYER_ID)) throw new Error("the player cannot stamp undiscovered evidence");
    if (!evidence.inspectedBy.includes(PLAYER_ID)) throw new Error("the player must inspect evidence before stamping it");
    if (!ledger.journal.stamps.includes(evidenceId)) ledger.journal.stamps.push(evidenceId);
    return ledger;
  }

  function observationsFor(ledger, observerId) {
    return list(ledger && ledger.observations).filter(function (row) { return row.observerId === observerId; });
  }

  function observedEvent(ledger, observerId, eventId) {
    return observationsFor(ledger, observerId).some(function (row) { return row.eventId === eventId; });
  }

  function sharedObservation(ledger, firstId, secondId, eventId) {
    return observedEvent(ledger, firstId, eventId) && observedEvent(ledger, secondId, eventId);
  }

  function playerCanRaiseEvent(ledger, eventId) {
    if (observedEvent(ledger, PLAYER_ID, eventId)) return true;
    return list(ledger && ledger.testimonies).some(function (row) {
      return row.listenerId === PLAYER_ID && row.aboutEventId === eventId;
    });
  }

  function countedSigns(ledger) {
    return unique(list(ledger && ledger.journal && ledger.journal.stamps).map(function (id) {
      return evidenceById(ledger, id);
    }).filter(function (evidence) {
      return evidence && evidence.authenticity === "genuine" && evidence.sign;
    }).map(function (evidence) { return evidence.sign; }));
  }

  function schedulePromise(input, spec) {
    var ledger = upgradeLedger(input);
    spec = spec || {};
    var id = requireText(spec.id, "promise id");
    var kind = requireText(spec.kind, "promise kind");
    if (ledger.promises.some(function (row) { return row.id === id; })) throw new Error("duplicate promise id: " + id);
    if (spec.createdByEventId && !eventById(ledger, spec.createdByEventId)) throw new Error("promise references an unknown cause event");
    if (spec.actorId && !ledger.actors[spec.actorId]) throw new Error("promise references an unknown actor: " + spec.actorId);
    var eligibleNight = Number.isInteger(spec.eligibleNight) ? spec.eligibleNight : 1;
    var dueByNight = Number.isInteger(spec.dueByNight) ? spec.dueByNight : eligibleNight;
    if (dueByNight < eligibleNight) throw new Error("promise deadline cannot precede eligibility");
    ledger.promises.push({
      id: id,
      kind: kind,
      actorId: spec.actorId || null,
      targetId: spec.targetId || PLAYER_ID,
      createdByEventId: spec.createdByEventId || null,
      eligibleNight: eligibleNight,
      dueByNight: dueByNight,
      status: "pending",
      fulfilledByEventId: null,
      payload: clone(spec.payload || {})
    });
    return ledger;
  }

  function pendingPromises(ledger, context) {
    context = context || {};
    var night = Number.isInteger(context.night) ? context.night : 0;
    var kinds = unique(context.kinds);
    return list(ledger && ledger.promises).filter(function (promise) {
      return promise.status === "pending" && promise.eligibleNight <= night && (!kinds.length || kinds.includes(promise.kind));
    }).map(function (promise) {
      var result = clone(promise);
      result.overdue = night > promise.dueByNight;
      return result;
    }).sort(function (a, b) {
      return a.dueByNight - b.dueByNight || a.eligibleNight - b.eligibleNight || a.id.localeCompare(b.id);
    });
  }

  function fulfillPromise(input, promiseId, eventId) {
    var ledger = upgradeLedger(input);
    var promise = ledger.promises.find(function (row) { return row.id === promiseId; });
    if (!promise) throw new Error("unknown promise: " + promiseId);
    if (promise.status !== "pending") throw new Error("promise is already settled: " + promiseId);
    if (!eventById(ledger, eventId)) throw new Error("promise requires a fulfilling event");
    promise.status = "fulfilled";
    promise.fulfilledByEventId = eventId;
    return ledger;
  }

  function canPresent(ledger, contract, context) {
    contract = contract || {};
    context = context || {};
    var audienceId = context.audienceId || PLAYER_ID;
    var reasons = [];
    list(contract.requiresObservedEvents).forEach(function (eventId) {
      if (!observedEvent(ledger, audienceId, eventId)) reasons.push(audienceId + " did not observe " + eventId);
    });
    list(contract.forbidsObservedEvents).forEach(function (eventId) {
      if (observedEvent(ledger, audienceId, eventId)) reasons.push(audienceId + " already observed " + eventId);
    });
    list(contract.requiresRaiseableEvents).forEach(function (eventId) {
      if (audienceId !== PLAYER_ID || !playerCanRaiseEvent(ledger, eventId)) reasons.push("player cannot raise " + eventId);
    });
    list(contract.actorsCanAct).forEach(function (actorId) {
      if (!actorCanAct(ledger, actorId)) reasons.push(actorId + " cannot act");
    });
    Object.keys(contract.subjectStatuses || {}).forEach(function (actorId) {
      if (currentActorStatus(ledger, actorId) !== contract.subjectStatuses[actorId]) reasons.push(actorId + " is not " + contract.subjectStatuses[actorId]);
    });
    list(contract.requiresDiscoveredEvidence).forEach(function (evidenceId) {
      var evidence = evidenceById(ledger, evidenceId);
      if (!evidence || !evidence.discoveredBy.includes(audienceId)) reasons.push(audienceId + " did not discover " + evidenceId);
    });
    list(contract.requiresStampedEvidence).forEach(function (evidenceId) {
      if (!ledger.journal.stamps.includes(evidenceId)) reasons.push(evidenceId + " is not stamped");
    });
    if (contract.location && context.location !== contract.location) reasons.push("scene is not at " + contract.location);
    return { ok: reasons.length === 0, reasons: reasons };
  }

  /* FNV-1a plus a final avalanche gives stable keyed outcomes without keeping
     mutable RNG position. Callers must use a durable semantic key. */
  function hash(text) {
    var h = 2166136261;
    var value = String(text);
    for (var i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return h >>> 0;
  }

  function roll(seed, key) {
    if (key == null || !String(key).trim()) throw new Error("outcome key is required");
    return hash(String(seed) + "|" + String(key).trim()) / 4294967296;
  }

  function chance(seed, key, probability) {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return roll(seed, key) < probability;
  }

  function pick(seed, key, values) {
    if (!Array.isArray(values) || !values.length) return null;
    return values[Math.floor(roll(seed, key) * values.length)];
  }

  function upgradeLedger(input) {
    if (!input) return createLedger();
    var ledger = clone(input);
    if (ledger.version > VERSION) throw new Error("continuity ledger is from a newer build");
    ledger.version = VERSION;
    ledger.runId = ledger.runId || "run";
    ledger.seed = ledger.seed || ledger.runId;
    ledger.sequence = Number.isInteger(ledger.sequence) ? ledger.sequence : list(ledger.events).length;
    ledger.actors = ledger.actors || {};
    ledger.events = list(ledger.events);
    ledger.observations = list(ledger.observations);
    ledger.testimonies = list(ledger.testimonies);
    ledger.evidence = list(ledger.evidence);
    ledger.promises = list(ledger.promises);
    Object.keys(ledger.actors).forEach(function (id) {
      var actor = ledger.actors[id];
      actor.initialStatus = actor.initialStatus || actor.status || "alive";
      actor.status = actor.status || actor.initialStatus;
    });
    ledger.journal = ledger.journal || {};
    ledger.journal.stamps = unique(ledger.journal.stamps);
    return ledger;
  }

  function upgradeRun(input) {
    var run = clone(input || {});
    if (run.schemaVersion > VERSION) throw new Error("run is from a newer build");
    if (!run.continuity) {
      var prior = run.schemaVersion || 5;
      run.continuity = createLedger({
        runId: run.gameId || "legacy-run",
        seed: run.seed || run.gameId || "legacy-run",
        actors: run.npcs || [],
        migration: { from: prior, importedLegacyFacts: false }
      });
      run.legacySchemaVersion = prior;
    } else {
      run.continuity = upgradeLedger(run.continuity);
    }
    run.schemaVersion = VERSION;
    return run;
  }

  function validateLedger(input) {
    var ledger;
    try { ledger = upgradeLedger(input); } catch (error) { return [error.message]; }
    var errors = [];
    var ids = {};
    var statuses = {};
    Object.keys(ledger.actors).forEach(function (id) { statuses[id] = ledger.actors[id].initialStatus; });
    ledger.events.forEach(function (event, index) {
      if (!event.id || ids[event.id]) errors.push("duplicate or missing event id at " + index);
      ids[event.id] = true;
      if (event.sequence !== index) errors.push("event sequence mismatch for " + event.id);
      list(event.actorIds).forEach(function (id) {
        if (!ledger.actors[id]) errors.push("event " + event.id + " has unknown actor " + id);
        else if (!ACTIVE_STATUSES[statuses[id]]) errors.push("inactive character " + id + " acts in " + event.id);
      });
      list(event.subjectIds).forEach(function (id) { if (!ledger.actors[id]) errors.push("event " + event.id + " has unknown subject " + id); });
      list(event.statusChanges).forEach(function (change) {
        if (!ledger.actors[change.actorId]) errors.push("event " + event.id + " changes an unknown actor");
        else if (!ACTOR_STATUSES[change.status]) errors.push("event " + event.id + " has invalid actor status");
        else statuses[change.actorId] = change.status;
      });
    });
    Object.keys(statuses).forEach(function (id) {
      if (ledger.actors[id].status !== statuses[id]) errors.push("projected status mismatch for " + id);
    });
    ledger.observations.forEach(function (row) {
      if (!ids[row.eventId]) errors.push("observation " + row.id + " has no event");
      if (row.observerId !== PLAYER_ID && !ledger.actors[row.observerId]) errors.push("observation " + row.id + " has unknown observer");
    });
    ledger.testimonies.forEach(function (row) {
      if (!ledger.actors[row.speakerId]) errors.push("testimony " + row.id + " has unknown speaker");
      if (row.aboutEventId && !ids[row.aboutEventId]) errors.push("testimony " + row.id + " has no subject event");
    });
    ledger.evidence.forEach(function (evidence) {
      if (!ids[evidence.sourceEventId]) errors.push("evidence " + evidence.id + " has no source event");
      if (!AUTHENTICITY[evidence.authenticity]) errors.push("evidence " + evidence.id + " has invalid authenticity");
      if (!EVIDENCE_STATES[evidence.state]) errors.push("evidence " + evidence.id + " has invalid state");
      if (!evidence.imageKey) errors.push("evidence " + evidence.id + " has no image key");
    });
    ledger.journal.stamps.forEach(function (id) {
      var evidence = evidenceById(ledger, id);
      if (!evidence) errors.push("journal stamp has no evidence: " + id);
      else if (!evidence.discoveredBy.includes(PLAYER_ID) || !evidence.inspectedBy.includes(PLAYER_ID)) errors.push("journal stamp was not manually earned: " + id);
    });
    var promiseIds = {};
    ledger.promises.forEach(function (promise) {
      if (!promise.id || promiseIds[promise.id]) errors.push("duplicate or missing promise id");
      promiseIds[promise.id] = true;
      if (promise.createdByEventId && !ids[promise.createdByEventId]) errors.push("promise " + promise.id + " has no cause event");
      if (promise.fulfilledByEventId && !ids[promise.fulfilledByEventId]) errors.push("promise " + promise.id + " has no fulfilling event");
      if (promise.status !== "pending" && promise.status !== "fulfilled") errors.push("promise " + promise.id + " has invalid status");
      if (promise.dueByNight < promise.eligibleNight) errors.push("promise " + promise.id + " has an impossible deadline");
    });
    return unique(errors);
  }

  return {
    VERSION: VERSION,
    PLAYER_ID: PLAYER_ID,
    createLedger: createLedger,
    upgradeLedger: upgradeLedger,
    upgradeRun: upgradeRun,
    appendEvent: appendEvent,
    recordObservation: recordObservation,
    recordTestimony: recordTestimony,
    addEvidence: addEvidence,
    updateEvidence: updateEvidence,
    discoverEvidence: discoverEvidence,
    inspectEvidence: inspectEvidence,
    stampEvidence: stampEvidence,
    eventById: eventById,
    evidenceById: evidenceById,
    currentActorStatus: currentActorStatus,
    actorCanAct: actorCanAct,
    observationsFor: observationsFor,
    observedEvent: observedEvent,
    sharedObservation: sharedObservation,
    playerCanRaiseEvent: playerCanRaiseEvent,
    countedSigns: countedSigns,
    schedulePromise: schedulePromise,
    pendingPromises: pendingPromises,
    fulfillPromise: fulfillPromise,
    canPresent: canPresent,
    roll: roll,
    chance: chance,
    pick: pick,
    validateLedger: validateLedger
  };
});
