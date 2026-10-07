import { useId } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

/**
 * A labelled text input with its hint and error wired to it.
 *
 * shadcn's Input is the box only. The parts that actually decide whether a form
 * is usable — a real `<label>` bound by `htmlFor`, a hint and an error both
 * reachable through `aria-describedby`, `aria-invalid` on the control, and the
 * error announced when it appears — are what this adds. Getting that right once
 * beats getting it right at five call sites.
 *
 * A placeholder is never the label. Placeholders vanish on focus, fail contrast
 * at their usual grey, and disappear entirely once a value is typed, which
 * leaves a form nobody can re-read.
 */
export function Field({
  id: providedId,
  label,
  hint,
  error,
  required = false,
  type = 'text',
  trailing,
  className,
  inputClassName,
  ...inputProps
}) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  // Order matters: the error is read before the hint, because it is the thing
  // that needs acting on.
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-control text-ink">
        {label}
        {required ? (
          // Marked for sighted users and named for everyone else. A bare
          // asterisk is not a label.
          <span className="ms-1 text-on-red" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="relative flex items-center">
        <input
          id={id}
          type={type}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          aria-errormessage={error ? errorId : undefined}
          className={cn(
            'w-full rounded-sm border bg-card px-3.5 py-2.5 text-body text-ink',
            'placeholder:text-ink-dim',
            'transition-colors focus:outline-none',
            error ? 'border-red' : 'border-hairline focus:border-forge',
            // 44px minimum target: this form gets filled with gloves on, at a
            // shared terminal, standing up.
            'min-h-11',
            trailing && 'pe-11',
            inputClassName,
          )}
          {...inputProps}
        />
        {trailing ? (
          <span className="absolute end-0 flex items-center pe-1.5">{trailing}</span>
        ) : null}
      </div>

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
 * A summary of everything wrong with the form, rendered above it and focused on
 * submit.
 *
 * Per-field errors alone are not enough: a keyboard or screen-reader user who
 * submits an invalid form gets no indication that anything happened, because
 * focus stays put and the errors appear somewhere below them. This is the
 * announcement.
 */
/**
 * The multiline field. Same chrome as `Field`, a `<textarea>` inside it.
 *
 * The product had no multiline input until root-cause analysis needed one: a
 * hypothesis runs to a paragraph and a cause's rationale to several sentences, and
 * a single-line input for either is a control that hides most of its own value.
 *
 * ── Grows, never scrolls at rest ──────────────────────────────────────────
 * `rows` sets the floor and `field-sizing-content` lets it grow with what is typed,
 * so reviewing a long rationale does not mean scrolling a four-line porthole. The
 * fallback where `field-sizing` is unsupported is an ordinary fixed-height
 * textarea, which is exactly what it would otherwise have been.
 *
 * `resize-y` stays available deliberately. Someone comparing two causes wants to
 * make one taller, and taking that away buys nothing.
 */
export function TextArea({
  id: providedId,
  label,
  hint,
  error,
  required = false,
  rows = 3,
  className,
  inputClassName,
  ...textareaProps
}) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-control text-ink">
        {label}
        {required ? (
          <span className="ms-1 text-on-red" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        aria-errormessage={error ? errorId : undefined}
        className={cn(
          'w-full resize-y rounded-sm border bg-card px-3.5 py-2.5 text-body text-ink',
          'placeholder:text-ink-dim',
          'transition-colors focus:outline-none',
          error ? 'border-red' : 'border-hairline focus:border-forge',
          '[field-sizing:content]',
          inputClassName,
        )}
        {...textareaProps}
      />

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

export function ErrorSummary({ title, errors, id, ref, className }) {
  const entries = Object.entries(errors).filter(([, message]) => Boolean(message))
  if (!entries.length) return null

  return (
    <div
      // React 19 passes ref as an ordinary prop, so no forwardRef needed. The
      // caller focuses this on a failed submit.
      ref={ref}
      id={id}
      role="alert"
      tabIndex={-1}
      className={cn(
        'rounded-sm border border-hairline stripe-red bg-card p-3.5 focus:outline-none',
        className,
      )}
    >
      <p className="m-0 text-control text-on-red">{title}</p>
      <ul className="mt-2 mb-0 flex list-none flex-col gap-1 p-0">
        {entries.map(([field, message]) => (
          <li key={field} className="text-body-sm text-ink-dim">
            {/* Links to the offending control, so fixing it is one keystroke. */}
            <a href={`#${field}`} className="text-on-forge underline decoration-from-font">
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
