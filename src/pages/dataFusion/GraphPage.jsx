import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useFusionGraph, useGraphNode } from '@/features/dataFusion/graph'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatCompact, formatInteger } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * Knowledge Graph — one machine's neighbourhood.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── Why not the whole estate ──────────────────────────────────────────────
 * A hundred and ten entities drawn at once is a hairball: a picture that proves
 * a graph exists and answers no question about it. What somebody opens this
 * screen to ask is "what does the platform actually know about this machine",
 * and that is a subgraph one screen can hold. The design's own graph is nine
 * nodes for the same reason — it just gets there by hardcoding nine, where
 * these are read off the estate.
 *
 * The header still counts the whole thing, so the scale is stated even though it
 * is not drawn.
 *
 * ── Nothing here is a new fact ────────────────────────────────────────────
 * The line comes from the hierarchy, the sensors from the signal catalogue, the
 * documents from the inheritance resolver, the sources from what each declares
 * it reads, the work orders and anomalies from their own collections. Every node
 * is a link to the screen that owns it, which is the test of whether an edge was
 * real: if it cannot be clicked into, it was decoration.
 *
 * ── What is not drawn is said ─────────────────────────────────────────────
 * Four per kind fit on a ring without labels colliding. A machine with eleven
 * documents shows four and the legend says eleven — a graph that quietly shows
 * a third of something is a graph nobody should trust.
 */
export function GraphPage() {
  const { t } = useTranslation(['app', 'common'])
  const navigate = useNavigate()
  useDocumentTitle(`${t('dataFusion.sections.graph')} · ${t('common:brand.name')}`)

  const graph = useFusionGraph()
  const [picked, setPicked] = useState(null)
  const [question, setQuestion] = useState('')

  const entities = graph.data?.entities ?? []
  /* DERIVED, not written by an effect. The default is "whatever the list puts
     first", which is the richest machine — a graph screen that opened on a node
     with two edges would look broken — and that is a function of the data rather
     than a state React needs to be put into. Writing it in an effect is the
     synchronous-setState lint rule this codebase has now tripped over three
     times. */
  const focusId = picked ?? entities[0]?.id ?? null
  const setFocusId = setPicked

  const node = useGraphNode(focusId)
  const hood = node.data

  function ask(event) {
    event.preventDefault()
    const text = question.trim()
    if (!text) return
    // The design's search bar goes nowhere. There is a Copilot screen now, so it
    // goes there with the question already asked.
    navigate(`/app/copilot?q=${encodeURIComponent(text)}`)
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-4">
        <h1 className="m-0 text-headline">{t('dataFusion.sections.graph')}</h1>
        <p className="mt-2 mb-0 max-w-[76ch] text-body-sm text-ink-dim">
          {graph.data ? (
            <Num>
              {t('dataFusion.graph.summary', {
                assets: formatInteger(graph.data.totals.assets),
                sensors: formatInteger(graph.data.totals.sensors),
                sources: formatInteger(graph.data.totals.sources),
                relationships: formatCompact(graph.data.totals.relationships),
              })}
            </Num>
          ) : (
            t('dataFusion.sectionIntros.graph')
          )}
        </p>
      </header>

      {/* Ask the graph. It leaves for the Copilot rather than pretending to
          answer here — there is no query engine behind this, and a box that
          returned a canned paragraph would be the one dishonest thing on the
          screen. */}
      <form onSubmit={ask} className="mb-4 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge">
          <Icon name="ai" size="sm" className="text-on-forge" />
          <label className="sr-only" htmlFor="graph-ask">
            {t('dataFusion.graph.askLabel')}
          </label>
          <input
            id="graph-ask"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t('dataFusion.graph.askPlaceholder')}
            className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
          />
        </div>
        <ForgeButton type="submit" variant="primary" disabled={!question.trim()}>
          {t('dataFusion.graph.ask')}
        </ForgeButton>
      </form>

      {graph.isPending ? (
        <SkeletonRows count={5} />
      ) : graph.isError ? (
        <ErrorState
          error={graph.error}
          title={t('dataFusion.graph.loadFailed')}
          onRetry={graph.refetch}
        />
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
            <ForgeSelect
              id="graph-focus"
              size="sm"
              label={t('dataFusion.graph.focusLabel')}
              value={focusId ?? ''}
              onValueChange={setFocusId}
              className="w-[20rem] max-sm:w-full"
              options={entities.map((entity) => ({
                value: entity.id,
                label: `${entity.name} · ${entity.code}`,
              }))}
            />
            {hood ? (
              <p className="m-0 text-body-sm text-ink-dim">
                <Num>
                  {t('dataFusion.graph.degree', {
                    count: hood.groups.reduce((sum, group) => sum + group.total, 0),
                  })}
                </Num>
              </p>
            ) : null}
          </div>

          {node.isError ? (
            <ErrorState
              error={node.error}
              title={t('dataFusion.graph.nodeFailed')}
              onRetry={node.refetch}
            />
          ) : hood ? (
            <div className="grid grid-cols-[1fr_18rem] items-start gap-3.5 max-lg:grid-cols-1">
              <Panel className="min-w-0">
                <Canvas hood={hood} />
              </Panel>

              <Panel className="min-w-0">
                <Eyebrow className="mb-2.5">{t('dataFusion.graph.legend')}</Eyebrow>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {hood.groups.map((group) => (
                    <li key={group.kind} className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-pill"
                        style={{ background: `var(--hue-${KIND_TONE[group.kind]})` }}
                      />
                      <span className="min-w-0 flex-1 text-body-sm text-ink">
                        {t(`dataFusion.graph.rel.${group.rel}`)}
                      </span>
                      <Num className="shrink-0 text-body-sm text-ink-dim">
                        {group.shown < group.total
                          ? t('dataFusion.graph.someOf', {
                              shown: group.shown,
                              total: group.total,
                            })
                          : formatInteger(group.total)}
                      </Num>
                    </li>
                  ))}
                </ul>

                {hood.groups.some((group) => group.shown < group.total) ? (
                  <p className="mt-3 mb-0 border-t border-subtle pt-3 text-micro font-normal text-ink-dim">
                    {t('dataFusion.graph.cappedNote')}
                  </p>
                ) : null}
              </Panel>
            </div>
          ) : (
            <SkeletonRows count={5} />
          )}
        </>
      )}
    </div>
  )
}

