import { useTranslation } from 'react-i18next'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import {
  PARENT_ICON,
  assetsOf,
  cascadeFor,
  describeParent,
  linesOf,
  sitesOf,
} from '@/features/hierarchy/parents'

/**
 * Where a sensor attaches: site, then line, then asset.
 *
 * ── Three selects, and the deepest one wins ───────────────────────────────
 * `Sensor` carries `plant_id`, `line_id` and `machine_id` and exactly one of them
 * is set — so the control's job is not to collect three values but to let someone
 * stop at the right depth. Site is required; line and asset each offer "attach
 * here" as their unset state. Pick a site and leave the rest alone and the sensor
 * hangs off the site; drill to a machine and it hangs off the machine.
 *
 * That rule is invisible in the controls themselves, so it is stated underneath in
 * words — the resolved attachment point, named. A form that silently decides which
 * of three ids to send is a form nobody can check before saving.
 *
 * ── Why cascading rather than one searchable list ──────────────────────────
 * An account's machines run to the thousands, so a flat list of every site, line and
 * machine would be a scroll rather than a choice. Narrowing by site and then by line
 * cuts it to the handful under one line by the time assets are offered, and it uses
 * `ForgeSelect` throughout — which brings Radix typeahead, so someone who knows the
 * machine name still types rather than scrolls.
 *
 * ── Fully controlled, no derived state ────────────────────────────────────
 * The three selections are computed from `parent` on every render via `cascadeFor`,
 * never mirrored into local state. So an edit form prefilling a machine gets all
 * three levels populated with no effect and no sync, and the control cannot hold a
 * selection that disagrees with the value it reports.
 *
 * @param {object} props
 * @param {Array<object>} props.nodes            Flat hierarchy nodes.
 * @param {string} props.language                For locale-correct sorting.
 * @param {?{tier: string, id: string}} props.parent
 * @param {(parent: ?{tier: string, id: string}) => void} props.onChange
 * @param {string} [props.error]                 Translated.
 * @param {boolean} [props.pending]              Hierarchy still loading.
 */
export function ParentPicker({ nodes, language, parent, onChange, error, pending = false }) {
  const { t } = useTranslation(['app', 'common'])

  const { siteId, lineId, assetId } = cascadeFor(nodes, parent)

  const sites = sitesOf(nodes, language)
  const lines = linesOf(nodes, siteId, language)
  const assets = assetsOf(nodes, lineId, language)

  const attached = describeParent(nodes, parent)

  const option = (node) => ({ value: node.id, label: node.name })

  return (
    <div className="flex flex-col gap-3">
      <ForgeSelect
        id="sensor-site"
        label={t('common:hierarchy.site')}
        hint={t('dataFusion.sensors.fields.parentHint')}
        required
        value={siteId ?? ''}
        onValueChange={(next) => onChange({ tier: 'site', id: next })}
        options={sites.map(option)}
        error={error}
        placeholder={
          pending
            ? t('common:loading')
            : sites.length
              ? t('dataFusion.sensors.fields.chooseSite')
              : t('dataFusion.sensors.fields.noSites')
        }
      />

      {/* Line and asset are rendered only once their parent is chosen. An empty
          disabled select teaches nothing; its absence says "not yet" without
          needing a sentence. */}
      {siteId ? (
        <ForgeSelect
          id="sensor-line"
          label={t('common:hierarchy.line')}
          value={lineId ?? ATTACH_HERE}
          onValueChange={(next) =>
            onChange(next === ATTACH_HERE ? { tier: 'site', id: siteId } : { tier: 'line', id: next })
          }
          options={[
            { value: ATTACH_HERE, label: t('dataFusion.sensors.fields.attachToSite') },
            ...lines.map(option),
          ]}
          placeholder={
            lines.length
              ? t('dataFusion.sensors.fields.chooseLine')
              : t('dataFusion.sensors.fields.noLines')
          }
        />
      ) : null}

      {lineId ? (
        <ForgeSelect
          id="sensor-asset"
          label={t('common:hierarchy.asset')}
          value={assetId ?? ATTACH_HERE}
          onValueChange={(next) =>
            onChange(next === ATTACH_HERE ? { tier: 'line', id: lineId } : { tier: 'asset', id: next })
          }
          options={[
            { value: ATTACH_HERE, label: t('dataFusion.sensors.fields.attachToLine') },
            ...assets.map(option),
          ]}
          placeholder={
            assets.length
              ? t('dataFusion.sensors.fields.chooseAsset')
              : t('dataFusion.sensors.fields.noAssets')
          }
        />
      ) : null}

      {/* The rule made visible. Which of the three ids is about to be sent, in
          words, at the moment it can still be changed. */}
      {attached ? (
        <p className="m-0 flex items-start gap-1.5 rounded-sm bg-sunken px-3 py-2 text-body-sm text-ink-dim">
          <Icon name={PARENT_ICON[attached.tier]} size="sm" className="mt-px shrink-0" />
          <span>
            {t(`dataFusion.sensors.fields.attachedTo.${attached.tier}`, { name: attached.name })}
            {attached.trail.length ? (
              <span className="text-ink-mute"> · {attached.trail.join(' · ')}</span>
            ) : null}
          </span>
        </p>
      ) : null}
    </div>
  )
}

/**
 * "Attach at the level above" — the unset state for line and asset.
 *
 * Not an empty string: Radix rejects an item whose value is `''`, the same reason
 * `IotSensorsPage` carries an `ALL` sentinel and `ConfigField` a `NOT_SET` one.
 */
const ATTACH_HERE = '__attach_here__'
