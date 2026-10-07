import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { EmptyState } from '@/components/forge/States'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatRelative } from '@/lib/format'
import { BoardAgent } from '@/pages/anomalies/WorkboardTab'
import { BoardCanvas } from './BoardCanvas'
import { BoardToolbar } from './BoardToolbar'
import {
  BOARD_LAYOUT,
  BOARD_LINKS,
  BOARD_STATUS_TONE,
  BOARD_TRACE,
  boardById,
  updatedAt,
} from './boards'

/**
 * One workboard, open on the canvas.
 *
 * DEMO. See `DEMO-MODE.md` §8.1. Its own route rather than a panel on the index,
 * because a board is the thing people send each other — `/app/workboards/WB-1042`
 * has to survive being pasted into a message.
 *
 * The surface is `BoardCanvas` and the assistant rail is `BoardAgent`, both shared
 * with the anomaly's Workboard tab. A board reached from the rail and a board
 * reached from an anomaly are the same object; two components would diverge.
 */
export function BoardDetailPage() {
  const { t } = useTranslation(['app', 'common'])
  const { boardId } = useParams()
  const { toast } = useToast()

  const board = boardById(boardId)

  useDocumentTitle(
    `${board ? t(`workboards.board.${board.id}.name`) : t('workboards.notFound')} · ${t('common:brand.name')}`,
  )

  if (!board) {
    return (
      <Page>
        <EmptyState
          icon="board"
          title={t('workboards.notFound')}
          body={t('workboards.notFoundBody')}
          action={
            <ForgeButton variant="primary" asChild>
              <Link to="/app/workboards">{t('workboards.backToAll')}</Link>
            </ForgeButton>
          }
        />
      </Page>
    )
  }

  /* The board's own subject substituted into the shared layout — see the note in
     `boards.js`. Six authored canvases would be six things to keep in step. */
  const cards = BOARD_LAYOUT.map((card) => ({
    ...card,
    kindLabel: t(`workboards.card.${card.key}.kind`),
    title:
      card.key === 'asset'
        ? board.asset
        : t(`workboards.card.${card.key}.title`, { asset: board.asset }),
    body: t(`workboards.card.${card.key}.body`, { line: board.line }),
    series: card.kind === 'chart' ? BOARD_TRACE : null,
  }))

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-start gap-3">
        <ForgeButton size="sm" asChild>
          <Link to="/app/workboards">
            <Icon name="right" size="xs" className="rotate-180" />
            {t('workboards.backToAll')}
          </Link>
        </ForgeButton>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-title text-balance">
              {t(`workboards.board.${board.id}.name`)}
            </h1>
            <StateBadge tone={BOARD_STATUS_TONE[board.status]}>
              {t(`workboards.status.${board.status}`)}
            </StateBadge>
          </div>
          <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 text-micro font-normal text-ink-mute">
            <Mono>{board.id}</Mono>
            <span aria-hidden="true">·</span>
            <span>{board.asset}</span>
            <span aria-hidden="true">·</span>
            <span>{board.line}</span>
            <span aria-hidden="true">·</span>
            <Num>
              {t('workboards.updatedBy', {
                name: board.owner,
                when: formatRelative(updatedAt(board)),
              })}
            </Num>
            {board.linked ? (
              <>
                <span aria-hidden="true">·</span>
                {/* The anomaly that started it, as a link. A board that names an
                    alert and cannot open it makes somebody search for it. */}
                <Link
                  to={`/app/anomalies/${board.linked}`}
                  className="font-semibold text-on-forge"
                >
                  {board.linked}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <BoardToolbar />
            <StateBadge tone="ack" dot={false}>
              {t('workboards.readOnly')}
            </StateBadge>
            <div className="flex-1" />
            <span className="text-micro text-ink-mute">
              <Num>{t('workboards.elements', { count: board.elements })}</Num>
            </span>
            <ForgeButton size="sm" onClick={() => toast(t('workboards.toast.shared'))}>
              <Icon name="send" size="xs" />
              {t('workboards.share')}
            </ForgeButton>
          </div>

          <BoardCanvas cards={cards} links={BOARD_LINKS} />
        </div>

        <BoardAgent
          prompts={['relatedAssets', 'pullTrend', 'causeMap']}
          onAsk={() => toast(t('workboards.toast.asked'))}
        />
      </div>
    </Page>
  )
}
