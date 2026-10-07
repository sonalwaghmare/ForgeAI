import { ALERTS } from './alerts'
import { logEntries } from './logbook'
import { SELF_ID, personById } from './people'

/**
 * The audit log.
 *
 * SYNTHETIC. Gated on `VITE_DEMO_MODE`. See `DEMO-MODE.md` §8.17.
 *
 * ── It is written by the rest of the demo, not authored here ──────────────
 * The design ships seven rows and a `hash: "sha256:9f2b…e41a"` that is the same
 * on all of them. Here every write in this product appends: lock an account on
 * the Users page, change a role, run an import, delete an alert rule, connect a
 * channel, save a connection — then open this page and the entry is there, with
 * who did it and what it was done to. That is the only version of an audit log
 * worth showing, because it is the only one that can be checked by doing
 * something.
 *
 * ── The history it starts with is the estate's own ────────────────────────
 * A log that is empty until you click something is a demo of an empty table. So
 * the seed is derived from things that have actually happened in this universe —
 * the anomalies somebody acknowledged, the notes somebody wrote — each with the
 * actor and the time those records already carry. Nothing in the seed is a row
 * invented to fill the screen, and a check asserts every seeded entry points at
 * a record that exists.
 *
 * ── No hash ───────────────────────────────────────────────────────────────
 * The design prints one per row and it is the same string every time, which is
 * worse than printing none: a tamper-evidence claim that is visibly not
 * tamper-evident. Chaining these entries properly is a server's job. The page
 * says the log is append-only and says nothing it cannot back.
 */

/**
 * What an action means for the reader, and therefore how it is coloured.
 *
 * Derived from the action rather than passed in beside it, so the same action
 * cannot be Info in one place and Critical in another. Anything that removes
 * access or a record is critical; anything that changes who can do what is a
 * warning; the rest is information.
 */
const CRITICAL = new Set([
  'ACCOUNT_LOCKED',
  'RULE_DELETED',
  'ROLE_DELETED',
  'CHANNEL_DISCONNECTED',
  /* A security policy change. The design's own audit table marks
     `settings:security · MFA enforcement enabled` critical, and it is right to:
     turning that off is the entry an access review is opened to find. */
  'SETTINGS_CHANGED',
  /* A key withdrawn or replaced ends an integration's access. */
  'API_KEY_REVOKED',
  /* A connection removed from the registry takes its pipelines with it. */
  'SOURCE_DELETED',
  /* Every setting in the product put back at once. It cannot clear this log —
     that is the point of the log — so this entry is how anybody finds out. */
  'SETTINGS_RESET',
])
const WARNING = new Set([
  'ACCOUNT_DEACTIVATED',
  'ACCOUNT_REACTIVATED',
  'ROLE_CHANGED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'USERS_IMPORTED',
  'ACCOUNT_CREATED',
  'CREDENTIAL_ROTATED',
  'API_KEY_CREATED',
  'API_KEY_ROTATED',
  'WEBHOOK_CREATED',
  'WEBHOOK_UPDATED',
  'WEBHOOK_DELETED',
  /* Ingest stopped is not a fault and is not nothing: telemetry the plant
     expects stops arriving, and the entry is how somebody finds out why. */
  'SOURCE_PAUSED',
  'SOURCE_RESUMED',
  /* An entitlement switched. It changes what the navigation rail offers every
     person in the organisation, which is a change to who can reach what. */
  'MODULE_CHANGED',
  /* Where invoices and renewal notices go. Changing it quietly is how a renewal
     notice stops reaching anybody who would act on it. */
  'BILLING_CONTACT_CHANGED',
])

export const severityOf = (action) =>
  CRITICAL.has(action) ? 'critical' : WARNING.has(action) ? 'warning' : 'info'

/** Actions this session has produced. Newest last; the reader gets them reversed. */
const WRITTEN = []

/**
 * Record something that happened.
 *
 * Called from the fixtures that perform the write, never from a page — a log
 * entry that depended on the UI remembering to write one is a log with holes in
 * exactly the places somebody took a shortcut.
 */
export function audit(action, { resource, detail = null, actorId = SELF_ID } = {}, now = Date.now()) {
  const entry = {
    id: `AUD-${WRITTEN.length + 1}`,
    at: new Date(now).toISOString(),
    actorId,
    action,
    resource,
    detail,
  }
  WRITTEN.push(entry)
  return entry
}

/* ── The seed ─────────────────────────────────────────────────────────────
   Derived from records that already carry an actor and a time. */

function seeded(now) {
  const rows = []

  /* Somebody acknowledged these. The alert holds who and how long ago it was
     detected; the acknowledgement is after that, which is the only ordering
     this fixture can honestly claim. */
  for (const alert of ALERTS) {
    if (alert.status === 'open' || !alert.assigneeId) continue
    const detected = now - alert.detectedMinutesAgo * 60_000
    rows.push({
      id: `AUD-SEED-${alert.id}`,
      at: new Date(detected + Math.min(alert.detectedMinutesAgo, 12) * 60_000).toISOString(),
      actorId: alert.assigneeId,
      action: alert.status === 'resolved' ? 'ANOMALY_RESOLVED' : 'ANOMALY_ACKNOWLEDGED',
      resource: `anomaly:${alert.id}`,
      detail: { asset: alert.assetName },
    })
  }

  /* And somebody wrote these. The logbook already resolves its author from the
     roster, so the actor is a real person on a real shift. */
  for (const entry of logEntries(now)) {
    if (!entry.authorId) continue
    rows.push({
      id: `AUD-SEED-${entry.id}`,
      at: entry.at,
      actorId: entry.authorId,
      action: 'LOGBOOK_WRITTEN',
      resource: `logbook:${entry.id}`,
      detail: { asset: entry.assetName },
    })
  }

  return rows
}

/** One entry, with the actor resolved and the severity derived. */
function compose(entry) {
  const actor = personById(entry.actorId)
  return {
    ...entry,
    actorName: actor?.name ?? null,
    actorInitials: actor
      ? actor.name.split(/\s+/).slice(0, 2).map((part) => part[0].toUpperCase()).join('')
      : null,
    /* `resource` is `kind:id`. Split here so the table can print the kind as a
       word and the id as a machine string, and so a check can assert the kind
       is one this product has. */
    resourceKind: String(entry.resource).split(':')[0],
    resourceId: String(entry.resource).slice(String(entry.resource).indexOf(':') + 1),
    severity: severityOf(entry.action),
  }
}

/** Everything, newest first. */
export function auditLog(now = Date.now()) {
  return [...seeded(now), ...WRITTEN]
    .map(compose)
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
}

export function auditStats(rows) {
  return {
    total: rows.length,
    critical: rows.filter((row) => row.severity === 'critical').length,
    warning: rows.filter((row) => row.severity === 'warning').length,
    /* People, not entries. "Nine events by one person" and "nine by nine" are
       different mornings and the count that says which is the actor count. */
    actors: new Set(rows.map((row) => row.actorId)).size,
  }
}

/** For the checks and for a reload-free demo reset. */
export function resetAudit() {
  WRITTEN.length = 0
}
