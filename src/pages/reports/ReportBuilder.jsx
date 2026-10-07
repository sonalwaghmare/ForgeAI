import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { AiBadge, PlainBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { cn } from '@/lib/cn'
import { CATEGORY_TONE, cadenceLabel, standardLabel, templateDesc, templateName } from './reportMeta'

const STEPS = ['scope', 'sections', 'delivery', 'preview']
const PERIODS = ['month', 'quarter']

/**
 * The report builder.
 *
 * DEMO. See `DEMO-MODE.md` §8.9. Four steps — scope, sections, delivery,
 * preview — replacing the three-field dialog that Generate used to open.
 *
 * ── Why the estimate is computed and not promised ─────────────────────────
 * The length shown on the last step is `pagesForSelection` applied to the
 * chosen sections and the sites in scope: the same function the server runs
 * when the build actually starts. Tick "Site / line breakdown" and the number
 * moves, because that section repeats per site. Narrow to one site and it moves
 * back. The design's builder shows the template's fixed page count regardless
 * of what was configured, which makes the whole configuration decorative.
 *
 * ── AI-written sections are marked as such ────────────────────────────────
 * Three of the ten — the summary, the insight and the recommended actions — are
 * written by the platform rather than tabulated from it. They carry the AI
 * badge in the picker, so somebody assembling a board pack knows before they
 * send it which paragraphs a model produced. That is not a nicety in a document
 * that goes to a board.
 *
 * ── The steps are reachable out of order ──────────────────────────────────
 * The stepper is a row of buttons, not a progress bar. Somebody who has been
 * here before goes straight to Sections. Nothing is validated on leaving a
 * step, because nothing on the first two steps can be left invalid — the only
 * unsatisfiable state is an empty section list, and that is guarded on the
 * control that would submit it.
 */
export function ReportBuilder({ template, library, pending, onBack, onGenerate, onAskAi }) {
  const { t } = useTranslation(['app', 'common'])

  const [step, setStep] = useState('scope')
  const [name, setName] = useState(() => templateName(t, template.id))
  const [period, setPeriod] = useState('month')
  const [siteId, setSiteId] = useState('')
  const [compare, setCompare] = useState(true)
  const [sections, setSections] = useState(() => library.defaultSections)
  const [format, setFormat] = useState('pdf')
  const [delivery, setDelivery] = useState('once')
  const [audience, setAudience] = useState('me')

  const siteCount = siteId ? 1 : Math.max(1, library.sites.length)

  /* The server's own arithmetic, run here so the preview cannot disagree with
     the card that appears. Per-site sections repeat; the rest do not. */
  const pages = useMemo(
    () =>
      library.sections
        .filter((section) => sections.includes(section.id))
        .reduce((sum, section) => sum + section.pages * (section.perSite ? siteCount : 1), 0),
    [library.sections, sections, siteCount],
  )

  const toggle = (id) =>
    setSections((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )

  const canSubmit = sections.length > 0 && !pending

  const scopeLabel = siteId
    ? (library.sites.find((site) => site.id === siteId)?.name ?? siteId)
    : t('reports.builder.allSites')

  const stepIndex = STEPS.indexOf(step)

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <ForgeButton size="sm" onClick={onBack}>
          <Icon name="right" size="xs" className="rotate-180" />
          {t('reports.builder.back')}
        </ForgeButton>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-title text-balance">{name}</h1>
          <p className="m-0 mt-1 text-micro font-normal text-ink-mute">
            <Mono>{template.id}</Mono> · {standardLabel(t, template.standard)} ·{' '}
            {t(`reports.category.${template.category}`)}
          </p>
        </div>
        <ForgeButton size="sm" onClick={onAskAi}>
          <Icon name="ai" size="xs" />
          {t('reports.builder.refine')}
        </ForgeButton>
      </header>

      {/* The stepper. Buttons, so a returning reader can jump. */}
      <nav aria-label={t('reports.builder.stepLabel')} className="mb-5 flex flex-wrap gap-1">
        {STEPS.map((entry, index) => {
          const done = index < stepIndex
          const current = entry === step
          return (
            <button
              key={entry}
              type="button"
              aria-current={current ? 'step' : undefined}
              onClick={() => setStep(entry)}
              className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-body-sm transition-colors hover:bg-sunken"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-[22px] shrink-0 items-center justify-center rounded-full text-micro font-semibold',
                  done && 'bg-green text-white',
                  current && !done && 'bg-forge text-white',
                  !current && !done && 'bg-sunken text-ink-mute',
                )}
              >
                {done ? <Icon name="check" size="xs" /> : index + 1}
              </span>
              <span className={cn(current ? 'font-semibold text-ink' : 'text-ink-dim')}>
                {t(`reports.builder.step.${entry}`)}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="grid items-start gap-4 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_minmax(0,20rem)]">
        <div>
          {step === 'scope' ? (
            <Panel className="flex flex-col gap-4">
              <Field
                label={t('reports.builder.name')}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))]">
                <ForgeSelect
                  label={t('reports.builder.period')}
                  value={period}
                  onValueChange={setPeriod}
                  options={PERIODS.map((value) => ({
                    value,
                    label: t(`reports.period.${value}`),
                  }))}
                />
                <ForgeSelect
                  label={t('reports.builder.scope')}
                  value={siteId}
                  onValueChange={setSiteId}
                  options={[
                    { value: '', label: t('reports.builder.allSites') },
                    ...library.sites.map((site) => ({ value: site.id, label: site.name })),
                  ]}
                />
              </div>
              <Checkbox
                checked={compare}
                onChange={setCompare}
                label={t('reports.builder.compare')}
              />
            </Panel>
          ) : null}

          {step === 'sections' ? (
            <Panel flush>
              <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-4">
                <h2 className="m-0 flex-1 text-micro font-semibold tracking-wide text-ink-dim uppercase">
                  {t('reports.builder.sectionsTitle')}
                </h2>
                <span className="text-micro text-ink-mute">
                  <Num>
                    {t('reports.builder.sectionsCount', {
                      selected: sections.length,
                      total: library.sections.length,
                    })}
                  </Num>
                </span>
              </div>
              <ul className="m-0 list-none p-0">
                {library.sections.map((section) => (
                  <li key={section.id} className="border-b border-hairline last:border-0">
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={sections.includes(section.id)}
                        onChange={() => toggle(section.id)}
                        className="size-4 shrink-0 accent-forge"
                      />
                      <span className="flex-1 text-body-sm">
                        {t(`reports.section.${section.id}`, { defaultValue: section.id })}
                      </span>
                      <span className="text-micro text-ink-mute">
                        <Num>{t('reports.pages', { count: section.pages })}</Num>
                      </span>
                      {section.ai ? <AiBadge label={t('reports.builder.aiWritten')} /> : null}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 p-4">
                <ForgeButton
                  size="sm"
                  onClick={() => setSections(library.sections.map((section) => section.id))}
                >
                  {t('reports.builder.selectAll')}
                </ForgeButton>
                <ForgeButton size="sm" onClick={() => setSections([])}>
                  {t('reports.builder.clear')}
                </ForgeButton>
              </div>
            </Panel>
          ) : null}

          {step === 'delivery' ? (
            <Panel className="flex flex-col gap-4">
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-2 p-0 text-control text-ink">
                  {t('reports.builder.format')}
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {library.formats.map((value) => (
                    <Chip key={value} selected={value === format} onClick={() => setFormat(value)}>
                      {t(`reports.format.${value}`)}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))]">
                <ForgeSelect
                  label={t('reports.builder.schedule')}
                  value={delivery}
                  onValueChange={setDelivery}
                  options={['once', 'daily', 'weekly', 'monthly', 'quarterly'].map((value) => ({
                    value,
                    label: t(`reports.delivery.${value}`),
                  }))}
                />
                <ForgeSelect
                  label={t('reports.builder.recipients')}
                  value={audience}
                  onValueChange={setAudience}
                  options={['me', 'plantLeadership', 'maintenance', 'board'].map((value) => ({
                    value,
                    label: t(`reports.audience.${value}`),
                  }))}
                />
              </div>
              <Checkbox checked onChange={() => {}} label={t('reports.builder.lineage')} />
              <Checkbox checked onChange={() => {}} label={t('reports.builder.rawData')} />
            </Panel>
          ) : null}

          {step === 'preview' ? (
            <Panel className="flex flex-col gap-4">
              <h2 className="m-0 text-micro font-semibold tracking-wide text-ink-dim uppercase">
                {t('reports.builder.readyTitle')}
              </h2>
              <dl className="m-0 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
                <Summary term={t('reports.builder.summaryTemplate')} value={templateName(t, template.id)} />
                <Summary term={t('reports.builder.summaryPeriod')} value={t(`reports.period.${period}`)} />
                <Summary term={t('reports.builder.summaryScope')} value={scopeLabel} />
                <Summary
                  term={t('reports.builder.summarySections')}
                  value={t('reports.sections', { count: sections.length })}
                />
                <Summary term={t('reports.builder.summaryFormat')} value={t(`reports.format.${format}`)} />
                <Summary
                  term={t('reports.builder.summaryPages')}
                  value={t('reports.pages', { count: pages })}
                />
              </dl>

              {sections.length === 0 ? (
                <p className="m-0 rounded-sm tint-amber px-3 py-2 text-body-sm text-on-amber">
                  {t('reports.builder.noSections')}
                </p>
              ) : null}

              <ForgeButton
                variant="primary"
                disabled={!canSubmit}
                onClick={() =>
                  onGenerate({
                    templateId: template.id,
                    period,
                    siteId,
                    sections,
                    format,
                  })
                }
              >
                {t('reports.builder.submit', { format: t(`reports.format.${format}`) })}
              </ForgeButton>
              <p className="m-0 text-micro font-normal text-ink-dim">{t('reports.form.note')}</p>
            </Panel>
          ) : null}

          {step !== 'preview' ? (
            <div className="mt-4 flex justify-end gap-2">
              {stepIndex > 0 ? (
                <ForgeButton onClick={() => setStep(STEPS[stepIndex - 1])}>
                  {t('reports.builder.back2')}
                </ForgeButton>
              ) : null}
              <ForgeButton variant="primary" onClick={() => setStep(STEPS[stepIndex + 1])}>
                {t('reports.builder.next')}
              </ForgeButton>
            </div>
          ) : null}
        </div>

        {/* What this report is, held beside the configuration rather than
            behind it — the reader is deciding whether it is the right report
            while they set it up. */}
        <aside className="flex flex-col gap-4">
          <Panel stripe={CATEGORY_TONE[template.category]}>
            <h2 className="m-0 mb-2.5 text-micro font-semibold tracking-wide text-ink-dim uppercase">
              {t('reports.aboutTitle')}
            </h2>
            <p className="m-0 mb-3 text-body-sm text-ink-dim">{templateDesc(t, template.id)}</p>
            <dl className="m-0 grid gap-1.5">
              <Row term={t('reports.about.standard')} value={standardLabel(t, template.standard)} />
              <Row term={t('reports.about.category')} value={t(`reports.category.${template.category}`)} />
              <Row term={t('reports.about.cadence')} value={cadenceLabel(t, template.cadence)} />
              <Row
                term={t('reports.about.audience')}
                value={(template.personas ?? [])
                  .map((persona) => t(`reports.persona.${persona}`))
                  .join(', ')}
              />
            </dl>
          </Panel>

          <Panel>
            <h2 className="m-0 mb-2.5 text-micro font-semibold tracking-wide text-ink-dim uppercase">
              {t('reports.kpisIncluded')}
            </h2>
            <ul className="m-0 mb-4 flex list-none flex-wrap gap-1.5 p-0">
              {(template.kpis ?? []).map((kpi) => (
                <li key={kpi}>
                  <PlainBadge>{t(`reports.kpi.${kpi}`, { defaultValue: kpi })}</PlainBadge>
                </li>
              ))}
            </ul>
            <h2 className="m-0 mb-2 text-micro font-semibold tracking-wide text-ink-dim uppercase">
              {t('reports.dataSources')}
            </h2>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {(template.sources ?? []).map((source) => (
                <li key={source} className="flex items-center gap-2 text-body-sm text-ink-dim">
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-green" />
                  {t(`reports.source.${source}`, { defaultValue: source })}
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  )
}

function Summary({ term, value }) {
  return (
    <div className="rounded-sm bg-sunken px-3 py-2">
      <dt className="text-micro font-normal text-ink-mute">{term}</dt>
      <dd className="m-0 mt-0.5 text-body-sm font-semibold">
        <Num>{value}</Num>
      </dd>
    </div>
  )
}

function Row({ term, value }) {
  return (
    <div className="flex gap-3 border-b border-hairline pb-1.5 text-body-sm last:border-0">
      <dt className="w-28 shrink-0 text-ink-mute">{term}</dt>
      <dd className="m-0 flex-1">{value}</dd>
    </div>
  )
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-body-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 accent-forge"
      />
      {label}
    </label>
  )
}
