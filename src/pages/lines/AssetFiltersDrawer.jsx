import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDrawer } from '@/components/forge/ForgeDrawer'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Eyebrow } from '@/components/forge/primitives'

/**
 * The More Filters drawer.
 *
 * ── It edits a draft, and Apply commits it ────────────────────────────────
 * The prototype's drawer is inert — its controls do nothing and its Apply
 * button only closes the panel. Making them live raised a real question: filter
 * as you click, or on Apply?
 *
 * Apply. The quick chips in the toolbar are the filter-as-you-click affordance
 * and they are one click each. This panel holds seven controls, and a reader
 * setting three of them does not want the table to re-sort twice on the way to
 * the third — nor to lose their place because row 40 moved while they were
 * still choosing. The parent owns the committed filters; this owns the draft.
 *
 * ── Closed sets are chips, open sets are selects ──────────────────────────
 * Criticality and stream status have three or four members that fit on a line,
 * so they are chips: every option visible, one click to change. Owner, tag and
 * type are open-ended and grow with the plant, so they are selects. Same split
 * the design uses, for a reason it does not state.
 */
export function AssetFiltersDrawer({ open, draft, options, onChange, onApply, onClear, onClose }) {
  const { t } = useTranslation(['app', 'common'])

  const set = (key, value) => onChange({ ...draft, [key]: value })

  const chipGroup = (key, values, labelFor) => (
    <div className="mb-5">
      <Eyebrow className="mb-2">{t(`assets.drawer.${key}`)}</Eyebrow>
      <div role="group" aria-label={t(`assets.drawer.${key}`)} className="flex flex-wrap gap-1.5">
        {['all', ...values].map((value) => (
          <Chip key={value} selected={draft[key] === value} onClick={() => set(key, value)}>
            {value === 'all' ? t('assets.drawer.any') : labelFor(value)}
          </Chip>
        ))}
      </div>
    </div>
  )

  return (
    <ForgeDrawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('assets.drawer.title')}
      closeLabel={t('common:actions.close')}
      footer={
        <>
          <ForgeButton className="flex-1" onClick={onClear}>
            {t('assets.drawer.clear')}
          </ForgeButton>
          <ForgeButton variant="primary" className="flex-1" onClick={onApply}>
            {t('assets.drawer.apply')}
          </ForgeButton>
        </>
      }
    >
      <div className="mb-5">
        <ForgeSelect
          label={t('assets.drawer.line')}
          value={draft.lineId}
          onValueChange={(value) => set('lineId', value)}
          options={[
            { value: 'all', label: t('assets.allLines') },
            ...options.lines.map((line) => ({ value: line.id, label: line.name })),
          ]}
        />
      </div>

      <div className="mb-5">
        <ForgeSelect
          label={t('assets.drawer.type')}
          value={draft.type}
          onValueChange={(value) => set('type', value)}
          options={[
            { value: 'all', label: t('assets.drawer.allTypes') },
            ...options.types.map((type) => ({
              value: type,
              label: t(`lines.type.${type}`, { defaultValue: type }),
            })),
          ]}
        />
      </div>

      {chipGroup('criticality', options.criticalities, (value) =>
        t(`common:severity.${value}`, { defaultValue: value }),
      )}

      {chipGroup('stream', ['online', 'offline'], (value) =>
        t(value === 'online' ? 'lines.row.online' : 'lines.row.offline'),
      )}

      {chipGroup('quick', ['critical', 'alerts'], (value) => t(`assets.quick.${value}`))}

      <div className="mb-5">
        <ForgeSelect
          label={t('assets.drawer.owner')}
          value={draft.owner}
          onValueChange={(value) => set('owner', value)}
          options={[
            { value: 'all', label: t('assets.drawer.allOwners') },
            ...options.owners.map((owner) => ({ value: owner.id, label: owner.name })),
          ]}
        />
      </div>

      <ForgeSelect
        label={t('assets.drawer.tag')}
        value={draft.tag}
        onValueChange={(value) => set('tag', value)}
        options={[
          { value: 'all', label: t('assets.drawer.allTags') },
          ...options.tags.map((tag) => ({ value: tag, label: tag })),
        ]}
      />
    </ForgeDrawer>
  )
}
