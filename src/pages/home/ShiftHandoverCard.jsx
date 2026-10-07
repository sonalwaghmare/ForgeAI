import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useAcknowledgeHandover, useHandoverMutation, useLatestHandover } from '@/features/handovers/queries'
import { useTasks } from '@/features/tasks/queries'
import { useToast } from '@/providers/ToastProvider'
import { formatPercent } from '@/lib/format'
import { HandoverFormDialog, HandoverReportDialog } from './HandoverDialogs'

/**
 * The shift handover card, from the prototype's right-hand column.
 *
 * DEMO.
 *
 * Reads the most recent PUBLISHED handover, not the newest row — the newest is
 * the shift currently running and is still a draft. Summarising a draft here
 * would show somebody their own unfinished note as if the last shift had handed
 * it over.
 *
 * The two buttons open the two modals, which are the whole feature: reading a
 * handover you have been given, and writing the one you are about to give.
 */
export function ShiftHandoverCard() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  const latest = useLatestHandover()
  // Only for the name list in the create form. The people directory has no
  // endpoint of its own yet and rides along with the task collection.
  const tasks = useTasks()

  const publish = useHandoverMutation()
  const acknowledge = useAcknowledgeHandover()

  const [dialog, setDialog] = useState(null)

  const handover = latest.data
  const report = handover?.report

  if (latest.isPending || !handover || !report) {
    return (
      <Panel>
        <Eyebrow className="mb-3.5">{t('screens.handovers')}</Eyebrow>
        <SkeletonRows count={3} />
      </Panel>
    )
  }

  const pair = t('handovers.shiftPair', {
    from: t(`common:shiftShort.${handover.from}`),
    to: t(`common:shiftShort.${handover.to}`),
  })

  const stats = [
    ['oee', formatPercent(handover.oee)],
    [
      'alerts',
      t('handovers.stats.alertsValue', {
        critical: handover.criticalCarried,
        high: handover.highCarried,
      }),
    ],
    ['pending', t('handovers.stats.pendingValue', { count: handover.pending })],
    ['safety', t('handovers.stats.noIncidents')],
  ]

  return (
    <>
      <Panel>
        <div className="mb-2.5 flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <Eyebrow>{t('handovers.card.title', { pair })}</Eyebrow>
            <p className="m-0 mt-1 text-micro font-normal text-ink-dim">
              {handover.date} · {handover.window}
            </p>
          </div>
          <span className="inline-flex items-center rounded-pill tint-green px-2.5 py-0.5 text-micro text-on-green">
            {t(`handovers.status.${handover.status}`)}
          </span>
          <ForgeButton asChild size="sm">
            <Link to="/app/handovers" aria-label={t('handovers.card.openAll')}>
              <Icon name="right" size="xs" className="mirror-rtl" />
            </Link>
          </ForgeButton>
        </div>

        <p className="m-0 text-micro font-normal text-ink-dim">
          <Mono>{handover.id}</Mono> · {handover.outgoing} → {handover.incoming}
        </p>

        <p className="mt-3 mb-0 line-clamp-4 text-body-sm leading-[1.6] text-ink-dim">
          {report.summary}
        </p>

        <dl className="m-0 mt-3.5 grid grid-cols-2 gap-2">
          {stats.map(([key, value]) => (
            <div key={key} className="rounded-sm bg-sunken px-3 py-2">
              <dt className="text-micro font-normal text-ink-dim">{t(`handovers.stats.${key}`)}</dt>
              <dd className="m-0 mt-0.5">
                <Num className="text-body-sm font-semibold text-ink">{value}</Num>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3.5 flex gap-2">
          <ForgeButton className="flex-1" onClick={() => setDialog('report')}>
            {t('common:actions.viewDetails')}
          </ForgeButton>
          {/* Primary, not the AI variant. The design makes this `btn-primary`
              and it is right to: the button's job is to start the handover, and
              the fact that the machine drafts the first version of it is a
              property of the form that opens, not of the act. The AI badge is
              inside, on the paragraph Forge AI actually wrote.

              The copilot icon stays, which is what the design does too — enough
              to say a draft is coming without spending the violet reservation on
              a routine primary action. */}
          <ForgeButton variant="primary" className="flex-1" onClick={() => setDialog('form')}>
            <Icon name="ai" size="xs" />
            {t('handovers.card.create')}
          </ForgeButton>
        </div>
      </Panel>

      {dialog === 'report' ? (
        <HandoverReportDialog
          open
          handover={handover}
          report={report}
          pending={acknowledge.isPending}
          onClose={() => setDialog(null)}
          onEdit={() => setDialog('form')}
          onExported={() => toast(t('handovers.toast.exported'))}
          onAcknowledge={() =>
            acknowledge.mutate(handover.id, {
              onSuccess: () => {
                setDialog(null)
                toast(t('handovers.toast.acknowledged'))
              },
              onError: () => toast(t('handovers.toast.failed'), 'error'),
            })
          }
        />
      ) : null}

      {dialog === 'form' ? (
        <HandoverFormDialog
          open
          handover={handover}
          report={report}
          people={tasks.data?.people ?? []}
          pending={publish.isPending}
          onClose={() => setDialog(null)}
          onExported={() => toast(t('handovers.toast.exported'))}
          onSubmit={(payload, incoming) =>
            publish.mutate(payload, {
              onSuccess: () => {
                setDialog(null)
                toast(
                  payload.status === 'draft'
                    ? t('handovers.toast.draftSaved')
                    : t('handovers.toast.published', { name: incoming }),
                )
              },
              onError: () => toast(t('handovers.toast.failed'), 'error'),
            })
          }
        />
      ) : null}
    </>
  )
}
