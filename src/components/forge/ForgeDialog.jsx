import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'

/**
 * The product's modal, composed over shadcn's Dialog rather than forking it.
 *
 * Radix supplies the parts that are easy to get subtly wrong and impossible to
 * notice by looking: the focus trap, restoring focus to the trigger on close,
 * Escape, scroll lock, `aria-modal`, and the title/description association. None
 * of that is worth hand-rolling.
 *
 * What this adds is the committed world. shadcn's own defaults diverge from
 * DESIGN.md in four places, all overridden here rather than by editing the
 * generated file:
 *
 *   bg-background  → bg-card      a modal sits above the page, so it is white
 *                                 on the warm ground, not the ground itself
 *   rounded-lg     → rounded-2xl  16px, the documented modal corner and the one
 *                                 place the radius ladder tops out
 *   text-lg        → text-title   18px is not on the type ramp; 16px is
 *   sm:text-left   → text-start   physical, and the header would not mirror
 *
 * Widths come from DESIGN.md's ladder — pick a step, never invent one.
 *
 * ── Dark mode: glass, blurred ────────────────────────────────────────────
 * `--surface-card` is a solid white in light and a 6% white tint in dark —
 * translucent by design, so a card reads as material sitting on the near-black
 * ground rather than as another rectangle painted on it. That works for a card
 * pinned to the page. It does NOT work for a modal opening above a dense table:
 * a 6% tint on top of the scrim on top of rows of text turns the dialog into a
 * legibility problem.
 *
 * The fix is the same one `TopBar` and `AssistantDock` use — a backdrop blur
 * behind the translucent surface, so what shows through is a wash rather than
 * words. The overlay above the page is bumped as well, because a 50% scrim is
 * enough on a warm light ground and not enough on a black one.
 */

const WIDTHS = {
  sm: 'sm:max-w-[min(470px,94vw)]',
  md: 'sm:max-w-[min(540px,94vw)]',
  lg: 'sm:max-w-[min(720px,94vw)]',
  xl: 'sm:max-w-[min(1100px,96vw)]',
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title        Required. Names the dialog for everyone.
 * @param {string} [props.description]
 * @param {'sm'|'md'|'lg'|'xl'} [props.size]
 * @param {React.ReactNode} [props.footer]
 * @param {string} [props.bodyClassName]
 *   Overrides the body's scroll cap. The default suits a form — a column of
 *   fields you fill top to bottom, where a short viewport should scroll rather
 *   than push the confirm button off the screen.
 *
 *   A DOCUMENT is the other case. A handover report is four sections and two
 *   tables that get read end to end before they are accepted, and 32rem turns
 *   that into a porthole: most of the dialog is empty chrome around a small
 *   scrolling box. Pass a taller cap there. The header and footer stay pinned
 *   either way, which is the one thing this arrangement does better than the
 *   prototype's single scrolling card — the Acknowledge button cannot scroll
 *   out of reach of the person deciding whether to press it.
 */
export function ForgeDialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  footer,
  className,
  bodyClassName,
  children,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'gap-0 rounded-2xl border-hairline bg-card p-0 text-ink shadow-lift',
          // Glass in dark, per the codebase's convention on other translucent
          // surfaces. `saturate` compensates for the desaturation that blurring
          // introduces, so the tint below still reads as itself.
          'dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]',
          WIDTHS[size],
          className,
        )}
      >
        <DialogHeader className="border-b border-hairline px-5 py-4 text-start">
          <DialogTitle className="text-title text-ink">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="mt-1 text-body-sm text-ink-dim">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {/* The body scrolls, not the dialog: a tall form on a short laptop must
            not push its own footer off the bottom of the screen. */}
        <div className={cn('max-h-[min(60vh,32rem)] overflow-y-auto px-5 py-4.5', bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <DialogFooter className="border-t border-hairline px-5 py-3.5 sm:justify-start">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export { DialogClose }
