/**
 * Export a handover as a plain-text file.
 *
 * The prototype does exactly this, and text rather than PDF is the right answer
 * for the reason the prototype does not state: a handover gets pasted into a
 * shift log, an email and a WhatsApp group within about ten minutes of being
 * written, and every one of those wants characters rather than a document.
 *
 * Labels are passed in already translated. This file builds a file, it does not
 * decide what anything is called — which is also why it takes `t` rather than
 * importing i18n and reaching for the bundle itself.
 */
export function exportHandover({ handover, report, t, labels }) {
  const lines = [
    labels.title.toUpperCase(),
    '',
    `${t('app:handovers.report.plant')}: ${report.siteName}`,
    `${t('app:handovers.report.window')}: ${handover.date} · ${handover.window}`,
    `${t('app:handovers.report.outgoing')}: ${handover.outgoing}`,
    `${t('app:handovers.report.incoming')}: ${handover.incoming}`,
    '',
    t('app:handovers.report.executiveSummary').toUpperCase(),
    report.summary,
    '',
    t('app:handovers.report.production').toUpperCase(),
    ...report.production.map(
      (row) => `  - ${t(`app:handovers.metric.${row.key}`)}: ${row.value} (${row.note})`,
    ),
    '',
    t('app:handovers.report.carried').toUpperCase(),
    ...report.carried.map(
      (row) =>
        `  - [${t(`common:severity.${row.severity}`)}] ${row.id} — ${row.description} (${t(
          `app:handovers.carriedState.${row.state}`,
        )})`,
    ),
    '',
    t('app:handovers.report.pending').toUpperCase(),
    ...report.pending.map((item, index) => `  ${index + 1}. ${item}`),
    '',
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${handover.id}.txt`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Released on the next tick rather than immediately: revoking synchronously
  // races the download in Safari and produces an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
