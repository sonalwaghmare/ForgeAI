import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'
import { Num } from './primitives'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The table footer DESIGN.md commits every table to: "Showing X–Y of Z", a
 * rows-per-page select, and elided page numbers — and it actually paginates.
 *
 * First implementation of that commitment, so it lives here rather than in the
 * screen that needed it. A footer copied into the second table is a footer that
 * disagrees with the first by the third.
 *
 * ── Why a native select for rows-per-page ────────────────────────────────
 * ForgeSelect is the product's select and it is right for a form field: 44px
 * tall, a visible label above it, a Radix listbox underneath. None of that fits
 * a chrome control sitting in a table footer. A native `<select>` here is not a
 * downgrade — it is keyboard-accessible and screen-reader labelled, and it does
 * not need to be told what a combobox is.
 *
 * @param {object} props
 * @param {number} props.total       Rows across every page.
 * @param {number} props.page        1-indexed.
 * @param {number} props.pageSize
 * @param {(page: number) => void} props.onPageChange
 * @param {(size: number) => void} props.onPageSizeChange
 * @param {string} props.label       Translated noun for the rows — "sources".
 */
export function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label,
  className,
}) {
  const { t } = useTranslation()
  const selectId = useId()

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-hairline px-3.5 py-2.5',
        className,
      )}
    >
      <p className="m-0 text-body-sm text-ink-dim">
        <Num>
          {t('pagination.showing', {
            first: formatInteger(first),
            last: formatInteger(last),
            total: formatInteger(total),
            label,
          })}
        </Num>
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={selectId} className="text-body-sm text-ink-dim">
          {t('pagination.rowsPerPage')}
        </label>
        <select
          id={selectId}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="num rounded-sm border border-hairline bg-card px-2 py-1 text-body-sm text-ink transition-colors focus:border-forge focus:outline-none"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {formatInteger(size)}
            </option>
          ))}
        </select>

        {/* Rendered even at a single page, with both arrows disabled. The footer
            then keeps its height and its controls keep their position while you
            filter — a pager that appears and disappears makes the row under the
            table jump — and "‹ 1 ›" states that there is one page rather than
            leaving an absence to interpret. */}
        <nav aria-label={t('pagination.label')} className="flex items-center gap-1">
          <PageStep
            direction="previous"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          />
          {elidedPages(page, pageCount).map((entry, index) =>
            entry === ELLIPSIS ? (
              // Not a button and not announced: it is a gap in a sequence, and a
              // screen reader reading "ellipsis" between page numbers is noise.
              // The numbers either side carry the meaning.
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 text-body-sm text-ink-mute"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                aria-current={entry === page ? 'page' : undefined}
                aria-label={t('pagination.goToPage', { page: formatInteger(entry) })}
                onClick={() => onPageChange(entry)}
                className={cn(
                  'num flex size-8 items-center justify-center rounded-sm text-body-sm transition-colors',
                  entry === page
                    ? 'bg-forge font-semibold text-white'
                    : 'border border-hairline bg-card text-ink-dim hover:border-forge hover:text-ink',
                )}
              >
                {formatInteger(entry)}
              </button>
            ),
          )}
          <PageStep
            direction="next"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          />
        </nav>
      </div>
    </div>
  )
}

/**
 * Rows per page.
 *
 * The top two steps exist for the server-paginated tables. A connection can carry
 * more than ten thousand sensors, and at 50 a page that is 200 pages of a control
 * whose widest form is seven slots — reachable only by stepping. 200 is not an
 * arbitrary ceiling either: `GET /sensors` declares `page_size: int = Query(le=200)`
 * and rejects anything above it with a 422, so it is the largest page the API will
 * serve.
 */
export const PAGE_SIZES = [10, 25, 50, 100, 200]

/**
 * Previous / next.
 *
 * The chevron mirrors under `dir="rtl"` because "previous" is a direction, not a
 * glyph — and it is `disabled` rather than hidden, so the control does not move
 * under the pointer when you reach the last page.
 */
function PageStep({ direction, disabled, onClick }) {
  const { t } = useTranslation()
  const isPrevious = direction === 'previous'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={isPrevious ? t('pagination.previous') : t('pagination.next')}
      className={cn(
        'flex size-8 items-center justify-center rounded-sm border border-hairline bg-card text-ink-dim transition-colors',
        'hover:border-forge hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
    >
      <Icon
        name="right"
        size="sm"
        className={cn(isPrevious ? 'rotate-180 rtl:rotate-0' : 'rtl:rotate-180')}
      />
    </button>
  )
}

const ELLIPSIS = '…'

/**
 * Page numbers with the middle elided.
 *
 * Seven or fewer pages are all shown; beyond that it is first, a window around
 * the current page, and last. The window keeps the same width at every position
 * — including at the ends, where it would otherwise shrink — so the control does
 * not change size as you page through it.
 */
export function elidedPages(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const shown = new Set([1, pageCount, page])
  // One either side normally; at the ends, four on the side that exists, so the
  // row keeps its width.
  if (page <= 3) [2, 3, 4, 5].forEach((n) => shown.add(n))
  else if (page >= pageCount - 2)
    [pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1].forEach((n) => shown.add(n))
  else [page - 1, page + 1].forEach((n) => shown.add(n))

  const pages = [...shown].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)

  const output = []
  let previous = 0
  for (const current of pages) {
    if (previous && current - previous > 1) output.push(ELLIPSIS)
    output.push(current)
    previous = current
  }
  return output
}
