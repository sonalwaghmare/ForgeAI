import { useTranslation } from 'react-i18next'
import { BrandWordmark, WORDMARK_RATIO } from './BrandWordmark'
import { ForgeMark } from './Icon'
import { cn } from '@/lib/cn'

/**
 * The brand lockup — one component, so the logo cannot drift between the four
 * places it appears.
 *
 * It exists because it had already drifted: the top bar, the sign-in header and
 * the two landing lockups each assembled their own mark-plus-text by hand, and
 * two of them used a different gap from the other two.
 *
 * ── Wordmark or mark ─────────────────────────────────────────────────────
 * The wordmark is 3:1 and cannot go in a square, so the two are not
 * interchangeable — this is the ordinary lockup-and-icon split. `wordmark`
 * wherever there is horizontal room; `mark` in the 60px collapsed rail and
 * anywhere else square. The hexagonal glyph is the icon mark, not a smaller
 * version of the logo.
 *
 * ── Both forms take their colour from the system ─────────────────────────
 * The wordmark's letterforms are `currentColor`, so `text-ink` carries them to
 * near-black on the warm page and near-white in the control room; its "ai" is
 * Forge Orange in both. The icon mark is Forge Orange throughout.
 *
 * Ink is set explicitly rather than inherited. DESIGN.md correction 14: a
 * component that leans on inherited colour renders in whatever theme its
 * ancestor happened to resolve, which is exactly the bug that correction records.
 *
 * ── Sizes come from a ladder ─────────────────────────────────────────────
 * Three steps, and the width is always stated alongside the height. Inline SVG
 * cannot shift the layout the way a loading bitmap could, but a stated box still
 * keeps the header's measurements readable rather than implied by a viewBox.
 */

const HEIGHTS = { sm: 20, md: 24, lg: 30 }

/**
 * @param {object} props
 * @param {'wordmark'|'mark'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 */
export function BrandLockup({ variant = 'wordmark', size = 'sm', className }) {
  const { t } = useTranslation('common')
  const height = HEIGHTS[size]
  const isMark = variant === 'mark'

  return (
    <span className={cn('inline-flex shrink-0 items-center', className)}>
      {isMark ? (
        <ForgeMark className="text-forge" style={{ width: height, height }} />
      ) : (
        <BrandWordmark
          className="text-ink"
          style={{ height, width: height * WORDMARK_RATIO }}
        />
      )}
      {/* The name, once, for assistive tech. Both forms are decorative artwork:
          ForgeMark sets `aria-hidden` unconditionally — correct for the dozens
          of decorative places it appears — and an aria-hidden element is out of
          the accessibility tree whatever role you give it. This does not depend
          on out-arguing that. */}
      <span className="sr-only">{t('brand.name')}</span>
    </span>
  )
}
