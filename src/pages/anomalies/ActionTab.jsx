import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { AiBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { useToast } from '@/providers/ToastProvider'
import { cn } from '@/lib/cn'
import { ON_TINT_CLASS } from '@/lib/tone'

/**
 * Anomaly · Action.
 *
 * DEMO. See `DEMO-MODE.md` §8.1. What to do about it: the corrective plan, the
 * documents that govern it, the times this happened before, and the work order
 * that would carry it out.
 *
 * ── Hardcoded, and said so ────────────────────────────────────────────────
 * Nothing here is joined to the plant — there is no endpoint that returns a plan,
 * a document set or a similarity ranking. Every figure is a literal from the
 * design, and the notice at the foot says so rather than letting a reader treat a
 * 94% match as a computed one.
 *
 * ── Why the work-order card is a recommendation, not a form ───────────────
 * The right rail states priority, start, duration, skills and parts as an
 * AI-authored proposal with the violet mark on it, and the button hands those
 * across as pre-filled fields. A blank form here would throw away the one thing
 * the analysis just worked out, and a form that silently arrived pre-filled would
 * hide that a machine chose the values. Naming it is what makes accepting it a
 * decision rather than a default.
 */

const PLAN = ['isolate', 'spectrum', 'compare', 'replace', 'baseline']

const PLAN_TONE = { high: 'red', medium: 'amber', low: 'watch' }
const PLAN_PRIORITY = {
  isolate: 'high',
  spectrum: 'high',
  compare: 'medium',
  replace: 'medium',
  baseline: 'low',
}

const DOCS = [
  { key: 'manual', ext: 'PDF', tone: 'red', icon: 'doc' },
  { key: 'sop', ext: 'DOC', tone: 'watch', icon: 'list' },
  { key: 'pid', ext: 'DWG', tone: 'green', icon: 'layers' },
  { key: 'priorWo', ext: 'WO', tone: 'amber', icon: 'wrench' },
]

const SIMILAR = [
  { key: 'alr3021', tone: 'red', match: 94 },
  { key: 'alr2740', tone: 'amber', match: 81 },
  { key: 'alr2109', tone: 'watch', match: 73 },
]

const WO_FIELDS = ['priority', 'start', 'duration', 'skills', 'parts']

export function ActionTab() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel>
          <div className="flex items-center gap-2">
            <Eyebrow className="flex-1">{t('anomalies.action.plan')}</Eyebrow>
            <AiBadge label={t('anomalies.action.aiDrafted')} />
          </div>
          <ol className="m-0 mt-2 list-none p-0">
            {PLAN.map((key, index) => {
              const priority = PLAN_PRIORITY[key]
              return (
                <li
                  key={key}
                  className="flex items-center gap-3 border-b border-hairline py-3 last:border-0"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-sunken text-micro font-bold"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-body-sm font-semibold">
                      {t(`anomalies.action.step.${key}.title`)}
                    </div>
                    <div className="mt-0.5 text-micro font-normal text-ink-dim">
                      {t(`anomalies.action.step.${key}.detail`)}
                    </div>
                  </div>
                  <StateBadge tone={PLAN_TONE[priority]} dot={false}>
                    {t(`anomalies.action.priority.${priority}`)}
                  </StateBadge>
                </li>
              )
            })}
          </ol>
        </Panel>

        <Panel>
          <Eyebrow>{t('anomalies.action.docs')}</Eyebrow>
          <ul className="m-0 mt-1 list-none p-0">
            {DOCS.map((doc) => (
              <li key={doc.key} className="border-b border-hairline last:border-0">
                <button
                  type="button"
                  onClick={() => toast(t('anomalies.action.toast.docOpened'))}
                  className="flex w-full items-center gap-3 py-2.5 text-start transition-colors hover:text-ink"
                >
                  {/* A file, drawn as one: the sheet plus its extension. Reads
                      as a document at a glance where a bare icon reads as a
                      row marker. */}
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-8 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xs border border-hairline bg-sunken"
                  >
                    <Icon name={doc.icon} size="xs" className={ON_TINT_CLASS[doc.tone]} />
                    <span
                      className={cn(
                        'text-[6.5px] font-bold tracking-wide',
                        ON_TINT_CLASS[doc.tone],
                      )}
                    >
                      {doc.ext}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold">
                      {t(`anomalies.action.doc.${doc.key}.title`)}
                    </span>
                    <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                      {t(`anomalies.action.doc.${doc.key}.detail`)}
                    </span>
                  </span>
                  <Icon name="right" size="sm" className="shrink-0 text-ink-mute" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <Eyebrow>{t('anomalies.action.similar')}</Eyebrow>
          <ul className="m-0 mt-1 list-none p-0">
            {SIMILAR.map((entry) => (
              <li key={entry.key} className="border-b border-hairline last:border-0">
                <button
                  type="button"
                  onClick={() => toast(t('anomalies.action.toast.similarOpened'))}
                  className="flex w-full items-center gap-3 py-2.5 text-start"
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: `var(--hue-${entry.tone})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold">
                      {t(`anomalies.action.past.${entry.key}.title`)}
                    </span>
                    <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                      <Num>{t(`anomalies.action.past.${entry.key}.meta`)}</Num>
                    </span>
                  </span>
                  {/* How alike, not how certain. The label under the figure is
                      what stops it being read as a confidence score. */}
                  <span className="shrink-0 text-end">
                    <Num className="block text-body font-bold text-on-green">{entry.match}%</Num>
                    <span className="block text-micro font-normal text-ink-mute">
                      {t('anomalies.action.match')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <p className="m-0 text-body-sm text-ink-mute italic">{t('anomalies.action.demoNotice')}</p>
      </div>

      <aside className="flex flex-col gap-4">
        <Panel flush>
          <div className="border-b border-hairline px-4 py-3">
            <Eyebrow>{t('anomalies.action.workOrder')}</Eyebrow>
          </div>
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="ai" size="sm" className="text-violet" />
              <span className="text-micro font-bold tracking-wide text-on-violet uppercase">
                {t('anomalies.action.aiSchedule')}
              </span>
            </div>
            <dl className="m-0">
              {WO_FIELDS.map((field) => (
                <div
                  key={field}
                  className="flex justify-between gap-3 border-b border-hairline py-1.5 text-body-sm last:border-0"
                >
                  <dt className="text-ink-mute">{t(`anomalies.action.wo.${field}.label`)}</dt>
                  <dd className="m-0 text-end font-semibold">
                    <Num>{t(`anomalies.action.wo.${field}.value`)}</Num>
                  </dd>
                </div>
              ))}
            </dl>
            <ForgeButton
              variant="primary"
              className="mt-3.5 w-full"
              onClick={() => toast(t('anomalies.action.toast.woCreated'))}
            >
              {t('anomalies.action.createWo')}
            </ForgeButton>
            <p className="m-0 mt-2 text-center text-micro font-normal text-ink-mute">
              {t('anomalies.action.prefilled')}
            </p>
          </div>
        </Panel>

        <Panel flush>
          <div className="border-b border-hairline px-4 py-3">
            <Eyebrow>{t('anomalies.action.activity')}</Eyebrow>
          </div>
          <ul className="m-0 list-none px-4 py-1">
            {['generated', 'acknowledged', 'escalated'].map((key, index, all) => (
              <li
                key={key}
                className={cn(
                  'flex gap-2.5 py-2.5',
                  index < all.length - 1 && 'border-b border-hairline',
                )}
              >
                <Icon name="gear" size="sm" className="mt-0.5 shrink-0 text-ink-mute" />
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm">{t(`anomalies.action.log.${key}.text`)}</div>
                  <Mono className="mt-0.5 block text-micro text-ink-mute">
                    {t(`anomalies.action.log.${key}.when`)}
                  </Mono>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </aside>
    </div>
  )
}

function Eyebrow({ className, children }) {
  return (
    <div className={cn('text-micro font-semibold tracking-wide text-ink-mute uppercase', className)}>
      {children}
    </div>
  )
}
