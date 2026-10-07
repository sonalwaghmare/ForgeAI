import { useId } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

/**
 * The product's select, composed over shadcn's Select rather than forking it.
 *
 * Radix supplies what a native `<select>` cannot — an icon beside each option —
 * and what a `<div>` menu never gets right: `role="combobox"`, typeahead,
 * arrow-key navigation, Escape, the listbox/option relationship, and focus
 * returning to the trigger. A DropdownMenu dressed as a select has none of that
 * and is not a form control.
 *
 * Most of shadcn's colour defaults already resolve correctly here, because the
 * shadcn compatibility tokens in index.css point at ours — `bg-popover` IS the
 * card, `focus:bg-accent` IS the sunken tone, `border-input` IS the hairline.
 * What genuinely diverges is shape, scale and height:
 *
 *   rounded-md    → rounded-sm    6px, the base corner
 *   text-sm       → text-body     14px from the ramp rather than Tailwind's
 *   shadow-xs     → shadow-none   inputs carry no shadow in this system
 *   shadow-md     → shadow-lift   an open menu is a response to input
 *   h-9           → min-h-11      44px, the gloved-hands target Field.jsx uses
 *   whitespace-nowrap → normal    a translated label has to be free to wrap
 *
 * The height override is written as `data-[size=default]:h-auto` rather than a
 * bare `h-auto` on purpose: tailwind-merge keys a class by its variants as well
 * as its property, so an unprefixed height never displaces a prefixed one and
 * the 36px would have quietly survived.
 *
 * Options carry an icon and a label and nothing more. Radix renders the
 * selected item's children into the trigger, so a description added here would
 * reappear inside the closed control.
 *
 * `labelHidden` covers the filter-bar case, where the trigger already reads
 * "All statuses" and a heading above it would only repeat that. The label is
 * still rendered and still bound — it moves to `sr-only`, it is not removed.
 * Dropping it would leave a combobox a screen reader announces with no name at
 * all, and a placeholder is not a label.
 *
 * @param {object} props
 * @param {string} [props.id]
 * @param {string} props.label                     Required. Visible unless `labelHidden`, never a placeholder.
 * @param {boolean} [props.labelHidden]            Visually hidden; still announced.
 * @param {boolean} [props.labelInline]
 *   The filter-pill form the design uses across its toolbars — `Status : Open ⌄`,
 *   with the label inside the trigger rather than above it. Use it for chrome that
 *   filters or orders a list; never for a form field, where a label above the
 *   control is what lets a column of fields scan.
 *
 *   Still a real `<label>` bound to the trigger, moved to `sr-only`, with the
 *   visible prefix marked `aria-hidden` so it is not announced twice. That matters
 *   more than it looks: this is the reason the pill is a `ForgeSelect` at all
 *   instead of a styled DropdownMenu. DESIGN.md forbids the latter outright — a
 *   menu has no `role="combobox"`, no listbox relationship, no typeahead and no
 *   form semantics. The design's own pills are `<div onClick>` menus; this gets
 *   the same look with the semantics they lack.
 * @param {'md'|'sm'} [props.size]                 `sm` is the 34px chrome control for toolbars.
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {string} props.value
 * @param {(value: string) => void} props.onValueChange
 * @param {Array<{value: string, label: string, icon?: string}>} props.options
 */
