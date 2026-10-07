import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Mono, Num } from '@/components/forge/primitives'
import { AUDIT_SEVERITIES, AUDIT_WINDOWS, useAuditLog } from '@/features/audit/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { downloadCsv, toCsv } from '@/lib/csv'
import { formatInteger } from '@/lib/format'
import { ON_TINT_CLASS, STRIPE_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * Settings → Audit log.
 *
 * DEMO. See `DEMO-MODE.md` §8.17.
 *
 * ── The rest of the demo writes this page ─────────────────────────────────
 * Lock an account on the Users screen, change a role, run an import, delete an
 * alert rule, disconnect a channel, replace a credential — then come here and
 * the entry is waiting, with who did it and what it was done to. The design
 * ships seven authored rows; this one can be checked by going and doing
 * something.
 *
 * ── The layout is the design's, column for column ─────────────────────────
 * Timestamp · Actor · Action · Resource · Details · IP · Severity, an absolute
 * two-line timestamp, the raw action token in monospace, a row that opens to
 * its stored record, "Showing n of m" with Prev and Next, and the Compliance
 * Export panel under the table. An earlier version of this screen kept the
 * content and rearranged the shape — relative times, translated action names,
 * no Details, no IP, four stat tiles the design does not have. Every one of
 * those was defensible on its own and together they made a screen that was not
 * this one.
 *
 * Two things depart, and both are about what a value CLAIMS rather than where
 * it sits:
 *
 * - **No hash.** The design prints `sha256:9f2b…e41a` on every row — the same
 *   string on all seven, which is a tamper-evidence claim that is visibly not
 *   tamper-evident. The footnote says the log is append-only and not chained,
 *   and claims nothing else.
 * - **The IP column is present and empty.** A source address is recorded by the
 *   server that received the request. There is no server here, so every row
 *   reads "—" and the footnote says why. Inventing plausible addresses in an
 *   audit log is the worst place in this product to invent anything.
 */

const ALL = 'all'

const SEVERITY_TONE = { critical: 'red', warning: 'amber', info: null }

const PAGE_SIZE = 12

export function AuditPage() {
  const { t, i18n } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('settings.audit.title')} · ${t('common:brand.name')}`)

  const [since, setSince] = useState(ALL)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState(ALL)
  const [severity, setSeverity] = useState(ALL)
  const [expanded, setExpanded] = useState(null)
  const [page, setPage] = useState(1)
  const [reporting, setReporting] = useState(false)

  const log = useAuditLog({
    severity,
    kind,
    since: since === ALL ? undefined : since,
    q: query.trim() || undefined,
  })

  const rows = log.data?.items ?? []
  const stats = log.data?.stats ?? {}
  const kindOptions = log.data?.options?.kinds ?? []

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const narrowed = severity !== ALL || kind !== ALL || since !== ALL || query.trim().length > 0

  /* Exports what is on the screen. On an audit log the difference between a
     filtered table and an unfiltered export is the difference between evidence
     and a misleading extract. */
  function exportCsv() {
    downloadCsv(
      'meridian-audit.csv',
      toCsv(
        ['timestamp', 'actor', 'action', 'resource', 'details', 'ip', 'severity'],
        rows.map((row) => [
          row.at,
          row.actorName ?? 'system',
          row.action,
          row.resource,
          detailText(t, row),
          '',
          row.severity,
        ]),
      ),
    )
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 text-headline">{t('settings.audit.title')}</h1>
          <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
            {t('settings.audit.intro')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ForgeButton disabled={!rows.length} onClick={exportCsv}>
            {t('settings.audit.exportCsv')}
          </ForgeButton>
          {/* Genuinely a PDF: the browser's own print-to-PDF over this page,
              which the print stylesheet is already written for. A button that
              claimed to render one server-side would be claiming a server. */}
          <ForgeButton disabled={!rows.length} onClick={() => window.print()}>
            {t('settings.audit.exportPdf')}
          </ForgeButton>
        </div>
      </header>

      {log.isPending ? (
        <SkeletonRows count={8} />
      ) : log.isError ? (
        <ErrorState
          error={log.error}
          title={t('settings.audit.loadFailed')}
          onRetry={log.refetch}
        />
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
            <ForgeSelect
              id="audit-since"
              labelHidden
              size="sm"
              label={t('settings.audit.filterBySince')}
              value={since}
              onValueChange={setSince}
              className="w-[12rem]"
              options={[
                { value: ALL, label: t('settings.audit.allTime') },
                ...AUDIT_WINDOWS.map((days) => ({
                  value: String(days),
                  label: t('settings.audit.lastDays', { count: days }),
                })),
              ]}
            />
            <div className="flex min-w-[15rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge">
              <Icon name="search" size="sm" className="text-ink-mute" />
              <label className="sr-only" htmlFor="audit-search">
                {t('settings.audit.searchLabel')}
              </label>
              <input
                id="audit-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('settings.audit.searchPlaceholder')}
                className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
              />
            </div>
            <ForgeSelect
              id="audit-kind"
              labelHidden
              size="sm"
              label={t('settings.audit.filterByKind')}
              value={kind}
              onValueChange={setKind}
              className="w-[13rem]"
              options={[
                { value: ALL, label: t('settings.audit.allKinds') },
                ...kindOptions.map((value) => ({
                  value,
                  label: t(`settings.audit.kinds.${value}`),
                })),
              ]}
            />
            <ForgeSelect
              id="audit-severity"
              labelHidden
              size="sm"
              label={t('settings.audit.filterBySeverity')}
              value={severity}
              onValueChange={setSeverity}
              className="w-[12rem]"
              options={[
                { value: ALL, label: t('settings.audit.allSeverities') },
                ...AUDIT_SEVERITIES.map((value) => ({
                  value,
                  label: t(`settings.audit.severity.${value}`),
                })),
              ]}
            />
          </div>

          {rows.length ? (
            <Panel flush className="mb-4 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t('settings.audit.tableCaption')}</caption>
                  <thead>
                    <tr>
                      {['when', 'actor', 'action', 'resource', 'details', 'ip', 'severity'].map(
                        (column) => (
                          <th
                            key={column}
                            scope="col"
                            className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                          >
                            {t(`settings.audit.columns.${column}`)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <Row
                        key={row.id}
                        row={row}
                        language={i18n.language}
                        open={expanded === row.id}
                        onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-3.5 py-2.5">
                <p className="m-0 flex-1 text-body-sm text-ink-dim">
                  <Num>
                    {t('settings.audit.showing', {
                      shown: formatInteger(visible.length),
                      total: formatInteger(rows.length),
                    })}
                  </Num>
                </p>
                <ForgeButton
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {t('settings.audit.prev')}
                </ForgeButton>
                <ForgeButton
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t('settings.audit.next')}
                </ForgeButton>
              </div>
            </Panel>
          ) : (
            <EmptyState
              icon="search"
              title={t('settings.audit.noMatch')}
              body={t('settings.audit.noMatchBody')}
              action={
                narrowed ? (
                  <ForgeButton
                    onClick={() => {
                      setSeverity(ALL)
                      setKind(ALL)
                      setSince(ALL)
                      setQuery('')
                    }}
                  >
                    {t('common:actions.clearFilters')}
                  </ForgeButton>
                ) : null
              }
            />
          )}

          {/* The design's closing panel, with its green leading edge. */}
          <Panel stripe="green" className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-body font-semibold text-ink">
                {t('settings.audit.compliance.title')}
              </p>
              <p className="mt-1 mb-0 text-body-sm text-ink-dim">
                {t('settings.audit.compliance.body')}
              </p>
            </div>
            <ForgeButton variant="primary" onClick={() => setReporting(true)}>
              {t('settings.audit.compliance.generate')}
            </ForgeButton>
          </Panel>

          <p className="mt-3.5 mb-0 max-w-[72ch] text-micro font-normal text-ink-mute">
            <Num>{t('settings.audit.footnote', { count: stats.total ?? 0 })}</Num>
          </p>
        </>
      )}

      {reporting ? (
        <ComplianceDialog rows={rows} onClose={() => setReporting(false)} />
      ) : null}
    </div>
  )
}

/**
 * The sentence in the Details column.
 *
 * One phrasing per action, taking the detail the write recorded. Kept out of the
 * fixture: the fixture stores what happened and this decides how to say it, and
 * a fixture holding English is a fixture that cannot be translated.
 */
function detailText(t, row) {
  const key = `settings.audit.details.${row.action}`
  const detail = row.detail ?? {}
  const text = t(key, { ...detail, defaultValue: '' })
  return text || ''
}

/**
 * One entry, and its stored record underneath when opened.
 *
 * The row is clickable, as the design has it, and the timestamp inside it is a
 * real `<button>` carrying `aria-expanded`. A `<tr>` with an onClick is not
 * focusable and not announced, and a compliance screen that cannot be read with
 * a keyboard fails the audit it exists for.
 */
function Row({ row, language, open, onToggle }) {
  const { t } = useTranslation('app')
  const tone = SEVERITY_TONE[row.severity]
  const at = new Date(row.at)

  const date = at.toLocaleDateString(language, { year: 'numeric', month: '2-digit', day: '2-digit' })
  const time = at.toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'cursor-pointer border-t border-subtle hover:bg-sunken',
          open && 'bg-sunken',
          row.severity === 'critical' && STRIPE_CLASS.red,
        )}
      >
        <td className="px-3.5 py-2.5 align-top">
          <button
            type="button"
            aria-expanded={open}
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
            className="text-start"
          >
            <Mono className="block text-micro text-ink-dim">{date}</Mono>
            <Mono className="block text-micro text-ink-mute">
              <time dateTime={row.at}>{time}</time>
            </Mono>
          </button>
        </td>

        <td className="px-3.5 py-2.5 align-top">
          {row.actorName ? (
            <span className="flex items-center gap-2 whitespace-nowrap">
              {/* Neutral, not a hashed colour. `Briefing` set that rule and it
                  holds here: a person is not a tone. */}
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-sunken text-micro font-bold text-ink-dim"
              >
                {row.actorInitials}
              </span>
              <span className="text-body-sm text-ink">{row.actorName}</span>
            </span>
          ) : (
            <span className="text-body-sm text-ink-mute">{t('settings.audit.system')}</span>
          )}
        </td>

        {/* The raw token, as the design prints it. It is what a log line says
            and what somebody greps an export for — translating it would make
            this column disagree with the file the Export button writes. */}
        <td className="px-3.5 py-2.5 align-top">
          <Mono className="text-micro whitespace-nowrap text-on-forge">{row.action}</Mono>
        </td>

        <td className="px-3.5 py-2.5 align-top">
          <Mono className="text-micro whitespace-nowrap text-ink-dim">{row.resource}</Mono>
        </td>

        <td className="px-3.5 py-2.5 align-top">
          <span className="text-body-sm text-ink-dim">{detailText(t, row) || <Dash />}</span>
        </td>

        {/* Present and empty. See the note at the top of this file. */}
        <td className="px-3.5 py-2.5 align-top">
          <Dash />
        </td>

        <td className="px-3.5 py-2.5 align-top">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-[3px] text-micro whitespace-nowrap',
              tone ? cn(TINT_CLASS[tone], ON_TINT_CLASS[tone]) : 'bg-sunken text-ink-dim',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                tone === 'red' ? 'bg-red' : tone === 'amber' ? 'bg-amber' : 'bg-ink-mute',
              )}
            />
            {t(`settings.audit.severity.${row.severity}`)}
          </span>
        </td>
      </tr>

      {open ? (
        <tr className="border-t border-subtle">
          <td colSpan={7} className="bg-sunken px-3.5 py-3">
            <pre className="m-0 overflow-x-auto text-micro text-ink-dim">
              <Mono>
                {JSON.stringify(
                  {
                    id: row.id,
                    timestamp: row.at,
                    actor: row.actorId,
                    action: row.action,
                    resource: row.resource,
                    detail: row.detail,
                    ip_address: null,
                    severity: row.severity,
                  },
                  null,
                  2,
                )}
              </Mono>
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function Dash() {
  return <span className="text-ink-mute">—</span>
}

/**
 * Generate a compliance report.
 *
 * The design's dialog: a date range, a report type and a format. What it
 * produces is the rows on the screen in the format asked for — CSV and JSON are
 * written to a file, PDF is the browser's own print of this page. A button that
 * claimed to render a SOC 2 report server-side would be claiming a server, and
 * the framework selected is recorded in the file rather than changing what is
 * in it, because nothing here knows what either standard requires.
 */
const REPORT_TYPES = ['soc2', 'iso27001', 'general']
const FORMATS = ['csv', 'json', 'pdf']

function ComplianceDialog({ rows, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const [type, setType] = useState(REPORT_TYPES[0])
  const [format, setFormat] = useState(FORMATS[0])

  function generate() {
    if (format === 'pdf') {
      onClose()
      window.print()
      return
    }
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'json') {
      const blob = JSON.stringify({ framework: type, generated: stamp, events: rows }, null, 2)
      downloadCsv(`meridian-${type}-${stamp}.json`, blob)
    } else {
      downloadCsv(
        `meridian-${type}-${stamp}.csv`,
        toCsv(
          ['framework', 'timestamp', 'actor', 'action', 'resource', 'severity'],
          rows.map((row) => [
            type,
            row.at,
            row.actorName ?? 'system',
            row.action,
            row.resource,
            row.severity,
          ]),
        ),
      )
    }
    onClose()
  }

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="sm"
      title={t('settings.audit.compliance.dialogTitle')}
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <span className="flex-1" />
          <ForgeButton variant="primary" onClick={generate}>
            {t('settings.audit.compliance.generate')}
          </ForgeButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ForgeSelect
          id="report-type"
          label={t('settings.audit.compliance.type')}
          value={type}
          onValueChange={setType}
          options={REPORT_TYPES.map((value) => ({
            value,
            label: t(`settings.audit.compliance.types.${value}`),
          }))}
        />
        <ForgeSelect
          id="report-format"
          label={t('settings.audit.compliance.format')}
          value={format}
          onValueChange={setFormat}
          options={FORMATS.map((value) => ({
            value,
            label: t(`settings.audit.compliance.formats.${value}`),
          }))}
        />
        <p className="m-0 rounded-sm border border-hairline bg-sunken px-3.5 py-3 text-body-sm text-ink-dim">
          <Num>{t('settings.audit.compliance.note', { count: rows.length })}</Num>
        </p>
      </div>
    </ForgeDialog>
  )
}
