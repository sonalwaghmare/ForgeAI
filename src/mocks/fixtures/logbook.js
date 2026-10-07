import { ALERTS } from './alerts'
import { HIERARCHY_NODES } from './hierarchy'
import { CREW, shiftsForWeek } from './shifts'

/**
 * The operator logbook.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 *
 * ── What is authored here, and what is not ────────────────────────────────
 * Four fields per entry: WHEN, WHICH MACHINE, WHAT THE OPERATOR WROTE, and the
 * tags they put on it. That is genuinely all a logbook holds — the prose is the
 * record and cannot be derived from anything.
 *
 * Everything the screen prints around it is computed:
 *
 * - **Who wrote it** is the operator rostered on the shift containing the
 *   entry's timestamp. Not a name typed beside the note. The logbook and the
 *   Shifts roster therefore cannot disagree about who was on nights, which is
 *   the first thing anybody in the room would check.
 * - **Which shift** comes from the same lookup, so a note at 02:14 is on the
 *   night shift because 02:14 is inside the night window, not because somebody
 *   wrote "Night" next to it.
 * - **Whether Forge AI cited it** is the presence of an investigation that
 *   would have found it — see `citationFor`.
 * - **The linked anomaly** is that same investigation. One fact, rendered
 *   twice, rather than two authored fields that can drift apart.
 *
 * The prototype authors all four: `{ op: "Priya Patel", shift: "Night",
 * ai: true, anomaly: "ALR-1024" }`. Its `ai` flag means nothing — it is true on
 * four of six entries and false on two, with no rule behind which — and
 * `ALR-1024` is not an alert this product has. Two of its six notes are about a
 * turbine and a heat exchanger, which is a different demo's plant.
 *
 * ── The clock ─────────────────────────────────────────────────────────────
 * Entries are authored as "n days ago at hh:mm" and resolved against a `now`
 * that is always a parameter — §2.5. An entry that resolves into the future
 * (today at 22:40, read at nine in the morning) rolls back a day rather than
 * appearing as a note about work nobody has done.
 */

/* ── Where an entry's author comes from ───────────────────────────────────
   The roster, reached over four weeks so every authored entry lands inside it.
   Recomputed per call rather than held, because `shiftsForWeek` reads the clock
   and a module-level snapshot would be stale by the second request. */
const ROSTER_DAYS = 28

/* The plant this log belongs to. Findlay's crew keeps Findlay's book, and the
   roster it composes against is Findlay's too. */
const ROSTER_SITE = 'site_findlay'

/** `yyyy-mm-dd` in local time — not `toISOString`, which shifts by the offset. */
const localDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/**
 * How far back Forge AI's `searchLogbook` tool call reaches.
 *
 * Not a number invented here: `ANALYSIS['ALR-4471'].toolCalls` records the call
 * as `searchLogbook · FDY-BM-03 · 14d`. This is that window, and the citation
 * rule below is what that tool call would actually have returned.
 */
export const CITATION_WINDOW_DAYS = 14

/**
 * The entries.
 *
 * Findlay only — the logbook belongs to the plant whose crew keeps it, and the
 * roster this composes against is Findlay's. `at` is local wall-clock time,
 * which is how an operator writes it and how the flagship investigation quotes
 * it back ("02:14 · cell 3 noise").
 *
 * The first entry is that one. It is the note Forge AI's evidence trail cites
 * on ALR-4471, and `verify:mocks` asserts the two still agree — the time, the
 * machine and the citation. If either side moves, the check fails rather than
 * the demo quietly claiming evidence that is not there.
 */
