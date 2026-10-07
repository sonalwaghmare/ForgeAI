/**
 * Checks that every translation key referenced in source exists in the locale
 * files, and that no user-facing literal slipped into JSX.
 *
 * PRODUCT.md makes i18n-readiness a hard requirement even though English ships
 * alone: no literal copy in JSX, including aria-label, title, alt, placeholder,
 * toast text, empty states and error messages. A missing key renders as the raw
 * key string in production, which is a bug users see — so this runs in CI, not
 * as a one-off.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const LOCALES = 'src/i18n/locales/en'
const SRC = 'src'

const bundles = Object.fromEntries(
  readdirSync(LOCALES)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file.replace('.json', ''), JSON.parse(readFileSync(join(LOCALES, file), 'utf8'))]),
)

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path)
    else if (['.js', '.jsx'].includes(extname(path))) files.push(path)
  }
}
walk(SRC)

const lookup = (bundle, path) =>
  path.split('.').reduce((node, part) => (node == null ? undefined : node[part]), bundle)

let missing = 0
let literals = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')

  // Namespaces this file loaded, in order. The first is the default.
  // Quote-style agnostic. These regexes originally matched single quotes only,
  // so a formatter pass that switched a file to double quotes made this script
  // silently stop checking it. A checker that quietly covers less than it
  // claims is worse than no checker at all.
  const nsMatch = source.match(/useTranslation\(\s*(\[[^\]]*\]|["'][^"']*["'])/)
  let namespaces = ['common']
  if (nsMatch) {
    namespaces = [...nsMatch[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
  }

  // Fully static keys: t('a.b') or t('ns:a.b')
  for (const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g)) {
    const raw = match[1]
    const [ns, key] = raw.includes(':') ? raw.split(':') : [namespaces[0], raw]
    if (!bundles[ns]) {
      console.log(`  MISSING NS  ${file}  ${raw}`)
      missing += 1
      continue
    }
    if (typeof lookup(bundles[ns], key) !== 'string') {
      console.log(`  MISSING KEY ${file}  ${ns}:${key}`)
      missing += 1
    }
  }

  // Template keys: t(`ns:a.b.${x}`) — the static prefix must resolve to an
  // object, so a typo in the fixed part is still caught.
  for (const match of source.matchAll(/\bt\(\s*`([^`$]*)\$\{/g)) {
    const raw = match[1]
    const [ns, prefix] = raw.includes(':') ? raw.split(':') : [namespaces[0], raw]
    const path = prefix.replace(/\.$/, '')
    if (!path) continue
    if (!bundles[ns]) {
      console.log(`  MISSING NS  ${file}  ${raw}`)
      missing += 1
      continue
    }
    const node = lookup(bundles[ns], path)
    if (typeof node !== 'object' || node === null) {
      console.log(`  BAD PREFIX  ${file}  ${ns}:${path}`)
      missing += 1
    }
  }

  // Hardcoded accessible names. These are the attributes most often forgotten,
  // and an untranslated aria-label is invisible in review.
  for (const attribute of ['aria-label', 'placeholder', 'alt', 'title']) {
    const pattern = new RegExp(`(?<![-\\w])${attribute}=["'][A-Za-z][^"'{]{2,}["']`, 'g')
    for (const match of source.matchAll(pattern)) {
      console.log(`  LITERAL     ${file}  ${match[0]}`)
      literals += 1
    }
  }
}

const unusedReport = []
const flatten = (node, prefix = []) =>
  Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value, [...prefix, key])
      : [[...prefix, key].join('.')],
  )
const allSource = files.map((file) => readFileSync(file, 'utf8')).join('\n')
for (const [ns, bundle] of Object.entries(bundles)) {
  for (const key of flatten(bundle)) {
    const leaf = key.split('.').pop()
    const parent = key.split('.').slice(0, -1).join('.')
    // Reached either literally, or via a template whose prefix appears.
    if (allSource.includes(key) || allSource.includes(`${parent}.$`) || allSource.includes(`'${leaf}'`) ||
      allSource.includes(`"${leaf}"`)) {
      continue
    }
    unusedReport.push(`${ns}:${key}`)
  }
}

console.log(`\nkeys missing from locales : ${missing}`)
console.log(`hardcoded user-facing text: ${literals}`)
console.log(`defined but unreferenced  : ${unusedReport.length}`)
if (unusedReport.length) console.log(`  ${unusedReport.join('\n  ')}`)

process.exit(missing === 0 && literals === 0 ? 0 : 1)
