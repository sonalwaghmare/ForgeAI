import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Mono } from '@/components/forge/primitives'
import { useToast } from '@/providers/ToastProvider'
import { BoardCanvas } from '@/pages/workboards/BoardCanvas'
import { BoardToolbar } from '@/pages/workboards/BoardToolbar'

/**
 * Anomaly · Workboard.
 *
 * DEMO. See `DEMO-MODE.md` §8.1. The investigation canvas scoped to one anomaly:
 * the asset, its signal, the drawing, the procedure and the findings laid out
 * together, with the agent panel beside it.
 *
 * The surface itself is `BoardCanvas`, shared with the Workboards module — a board
 * reached from the rail and a board reached from an anomaly are the same object,
 * and letting them be two components would guarantee they diverged.
 */

/**
 * Where each card sits, as a percentage of the board.
 *
 * Percentages rather than pixels so the board reflows with the viewport instead of
 * needing a horizontal scrollbar on a laptop — the one thing a fixed layout
 * genuinely has to get right.
 */
const LAYOUT = [
  { key: 'asset', kind: 'asset', x: 2, y: 4, w: 30 },
  { key: 'signal', kind: 'chart', x: 36, y: 2, w: 38 },
  { key: 'finding', kind: 'rca', x: 78, y: 6, w: 20 },
  { key: 'pid', kind: 'pid', x: 4, y: 46, w: 30 },
  { key: 'sop', kind: 'sop', x: 38, y: 52, w: 28 },
  { key: 'wo', kind: 'wo', x: 70, y: 48, w: 27 },
]

/**
 * Connector runs, as [fromKey, toKey], drawn as arrows.
 *
 * Direction carries the argument: the asset produced the signal, the signal
 * produced the finding, the finding raised the work order. An undirected line says
 * two cards are related; an arrow says which way the reasoning ran, which is the
 * whole reason a board beats a list.
 */
const LINKS = [
  ['asset', 'signal'],
  ['signal', 'finding'],
  ['pid', 'asset'],
  ['sop', 'wo'],
  ['finding', 'wo'],
]

const TRACE = [8.1, 8.3, 8.9, 9.4, 10.2, 11.1, 11.9, 12.8, 13.5, 14.1, 14.8, 15.2]

export function WorkboardTab({ anomaly }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  const cards = LAYOUT.map((card) => ({
    ...card,
    kindLabel: t(`anomalies.workboard.card.${card.key}.kind`),
    title: t(`anomalies.workboard.card.${card.key}.title`),
    body: t(`anomalies.workboard.card.${card.key}.body`),
    series: card.kind === 'chart' ? TRACE : null,
  }))

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <BoardToolbar />
          <StateBadge tone="ack" dot={false}>
            {t('workboards.readOnly')}
          </StateBadge>
          <div className="flex-1" />
          <Mono className="text-micro text-ink-mute">
            {t('anomalies.workboard.boardId', { id: anomaly?.id ?? '—' })}
          </Mono>
          <ForgeButton size="sm" onClick={() => toast(t('workboards.toast.shared'))}>
            <Icon name="send" size="xs" />
            {t('workboards.share')}
          </ForgeButton>
        </div>

        <BoardCanvas cards={cards} links={LINKS} />
      </div>

      {/* The agent, beside the board rather than over it — on a canvas the thing
          you are asking about must stay visible while you ask. */}
      <BoardAgent
        prompts={['relatedAssets', 'pullTrend', 'causeMap']}
        onAsk={() => toast(t('workboards.toast.asked'))}
      />
    </div>
  )
}

/** The assistant rail. Exported so the Workboards module renders the same one. */
export function BoardAgent({ prompts, onAsk }) {
  const { t } = useTranslation(['app', 'common'])
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 rounded-sm border border-hairline bg-card p-4 xl:w-80">
      <div className="flex items-center gap-2">
        <Icon name="ai" size="sm" className="text-violet" />
        <span className="flex-1 text-body-sm font-semibold">{t('workboards.agent')}</span>
      </div>
      <p className="m-0 text-body-sm text-ink-dim">{t('workboards.agentBody')}</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {prompts.map((key) => (
          <li key={key}>
            <button
              type="button"
              onClick={onAsk}
              className="w-full rounded-sm border border-hairline bg-card px-3 py-2 text-start text-body-sm text-ink-dim transition-colors hover:border-forge hover:text-ink"
            >
              {t(`workboards.prompt.${key}`)}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
