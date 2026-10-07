/**
 * CSV parsing and serialising, with no idea what is in the file.
 *
 * Lifted out of the asset import when the people import needed the same reader.
 * The PARSER is generic and the schema is not — field lists, aliases, validation
 * and the record shape stay with the module that owns the records. What is
 * shared is the one part that is genuinely the same and genuinely fiddly.
 */

/**
 * A CSV, parsed.
 *
 * Handles quoted fields and embedded commas, which is the one thing a naive
 * `split(',')` gets wrong and the one thing every real export contains — an
 * asset called "Bodymaker 3, drive end" would otherwise shift every column after
 * it by one and the reader would never know why the mapping looked mad.
 */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else quoted = false
      } else field += character
      continue
    }
    if (character === '"') quoted = true
    else if (character === ',') {
      row.push(field.trim())
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field.trim())
      field = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else field += character
  }
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)

  const [header = [], ...body] = rows
  return {
    columns: header,
    rows: body.map((entry) => Object.fromEntries(header.map((column, index) => [column, entry[index] ?? '']))),
  }
}


/**
 * Serialise rows back out.
 *
 * Quotes a cell only when it needs it — a comma, a quote or a newline in the
 * value — because a file where every field is quoted is one a spreadsheet opens
 * correctly and a person reads badly.
 */
export function toCsv(headers, rows) {
  const cell = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\n')
}

/**
 * Hand the browser a file.
 *
 * An object URL rather than a data URI: a file of any size would blow the length
 * limit a data URI has in some browsers, and this is the one place in the product
 * that writes one.
 *
 * The media type is passed rather than assumed. It was `text/csv` for everything
 * until the API page started writing an OpenAPI document, and a JSON file
 * labelled as a spreadsheet is the kind of small lie that costs somebody twenty
 * minutes with a text editor.
 */
export function downloadFile(filename, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const downloadCsv = (filename, text) =>
  downloadFile(filename, text, 'text/csv;charset=utf-8')

export const downloadJson = (filename, value) =>
  downloadFile(filename, JSON.stringify(value, null, 2), 'application/json;charset=utf-8')
