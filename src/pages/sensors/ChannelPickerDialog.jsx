import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { formatMeasure } from '@/lib/units'
import { cn } from '@/lib/cn'

/**
 * Pick channels — for a new chart, or to add series to an open one.
 *
 * DEMO. One dialog for both, because they are the same act with a different
 * button on the end: the design has a New Chart modal and an "+ Add Series"
 * button with nothing behind it, and building two would have meant two channel
 * lists that could drift apart.
 *
 * ── It creates something ──────────────────────────────────────────────────
 * The prototype's Create Chart closes the modal and forgets. Here it POSTs, the
 * chart lands in the catalogue, and the Workstation opens it.
 *
 * ── The list is searchable, because it is fifty rows and not four ─────────
 * The design's checklist is the four sensors of one asset. Ours spans the plant,
 * so it groups by asset and takes a filter — a scrollable list of fifty
 * unsorted checkboxes is a control nobody completes.
 */
export function ChannelPickerDialog({
  open,
  mode,
  channels,
  selected,
  pending,
  onClose,
  onSubmit,
}) {
  const { t } = useTranslation(['app', 'common'])
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState(() => new Set(selected ?? []))
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matching = channels.filter(
      (channel) =>
        !needle ||
        `${channel.name} ${channel.assetName} ${channel.assetCode} ${channel.tag}`
          .toLowerCase()
          .includes(needle),
    )
    const byAsset = new Map()
    for (const channel of matching) {
      if (!byAsset.has(channel.assetId)) byAsset.set(channel.assetId, { asset: channel, items: [] })
      byAsset.get(channel.assetId).items.push(channel)
    }
    return [...byAsset.values()]
  }, [channels, query])

  const toggle = (id) =>
    setPicked((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const close = () => {
    setTitle('')
    setQuery('')
    setPicked(new Set(selected ?? []))
    onClose()
  }

  const canSubmit = picked.size > 0 && !pending

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      size="lg"
      bodyClassName="max-h-[min(72vh,44rem)]"
      title={t(mode === 'create' ? 'sensors.picker.createTitle' : 'sensors.picker.addTitle')}
      footer={
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <ForgeButton onClick={close}>{t('common:actions.cancel')}</ForgeButton>
          <ForgeButton
            variant="primary"
            disabled={!canSubmit}
            onClick={() => onSubmit({ name: title, signalIds: [...picked] })}
          >
            {t(mode === 'create' ? 'sensors.picker.create' : 'sensors.picker.add')}
          </ForgeButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {mode === 'create' ? (
          <>
            <Field
              label={t('sensors.picker.nameLabel')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('sensors.picker.namePlaceholder')}
              hint={t('sensors.picker.nameHint')}
            />
          </>
        ) : null}

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Eyebrow className="flex-1">
              {t('sensors.picker.signals')} · <Num>{picked.size}</Num>
            </Eyebrow>
            <label className="flex min-w-[12rem] items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge">
              <Icon name="search" size="xs" className="shrink-0 text-ink-mute" />
              <span className="sr-only">{t('sensors.picker.search')}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('sensors.picker.searchPlaceholder')}
                className="w-full border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
              />
            </label>
          </div>

          {groups.length === 0 ? (
            <p className="m-0 rounded-sm border border-hairline bg-sunken px-3.5 py-6 text-center text-body-sm text-ink-dim">
              {t('sensors.picker.noMatch')}
            </p>
          ) : (
            <div className="max-h-[20rem] overflow-y-auto rounded-sm border border-hairline bg-sunken p-1.5">
              {groups.map((group) => (
                <div key={group.asset.assetId} className="mb-1.5 last:mb-0">
                  <p className="m-0 flex items-center gap-2 px-2 py-1.5 text-eyebrow text-ink-dim">
                    <Icon name="machine" size="xs" />
                    {group.asset.assetName}
                    <Mono className="font-normal">{group.asset.assetCode}</Mono>
                  </p>
                  {group.items.map((channel) => (
                    <label
                      key={channel.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-xs px-2 py-1.5 hover:bg-card',
                        picked.has(channel.id) && 'bg-card',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={picked.has(channel.id)}
                        onChange={() => toggle(channel.id)}
                        className="accent-forge"
                      />
                      <span className="min-w-0 flex-1 truncate text-body-sm">{channel.name}</span>
                      <Num className="shrink-0 text-micro font-normal text-ink-dim">
                        {formatMeasure({ value: channel.value, unit: channel.unit })}
                      </Num>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ForgeDialog>
  )
}
