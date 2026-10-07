import { post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { parseCsv } from '@/lib/csv'

/* Re-exported so the wizard's imports do not have to know the reader moved out
   to `lib/` when the people import needed the same one. */
export { parseCsv }

/**
 * Bulk asset import — parsing, mapping and validation.
 *
 * DEMO, but the logic is real: this file parses an actual dropped CSV, matches
 * its columns against the canonical fields, and validates every row against the
 * plant that exists. The prototype simulates all three — clicking the dropzone
 * "parses" a hardcoded file whatever you dropped, and the validation runs over
 * that same hardcoded array.
 *
 * Making it real cost about eighty lines and turns the wizard from a slideshow
 * into something a plant engineer can put their own file through, which is the
 * only way anyone finds out whether the mapping step is any good.
 */

/** The fields an asset record needs, and what each is for. */
export const IMPORT_FIELDS = [
  { key: 'code', required: true },
  { key: 'name', required: true },
  { key: 'type', required: true },
  { key: 'line', required: true },
  { key: 'criticality', required: false },
  { key: 'owner', required: false },
  { key: 'sensors', required: false },
  { key: 'installed', required: false },
]

/** How duplicates are handled when a row's code already exists. */
export const DUPLICATE_MODES = ['update', 'skip']

/**
 * Guess which source column feeds each field.
 *
 * Normalised contains-matching rather than exact equality: real exports say "Tag
 * ID", "Equipment Type", "Commissioned". Getting seven of eight right and asking
 * about the eighth is the difference between a mapping step somebody reads and
 * one they click through.
 */
const ALIASES = {
  code: ['code', 'tag', 'assetid', 'id', 'number'],
  name: ['name', 'description', 'title'],
  type: ['type', 'equipment', 'category', 'class'],
  line: ['line', 'production', 'area'],
  criticality: ['crit', 'priority', 'importance'],
  owner: ['owner', 'responsible', 'engineer'],
  sensors: ['sensor', 'channel', 'tags'],
  installed: ['install', 'commission', 'date', 'inservice'],
}

const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export function autoMap(columns) {
  const mapping = {}
  const taken = new Set()
  for (const field of IMPORT_FIELDS) {
    const match = columns.find((column) => {
      if (taken.has(column)) return false
      const key = normalise(column)
      return ALIASES[field.key].some((alias) => key.includes(alias))
    })
    if (match) {
      mapping[field.key] = match
      taken.add(match)
    } else mapping[field.key] = null
  }
  return mapping
}

const CRITICALITIES = ['critical', 'high', 'medium', 'low']

/**
 * Validate one mapped row against the plant that exists.
 *
 * Errors block the row; warnings do not. The distinction is whether the platform
 * can store something true: a missing id has no record to be, while an
 * unrecognised criticality has a defensible default. Saying which is which is
 * what stops a reader treating the whole list as a wall of red.
 *
 * `issue.field` is returned so the review table can point at the cell rather
 * than only naming it.
 */
export function validateRow(row, mapping, { lineNames, existingCodes }) {
  const value = (key) => (mapping[key] ? String(row[mapping[key]] ?? '').trim() : '')
  const issues = []

  for (const field of IMPORT_FIELDS) {
    if (field.required && !value(field.key)) {
      issues.push({ field: field.key, level: 'error', key: 'missing' })
    }
  }

  const line = value('line')
  if (line && !lineNames.includes(line)) {
    issues.push({ field: 'line', level: 'error', key: 'unknownLine', value: line })
  }

  const code = value('code')
  if (code && existingCodes.includes(code)) {
    issues.push({ field: 'code', level: 'warn', key: 'duplicate', value: code })
  }

  const criticality = value('criticality')
  if (criticality && !CRITICALITIES.includes(criticality.toLowerCase())) {
    issues.push({ field: 'criticality', level: 'warn', key: 'criticality', value: criticality })
  }

  const installed = value('installed')
  if (installed && !/^\d{4}-\d{2}-\d{2}$/.test(installed)) {
    issues.push({ field: 'installed', level: 'warn', key: 'date', value: installed })
  }

  return issues
}

/** Every row validated, plus the three counts the summary step reports. */
export function validateAll(rows, mapping, context) {
  const validated = rows.map((row, index) => {
    const issues = validateRow(row, mapping, context)
    return {
      index,
      row,
      issues,
      level: issues.some((issue) => issue.level === 'error')
        ? 'error'
        : issues.length
          ? 'warn'
          : 'ready',
    }
  })
  return {
    validated,
    ready: validated.filter((entry) => entry.level === 'ready').length,
    warnings: validated.filter((entry) => entry.level === 'warn').length,
    errors: validated.filter((entry) => entry.level === 'error').length,
  }
}

/** Turn a validated, mapped row into the record the endpoint takes. */
export function toRecord(row, mapping) {
  const value = (key) => (mapping[key] ? String(row[mapping[key]] ?? '').trim() : '')
  return {
    code: value('code'),
    name: value('name'),
    type: value('type').toLowerCase(),
    line: value('line'),
    criticality: CRITICALITIES.includes(value('criticality').toLowerCase())
      ? value('criticality').toLowerCase()
      : 'medium',
    owner: value('owner'),
    // Pipe-separated in every export this has been shown, and the separator a
    // CSV cell can hold without quoting.
    sensors: value('sensors').split('|').map((entry) => entry.trim()).filter(Boolean),
    installed: /^\d{4}-\d{2}-\d{2}$/.test(value('installed')) ? value('installed') : null,
  }
}

/** Commit the import. Creates or updates, and reports which it did. */
export const importAssets = (body) => post(endpoints.assets.import, body)

/**
 * A CSV of the canonical headers plus two filled rows.
 *
 * The two rows are real assets from the plant, so a reader can see the shape a
 * value should take rather than inferring it from a header — and a file
 * downloaded here and dropped straight back in validates clean, which is the
 * fastest way to confirm the loop works.
 */
export function templateCsv(lineName) {
  const header = 'Tag ID,Description,Equipment Type,Line,Criticality,Owner,Sensor Tags,Commissioned'
  const rows = [
    `FDY-PMP-31,Booster pump 31,pump,${lineName},high,Ines Brandt,flow|pressure,2021-04-12`,
    `FDY-FAN-09,Extract fan 9,fan,${lineName},low,Karan Patel,vibration,2022-02-20`,
  ]
  return `${header}\n${rows.join('\n')}\n`
}

/**
 * The file the demo drops in when nobody has one to hand.
 *
 * Deliberately imperfect: a missing tag, an unknown line, a mistyped
 * criticality, a date that is not one, and a code that already exists. A sample
 * that validates clean demonstrates nothing about the validation step, which is
 * the part of this wizard worth showing.
 */
export const SAMPLE_FILE = {
  name: 'findlay-assets-q2.csv',
  text: [
    'Tag ID,Description,Equipment Type,Line,Criticality,Owner,Sensor Tags,Commissioned',
    'FDY-PMP-31,Booster pump 31,pump,Line 1,high,Ines Brandt,flow|pressure,2021-04-12',
    'FDY-MTR-88,Drive motor 88,motor,Line 2,critical,Dana Okafor,temperature|vibration|current,2020-11-03',
    'FDY-CNV-19,Transfer conveyor 19,conveyor,Line 2,medium,Karan Patel,vibration|current,2022-02-20',
    'FDY-BM-03,Bodymaker 3,bodymaker,Line 1,critical,Arjun Mehta,vibration|temperature,2019-07-12',
    ',Spare gearbox,gearbox,Line 2,low,Maya Reddy,vibration,2023-01-09',
    'FDY-FAN-77,Extract fan 77,fan,Cooling Tower B,low,Karan Patel,vibration,not-a-date',
    'FDY-PMP-32,Booster pump 32,pump,Compressed Air,Med,Ines Brandt,flow|pressure,2021-05-30',
  ].join('\n'),
}
