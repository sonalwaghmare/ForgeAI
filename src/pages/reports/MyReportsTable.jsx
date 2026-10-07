import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState } from '@/components/forge/States'
import { AiBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { formatDateTime, formatRelative } from '@/lib/format'
import { templateName } from './reportMeta'

/**
 * Reports this account has generated.
 *
 * DEMO. See `DEMO-MODE.md` §8.9. The design's "My Reports" tab — the same shelf
 * that used to be the whole module, now one of three views, and flat rather
 * than a card grid because it is a log of things produced and the useful
 * comparison between rows is when and by whom.
 *
 * ── The progress bar is the only reason this is not a plain table ─────────
 * A row that is still building carries a real percentage, moving under the
 * reader as the server's clock advances — `generating` is derived from
 * `startedAt`, never stored, so the badge genuinely changes while you watch.
 * The design's "Generating" is a string that will say the same tomorrow.
 */
export function MyReportsTable({ reports, onBrowse, onDownload }) {
  const { t } = useTranslation(['app', 'common'])

  if (!reports.length) {
    return (
      <EmptyState
        icon="chart"
        title={t('reports.mine.empty')}
        body={t('reports.mine.emptyBody')}
        action={
          <ForgeButton variant="primary" onClick={onBrowse}>
            {t('reports.mine.browse')}
          </ForgeButton>
        }
      />
    )
  }

  /* A report's display name: the library entry it came from where there is one,
     and the engine's own kind where there is not — the shelf predates the
     catalogue and its older rows have no template. */
  const label = (report) =>
    report.templateId
      ? templateName(t, report.templateId)
      : t('reports.cardTitle', {
          period: t(`reports.period.${report.period}`),
          kind: t(`reports.kind.${report.kind}`),
          scope: report.siteName ?? t('reports.allSites'),
        })

  return (
    <Panel flush className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          <thead>
            <tr className="border-b border-hairline">
              <Th className="w-full">{t('reports.mine.column.report')}</Th>
              <Th>{t('reports.mine.column.template')}</Th>
              <Th>{t('reports.mine.column.by')}</Th>
              <Th>{t('reports.mine.column.when')}</Th>
              <Th>{t('reports.mine.column.pages')}</Th>
              <Th>{t('reports.mine.column.status')}</Th>
              <Th>
                <span className="sr-only">{t('reports.download')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-semibold">{label(report)}</span>
                  <span className="mt-0.5 block text-micro font-normal text-ink-mute">
                    <Mono>{report.id}</Mono>
                    {' · '}
                    <Num>
                      {t('reports.covers', {
                        from: formatDateTime(report.from, { dateStyle: 'medium' }),
                        to: formatDateTime(report.to, { dateStyle: 'medium' }),
                      })}
                    </Num>
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                  {report.templateId ? <Mono>{report.templateId}</Mono> : '—'}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                  {report.author ?? <AiBadge />}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                  <Num>{report.generatedAt ? formatRelative(report.generatedAt) : '—'}</Num>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Num>{report.status === 'ready' ? report.pages : '—'}</Num>
                </td>
                <td className="px-3 py-2.5">
                  {report.status === 'ready' ? (
                    <StateBadge tone="green">{t('reports.status.ready')}</StateBadge>
                  ) : (
                    <div className="min-w-[7rem]">
                      <div
                        role="progressbar"
                        aria-valuenow={report.progress ?? 0}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={label(report)}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
                      >
                        <span
                          className="block h-full rounded-full bg-forge transition-[inline-size] duration-500"
                          style={{ inlineSize: `${report.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="mt-1 block text-micro font-normal text-ink-dim">
                        <Num>{t('reports.progress', { percent: report.progress ?? 0 })}</Num>
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-end">
                  <ForgeButton
                    size="sm"
                    disabled={report.status !== 'ready'}
                    onClick={() => onDownload(report)}
                  >
                    <Icon name="doc" size="xs" />
                    {t(`reports.format.${report.format ?? 'pdf'}`)}
                  </ForgeButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function Th({ className, children }) {
  return (
    <th
      scope="col"
      className={`bg-sunken px-3 py-2.5 text-start text-micro font-semibold tracking-wide whitespace-nowrap text-ink-dim uppercase first:ps-4 ${className ?? ''}`}
    >
      {children}
    </th>
  )
}
