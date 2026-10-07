import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { TrendChart } from '@/components/forge/TrendChart'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { useFusionOverview } from '@/features/dataFusion/sources'
import { useConnections } from '@/features/dataFusion/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatCompact, formatInteger } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS, toneForHealth } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { fusionPath } from './sections'

/**
 * Data Overview — the module's landing screen.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── Every number here is a count of something, and can be clicked into ────
 * This screen was built after the source tables and the document registry, not
 * before them, and that ordering is the whole design. A KPI card is the easiest
 * place in a product to put a figure nobody can trace: the prototype prints
 * `graphEntities: 18.4k` beside four other round numbers, and there is no way to
 * open any of them and no way for any of them to be wrong.
 *
 * Here the connection figure is the registry's own connected-over-total, the tag
 * figure is what the streaming families carry, documents and media are registry
 * lengths, and the graph total is the estate plus its signals plus its records.
 * Each card and each category row links to the screen holding what it counted.
 *
 * ── Headline figures are abbreviated; nothing else is ─────────────────────
 * 11.4k and 28M rather than 11,432 and 28,018,672. The exact digits are not the
 * point in a KPI tile and their width is: the full figure wraps, dominates the
 * card and invites a comparison nobody will act on. The tables print all of it,
 * because that is where a number is meant to be reconciled.
 *
 * ── The IoT row comes from the live API, not from the fixture ─────────────
 * IoT & Sensors is built against `/v1/connections`, so its count is the only one
 * on this page the fixture cannot produce. Joining the two here — the one place
 * that reads both transports — is what stops this screen and that one disagreeing
 * about how many gateways exist. If the live query has not landed, the row says
 * so rather than guessing.
 */
