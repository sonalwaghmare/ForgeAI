import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useMyAssets } from '@/features/home/queries'
import { STATE_TONE, toneForHealth } from '@/lib/tone'
import { formatInteger } from '@/lib/format'

/**
 * My assets — the prototype's table of what this person is responsible for.
 *
 * DEMO.
 *
 * A table and not cards: five columns of the same five facts about six machines
 * is exactly what a table is for, and the health bar only means anything when
 * the bars line up under each other.
 */
export function MyAssetsTable() {
  const { t } = useTranslation(['app', 'common'])
  const assets = useMyAssets()

  return (
    <Panel flush>
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <Eyebrow className="flex-1">{t('home.dashboard.myAssets')}</Eyebrow>
        <ForgeButton asChild size="sm">
          <Link to="/app/assets" aria-label={t('home.dashboard.openAssets')}>
            <Icon name="right" size="xs" className="mirror-rtl" />
          </Link>
        </ForgeButton>
      </div>

      {assets.isPending ? (
        <div className="p-4">
          <SkeletonRows count={4} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="bg-sunken">
                {['asset', 'state', 'health', 'lastEvent'].map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="eyebrow border-b border-hairline px-4 py-2.5 text-start whitespace-nowrap"
                  >
                    {t(`home.dashboard.assetColumns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(assets.data ?? []).map((asset) => {
                const healthTone = toneForHealth(asset.health)
                const stateTone = STATE_TONE[asset.state] ?? 'green'
                return (
                  <tr key={asset.id} className="border-b border-subtle last:border-b-0 even:bg-row-alt">
                    <td className="px-4 py-2.5">
                      <span className="block font-semibold text-ink">{asset.name}</span>
                      <Mono className="block text-micro text-ink-dim">{asset.id}</Mono>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-micro"
                        style={{
                          color: `var(--on-${stateTone})`,
                          backgroundColor: `color-mix(in srgb, var(--hue-${stateTone}) calc(var(--tint) * 100%), transparent)`,
                        }}
                      >
                        {t(`common:state.${asset.state}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        {/* The bar is the comparison; the number is the value. Both,
                            because a bar alone cannot be read out and a number alone
                            cannot be scanned down a column. */}
                        <span
                          role="presentation"
                          className="h-1.5 w-16 shrink-0 overflow-hidden rounded-pill bg-hairline"
                        >
                          <span
                            className="block h-full rounded-pill"
                            style={{
                              width: `${asset.health}%`,
                              backgroundColor: `var(--hue-${healthTone})`,
                            }}
                          />
                        </span>
                        <Num className="font-semibold" style={{ color: `var(--on-${healthTone})` }}>
                          {formatInteger(asset.health)}
                        </Num>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-dim">
                      {asset.openWorkOrders > 0
                        ? t('home.dashboard.openWorkOrders', { count: asset.openWorkOrders })
                        : t('home.dashboard.noEvent')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