const KIND_TONE = {
  asset: 'dismissed',
  line: 'ack',
  site: 'green',
  sensor: 'forge',
  document: 'violet',
  media: 'watch',
  source: 'amber',
  workOrder: 'amber',
  anomaly: 'red',
}

/** Where each kind of node goes when you click it. */
const HREF = {
  asset: (node) => `/app/assets/${node.id}`,
  line: (node) => `/app/assets/${node.id}`,
  site: () => '/app/executive',
  sensor: () => '/app/sensors',
  document: () => '/app/data-fusion/documents',
  media: () => '/app/data-fusion/media',
  source: () => '/app/data-fusion/ot',
  workOrder: () => '/app/work-orders',
  anomaly: (node) => `/app/anomalies/${node.id}`,
}

/**
 * The picture.
 *
 * An SVG for the edges, HTML for the nodes, positioned over it. Text inside an
 * SVG does not wrap, does not take the app's type scale without being told, and
 * cannot be a router link — three problems that all go away by drawing only the
 * lines in SVG and putting the nodes on top as ordinary elements.
 */
function Canvas({ hood }) {
  const { t } = useTranslation('app')

  return (
    <div className="relative aspect-[16/10] w-full min-h-[22rem]">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 size-full"
      >
        {hood.nodes.map((node) => (
          <line
            key={node.id}
            x1="50"
            y1="50"
            x2={node.x}
            y2={node.y}
            stroke="var(--border-hairline)"
            strokeWidth="0.3"
          />
        ))}
      </svg>

      {/* The focus. Larger and named in full, because everything else on the
          canvas is described relative to it. */}
      <span
        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
        style={{ insetInlineStart: '50%', top: '50%' }}
      >
        <span
          className={cn(
            'flex size-12 items-center justify-center rounded-full border-2 border-forge',
            TINT_CLASS.dismissed,
          )}
        >
          <Icon name="factory" size="md" className={ON_TINT_CLASS.dismissed} />
        </span>
        <span className="rounded-sm bg-card px-1.5 text-body-sm font-semibold whitespace-nowrap text-ink">
          {hood.focus.name}
        </span>
        <Mono className="rounded-sm bg-card px-1.5 text-micro text-ink-dim">
          {hood.focus.code}
        </Mono>
      </span>

      {hood.nodes.map((node) => (
        <Link
          key={node.id}
          to={HREF[node.kind](node)}
          title={t(`dataFusion.graph.rel.${node.rel}`)}
          className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-sm p-1 transition-colors hover:bg-sunken"
          style={{ insetInlineStart: `${node.x}%`, top: `${node.y}%` }}
        >
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-full border border-hairline',
              TINT_CLASS[node.tone],
            )}
          >
            <Icon name={node.icon} size="xs" className={ON_TINT_CLASS[node.tone]} />
          </span>
          {/* Two lines maximum. A document title is long, and a graph where one
              label pushes into three neighbours is unreadable. */}
          <span className="line-clamp-2 text-center text-micro font-normal text-ink-dim">
            {node.name}
          </span>
        </Link>
      ))}
    </div>
  )
}
