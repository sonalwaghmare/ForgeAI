import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/**
 * Product buttons, composed over shadcn's Button rather than forking it — the
 * primitive stays regenerable, our spec lives here.
 *
 * Quiet until it matters. `secondary` is the default button: a white surface
 * with a hairline that moves its border to the accent on hover and leaves the
 * fill alone. `primary` is rationed to roughly one per view, and its hover
 * brightens rather than shifting hue — the accent has one value.
 *
 * ── Every filled variant states its own hover colours, and must ───────────
 * The primitive is composed at `variant="ghost"`, which ships
 * `hover:bg-accent hover:text-accent-foreground`. Nothing here used to answer
 * that, and `tailwind-merge` cannot drop a class no other class conflicts with —
 * so every filled button in this product turned its white label to near-black ink
 * on hover, and the AI button's gradient was the surface that finally made it
 * visible. Declaring `hover:text-white` and a `hover:bg-*` in the variant is what
 * evicts the primitive's pair; the dark-mode twin is spelled out for the same
 * reason. See DESIGN.md correction 15 — this is that lesson again, on a different
 * property.
 */

const VARIANTS = {
  primary:
    'bg-forge text-white shadow-accent hover:bg-forge dark:hover:bg-forge hover:text-white hover:brightness-[1.08] border-0',
  secondary:
    'bg-card text-ink border border-hairline hover:border-forge hover:bg-card dark:hover:bg-card hover:text-ink',
  ghost: 'bg-transparent text-ink-dim hover:bg-sunken dark:hover:bg-sunken hover:text-ink border-0',
  danger:
    'bg-red text-white hover:bg-red dark:hover:bg-red hover:text-white hover:brightness-[1.08] border-0',
  /**
   * The buttons that start the machine thinking.
   *
   * The prototype's `.btn-ai`, and the one place The Violet Reservation is spent
   * on a control rather than on a mark: the hue means AI authorship, and what
   * these buttons produce is a machine-written document. Every AI entry point in
   * the product is now this object — the assistant in the top bar and Investigate
   * on an anomaly — so the affordance is recognisable before the label is read.
   *
   * `ai-gradient` over `bg-violet`, never instead of it. The flat fill is the
   * fallback, and it is exactly what these buttons looked like before correction
   * 20. No `shadow-accent`: that glow is orange and would put the accent back
   * around a violet fill.
   *
   * The hover is the prototype's own and nothing else: 7% brightness on
   * `transition-[filter]`, so the fill lightens and NOTHING moves, recolours or
   * fades with it. `hover:bg-violet` and `hover:text-white` are not decoration
   * here — they are what stops the primitive's ghost hover from repainting the
   * button under the gradient and flipping the label to dark ink.
   *
   * The 10px corner belongs to the variant rather than to a size: it is part of
   * this object wherever it is used.
   */
  ai: 'ai-gradient bg-violet text-white font-bold rounded-lg transition-[filter] hover:bg-violet dark:hover:bg-violet hover:text-white hover:brightness-[1.07] border-0',
}

const SIZES = {
  // 8px 14px at 13px/600, per the documented control step.
  md: 'h-[34px] rounded-sm px-3.5 text-control',
  sm: 'h-[30px] rounded-sm px-3 text-body-sm font-semibold',
  lg: 'h-[42px] rounded-sm px-5 text-body font-semibold',
}

export function ForgeButton({ variant = 'secondary', size = 'md', className, ...rest }) {
  return (
    <Button
      variant="ghost"
      size="default"
      className={cn(
        'gap-2 transition-all disabled:opacity-50',
        // Gloved hands on a tablet need a 44px target; on the desktop the
        // control ladder holds.
        'max-lg:min-h-11',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  )
}

/**
 * Icon-only button. 34px square at a 10px radius — the one step off the base
 * corner, because a square icon target reads better slightly softer.
 *
 * `label` is required and must be translated: `title` alone is not a reliable
 * accessible name, and the prototype relied on it throughout.
 */
export function IconButton({ label, pressed, bare = false, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        'flex size-[34px] items-center justify-center rounded-lg transition-colors',
        bare
          ? 'text-ink-dim hover:text-ink'
          : 'border border-hairline bg-card text-ink-dim hover:border-forge hover:text-ink',
        pressed && !bare && 'border-transparent bg-forge text-white hover:text-white',
        'max-lg:size-11',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
