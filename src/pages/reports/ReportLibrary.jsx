import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState } from '@/components/forge/States'
import { PlainBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { cn } from '@/lib/cn'
import { CATEGORY_DOT, CATEGORY_TONE, cadenceLabel, standardLabel, templateDesc, templateName } from './reportMeta'

/**
 * The standard-report library.
 *
 * DEMO. See `DEMO-MODE.md` §8.9. Thirty-four reports a plant is expected to
 * produce, filed by subject and by the role that reads them.
 *
 * ── Why the filters are what they are ─────────────────────────────────────
 * Thirty-four is past the number anybody scans. The design's answer is a role
 * filter first and a category second, and that ordering is right: somebody
 * arriving here is a maintenance planner or a quality engineer before they are
 * looking for a Pareto. Search covers the third case — a person who knows the
 * standard ("ISO 14224") or the metric ("MTBF") but not what the report is
 * called.
 *
 * ── Grouping is only honest under the default sort ────────────────────────
 * Cards are grouped under their category heading while sorted by category. Sort
 * by name or by usage and the grouping is dropped rather than kept as a
 * decoration — a "Quality & Compliance" heading over a list sorted by something
 * else says the group is the organising principle when it is not.
 *
 * ── Search matches the things printed on the card ─────────────────────────
 * Name, description, standard and KPI labels — all translated first, so a
 * reader searching in their own language matches the words they can actually
 * see. Searching the raw keys would work in English and silently fail
 * everywhere else.
 */
export function ReportLibrary({ library, onOpen }) {
  const { t } = useTranslation(['app', 'common'])

  const [search, setSearch] = useState('')
  const [persona, setPersona] = useState('all')
  const [category, setCategory] = useState('all')
  const [cadence, setCadence] = useState('all')
  const [sort, setSort] = useState('category')

  const templates = library.templates

  /* Translated once per template rather than once per keystroke — the haystack
     is stable, the needle is not. */
  const searchable = useMemo(
    () =>
      new Map(
        templates.map((entry) => [
          entry.id,
          [
            entry.id,
            templateName(t, entry.id),
            templateDesc(t, entry.id),
            standardLabel(t, entry.standard),
            ...(entry.kpis ?? []).map((kpi) => t(`reports.kpi.${kpi}`, { defaultValue: kpi })),
          ]
            .join(' ')
            .toLowerCase(),
        ]),
      ),
    [templates, t],
  )

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matched = templates.filter(
      (entry) =>
        (persona === 'all' || (entry.personas ?? []).includes(persona)) &&
        (category === 'all' || entry.category === category) &&
        (cadence === 'all' || (entry.cadence ?? []).includes(cadence)) &&
        (!needle || (searchable.get(entry.id) ?? '').includes(needle)),
    )
    if (sort === 'name') {
      return [...matched].sort((a, b) => templateName(t, a.id).localeCompare(templateName(t, b.id)))
    }
    if (sort === 'popular') {
      return [...matched].sort((a, b) => Number(b.popular) - Number(a.popular))
    }
    return matched
  }, [templates, persona, category, cadence, search, sort, searchable, t])

  const grouped = sort === 'category' && category === 'all'

  const active = [
    persona !== 'all' && { key: 'persona', label: t(`reports.persona.${persona}`), clear: () => setPersona('all') },
    category !== 'all' && { key: 'category', label: t(`reports.category.${category}`), clear: () => setCategory('all') },
    cadence !== 'all' && { key: 'cadence', label: t(`reports.cadence.${cadence}`), clear: () => setCadence('all') },
    search.trim() && { key: 'search', label: `“${search.trim()}”`, clear: () => setSearch('') },
  ].filter(Boolean)

  const resetAll = () => {
    setPersona('all')
    setCategory('all')
    setCadence('all')
    setSearch('')
  }

  return (
    <>
      <Panel flush className="mb-4">
        <div className="flex flex-wrap items-end gap-2.5 p-3">
          {/* The repo's search idiom: a real <label> wrapping the input, its
              text sr-only because the icon and placeholder already read as
              search to a sighted user — and a placeholder is not a label. */}
          <label className="flex min-w-[min(100%,15rem)] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge">
            <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
            <span className="sr-only">{t('reports.filter.searchLabel')}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('reports.filter.search')}
              className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
            />
          </label>
          <ForgeSelect
            label={t('reports.filter.persona')}
            labelHidden
            value={persona}
            onValueChange={setPersona}
            className="min-w-[min(100%,11rem)]"
            options={[
              { value: 'all', label: t('reports.persona.all') },
              ...library.personas.map((value) => ({ value, label: t(`reports.persona.${value}`) })),
            ]}
          />
          <ForgeSelect
            label={t('reports.filter.category')}
            labelHidden
            value={category}
            onValueChange={setCategory}
            className="min-w-[min(100%,11rem)]"
            options={[
              { value: 'all', label: t('reports.category.all') },
              ...library.categories.map(({ id }) => ({ value: id, label: t(`reports.category.${id}`) })),
            ]}
          />
          <ForgeSelect
            label={t('reports.filter.cadence')}
            labelHidden
            value={cadence}
            onValueChange={setCadence}
            className="min-w-[min(100%,9rem)]"
            options={[
              { value: 'all', label: t('reports.cadence.all') },
              ...library.cadences.map((value) => ({ value, label: t(`reports.cadence.${value}`) })),
            ]}
          />
          <ForgeSelect
            label={t('reports.filter.sort')}
            labelHidden
            value={sort}
            onValueChange={setSort}
            className="min-w-[min(100%,9rem)]"
            options={['category', 'name', 'popular'].map((value) => ({
              value,
              label: `${t('reports.filter.sort')}: ${t(`reports.sort.${value}`)}`,
            }))}
          />

          {/* How much of the catalogue is on screen. Shown always, not only
              once something is filtered — with thirty-four reports the
              denominator is the useful half of it. */}
          <span className="ms-auto ps-2 text-micro whitespace-nowrap text-ink-mute">
            <Num>{t('reports.filter.showing', { shown: rows.length, total: templates.length })}</Num>
          </span>
        </div>

        {active.length ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-3 py-2.5">
            <span className="text-micro font-semibold tracking-wide text-ink-mute uppercase">
              {t('reports.filter.active')}
            </span>
            {active.map((entry) => (
              <Chip key={entry.key} selected onClick={entry.clear}>
                {entry.label}
                <Icon name="x" size="xs" />
              </Chip>
            ))}
            <ForgeButton size="sm" onClick={resetAll}>
              {t('reports.filter.reset')}
            </ForgeButton>
          </div>
        ) : null}
      </Panel>

      {rows.length === 0 ? (
        <EmptyState icon="chart" title={t('reports.noMatch')} body={t('reports.noMatchBody')} />
      ) : grouped ? (
        library.categories.map(({ id }) => {
          const group = rows.filter((entry) => entry.category === id)
          if (!group.length) return null
          return (
            <section key={id} className="mb-6">
              <h2 className="mb-2.5 flex items-center gap-2 text-micro font-semibold tracking-wide text-ink-dim uppercase">
                <span
                  aria-hidden="true"
                  className={cn('size-2 rounded-xs', CATEGORY_DOT[CATEGORY_TONE[id]])}
                />
                {t(`reports.category.${id}`)}
                <span className="font-normal text-ink-mute">
                  <Num>{group.length}</Num>
                </span>
              </h2>
              <CardGrid rows={group} onOpen={onOpen} />
            </section>
          )
        })
      ) : (
        <CardGrid rows={rows} onOpen={onOpen} />
      )}
    </>
  )
}