export const LOG_ENTRIES = [
  {
    /* The flagship. `ANALYSIS['ALR-4471']` quotes this note, so it has to have
       been written BEFORE that alert was detected — the analysis searched the
       logbook backwards from the alert and found it.

       Yesterday, not today, and that is the fix rather than the setting. At
       `daysAgo: 0` this note sits at 02:14 on today's clock while ALR-4471 is
       pinned 34 minutes behind NOW, so the two cross once every morning:
       between 02:14 and 02:48 the alert predates the note it is supposed to
       have found, the citation stops resolving and the flagship story quietly
       comes apart. A night note from the previous shift is both the truer
       version and the one that cannot invert. */
    id: 'LOG-2214',
    daysAgo: 1,
    at: '02:14',
    assetId: 'FDY-BM-03',
    text: 'Knocking audible at cell 3 through the whole night run — you can hear it over the conveyor from the aisle. Discharge bearing was re-greased last month. Sight glass on the toolpack looks low, ISO VG 46. Left it running, flagged for days.',
    tags: ['vibration', 'cell3', 'lubrication'],
  },
  {
    id: 'LOG-2211',
    daysAgo: 0,
    at: '23:48',
    assetId: 'FDY-CMP-12',
    text: 'Coolant pressure on C-12 dropped away during the changeover and came back after about forty seconds. Nothing tripped and the line kept rate. Logging it because this is the second changeover it has done it on.',
    tags: ['coolant', 'changeover'],
  },
  {
    id: 'LOG-2208',
    daysAgo: 1,
    at: '19:05',
    assetId: 'FDY-WSH-01',
    text: 'Stage 4 rinse conductivity climbing steadily from the start of the shift. Topped the rinse tank up and it came back about halfway. Worth someone looking at the make-up valve.',
    tags: ['conductivity', 'rinse', 'stage4'],
  },
  {
    id: 'LOG-2204',
    daysAgo: 1,
    at: '15:30',
    assetId: 'FDY-BM-03',
    text: 'Routine inspection on Bodymaker 3. Toolpack within spec, lubrication nominal, no play in the ram. Nothing to action from this one.',
    tags: ['inspection', 'routine'],
  },
  {
    id: 'LOG-2201',
    daysAgo: 2,
    at: '11:20',
    assetId: 'FDY-OVN-01',
    text: 'Zone 3 burner on the IBO oven cycling more often than the other zones. Flame signal steady, no lockouts. Might just be the new coating drawing more heat, but it was not doing it last week.',
    tags: ['oven', 'zone3', 'burner'],
  },
  {
    id: 'LOG-2197',
    daysAgo: 2,
    at: '06:40',
    assetId: 'FDY-PAL-02',
    text: 'Layer gripper catching on the third layer, knocked one can off the stack. Cleared it and reset, ran clean for the rest of the shift. Second time this week.',
    tags: ['palletizer', 'gripper'],
  },
  {
    id: 'LOG-2193',
    daysAgo: 3,
    at: '14:12',
    assetId: 'FDY-DEC-02',
    text: 'Ink pump 2 pressure hunting at start-up on Decorator 2, settled after about ten minutes and held all shift. Print quality never went out.',
    tags: ['decorator', 'inkPump', 'startup'],
  },
  {
    id: 'LOG-2188',
    daysAgo: 4,
    at: '22:35',
    assetId: 'FDY-CHL-02',
    text: 'Suction pressure low on CH-02 at the start of nights. Left it on and watched it — came up as the load came on. Noting it in case it does the same tomorrow.',
    tags: ['chiller', 'suction'],
  },
  {
    id: 'LOG-2184',
    daysAgo: 5,
    at: '09:55',
    assetId: 'FDY-BM-07',
    text: 'Ram bearing on Bodymaker 7 replaced under planned maintenance. Machine handed back at 09:40, vibration back down to baseline on the first run. Old bearing kept for the failure review.',
    tags: ['maintenance', 'bearing', 'planned'],
  },
  {
    id: 'LOG-2180',
    daysAgo: 6,
    at: '17:22',
    assetId: 'FDY-WSH-01',
    text: 'Replaced the inline filter on the washer, differential pressure back to normal. Next one due in ninety days, tag written up.',
    tags: ['maintenance', 'filter', 'routine'],
  },
  {
    id: 'LOG-2176',
    daysAgo: 7,
    at: '03:08',
    assetId: 'FDY-CMP-12',
    text: 'Compressor room noticeably warmer than usual on the walkround. Nothing on the panel. Propped the door and it settled. Might be worth checking the extract fan.',
    tags: ['compressor', 'temperature', 'walkround'],
  },
  {
    id: 'LOG-2171',
    daysAgo: 8,
    at: '13:44',
    assetId: 'FDY-BM-03',
    text: 'Changeover to the 202 end took longer than the standard — about twenty minutes over. Not a fault, just the toolpack fighting us. Worth timing the next one properly.',
    tags: ['changeover', 'setup'],
  },
]