export function ForgeSelect({
  id,
  label,
  labelHidden = false,
  labelInline = false,
  size = 'md',
  hint,
  error,
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  required = false,
  className,
}) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`

  // The error is announced before the hint, because it is the thing that needs
  // acting on. Same order as Field.
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-1.5', labelInline && 'gap-0', className)}>
      <label
        htmlFor={fieldId}
        className={cn('text-control text-ink', (labelHidden || labelInline) && 'sr-only')}
      >
        {label}
        {required ? (
          <span className="ms-1 text-on-red" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          aria-errormessage={error ? errorId : undefined}
          className={cn(
            'w-full rounded-sm bg-card text-ink shadow-none',
            'whitespace-normal',
            'data-[placeholder]:text-ink-dim',
            /**
             * Three control steps, and the pill is its own — it is not a small
             * form field.
             *
             * 44px is the form step: a gloved hand at a shared terminal, and the
             * height every `Field` in the product uses so a column of controls
             * scans as one column.
             *
             * The pill sits in a toolbar beside `ForgeButton`s — the date range
             * button is directly next to these — so it takes the button's own
             * metrics off the documented control ladder: **34px, `px-3.5`,
             * 13px/600**. Anything else and a row of chrome has two baselines and
             * two type sizes in it, which is the kind of thing nobody can name and
             * everybody notices.
             *
             * `min-h` rather than a hard `h`, unlike the button: a translated label
             * that wraps grows the pill instead of spilling out of it, so this
             * needs no `whitespace-nowrap` on copy that has a +35% budget. Same
             * 34px at rest. `max-lg:min-h-11` matches the button's own tablet
             * growth.
             *
             * `w-auto` displaces the `w-full` above — a toolbar of these reads as a
             * set of statements, and equal-width pills would read as a form.
             * tailwind-merge resolves it because both are plain width utilities.
             */
            labelInline
              ? 'data-[size=default]:h-auto min-h-[34px] w-auto gap-1.5 px-3.5 py-1 text-control max-lg:min-h-11'
              : size === 'sm'
                ? 'data-[size=default]:h-[34px] px-3 py-1.5 text-body-sm'
                : 'data-[size=default]:h-auto min-h-11 px-3.5 py-2.5 text-body',
            error && 'border-red',
          )}
        >
          {labelInline ? (
            // Hidden from assistive tech: the bound <label> above already carries
            // this word, and announcing "Status Status Open" is worse than useless.
            <span aria-hidden="true" className="font-normal text-ink-dim">
              {label}
              <span className="mx-1 text-ink-mute">:</span>
            </span>
          ) : null}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        {/**
         * ── `popper`, not Radix's default `item-aligned` ────────────────────
         * `item-aligned` emulates a native macOS select: it keeps the SELECTED
         * option under the trigger, which means scrolling the list moves the
         * popup itself rather than only its contents. Radix implements that by
         * rewriting the content's `top` and height as the scroll position
         * changes, so a list long enough to scroll visibly drifts upward under
         * the cursor while you are reading it — and the option you were aiming
         * at is no longer where you aimed.
         *
         * That behaviour is defensible for a short list where the selection is
         * the thing you are re-checking. It is wrong for a catalogue: nine
         * waveform types, seventeen engineering units, every hierarchy tier's
         * node list. Those are read top to bottom by someone who has not chosen
         * yet, and a surface that moves while being read is a surface that gets
         * misclicked. `popper` anchors the menu to the trigger and scrolls only
         * the viewport, which is what every other overlay in this app does.
         *
         * Set here rather than in `ui/select.jsx` deliberately: `position` is
         * not a physical property, so DESIGN.md rule 15 does not apply and the
         * primitive stays regenerable.
         */}
        <SelectContent
          position="popper"
          // Anchored to the field's start edge rather than centred on it, so a
          // long option label grows away from the label above it — and does so
          // correctly under `dir="rtl"`, which `center` cannot express.
          align="start"
          className={cn(
            'rounded-sm border-hairline bg-card shadow-lift',
            /**
             * The glass, stated here rather than inherited.
             *
             * The primitive already carries this pair — but it also carries
             * `bg-popover`, and the `bg-card` above replaces it through
             * tailwind-merge. Spelling the blur out at the same call site keeps
             * the surface and its material together, so a later edit to one
             * cannot silently leave the other behind: a 6% white fill with no
             * blur is a menu you can read the table through.
             *
             * The same pair every other floating surface uses — ForgeDialog,
             * ForgeDrawer, the Radix menus, both date pickers. `saturate`
             * compensates for the desaturation blurring introduces.
             */
            'dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]',
            /**
             * A height cap the primitive does not give us, and a fix for one it
             * does.
             *
             * `min(available, 20rem)` keeps BOTH bounds that matter: the menu
             * never grows past the space actually below the trigger, and never
             * past ten-ish options on a tall display, where a full-viewport
             * column of units is a wall rather than a list. Written as one
             * `min()` because tailwind-merge would otherwise drop the
             * primitive's own `max-h` in favour of this one and lose the
             * viewport clamp.
             *
             * The viewport override undoes a defect in the generated file: in
             * popper mode it sets the viewport to `h-[--radix-select-trigger-height]`,
             * which is the TRIGGER's height — about 44px, or one and a half
             * options, whatever the cap above says. Overridden from out here by
             * data attribute, again so the primitive stays regenerable.
             */
            'max-h-[min(var(--radix-select-content-available-height),20rem)]',
            '[&_[data-radix-select-viewport]]:h-auto',
          )}
        >
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="py-2 text-body">
              {option.icon ? <Icon name={option.icon} size="md" className="text-ink-dim" /> : null}
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-body-sm text-on-red">
          <Icon name="bolt" size="xs" className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-body-sm text-ink-dim">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A field whose value cannot be edited, shown with the reason.
 *
 * Used where the API accepts a value on create and not on update. A disabled
 * `<select>` would be the obvious alternative and it is worse: it looks like a
 * control, takes a hover, and teaches someone to keep trying it. This states
 * the value as a fact.
 */
export function StaticField({ label, hint, icon, children, className }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-control text-ink">{label}</span>
      <span className="flex min-h-11 items-center gap-2 rounded-sm bg-sunken px-3.5 py-2.5 text-body text-ink">
        {icon ? <Icon name={icon} size="md" className="text-ink-dim" /> : null}
        {children}
      </span>
      {hint ? <p className="text-body-sm text-ink-dim">{hint}</p> : null}
    </div>
  )
}
