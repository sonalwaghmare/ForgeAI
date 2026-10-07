import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Icon } from '@/components/forge/Icon'
import { IconButton } from '@/components/forge/ForgeButton'
import { Meter } from '@/components/forge/Meter'
import { Panel } from '@/components/forge/Panel'
import { EmptyState } from '@/components/forge/States'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The plant, drawn.
 *
 * DEMO. Every asset the table shows, arranged by floor and line, with the
 * material flow along each lane. Same records, same filters — this is a second
 * projection of the collection, not a second collection.
 *
 * ── What a map is for here ────────────────────────────────────────────────
 * The table answers "which assets match", and it is better at that. The map
 * answers "where", and specifically "is the trouble spread across the plant or
 * concentrated on one lane" — which is the question the table cannot be made to
 * answer however it is sorted. It earns its place by being the only view where
 * position carries meaning.
 *
 * ── Floors come from the lines ────────────────────────────────────────────
 * The prototype hardcodes three floors and shows an empty one when nothing is
 * there. Here the tabs are derived from the lines the site actually has, so
 * there is no chip that leads nowhere.
 */

const ZOOM_MIN = 70
const ZOOM_MAX = 130
const ZOOM_STEP = 10

/** Severity of an asset, for the station ring. Offline is absence, not fault. */
function severityOf(asset) {
  if (asset.alerts.worst === 'critical') return 'red'
  if (asset.alerts.worst === 'high') return 'amber'
  if (asset.alerts.worst) return 'watch'
  if (!asset.online) return null
  return 'green'
}