/* ── Written entries ──────────────────────────────────────────────────────
   The composer's writes land here, at module scope, so they survive the session
   exactly as created charts and uploaded documents do. Newest first, and they
   carry an absolute instant rather than a `daysAgo` — an entry written now is
   pinned to when it was written, not to a distance from a moving clock. */
const WRITTEN = []

export const allLogEntries = () => [...WRITTEN, ...LOG_ENTRIES]

/**
 * When an authored entry happened.
 *
 * `daysAgo` counts back from today's date and `at` is wall-clock, so the note
 * that says 02:14 always reads 02:14 whichever morning it is looked at.
 *
 * An entry that lands in the future rolls back a day. Without that, "today at
 * 22:35" is a night-shift note filed at nine in the morning — a record of work
 * nobody has done, sitting above notes about work they have.
 */
function instantOf(entry, now) {
  if (entry.at == null) return new Date(entry.instant)
  const [hours, minutes] = entry.at.split(':').map(Number)
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - entry.daysAgo)
  date.setHours(hours, minutes, 0, 0)
  if (date.getTime() > now) date.setDate(date.getDate() - 1)
  return date
}

/**
 * The investigation that cited an entry, if there is one.
 *
 * The rule is the tool call, run backwards. Forge AI searched this asset's
 * logbook over the fourteen days before it raised the alert, so an entry is
 * cited when an alert exists ON THE SAME MACHINE, detected AFTER the entry was
 * written and within that window. The nearest such alert wins — the
 * investigation that would have picked the note up first.
 *
 * Two consequences worth stating, because both are the point:
 *
 * - An entry on a machine with nothing wrong carries no badge. The mix on the
 *   screen is a property of the plant, not a decoration.
 * - The violet "AI Analyzed" badge and the anomaly chip below it are the SAME
 *   fact. They cannot contradict each other, which the prototype's can: it has
 *   an entry marked `ai: true` with `anomaly: null`, so the machine analysed
 *   something and produced nothing.
 */
export function citationFor(entry, now = Date.now()) {
  const at = instantOf(entry, now).getTime()
  const window = CITATION_WINDOW_DAYS * 86_400_000

  return (
    ALERTS.filter((alert) => alert.assetId === entry.assetId)
      .map((alert) => ({ alert, detectedAt: now - alert.detectedMinutesAgo * 60_000 }))
      .filter(({ detectedAt }) => detectedAt >= at && detectedAt - at <= window)
      .filter(({ alert }) => mentions(entry, alert))
      .sort((a, b) => a.detectedAt - b.detectedAt)[0]?.alert ?? null
  )
}

/**
 * Whether a note is ABOUT what an alert is about.
 *
 * The window on its own is not enough. Every machine on this plant has an open
 * alert and every entry predates one, so "same machine, written first" cited
 * all twelve — the badge would be on every card, which is the prototype's
 * always-on marker arrived at from the other direction.
 *
 * An investigation quotes the note that bears on it. So the note has to name
 * what the alert names: a word from its failing COMPONENT or its SENSOR. The
 * routine inspection that found nothing wrong with the toolpack is not evidence
 * of a bearing failure, and the filter change on the washer is not evidence of
 * a conductivity drift, even though both were written on the right machine at
 * the right time.
 *
 * Words shorter than four characters are dropped: `ram`, `ink` and `RMS` match
 * inside half the vocabulary in English and would put the badge back on
 * everything.
 */
function mentions(entry, alert) {
  const terms = `${alert.component ?? ''} ${alert.sensor ?? ''}`
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 4)

  const text = `${entry.text} ${(entry.tags ?? []).join(' ')}`.toLowerCase()
  return terms.some((term) => text.includes(term))
}

