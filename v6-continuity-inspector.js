/* Hollow's Edge V6 Continuity Inspector
 *
 * A read-only development view of canonical truth and observer knowledge.
 * This module deliberately returns plain data and never writes to the ledger.
 */
(function (root, factory) {
  var continuity = typeof module === "object" && module.exports
    ? require("./v6-continuity.js")
    : root && root.HE_CONTINUITY;
  var api = factory(continuity);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HE_V6_CONTINUITY_INSPECTOR = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Continuity) {
  "use strict";

  if (!Continuity) throw new Error("V6 continuity inspector requires HE_CONTINUITY");

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function eventView(event) {
    return {
      id: event.id,
      sequence: event.sequence,
      type: event.type,
      phase: event.phase,
      night: event.night,
      day: event.day,
      location: event.location,
      actorIds: list(event.actorIds).slice(),
      subjectIds: list(event.subjectIds).slice(),
      statusChanges: clone(event.statusChanges || []),
      truth: clone(event.truth || {})
    };
  }

  function observerView(ledger, observerId) {
    return list(ledger.observations)
      .filter(function (row) { return row.observerId === observerId; })
      .map(function (row) {
        var event = Continuity.eventById(ledger, row.eventId);
        return {
          id: row.id,
          eventId: row.eventId,
          event: event ? eventView(event) : null,
          mode: row.mode,
          certainty: row.certainty,
          factKeys: list(row.factKeys).slice(),
          actorIdsRecognised: list(row.actorIdsRecognised).slice(),
          locationRecognised: row.locationRecognised !== false
        };
      });
  }

  function testimonyFor(ledger, listenerId) {
    return list(ledger.testimonies)
      .filter(function (row) { return row.listenerId === listenerId; })
      .map(clone);
  }

  function snapshot(run) {
    var upgraded = Continuity.upgradeRun(run || {});
    var ledger = upgraded.continuity;
    var observers = {};
    Object.keys(ledger.actors).forEach(function (id) {
      observers[id] = {
        actor: clone(ledger.actors[id]),
        observations: observerView(ledger, id),
        testimonyHeard: testimonyFor(ledger, id)
      };
    });
    return {
      version: ledger.version,
      runId: ledger.runId,
      sequence: ledger.sequence,
      migration: clone(ledger.migration),
      issues: Continuity.validateLedger(ledger),
      truth: list(ledger.events).map(eventView),
      observers: observers,
      evidence: clone(ledger.evidence),
      promises: clone(ledger.promises),
      journal: clone(ledger.journal)
    };
  }

  function serializationAudit(run) {
    var before = snapshot(run);
    var restoredRun = Continuity.upgradeRun(JSON.parse(JSON.stringify(run || {})));
    var after = snapshot(restoredRun);
    return {
      ok: JSON.stringify(before) === JSON.stringify(after),
      before: before,
      after: after
    };
  }

  return Object.freeze({
    snapshot: snapshot,
    observerView: observerView,
    serializationAudit: serializationAudit
  });
});
