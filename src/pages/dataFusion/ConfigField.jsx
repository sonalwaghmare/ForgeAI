import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { IconButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'

/**
 * One connector-configuration field, rendered from the connector type's own
 * `config_schema`.
 *
 * Shared by the Connect-source wizard and the edit dialog, which is the whole
 * point: both are the same generated form over the same schema, and a second copy
 * would be a second set of coercion rules to keep in step with the server's
 * validator.
 *
 * The control comes from `field.type` and nothing else — never from the shape of
 * the value, which would make an empty password indistinguishable from an empty
 * host. Labels are the server's own strings, rendered as data: they name protocol
 * concepts ("Endpoint URL", "Security Policy"), which is the one category of copy
 * that does not move between locales.
 */

/**
 * Sentinel for "not set" on an optional select. Radix rejects an item whose value
 * is the empty string, and an optional field has to be able to return to unset.
 */
export const NOT_SET = '__unset__'

/**
 * @param {object} props
 * @param {{key: string, label: string, type: string, required: boolean, options: string[]|null}} props.field
 * @param {*} props.value
 * @param {string} [props.error]   Translated. Either a local required-check or the server's.
 * @param {string} [props.hint]    Used by the edit form to explain a blanked credential.
 * @param {(value: *) => void} props.onChange
 * @param {(field: object) => void} [props.onOpenBuilder]
 *   Offered only for `type: 'jsonpath'`. Absent — as it is on every connection
 *   form, since no `config_schema` declares a query — the field is still a working
 *   monospace text input. A field whose helper is unavailable must not become
 *   uneditable.
 * @param {string} [props.idPrefix]
 *   Namespace for the generated DOM id. The sensor form renders TWO generated
 *   field sets on one screen — the connector's `extraction_schema` and the chosen
 *   waveform type's `metadata_schema` — and the two key spaces are independent,
 *   so a connector free to declare a field called `range.min` would otherwise
 *   produce a duplicate id. That breaks more than tidiness: `<label for>` binds to
 *   the first match, so one input would be unlabelled and `ErrorSummary`'s anchor
 *   would scroll to the wrong control.
 */
export function ConfigField({
  field,
  value,
  error,
  hint,
  onChange,
  onOpenBuilder,
  idPrefix = 'cfg',
}) {
  const { t } = useTranslation(['app', 'common'])
  const id = `${idPrefix}-${field.key.replace(/\./g, '-')}`

  if (field.type === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2.5 rounded-sm border border-hairline bg-card px-3.5 py-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="accent-forge"
        />
        <span className="text-control text-ink" translate="no">
          {field.label}
        </span>
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <ForgeSelect
        id={id}
        label={field.label}
        hint={hint}
        required={field.required}
        error={error}
        value={value ?? NOT_SET}
        onValueChange={(next) => onChange(next === NOT_SET ? '' : next)}
        options={[
          ...(field.required ? [] : [{ value: NOT_SET, label: t('dataFusion.connect.notSet') }]),
          ...(field.options ?? []).map((option) => ({ value: option, label: option })),
        ]}
      />
    )
  }

  return (
    <Field
      id={id}
      label={field.label}
      hint={hint}
      required={field.required}
      error={error}
      // `number` gives a numeric keypad on a tablet, which is where this gets
      // filled in. `password` masks it. Everything else is text.
      type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
      // Hosts, endpoints and credentials are typed exactly; autocorrect and
      // auto-capitalisation on a tablet keyboard silently corrupt all three.
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      // A masked credential in a proportional face is unreadable as a length
      // check; everything else here is a machine string anyway.
      inputClassName={field.type === 'password' ? undefined : 'mono text-mono'}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      // The builder is an accelerator beside the input, never a replacement for
      // it. A `value_path` pasted from a working sensor has to be typeable
      // directly, and an expression the builder cannot model — a compound filter,
      // a recursive descent — must still be editable here.
      trailing={
        field.type === 'jsonpath' && onOpenBuilder ? (
          <IconButton
            bare
            label={t('dataFusion.sensors.builder.open', { field: field.label })}
            onClick={() => onOpenBuilder(field)}
            className="size-8"
          >
            <Icon name="layers" size="sm" />
          </IconButton>
        ) : undefined
      }
    />
  )
}
