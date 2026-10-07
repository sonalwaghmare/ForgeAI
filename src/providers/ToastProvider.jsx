import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/forge/Icon'
import { cn } from '@/lib/cn'

/**
 * Toasts — the product's confirmation of a thing that happened.
 *
 * The prototype fires one on essentially every mutation, and it is right to:
 * a task ticked off, a handover published, a rule paused. Without it the button
 * animates and nothing else does, and the operator cannot tell a slow save from
 * a silent failure.
 *
 * ── Why this is hand-rolled and not sonner ─────────────────────────────────
 * The product needs three things from a toast — announce, auto-dismiss, stack —
 * and all three fit in this file. Pulling in a library would add a dependency
 * whose styling then has to be fought back to DESIGN.md, for behaviour that is
 * forty lines.
 *
 * ── Announcing ────────────────────────────────────────────────────────────
 * The region is `aria-live="polite"` and `role="status"`, so a screen reader is
 * told what happened without being interrupted mid-sentence. `assertive` would
 * be wrong: none of these are errors the reader must abandon their task for.
 *
 * Messages arrive already translated. Nothing here calls `t()` — a toast is a
 * transport for copy the caller owns, and routing it through the i18n layer here
 * would mean every caller passing a key plus its interpolations instead of a
 * sentence.
 */

const ToastContext = createContext(null)

/** How long a toast stays. The prototype's 3s, which is long enough to read one
    short sentence and short enough not to sit over the thing you just clicked. */
const DISMISS_AFTER_MS = 3000

/** Tone → the icon and hue that make the toast readable at a glance. */
const TONES = {
  ok: { icon: 'check', className: 'text-on-green' },
  info: { icon: 'bolt', className: 'text-on-forge' },
  warn: { icon: 'shield', className: 'text-on-amber' },
  error: { icon: 'x', className: 'text-on-red' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // Timers are held in a ref rather than state: clearing one must not re-render,
  // and a timer that outlives its toast is the classic way this component leaks.
  const timers = useRef(new Map())
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback(
    (message, tone = 'ok') => {
      const id = (nextId.current += 1)
      setToasts((current) => [...current, { id, message, tone }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS),
      )
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        // `pointer-events-none` on the stack, restored per toast: an empty
        // region pinned over the bottom-right corner must not eat clicks on
        // whatever is under it.
        className="pointer-events-none fixed bottom-5 end-5 z-[300] flex flex-col items-end gap-2"
      >
        {toasts.map((item) => {
          const tone = TONES[item.tone] ?? TONES.ok
          return (
            <div
              key={item.id}
              className="animate-toast-in pointer-events-auto flex max-w-[24rem] items-center gap-2.5 rounded-sm border border-hairline bg-card px-4 py-3 text-body-sm text-ink shadow-lift dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]"
            >
              <Icon name={tone.icon} size="sm" className={cn('shrink-0', tone.className)} />
              <span className="min-w-0">{item.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * `toast(message, tone?)`.
 *
 * Throws outside the provider rather than returning a no-op: a mutation that
 * silently stops confirming itself is a bug that survives review, and a crash in
 * development is how it gets found in the minute it is introduced.
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