export function AssetFloorMap({ assets, lines, onOpenLine }) {
  const { t } = useTranslation(['app', 'common'])

  const floors = useMemo(
    () => [...new Set(lines.map((line) => line.floor ?? 1))].sort((a, b) => a - b),
    [lines],
  )
  const [floor, setFloor] = useState(floors[0] ?? 1)
  const [zoom, setZoom] = useState(100)
  const [hovered, setHovered] = useState(null)

  const active = floors.includes(floor) ? floor : floors[0]
  const floorLines = lines.filter((line) => (line.floor ?? 1) === active)
  const label = (value) =>
    value === 3 ? t('assets.map.mezzanine') : t('assets.map.floor', { number: value })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-hairline bg-card px-3.5 py-2.5">
        <Icon name="map" size="sm" className="shrink-0 text-on-forge" />
        <Eyebrow>{t('assets.map.floorLabel')}</Eyebrow>
        <div role="group" aria-label={t('assets.map.floorLabel')} className="flex flex-wrap gap-1.5">
          {floors.map((entry) => (
            <Chip key={entry} selected={entry === active} onClick={() => setFloor(entry)}>
              {label(entry)}
              <Num className="text-ink-mute">
                {formatInteger(lines.filter((line) => (line.floor ?? 1) === entry).length)}
              </Num>
            </Chip>
          ))}
        </div>
        <span className="ms-auto text-micro font-normal text-ink-dim">{t('assets.map.hint')}</span>
      </div>

      <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:minmax(0,1fr)_minmax(14rem,16rem)]">
        <Panel className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Eyebrow className="flex-1">
              {t('assets.map.layout', { floor: label(active) })}
            </Eyebrow>
            <div className="flex items-center gap-1">
              <IconButton
                label={t('assets.map.zoomOut')}
                onClick={() => setZoom((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP))}
                disabled={zoom <= ZOOM_MIN}
              >
                <Icon name="minus" size="xs" />
              </IconButton>
              <button
                type="button"
                onClick={() => setZoom(100)}
                aria-label={t('assets.map.zoomReset')}
                className="num rounded-sm border border-hairline bg-card px-2 py-1 text-body-sm text-ink-dim transition-colors hover:border-forge hover:text-ink"
              >
                {zoom}%
              </button>
              <IconButton
                label={t('assets.map.zoomIn')}
                onClick={() => setZoom((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP))}
                disabled={zoom >= ZOOM_MAX}
              >
                <Icon name="plus" size="xs" />
              </IconButton>
            </div>
          </div>

          {floorLines.length === 0 ? (
            <EmptyState
              icon="map"
              title={t('assets.map.empty')}
              className="border-0 bg-transparent shadow-none"
            />
          ) : (
            /* The zoom scales the drawing, and the wrapper scrolls when it grows
               past the card — a zoom that reflows instead of magnifying is a
               font-size control wearing a magnifying glass. */
            <div className="overflow-auto">
              <div
                className="flex flex-col gap-3 origin-top-left transition-transform"
                style={{ transform: `scale(${zoom / 100})`, width: `${(100 / zoom) * 100}%` }}
              >
                {floorLines.map((line) => (
                  <Lane
                    key={line.id}
                    line={line}
                    assets={assets.filter((asset) => asset.lineId === line.id)}
                    hovered={hovered}
                    onHover={setHovered}
                    onOpenLine={onOpenLine}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* The readout sits inside the card rather than floating over the app.
              The prototype pins it to the viewport, which puts a tooltip over
              whatever else the reader had on screen. */}
          {hovered ? <StationReadout asset={hovered} t={t} /> : null}
        </Panel>

        <Panel flush className="self-start">
          <div className="border-b border-hairline px-4.5 py-3">
            <Eyebrow>{t('assets.map.summary')}</Eyebrow>
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {floorLines.map((line) => {
              const lineAssets = assets.filter((asset) => asset.lineId === line.id)
              const counts = {
                critical: lineAssets.filter((asset) => asset.alerts.critical).length,
                high: lineAssets.filter((asset) => asset.alerts.high).length,
                offline: lineAssets.filter((asset) => !asset.online).length,
              }
              const clean = !counts.critical && !counts.high && !counts.offline
              return (
                <li key={line.id} className="border-b border-subtle last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onOpenLine(line.id)}
                    className="w-full px-4 py-2.5 text-start transition-colors hover:bg-sunken"
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-body-sm font-medium">
                        {line.name}
                      </span>
                      <Num className="shrink-0 text-micro text-ink-dim">
                        {formatInteger(lineAssets.length)}
                      </Num>
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {counts.critical ? (
                        <StateBadge tone="red" dot={false}>
                          <Num>{formatInteger(counts.critical)}</Num>
                        </StateBadge>
                      ) : null}
                      {counts.high ? (
                        <StateBadge tone="amber" dot={false}>
                          <Num>{formatInteger(counts.high)}</Num>
                        </StateBadge>
                      ) : null}
                      {counts.offline ? (
                        <StateBadge tone={null} dot={false}>
                          <Num>{t('assets.map.offline', { count: counts.offline })}</Num>
                        </StateBadge>
                      ) : null}
                      {clean ? (
                        <span className="text-micro font-normal text-ink-dim">
                          {t('assets.map.allNormal')}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

/**
 * One production line as a lane.
 *
 * The track behind the stations is the material flow, and it is drawn once
 * across the whole lane rather than between each pair — the line is continuous,
 * and segments between stations would imply the gaps are the interesting part.
 */
function Lane({ line, assets, hovered, onHover, onOpenLine, t }) {
  const worst = assets.some((asset) => asset.alerts.critical)
    ? 'red'
    : assets.some((asset) => asset.alerts.high)
      ? 'amber'
      : null

  return (
    <section
      className={cn(
        'rounded-sm border bg-sunken p-3.5',
        worst ? 'border-current/30' : 'border-hairline',
      )}
      style={worst ? { borderColor: `color-mix(in srgb, var(--hue-${worst}) 40%, transparent)` } : undefined}
    >
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Dot tone={worst ?? 'green'} size={7} />
        <button
          type="button"
          onClick={() => onOpenLine(line.id)}
          className="text-body-sm font-semibold hover:text-on-forge"
        >
          {line.name}
        </button>
        <Num className="text-micro font-normal text-ink-dim">
          {t('assets.map.lineAssets', { count: assets.length })}
        </Num>
        {line.building ? (
          <span className="ms-auto text-micro font-normal text-ink-dim">{line.building}</span>
        ) : null}
      </div>

      <ol
        aria-label={t('assets.map.flow', { count: assets.length })}
        className="relative m-0 flex list-none items-start gap-1 p-0"
      >
        {/* The flow track. Behind the stations, inset so it does not run out
            past the first and last of them. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-6 top-4 h-[3px] rounded-pill"
          style={{
            background:
              'linear-gradient(90deg, color-mix(in srgb, var(--hue-forge) 45%, transparent), color-mix(in srgb, var(--hue-violet) 45%, transparent))',
          }}
        />
        {assets.map((asset) => (
          <li key={asset.id} className="relative z-1 min-w-0 flex-1">
            <Station asset={asset} hovered={hovered} onHover={onHover} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function Station({ asset, hovered, onHover }) {
  const tone = severityOf(asset)
  const pulsing = asset.alerts.total > 0

  return (
    <Link
      to={`/app/assets/${asset.id}`}
      onMouseEnter={() => onHover(asset)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(asset)}
      onBlur={() => onHover(null)}
      className="flex flex-col items-center gap-1.5"
    >
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-sm border-2 bg-card transition-transform',
          hovered?.id === asset.id && 'scale-110',
          // `currentColor` is what the keyframe expands into a ring, so the tone
          // is set once here and the animation stays hue-agnostic.
          pulsing && 'animate-alert-ring',
        )}
        style={{
          borderColor: tone ? `var(--hue-${tone})` : 'var(--ink-mute)',
          color: tone ? `color-mix(in srgb, var(--hue-${tone}) 22%, transparent)` : 'transparent',
        }}
      >
        <Icon
          name="machine"
          size="xs"
          className={cn(!tone && 'text-ink-mute')}
          style={tone ? { color: `var(--on-${tone})` } : undefined}
        />
      </span>
      <Mono className="max-w-full truncate text-[0.5625rem] text-ink-dim">
        {asset.code.split('-').slice(-2).join('-')}
      </Mono>
    </Link>
  )
}

function StationReadout({ asset, t }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border border-hairline bg-sunken px-3.5 py-2.5">
      <Eyebrow className="sr-only">{t('assets.map.hover')}</Eyebrow>
      <span className="min-w-0">
        <span className="block text-body-sm font-semibold">{asset.name}</span>
        <Mono className="mt-0.5 block text-micro text-ink-dim">{asset.code}</Mono>
      </span>
      <span className="text-body-sm text-ink-dim">
        {t(`lines.type.${asset.type}`, { defaultValue: asset.type })}
      </span>
      <Meter value={asset.health} label={t('lines.row.health')} compact />
      {asset.alerts.total ? (
        <StateBadge tone={asset.alerts.worst === 'critical' ? 'red' : 'amber'} dot={false}>
          <Num>{formatInteger(asset.alerts.total)}</Num>
        </StateBadge>
      ) : null}
      <span className="ms-auto inline-flex items-center gap-1.5 text-micro font-normal text-ink-dim">
        {asset.online ? (
          <Dot tone="green" size={6} />
        ) : (
          <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-ink-mute" />
        )}
        {t(asset.online ? 'lines.row.online' : 'lines.row.offline')}
      </span>
    </div>
  )
}
