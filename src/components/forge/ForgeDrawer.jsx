import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { IconButton } from './ForgeButton'

/**
 * A panel that slides in from the inline end — the prototype's filters drawer.
 *
 * ── Why not `ForgeDialog` with a side prop ────────────────────────────────
 * They are different objects doing different jobs. A dialog interrupts: it
 * centres, it is about one decision, and it closes when that decision is made.
 * A drawer accompanies: it sits beside the thing it modifies, it holds a dozen
 * controls, and you watch the table behind it while you work. Bolting a `side`
 * onto ForgeDialog would give one component two layouts, two sizing ladders and
 * two sets of reasons — and the next person would have to read both to change
 * either.
 *
 * ── Why it is still a Radix dialog underneath ─────────────────────────────
 * Because everything hard about a drawer is the same as everything hard about a
 * dialog: the focus trap, restoring focus to the trigger, Escape, scroll lock,
 * `aria-modal`, and labelling. None of that is worth hand-rolling twice. What
 * this changes is only where the panel sits and how it arrives.
 *
 * ── Logical positioning ───────────────────────────────────────────────────
 * `end-0`, not `right-0`, and the entrance animation is authored for both
 * directions — a drawer that slides in from the right under `dir="rtl"` enters
 * from the side the reader's eye is leaving.
 */
export function ForgeDrawer({ open, onOpenChange, title, footer, closeLabel, children, className }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 end-0 z-50 flex w-[min(24rem,100vw)] flex-col',
            'border-s border-hairline bg-card text-ink shadow-lift',
            'dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]',
            // The codebase's own animation, not `animate-in` — neither
            // tailwindcss-animate nor tw-animate-css is installed, so shadcn's
            // generated animation classes are inert here. `index.css` owns the
            // motion vocabulary and honours `prefers-reduced-motion` with it.
            'animate-drawer-in',
            className,
          )}
        >
          <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
            <DialogTitle className="m-0 flex-1 text-title text-ink">{title}</DialogTitle>
            <DialogPrimitive.Close asChild>
              <IconButton label={closeLabel}>
                <Icon name="x" size="sm" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>

          {/* The body scrolls, not the panel: the Apply button must stay put on a
              short viewport, which is the whole reason to pin the footer. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="flex gap-2 border-t border-hairline px-5 py-3.5">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
