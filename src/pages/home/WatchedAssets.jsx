import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { SignalTrace } from '@/components/forge/SignalTrace'
import { SkeletonRows } from '@/components/forge/States'
import { Dot, Eyebrow, Measure, Mono } from '@/components/forge/primitives'
import { useWatchedAssets } from '@/features/home/queries'
import { cn } from '@/lib/cn'

/**
 * Live monitoring — the watched-assets carousel from the prototype.
 *
 * DEMO. Three assets the shift is actively watching, each with the one signal
 * that put it there.
 *
 * ── The rotation, and why it can be stopped ────────────────────────────────
 * The prototype advances every four seconds and pauses on hover. Hover alone is
 * not enough: a keyboard user reading the third trace has no way to stop it
 * moving under them, and neither does anyone who has asked their OS to reduce
 * motion. So it pauses on hover AND on focus, and it does not start at all when
 * `prefers-reduced-motion` is set. The dots and arrows still work in every case,
 * which is what makes stopping it safe — the content is reachable without the
 * animation.
 */

const ROTATE_MS = 4000

export function WatchedAssets() {
  const { t } = useTranslation(['app', 'common'])
  const watched = useWatchedAssets()
  const items = watched.data ?? []

  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (held || items.length < 2) return undefined
    // Read at effect time rather than at module load: someone can turn the OS
    // setting on while the tab is open, and a value captured once would ignore it
    // until reload.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = setInterval(() => setIndex((current) => (current + 1) % items.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [held, items.length])

  // A refetch that returns fewer assets than the index we are sitting on would
  // otherwise render nothing at all.
  const active = items[Math.min(index, Math.max(0, items.length - 1))]

  return (
    <Panel>
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Eyebrow className="flex-1">{t('home.dashboard.watched')}</Eyebrow>
        <span className="inline-flex items-center gap-1.5 rounded-pill tint-green px-2.5 py-0.5 text-micro text-on-green">
          <Dot tone="green" size={6} />
          {t('home.dashboard.streaming')}
        </span>
        <ForgeButton asChild size="sm">
          <Link to="/app/sensors" aria-label={t('home.dashboard.openSensors')}>
            <Icon name="right" size="xs" className="mirror-rtl" />
          </Link>
        </ForgeButton>
      </div>

      {watched.isPending || !active ? (
        <SkeletonRows count={1} />
      ) : (
        <div
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocusCapture={() => setHeld(true)}
          onBlurCapture={() => setHeld(false)}
        >
          <div className="mb-2 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-control text-ink">{active.name}</p>
              <p className="m-0 mt-0.5 text-micro font-normal text-ink-dim">
                <Mono>{active.id}</Mono> · {active.lineName} · {active.sensor}
              </p>
            </div>
            <Measure
              measure={active.reading}
              className="text-headline"
              style={{ color: `var(--on-${active.tone})` }}
            />
          </div>

          <SignalTrace
            // Keyed so React tears the chart down between assets instead of
            // morphing one trace into the next, which reads as the signal itself
            // changing rather than the subject.
            key={active.id}
            values={active.values}
            threshold={active.threshold}
            normalBand={active.normalBand}
            anomalyFrom={active.anomalyFrom ?? undefined}
            unit={active.reading.unit}
            label={`${active.name} · ${active.sensor}`}
          />

          {items.length > 1 ? (
            <div className="mt-3 flex items-center gap-2">
              <IconButton
                bare
                label={t('home.dashboard.watchedPrevious')}
                className="size-8"
                onClick={() => setIndex((current) => (current - 1 + items.length) % items.length)}
              >
                <Icon name="right" size="sm" className="rotate-180 rtl:rotate-0" />
              </IconButton>

              <div className="flex flex-1 justify-center gap-1.5">
                {items.map((item, position) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={t('home.dashboard.watchedGoTo', { name: item.name })}
                    aria-current={position === index}
                    onClick={() => setIndex(position)}
                    className={cn(
                      'h-1.5 rounded-pill transition-all',
                      position === index ? 'w-4.5 bg-forge' : 'w-1.5 bg-hairline hover:bg-ink-mute',
                    )}
                  />
                ))}
              </div>

              <IconButton
                bare
                label={t('home.dashboard.watchedNext')}
                className="size-8"
                onClick={() => setIndex((current) => (current + 1) % items.length)}
              >
                <Icon name="right" size="sm" className="mirror-rtl" />
              </IconButton>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  )
}