export function FusionOverviewPage() {
  const { t } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('dataFusion.sections.overview')} · ${t('common:brand.name')}`)

  const overview = useFusionOverview()
  const connections = useConnections()

  const data = overview.data

  /**
   * The five families in the design's order, with IoT spliced in from the live
   * resource. Its counts are `isActive` over the whole collection, which is the
   * same fact the IoT table's own state column shows.
   */
  const families = useMemo(() => {
    if (!data) return []
    const iotRows = connections.data?.items ?? []
    const iot = {
      id: 'iot',
      section: 'iot',
      total: iotRows.length,
      connected: iotRows.filter((row) => row.isActive).length,
      tags: null,
      unit: null,
      resolved: connections.isSuccess,
    }
    iot.share = iot.total ? Math.round((iot.connected / iot.total) * 100) : 0

    const byId = new Map(data.families.map((family) => [family.id, { ...family, resolved: true }]))
    return ['ot', 'iot', 'biz', 'db', 'vision']
      .map((id) => (id === 'iot' ? iot : byId.get(id)))
      .filter(Boolean)
  }, [data, connections.data, connections.isSuccess])

  /* The headline connection figure spans both transports too, so it is summed
     from the same rows the category list draws rather than taken from either
     side alone. */
  const totals = useMemo(
    () => ({
      total: families.reduce((sum, family) => sum + family.total, 0),
      connected: families.reduce((sum, family) => sum + family.connected, 0),
    }),
    [families],
  )

  if (overview.isPending) {
    return (
      <div className="px-8 py-6 max-xl:px-5.5">
        <Header t={t} />
        <SkeletonRows count={5} />
      </div>
    )
  }

  if (overview.isError) {
    return (
      <div className="px-8 py-6 max-xl:px-5.5">
        <Header t={t} />
        <ErrorState
          error={overview.error}
          title={t('dataFusion.overview.loadFailed')}
          onRetry={overview.refetch}
        />
      </div>
    )
  }

  const attention = data.attention
  const stats = data.ingestStats

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <Header t={t} />

      {/* Five figures across the top. No icons: the label already names the
          thing, and a glyph beside every one of five identical tiles is
          decoration that costs a line of height each. */}
      <div className="mb-3.5 grid grid-cols-5 gap-3 max-xl:grid-cols-3 max-sm:grid-cols-2">
        <StatCard
          to={fusionPath('ot')}
          label={t('dataFusion.overview.cards.connections')}
          value={t('dataFusion.overview.cards.connectionsValue', {
            connected: totals.connected,
            total: totals.total,
          })}
          sub={
            data.sources.attention
              ? t('dataFusion.overview.cards.connectionsAttention', {
                  count: data.sources.attention,
                })
              : t('dataFusion.overview.cards.connectionsClear')
          }
          /* Orange only when something is wrong. A figure that is always
             coloured is a figure whose colour carries nothing. */
          accent={data.sources.attention > 0}
        />
        <StatCard
          to={fusionPath('ot')}
          label={t('dataFusion.overview.cards.tags')}
          value={formatCompact(data.streamingTags)}
          sub={t('dataFusion.overview.cards.tagsSub', {
            points: formatCompact(stats.pointsPerDay),
          })}
        />
        <StatCard
          to={fusionPath('documents')}
          label={t('dataFusion.overview.cards.documents')}
          value={formatInteger(data.knowledge.documents)}
          sub={
            data.knowledge.unverified
              ? t('dataFusion.overview.cards.documentsSub', {
                  count: data.knowledge.unverified,
                })
              : t('dataFusion.overview.cards.documentsClear')
          }
          accent={data.knowledge.unverified > 0}
        />
        <StatCard
          to={fusionPath('media')}
          label={t('dataFusion.overview.cards.media')}
          value={formatInteger(data.knowledge.media)}
          sub={t('dataFusion.overview.cards.mediaSub', {
            size: formatInteger(Math.round(data.knowledge.cadKb / 1024)),
          })}
        />
        <StatCard
          to={fusionPath('graph')}
          label={t('dataFusion.overview.cards.graph')}
          value={formatCompact(data.graph.entityTotal)}
          sub={t('dataFusion.overview.cards.graphSub', {
            count: formatCompact(data.graph.relationshipTotal),
          })}
        />
      </div>

      <div className="grid grid-cols-[1fr_22rem] items-start gap-3.5 max-xl:grid-cols-1">
        {/* The categories list is the screen's main surface: five rows, each one
            a way into a family. */}
        <Panel flush className="min-w-0">
          <Eyebrow className="border-b border-hairline px-4 py-3">
            {t('dataFusion.overview.families.title')}
          </Eyebrow>
          <ul className="m-0 flex list-none flex-col p-0">
            {families.map((family) => (
              <li key={family.id} className="border-b border-subtle last:border-b-0">
                <Link
                  to={fusionPath(family.section)}
                  className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-sunken"
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-sm',
                      TINT_CLASS[FAMILY_TONE[family.id]],
                    )}
                  >
                    <Icon
                      name={FAMILY_ICON[family.id]}
                      size="sm"
                      className={ON_TINT_CLASS[FAMILY_TONE[family.id]]}
                    />
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-body-sm font-semibold text-ink">
                      {t(`dataFusion.overview.families.name.${family.id}`)}
                    </span>
                    <span className="text-micro font-normal text-ink-dim">
                      {family.resolved ? (
                        <Num>
                          {t('dataFusion.overview.families.connected', {
                            connected: family.connected,
                            total: family.total,
                          })}
                        </Num>
                      ) : (
                        t('dataFusion.overview.families.unresolved')
                      )}
                    </span>
                  </span>

                  {family.resolved ? (
                    <ShareBar value={family.share} />
                  ) : (
                    <span className="w-[5.5rem] shrink-0" />
                  )}

                  <Icon
                    name="right"
                    size="xs"
                    className="shrink-0 text-ink-mute rtl:rotate-180"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="flex min-w-0 flex-col gap-3.5">
          <Panel>
            <Eyebrow className="mb-3">{t('dataFusion.overview.attention.title')}</Eyebrow>
            {attention.length ? (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {attention.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      to={fusionPath(item.section)}
                      className="flex items-start gap-2.5 rounded-sm -mx-2 px-2 py-1 transition-colors hover:bg-sunken"
                    >
                      {/* A dot, not a glyph. Five different icons in a five-item
                          list is five things to decode; the dot's hue says only
                          how urgent, which is all the list is sorted by. */}
                      <span
                        aria-hidden="true"
                        className="mt-[7px] size-2 shrink-0 rounded-pill"
                        style={{ background: `var(--hue-${ATTENTION_TONE[item.kind]})` }}
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-body-sm font-semibold text-ink">{item.name}</span>
                        <span className="text-micro font-normal text-ink-dim">
                          <AttentionReason item={item} />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              /* Not an EmptyState panel — an empty attention list is the good
                 outcome, not a missing screen, and drawing it as an error-shaped
                 block would read as one. */
              <p className="m-0 text-body-sm text-ink-dim">
                {t('dataFusion.overview.attention.clear')}
              </p>
            )}
          </Panel>

          <Panel>
            <Eyebrow className="mb-2.5">{t('dataFusion.overview.ingest.title')}</Eyebrow>
            {/* Muted rather than Forge Orange. The accent is this product's
                identity and interaction colour; a 24-hour volume trace is
                neither, and colouring it competes with the one orange figure in
                the row of cards above that actually means something. */}
            <TrendChart
              series={[
                {
                  key: 'ingest',
                  label: t('dataFusion.overview.ingest.seriesLabel'),
                  values: data.ingest.map((point) => point.value),
                  tone: 'muted',
                },
              ]}
              label={t('dataFusion.overview.ingest.chartLabel')}
              format={(value) => formatCompact(Math.round(value))}
              xLabel={t('dataFusion.overview.ingest.hour')}
              xTicks={data.ingest
                .filter((_, index) => index % 8 === 0)
                .map((point) => `${String(point.hour).padStart(2, '0')}:00`)}
              legend={false}
              axis
              /* Wider than the default: this series is in the millions and this
                 is a 22rem column, so "1.5M" needs about twice the gutter "84"
                 does on a full-width card. */
              axisWidth={104}
            />
            <p className="mt-2.5 mb-0 text-micro font-normal text-ink-dim">
              <Num>
                {t('dataFusion.overview.ingest.footnote', {
                  peak: formatCompact(stats.peakPerHour),
                  lag: stats.avgLagSeconds,
                })}
              </Num>
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Header({ t }) {
  return (
    <header className="mb-5">
      <h1 className="m-0 text-headline">{t('dataFusion.sections.overview')}</h1>
      <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
        {t('dataFusion.sectionIntros.overview')}
      </p>
    </header>
  )
}

/**
 * Hues for the five families.
 *
 * `dismissed` is the token that holds this palette's #0A84FF, which is the blue
 * the design gives OT. The name is about anomalies rather than about the hue,
 * and reusing it here is cheaper than a sixth blue that would then have to be
 * kept in step with this one. Nothing on this screen is an anomaly status, so
 * there is nothing for it to be confused with.
 */
const FAMILY_TONE = {
  ot: 'dismissed',
  iot: 'forge',
  biz: 'green',
  db: 'violet',
  vision: 'amber',
}

const FAMILY_ICON = { ot: 'gauge', iot: 'bolt', biz: 'wrench', db: 'layers', vision: 'eye' }

/** Dot hues on the attention list, by how much the entry matters. */
const ATTENTION_TONE = {
  sourceDown: 'red',
  sourceStale: 'amber',
  sourceUnconfigured: 'amber',
  docExpiring: 'amber',
  docUnverified: 'forge',
}

/**
 * The proportion of a family that is connected.
 *
 * Its own component rather than `Meter` because this bar carries no number
 * beside it — the "4 of 6 connected" line under the name already is the number,
 * and printing 67 as well would say the same thing twice in one row. `Meter`
 * makes the figure mandatory for good reasons that do not hold here.
 */
function ShareBar({ value }) {
  const { t } = useTranslation('app')
  const tone = toneForHealth(value) ?? 'green'

  return (
    <span
      role="meter"
      aria-label={t('dataFusion.overview.families.meterLabel', { percent: value })}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="inline-block h-1.5 w-[5.5rem] shrink-0 overflow-hidden rounded-pill bg-sunken"
    >
      <span
        className="block h-full rounded-pill"
        style={{ inlineSize: `${value}%`, background: `var(--hue-${tone})` }}
      />
    </span>
  )
}

/**
 * Why something is on the attention list, in its own words.
 *
 * Five reasons and five sentences rather than one generic "needs attention" —
 * "TLS handshake failed" and "nobody has verified this" call for different
 * actions, and a list that flattens them makes the reader open each row to find
 * out which they are looking at.
 */
function AttentionReason({ item }) {
  const { t } = useTranslation('app')

  if (item.kind === 'sourceDown') {
    return t('dataFusion.overview.attention.sourceDown', {
      reason: t(`dataFusion.sources.error.${item.detail}`),
    })
  }
  if (item.kind === 'sourceStale') {
    return t('dataFusion.overview.attention.sourceStale', { minutes: item.minutes })
  }
  if (item.kind === 'sourceUnconfigured') {
    return t('dataFusion.overview.attention.sourceUnconfigured')
  }
  if (item.kind === 'docExpiring') {
    return t('dataFusion.overview.attention.docExpiring', { days: item.days })
  }
  return t('dataFusion.overview.attention.docUnverified')
}

/**
 * One KPI tile.
 *
 * Hand-rolled rather than `MetricCard`: that component leads with an icon tile
 * and a sentence-case label, which is right on the OEE and Executive screens
 * where a card carries a delta and a trend. Here the design puts an uppercase
 * eyebrow over a large figure with nothing else in the tile, and bending
 * `MetricCard` into that shape would mean adding two props that only this screen
 * would ever pass.
 */
function StatCard({ to, label, value, sub, accent = false }) {
  return (
    <Link
      to={to}
      className="rounded-sm border border-hairline bg-card px-4 py-3.5 shadow-edge transition-colors hover:border-forge/40"
    >
      <Eyebrow>{label}</Eyebrow>
      <p
        className={cn(
          'mt-2 mb-1 text-headline leading-none',
          accent ? 'text-on-forge' : 'text-ink',
        )}
      >
        <Num>{value}</Num>
      </p>
      <p className="m-0 text-body-sm text-ink-dim">
        <Num>{sub}</Num>
      </p>
    </Link>
  )
}
