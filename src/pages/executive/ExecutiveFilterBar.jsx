import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Panel } from '@/components/forge/Panel'
import { Dot, Num } from '@/components/forge/primitives'
import { formatDateTime } from '@/lib/format'
import { PERIODS } from './executiveModel'

/**
 * Window, scope, and how current the numbers are.
 *
 * ── Both controls commit ──────────────────────────────────────────────────
 * The prototype's period pills relabel a caption over one hardcoded dataset and
 * its site select is wired to a `useState` nothing reads. Here the period is a
 * month count that scales every flow figure on the screen and the scope narrows
 * the rollup to one plant — the KPIs, the leakage bars, the traces and the
 * brief all recompute. A control that does nothing is the clearest possible
 * signal that a screen is a mock-up.
 *
 * ── The currency stamp is the query's ─────────────────────────────────────
 * The design prints "Data current to 20 Aug 06:00" as a literal, which is right
 * on one morning. This is `dataUpdatedAt` from the request that filled the
 * screen, formatted in the reader's locale.
 *
 * ── `total`, not `count` ──────────────────────────────────────────────────
 * "All sites (n)" interpolates `{total}` deliberately. `count` is i18next's
 * reserved plural key: passing it against a key with no plural forms sends the
 * string through plural resolution instead of interpolation. The figure comes
 * from the summary's own estate count, so it cannot drift from the one printed
 * in the page header.
 */
export function ExecutiveFilterBar({ period, scopeId, sites, total, updatedAt, onChange }) {
  const { t } = useTranslation('app')

  return (
    <Panel flush className="mb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
        <div role="group" aria-label={t('executive.periodLabel')} className="flex flex-wrap gap-1.5">
          {PERIODS.map((entry) => (
            <Chip
              key={entry}
              selected={entry === period}
              onClick={() => onChange('period', entry === 'mtd' ? null : entry)}
            >
              {t(`executive.period.${entry}`)}
            </Chip>
          ))}
        </div>

        <span className="text-body-sm text-ink-mute">
          {t('executive.versus', { prior: t(`executive.prior.${period}`) })}
        </span>

        <ForgeSelect
          label={t('executive.scope')}
          labelInline
          size="sm"
          value={scopeId}
          onValueChange={(value) => onChange('site', value === 'all' ? null : value)}
          options={[
            { value: 'all', label: t('executive.allSites', { total: total ?? sites.length }) },
            ...sites.map((site) => ({ value: site.id, label: site.name })),
          ]}
        />

        {updatedAt ? (
          <span className="ms-auto inline-flex items-center gap-2 text-body-sm text-ink-mute">
            <Dot tone="green" />
            <Num>{t('executive.currentTo', { at: formatDateTime(updatedAt) })}</Num>
          </span>
        ) : null}
      </div>
    </Panel>
  )
}
