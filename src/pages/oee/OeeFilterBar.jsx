import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { IconButton } from '@/components/forge/ForgeButton'
import { Panel } from '@/components/forge/Panel'
import { Eyebrow } from '@/components/forge/primitives'
import { PERIODS } from '@/features/oee/api'

const SHIFTS = ['morning', 'afternoon', 'night']
const BANDS = ['world', 'target', 'risk']

/**
 * The module's scope bar — three rows, exactly the design's arrangement.
 *
 * Row one is the window and the comparison toggle, with the window's totals on
 * the end. Row two is the scope: search, line, shift, band. Row three is the
 * active-filter summary, which appears only once something is set.
 *
 * ── Every control here does something ─────────────────────────────────────
 * In the prototype the whole bar is decoration: nine controls, none of them
 * wired to anything the screen draws. Here the period chips swap the payload
 * (`GET /v1/oee/summary?period=…`), and line, band and search narrow the line
 * table and the Overview's line strip while shift narrows the crew panel — with
 * a note saying so, because the one thing they deliberately do NOT do is
 * recompute the plant headline off the filtered subset.
 *
 * ── Two of the design's controls are not here ─────────────────────────────
 * The product select — 330 ml / 500 ml / 250 ml — is gone because there is no
 * product entity anywhere in this universe for it to select, and a select whose
 * every option matches everything is worse than its absence. Same call the
 * Sensor Explorer made about its source-system select.
 *
 * The custom date range is gone for the same reason one level down: the OEE
 * service answers a named window, not a span, so a date pair would either be
 * ignored or silently rounded to the nearest chip. When `?from=&to=` lands, it
 * belongs here.
 */
export function OeeFilterBar({
  period,
  lineId,
  shiftKey,
  band,
  query,
  compare,
  lines,
  summaryLine,
  onChange,
}) {
  const { t } = useTranslation('app')

  const lineName = (id) => lines.find((line) => line.id === id)?.name ?? id

  const active = [
    lineId !== 'all' && { key: 'line', label: lineName(lineId) },
    shiftKey !== 'all' && { key: 'shift', label: t(`oee.shift.${shiftKey}`) },
    band !== 'all' && { key: 'band', label: t(`oee.filters.bandOption.${band}`) },
    query && { key: 'q', label: `“${query}”` },
  ].filter(Boolean)

  const reset = () => {
    ;['line', 'shift', 'band', 'q'].forEach((key) => onChange(key, null))
  }

  return (
    <Panel flush className="mb-4">
      {/* ── Window, comparison, totals ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
        <div role="group" aria-label={t('oee.periodLabel')} className="flex flex-wrap gap-1.5">
          {PERIODS.map((entry) => (
            <Chip
              key={entry}
              selected={entry === period}
              onClick={() => onChange('period', entry === 'day' ? null : entry)}
            >
              {t(`oee.period.${entry}`)}
            </Chip>
          ))}
        </div>

        {/* <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink-dim">
          <input
            type="checkbox"
            checked={compare}
            onChange={(event) => onChange('compare', event.target.checked ? null : '0')}
            className="size-4 accent-forge"
          />
          {t('oee.filters.compare')}
        </label> */}

        {summaryLine ? (
          <span className="num ms-auto text-body-sm text-ink-mute">{summaryLine}</span>
        ) : null}
      </div>

      {/* ── Scope ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-subtle px-3.5 py-2.5">
        <label className="flex min-w-[11rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge sm:max-w-[18rem]">
          <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
          <span className="sr-only">{t('oee.filters.search')}</span>
          <input
            value={query}
            onChange={(event) => onChange('q', event.target.value)}
            placeholder={t('oee.filters.searchPlaceholder')}
            className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
          />
        </label>

        <ForgeSelect
          label={t('oee.filters.line')}
          labelInline
          size="sm"
          value={lineId}
          onValueChange={(value) => onChange('line', value === 'all' ? null : value)}
          options={[
            { value: 'all', label: t('oee.filters.allLines') },
            ...lines.map((line) => ({ value: line.id, label: line.name })),
          ]}
        />

        <ForgeSelect
          label={t('oee.filters.shift')}
          labelInline
          size="sm"
          value={shiftKey}
          onValueChange={(value) => onChange('shift', value === 'all' ? null : value)}
          options={[
            { value: 'all', label: t('oee.filters.allShifts') },
            ...SHIFTS.map((key) => ({ value: key, label: t(`oee.shift.${key}`) })),
          ]}
        />

        <ForgeSelect
          label={t('oee.filters.band')}
          labelInline
          size="sm"
          value={band}
          onValueChange={(value) => onChange('band', value === 'all' ? null : value)}
          options={[
            { value: 'all', label: t('oee.filters.allBands') },
            ...BANDS.map((key) => ({ value: key, label: t(`oee.filters.bandOption.${key}`) })),
          ]}
        />
      </div>

      {/* ── What is currently set ────────────────────────────────────── */}
      {active.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-subtle px-3.5 py-2.5">
          <Eyebrow>{t('oee.filters.active')}</Eyebrow>
          {active.map((entry) => (
            <span
              key={entry.key}
              className="inline-flex items-center gap-1 rounded-pill border border-forge/30 tint-forge py-[3px] ps-2.5 pe-1 text-micro font-semibold text-on-forge"
            >
              {entry.label}
              <IconButton
                bare
                label={t('oee.filters.remove', { name: entry.label })}
                onClick={() => onChange(entry.key, null)}
                className="size-5"
              >
                <Icon name="x" size="xs" />
              </IconButton>
            </span>
          ))}
          <button
            type="button"
            onClick={reset}
            className="text-body-sm text-ink-dim underline underline-offset-2 hover:text-ink"
          >
            {t('oee.filters.reset', { number: active.length })}
          </button>
          <p className="m-0 basis-full text-micro font-normal text-ink-mute italic">
            {t('oee.filters.scopeNote')}
          </p>
        </div>
      ) : null}
    </Panel>
  )
}
