/**
 * A one-page PDF, written by hand.
 *
 * Twenty lines of PDF syntax rather than a dependency. The invoice download on
 * Settings → Billing is the only thing in this product that needs one, and
 * `pdf-lib` is ~380KB for a page of left-aligned text.
 *
 * ── Why not download a .txt and call it done ──────────────────────────────
 * Because the control says PDF. A button labelled PDF that hands over a text
 * file is the same class of thing this codebase keeps refusing elsewhere — a
 * label that does not describe what happens. This produces a file that opens in
 * a PDF reader, and it is small enough to read in a text editor and check.
 *
 * ── What it deliberately cannot do ────────────────────────────────────────
 * One page, one font, no wrapping, no images, WinAnsi only. Anything more
 * belongs to a real generator on a server that also owns the invoice record.
 */

/** Courier is one of the 14 base fonts, so no font file has to be embedded. */
const FONT = 'Courier'

/* PDF strings are parenthesised, so those three characters need escaping.
   Anything outside WinAnsi is dropped rather than mis-encoded: a mangled glyph
   in a financial document is worse than a missing one. */
const escape = (text) =>
  String(text)
    .replace(/[\\()]/g, (c) => `\\${c}`)
    .replace(/[^\x20-\x7E]/g, '')

/**
 * @param {object} doc
 * @param {string[]} doc.lines  One per printed line, top to bottom.
 * @param {number} [doc.size]   Point size.
 * @returns {Blob} `application/pdf`
 */
export function simplePdf({ lines, size = 11 }) {
  const leading = size * 1.6
  const top = 780

  const text = [
    'BT',
    `/F1 ${size} Tf`,
    `${leading} TL`,
    `1 0 0 1 56 ${top} Tm`,
    ...lines.map((line) => `(${escape(line)}) Tj T*`),
    'ET',
  ].join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT} /Encoding /WinAnsiEncoding >>`,
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ]

  /* The cross-reference table is byte offsets into the file, so the body has to
     be assembled before the table can be written — which is why this is built
     as a string and measured as it goes rather than templated. */
  let body = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xref = body.length
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) table += `${String(offset).padStart(10, '0')} 00000 n \n`

  const file =
    body +
    table +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  return new Blob([file], { type: 'application/pdf' })
}

/** Hand a blob to the browser under a filename. */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
