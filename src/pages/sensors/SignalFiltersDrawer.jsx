import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDrawer } from '@/components/forge/ForgeDrawer'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { STREAM_FILTERS } from '@/features/signals/api'
import { formatInteger, formatRelative } from '@/lib/format'

/**
 * The More Filters drawer.
 *
 * DEMO. Edits a draft; **Apply** commits it — the same split as
 * `AssetFiltersDrawer`, for the same reason: the toolbar is the
 * filter-as-you-click surface and this panel is where several are set at once.
 *
 * ── Two departures from the prototype's drawer ────────────────────────────
 * **No Site control.** The prototype puts one here and another in the scope
 * selector six inches above it, so a reader can set two site filters that
 * disagree. The scope selector owns that axis.
 *
 * **Source system is a statement, not a select.** The prototype offers SCADA /
 * PLC, OSIsoft PI, MQTT / IoT and MES / ERP. Our universe has three connected
 * systems and exactly one of them declares `signals` among what it provides —
 * the MES row goes as far as declaring `doesNotProvide: ['vibration']`. Three of
 * those four options would therefore match nothing, silently. So the panel says
 * where these readings come from and when it last synced, which is the useful
 * half of what a source filter is for.
 *
 * Stream status keeps its control and prints its counts, including the zero.
 * Nothing at Meridian is offline today, and a labelled zero says that; an option
 * that quietly returns nothing does not.
 */
export function SignalFiltersDrawer({
  open,
  draft,
  options,
  facets,
  source,
  onChange,
  onApply,
  onClear,
  onClose,
}) {
  const { t } = useTranslation(['app', 'common'])

  const set = (key, value) => onChange({ ...draft, [key]: value })

  return (
    <ForgeDrawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('sensors.drawer.title')}
      closeLabel={t('common:actions.close')}
      footer={
        <>
          <ForgeButton className="flex-1" onClick={onClear}>
            {t('sensors.drawer.clear')}
          </ForgeButton>
          <ForgeButton variant="primary" className="flex-1" onClick={onApply}>
            {t('sensors.drawer.apply')}
          </ForgeButton>
        </>
      }
    >
      <div className="mb-5">
        <ForgeSelect
          label={t('sensors.drawer.line')}
          value={draft.lineId}
          onValueChange={(value) => set('lineId', value)}
          options={[
            { value: 'all', label: t('sensors.drawer.anyLine') },
            ...options.lines.map((line) => ({ value: line.id, label: line.name })),
          ]}
        />
      </div>

      <div className="mb-5">
        <ForgeSelect
          label={t('sensors.drawer.asset')}
          value={draft.assetId}
          onValueChange={(value) => set('assetId', value)}
          options={[
            { value: 'all', label: t('sensors.drawer.anyAsset') },
            ...options.assets.map((asset) => ({ value: asset.id, label: asset.name })),
          ]}
        />
      </div>

      <div className="mb-5">
        <ForgeSelect
          label={t('sensors.drawer.kind')}
          value={draft.kind}
          onValueChange={(value) => set('kind', value)}
          options={[
            { value: 'all', label: t('sensors.drawer.anyKind') },
            ...options.kinds.map((kind) => ({ value: kind, label: t(`sensors.kind.${kind}`) })),
          ]}
        />
      </div>

      <div className="mb-5">
        <Eyebrow className="mb-2">{t('sensors.drawer.stream')}</Eyebrow>
        <div role="group" aria-label={t('sensors.drawer.stream')} className="flex flex-wrap gap-1.5">
          {STREAM_FILTERS.map((value) => (
            <Chip key={value} selected={draft.stream === value} onClick={() => set('stream', value)}>
              {t(`sensors.stream.${value}`)}
              <Num className="font-normal text-ink-dim">
                {formatInteger(
                  value === 'all' ? (facets.all ?? 0) : (facets[value] ?? 0),
                )}
              </Num>
            </Chip>
          ))}
        </div>
      </div>

      {source ? (
        <div className="rounded-sm border border-hairline bg-sunken p-3.5">
          <Eyebrow className="mb-1.5">{t('sensors.drawer.source')}</Eyebrow>
          <p className="m-0 flex items-center gap-2 text-body-sm font-semibold">
            <Icon name="plug" size="xs" className="text-ink-mute" />
            {t(`sensors.family.${source.family}`, { defaultValue: source.family })}
            <Mono className="text-micro font-normal text-ink-dim">{source.protocol}</Mono>
          </p>
          <p className="m-0 mt-1.5 text-micro font-normal text-ink-dim">
            {t('sensors.drawer.sourceNote', { synced: formatRelative(source.lastSyncAt) })}
          </p>
        </div>
      ) : null}
    </ForgeDrawer>
  )
}