function CardGrid({ rows, onOpen }) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
      {rows.map((entry) => (
        <TemplateCard key={entry.id} template={entry} onOpen={onOpen} />
      ))}
    </div>
  )
}

/**
 * One report in the catalogue.
 *
 * The whole card is the button. A card whose only target is a "Generate →" link
 * in its corner makes the reader aim at 60px of a 300px surface they already
 * believe is clickable.
 */
function TemplateCard({ template, onOpen }) {
  const { t } = useTranslation(['app', 'common'])
  return (
    <Panel
      as="button"
      interactive
      stripe={CATEGORY_TONE[template.category]}
      onClick={() => onOpen(template)}
      className="flex flex-col gap-2.5 text-start"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-body font-semibold text-balance">{templateName(t, template.id)}</h3>
          <p className="m-0 mt-1 text-micro font-normal text-ink-mute">
            <Mono>{template.id}</Mono> · {standardLabel(t, template.standard)}
          </p>
        </div>
        {template.popular ? <PlainBadge>{t('reports.popular')}</PlainBadge> : null}
      </div>

      <p className="m-0 text-body-sm text-ink-dim">{templateDesc(t, template.id)}</p>

      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {(template.kpis ?? []).slice(0, 4).map((kpi) => (
          <li
            key={kpi}
            className="rounded-xs bg-sunken px-1.5 py-0.5 text-micro font-normal text-ink-dim"
          >
            {t(`reports.kpi.${kpi}`, { defaultValue: kpi })}
          </li>
        ))}
      </ul>

      <p className="m-0 mt-auto flex flex-wrap items-center gap-x-2 text-micro font-normal text-ink-mute">
        <span>{cadenceLabel(t, template.cadence)}</span>
        <span aria-hidden="true">·</span>
        <Num>{t('reports.pages', { count: template.pages })}</Num>
        <span className="ms-auto font-semibold text-on-forge">{t('reports.open')} →</span>
      </p>
    </Panel>
  )
}
