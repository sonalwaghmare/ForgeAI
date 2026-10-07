/**
 * Fails the build if a colour literal appears anywhere outside the token file.
 *
 * DESIGN.md commits the whole product to one palette in one place, and the value
 * of that commitment is entirely in whether it stays true. It does not stay true
 * by being written down: the failure mode is one `#F26522` typed into a new
 * component under deadline, which then survives every theme switch, ignores
 * colour-blind mode, and is invisible in review because it looks correct in the
 * one theme the author had open.
 *
 * So this is mechanical. `src/styles/tokens.css` may contain colour literals.
 * Nothing else in `src/`, and not `index.html`, may.
 *
 * Sibling of verify-i18n.mjs and for the same reason it exists: a rule a human
 * has to remember is a rule that lasts until the next busy week.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative, sep } from 'node:path'

/** The single source of truth. The one file allowed to hold a colour. */
const TOKENS = join('src', 'styles', 'tokens.css')

const ROOTS = ['src', 'index.html']
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html']

/**
 * What counts as a colour literal.
 *
 * `#` followed by exactly 3, 4, 6 or 8 hex digits and nothing word-like after —
 * so a serial such as `#ANM-DEMO-009` or an anchor `#section` never matches, and
 * a 5-digit near-miss is caught rather than silently ignored. Plus the functional
 * notations, including the modern space-separated forms.
 *
 * `color-mix` and `currentColor` are deliberately NOT matched: they are how a
 * component is supposed to derive a colour, and both take their input from a
 * token.
 */
const PATTERNS = [
  /#[0-9a-fA-F]{8}(?![0-9a-zA-Z])/g,
  /#[0-9a-fA-F]{6}(?![0-9a-zA-Z])/g,
  /#[0-9a-fA-F]{4}(?![0-9a-zA-Z])/g,
  /#[0-9a-fA-F]{3}(?![0-9a-zA-Z])/g,
  /\brgba?\(/g,
  /\bhsla?\(/g,
  /\b(?:oklch|oklab|lab|lch|color)\(/g,
]

/**
 * Comments are stripped before scanning.
 *
 * Not laziness — the token file's own documentation quotes the values it
 * replaced so the accessibility revert is a copy-paste, and a rule that forbade
 * naming a colour in prose would force that documentation out of the codebase.
 * A literal in a comment cannot render.
 */
function stripComments(source, ext) {
  if (ext === '.html') return source.replace(/<!--[\s\S]*?-->/g, '')
  let out = source.replace(/\/\*[\s\S]*?\*\//g, '')
  if (ext !== '.css') out = out.replace(/^\s*\/\/.*$/gm, '')
  return out
}

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path)
    else if (EXTENSIONS.includes(extname(path))) files.push(path)
  }
}

for (const root of ROOTS) {
  try {
    if (statSync(root).isDirectory()) walk(root)
    else files.push(root)
  } catch {
    // A root that is not present is not a failure — index.html may move.
  }
}

const findings = []

for (const file of files) {
  if (relative('.', file).split(sep).join('/') === TOKENS.split(sep).join('/')) continue

  const raw = readFileSync(file, 'utf8')
  const source = stripComments(raw, extname(file))
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0
      const match = pattern.exec(line)
      if (match) {
        findings.push({ file, line: index + 1, value: match[0], text: line.trim().slice(0, 90) })
        break
      }
    }
  })
}

console.log(`colour literals outside ${TOKENS} : ${findings.length}`)

if (findings.length) {
  console.error('')
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.value}`)
    console.error(`    ${f.text}`)
  }
  console.error(
    `\nEvery colour in this product belongs in ${TOKENS}, for light, dark and` +
      '\ncolour-blind mode. Add a token there and an @theme alias, then use the' +
      '\ngenerated utility (text-on-red, tint-red, bg-card …) or var(--hue-red)' +
      '\nin raw CSS and SVG attributes.\n' +
      '\nWhy: a literal ignores the theme attribute and colour-blind mode, and it' +
      '\nlooks correct in whichever theme you had open. See DESIGN.md.\n',
  )
  process.exit(1)
}