/* ── Search ───────────────────────────────────────────────────────────────
   The design puts a violet "semantic search" marker beside a `.includes()` and
   a placeholder reading "try 'bearing issues'". Typing that into it returns
   nothing: no entry contains the word "issues", and the one about a bearing
   says "knocking".

   This is not embeddings — there is no model behind a fixture, and pretending
   otherwise is worse than the dead marker. It is a small expansion table over
   the vocabulary a plant actually uses for the same thing, applied server-side,
   and the screen SAYS which extra terms it matched on rather than claiming
   something it did not do. A reader who searches "bearing" finds the note that
   says knocking, and can see why.

   Keys and values are matched as substrings, so `lubric` catches lubrication. */
const SYNONYMS = {
  bearing: ['knocking', 'vibration', 'ram', 'grease'],
  noise: ['knocking', 'audible', 'rattle'],
  vibration: ['knocking', 'bearing'],
  leak: ['drip', 'coolant', 'seal'],
  temperature: ['warm', 'heat', 'burner', 'suction'],
  lubrication: ['grease', 'oil', 'iso vg'],
  pressure: ['suction', 'differential', 'hunting'],
  filter: ['differential', 'inline'],
  cleaning: ['rinse', 'wash', 'conductivity'],
  maintenance: ['replaced', 'planned', 'inspection'],
}

/** Everything about an entry that a search should look at. */
const haystack = (row) =>
  [row.text, row.authorName, row.assetName, row.assetId, row.shiftType, ...row.tags]
    .join(' ')
    .toLowerCase()

/**
 * Filter composed rows by a query, and say what the query was expanded to.
 *
 * Returns the matched rows plus `expanded` — the synonym terms that actually
 * earned a match. Terms that found nothing are not reported, so the chip never
 * takes credit for work it did not do.
 */
export function searchEntries(rows, query) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return { rows, expanded: [] }

  const terms = q.split(/\s+/).filter(Boolean)

  /* Every synonym of every typed term, minus the terms themselves — a query for
     "bearing" should not report that it also matched "bearing". */
  const extras = [
    ...new Set(
      terms.flatMap((term) =>
        Object.entries(SYNONYMS)
          .filter(([key]) => key.includes(term) || term.includes(key))
          .flatMap(([, values]) => values),
      ),
    ),
  ].filter((extra) => !terms.some((term) => extra.includes(term)))

  const earned = new Set()
  const matched = rows.filter((row) => {
    const text = haystack(row)
    /* A typed term is enough on its own. An expansion only counts when no typed
       term hit, so "bearing" ranks the literal matches in and drags the
       knocking note along, rather than the expansion quietly widening a query
       that was already precise. */
    if (terms.some((term) => text.includes(term))) return true
    const hit = extras.filter((extra) => text.includes(extra))
    hit.forEach((extra) => earned.add(extra))
    return hit.length > 0
  })

  return { rows: matched, expanded: [...earned] }
}

/**
 * One entry, resolved.
 *
 * The author and the shift come from the roster; the machine from the
 * hierarchy; the citation from the alert records. Nothing here is stored.
 */
export function composeEntry(entry, roster, now = Date.now()) {
  const at = instantOf(entry, now)
  const node = HIERARCHY_NODES.find((row) => row.id === entry.assetId) ?? null
  const line = node ? (HIERARCHY_NODES.find((row) => row.id === node.parentId) ?? null) : null

  /* The shift the note was written on. Found by containment, which is what puts
     an 02:14 note on the night shift that started at 22:00 the day before —
     the trap the fixture's own `windowFor` exists to handle. */
  const shift =
    roster.find(
      (row) => at.getTime() >= Date.parse(row.startsAt) && at.getTime() < Date.parse(row.endsAt),
    ) ?? null

  /* A written entry carries its author, because the person who wrote it is a
     fact about the record. An authored one takes the rostered operator — the
     logbook does not get to disagree with the roster about who was there. */
  const author = entry.authorId
    ? (CREW.find((person) => person.id === entry.authorId) ?? null)
    : null

  const alert = citationFor(entry, now)

  return {
    id: entry.id,
    at: at.toISOString(),
    date: localDate(at),
    assetId: entry.assetId,
    assetName: node?.name ?? entry.assetId,
    lineId: line?.id ?? null,
    lineName: line?.name ?? null,
    text: entry.text,
    tags: entry.tags ?? [],
    authorId: author?.id ?? shift?.operatorId ?? null,
    authorName: author?.name ?? shift?.operatorName ?? null,
    authorInitials: author?.initials ?? shift?.operatorInitials ?? null,
    authorRole: author?.role ?? shift?.operatorRole ?? null,
    shiftId: shift?.id ?? null,
    shiftType: shift?.type ?? null,
    /* The badge and the chip, which are one fact. `cited` is never true with a
       null `alert`: they are the same expression. */
    cited: Boolean(alert),
    alert: alert
      ? {
          id: alert.id,
          severity: alert.severity,
          sensor: alert.sensor,
          status: alert.status,
          assetId: alert.assetId,
        }
      : null,
    written: Boolean(entry.instant),
  }
}

/**
 * Every entry, resolved and newest first.
 *
 * `now` is a parameter throughout — §2.5. The roster is fetched once and passed
 * down rather than recomputed per entry, which would be twelve rebuilds of a
 * four-week rota to render one page.
 */
export function logEntries(now = Date.now()) {
  const roster = shiftsForWeek(now, ROSTER_DAYS)
  return allLogEntries()
    .map((entry) => composeEntry(entry, roster, now))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/**
 * The machines this logbook has entries about.
 *
 * Counted off the entries, so the filter cannot offer a machine with nothing
 * behind it — the prototype's list is three hardcoded options, one of which
 * (`CVR-07`) has no entry and two of which are not on this plant.
 */
export function logbookAssets(rows) {
  const seen = new Map()
  for (const row of rows) {
    const held = seen.get(row.assetId)
    if (held) held.entries += 1
    else seen.set(row.assetId, { id: row.assetId, name: row.assetName, entries: 1 })
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Every machine an entry could be written about.
 *
 * The plant the logbook belongs to, read from the hierarchy — NOT the machines
 * that happen to have entries already. Those two are different lists and using
 * the second for the composer would make a machine unwritable until somebody
 * had already written about it. The prototype offers two hardcoded options.
 */
export function plantAssets() {
  const lines = HIERARCHY_NODES.filter(
    (node) => node.tier === 'line' && node.parentId === ROSTER_SITE,
  ).map((line) => line.id)

  return HIERARCHY_NODES.filter((node) => node.tier === 'asset' && lines.includes(node.parentId))
    .map((node) => ({ id: node.id, name: node.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Write an entry.
 *
 * The author is stamped by the server and is not taken from the body. A real
 * API reads it from the token; this one has no token, so it stamps the demo
 * persona and says so. Either way the client cannot choose whose name goes on a
 * record — the same rule that makes a work order raised through the form
 * `authoredBy: 'human'` whatever the form sent.
 *
 * Tags are normalised here rather than at the call site: the composer's field
 * takes free text, and `#Cell 3`, `cell3` and `Cell3` are one tag.
 */
export function addLogEntry({ assetId, text, tags }, authorId, now = Date.now()) {
  const body = (text ?? '').trim()
  if (!body) return { error: 'emptyText' }
  if (!HIERARCHY_NODES.some((node) => node.id === assetId && node.tier === 'asset'))
    return { error: 'unknownAsset' }

  const entry = {
    id: `LOG-${2300 + WRITTEN.length}`,
    instant: new Date(now).toISOString(),
    assetId,
    text: body,
    tags: normaliseTags(tags),
    authorId,
  }
  WRITTEN.unshift(entry)
  return { entry: composeEntry(entry, shiftsForWeek(now, ROSTER_DAYS), now) }
}

/**
 * `#Cell 3, vibration` → `['cell3', 'vibration']`. Deduplicated, order kept.
 *
 * Splitting on whitespace as well as commas looks right until somebody types
 * `#Cell 3`, which becomes two tags, one of which is the number three. So the
 * split is on commas and on the `#` itself — which covers both spellings the
 * field invites, `#a #b` and `a, b` — and whatever is left inside a tag has its
 * spaces and punctuation stripped rather than being cut at them.
 */
export function normaliseTags(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input ?? '')
        .replace(/#/g, ',')
        .split(',')
  const out = []
  for (const item of raw) {
    const tag = String(item).replace(/^#+/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out.slice(0, 6)
}
