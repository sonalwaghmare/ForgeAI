import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

/**
 * Select some text, get an offer to ask the assistant about it.
 *
 * A floating control anchored above whatever the reader has highlighted inside
 * `containerRef`. The pattern is the one ChatGPT and Notion use, and it earns its
 * place here for a reason specific to this product: a generated analysis is long,
 * and the question somebody has about it is almost always about one clause of it.
 * Retyping that clause into the dock is the whole friction, and a quote carried
 * across is the whole fix.
 *
 * ── It fires only for text the SERVER wrote ───────────────────────────────
 * Scoped to a container rather than the document, because offering to explain the
 * page's own furniture — a column header, a button label — would be offering to
 * explain this application to the person using it. The caller puts the ref around
 * the payload and nothing else.
 *
 * ── Positioning is `fixed`, and recomputed on scroll ──────────────────────
 * The selection rectangle comes from `Range.getBoundingClientRect()`, which is
 * viewport-relative — so `fixed` needs no offset arithmetic against the scroll
 * container, which is what makes this work inside a shell where the document
 * itself never scrolls. It follows the selection on scroll rather than hiding: a
 * control that vanishes when the reader nudges the page reads as a glitch.
 *
 * ── `onMouseDown` is prevented, and that is load-bearing ──────────────────
 * Pressing a button clears the selection before the click handler runs, so the
 * quote would be gone by the time it was needed. Preventing the default on
 * mousedown keeps the range alive long enough to read it.
 *
 * ── The floor is one word, not a character count ──────────────────────────
 * This was twelve characters, which is most of a short sentence — so quoting a
 * threshold, a unit or a part number, the things somebody most often wants
 * explained, silently offered nothing at all. A count cannot express the actual
 * rule anyway: twelve characters of punctuation is not a question, and `RPM` is.
 *
 * So the test is that the selection contains a WORD — one run of at least
 * `minWordLength` letters or digits. That admits `RPM` and `4.2` while still
 * rejecting the two cases a count was really there to reject: a stray drag that
 * lands on a bracket or a comma, and a click that selects whitespace. Letters and
 * digits are matched by Unicode property, not `A-Z`, so the rule survives the day
 * this reads a locale that is not Latin.
 *
 * ── `within` narrows it further, to one block at a time ───────────────────
 * A container is the right unit when everything inside it was written by the same
 * author, which is true of an anomaly's record and analysis. It is not true of a
 * conversation: the transcript interleaves what the copilot answered with what the
 * reader typed, and offering to explain somebody their own question is the same
 * mistake as offering to explain a column header.
 *
 * So `within` is a selector the selection must sit inside, and both ends must sit
 * inside the SAME matching element. That second half is what stops a drag from the
 * end of one answer into the next one producing a quote that reads as one passage
 * and is two, with the question between them silently dropped.
 *
 * @param {object} props
 * @param {{current: HTMLElement|null}} props.containerRef the region to watch
 * @param {(quote: string) => void} props.onAsk
 * @param {string} [props.within] CSS selector; when given, the selection must be
 *   inside one element matching it, not merely inside the container
 * @param {number} [props.minWordLength] how many letters or digits in a row
 *   count as a word
 */
export function AskOnSelection({ containerRef, onAsk, within, minWordLength = 2 }) {
  const { t } = useTranslation(['app', 'common'])
  const [anchor, setAnchor] = useState(null)
  const quote = useRef('')

  /* Built once per threshold rather than per event: `selectionchange` fires on
     every frame of a drag, and compiling the same pattern sixty times a second is
     work nobody asked for. No `g` flag, so `.test` carries no `lastIndex` between
     calls — with one it would alternate true and false down a single drag. */
  const hasWord = useMemo(
    () => new RegExp(`[\\p{L}\\p{N}]{${minWordLength},}`, 'u'),
    [minWordLength],
  )

  const read = useCallback(() => {
    const container = containerRef.current
    const selection = typeof window === 'undefined' ? null : window.getSelection()

    if (!container || !selection || selection.isCollapsed || !selection.rangeCount) {
      setAnchor(null)
      return
    }

    const range = selection.getRangeAt(0)

    /**
     * The range actually being quoted — the reader's, narrowed to one block when
     * `within` says to.
     *
     * ── Why this is not `owner(start) === owner(end)` ─────────────────────────
     * It was, and it refused the most ordinary selection there is: the whole
     * answer. Browsers do not put both endpoints inside a block when you select
     * all of it — a triple-click, or a drag past the last character, lands the end
     * on the PARENT node, after the paragraph. Comparing the two owners then
     * compares the paragraph against its container and rejects a selection that is
     * plainly one passage.
     *
     * So the test is which quotable blocks the range TOUCHES. Exactly one is the
     * answer, whether or not the endpoints are tidy; two or more is a drag across
     * a reply and the question above it, which is still refused — that quote would
     * read as one passage and be two, with the reader's own words spliced out of
     * the middle.
     *
     * Then the range is clipped to that block, so what gets quoted is the answer
     * and not the `SOURCES` heading or the disclaimer the drag happened to cross.
     * Clipping rather than refusing is the difference between a control that works
     * the way selection already does and one that asks the reader to select more
     * precisely than they meant to.
     */
    let quoted = range

    if (within) {
      /* `closest` needs an element, and a range end is usually a text node. */
      const owner = (node) => (node.nodeType === 1 ? node : node.parentElement)?.closest(within)

      // The common ancestor is inside a block whenever the whole selection is.
      let block = owner(range.commonAncestorContainer)

      if (!block || !container.contains(block)) {
        const touched = Array.from(container.querySelectorAll(within)).filter((node) =>
          range.intersectsNode(node),
        )
        if (touched.length !== 1) {
          setAnchor(null)
          return
        }
        block = touched[0]
      }

      quoted = range.cloneRange()
      if (!block.contains(quoted.startContainer)) quoted.setStart(block, 0)
      if (!block.contains(quoted.endContainer)) quoted.setEnd(block, block.childNodes.length)
    } else {
      /* Both ends inside the watched region. `contains` on the common ancestor alone
         would accept a selection that starts in the payload and runs off into the
         page's own chrome, and quoting that back would include furniture. */
      if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
        setAnchor(null)
        return
      }
    }

    const text = quoted.toString().replace(/\s+/g, ' ').trim()
    if (!hasWord.test(text)) {
      setAnchor(null)
      return
    }

    /* The clipped range's box, not the reader's. A drag that ran past the answer
       would otherwise anchor the button over text the quote does not include. */
    const rect = quoted.getBoundingClientRect()
    if (!rect.width && !rect.height) {
      setAnchor(null)
      return
    }

    quote.current = text
    setAnchor({ top: rect.top, left: rect.left + rect.width / 2 })
  }, [containerRef, hasWord, within])

  useEffect(() => {
    /* `selectionchange` is the only event that fires for every way a selection can
       be made — drag, double-click, keyboard, Select All — so it is the one to
       listen to rather than assembling `mouseup` plus `keyup` and missing a case. */
    document.addEventListener('selectionchange', read)
    /* Capture, because the scroller is an inner element and scroll does not
       bubble. Passive: this only reads geometry. */
    window.addEventListener('scroll', read, { capture: true, passive: true })
    window.addEventListener('resize', read)
    return () => {
      document.removeEventListener('selectionchange', read)
      window.removeEventListener('scroll', read, { capture: true })
      window.removeEventListener('resize', read)
    }
  }, [read])

  useEffect(() => {
    if (!anchor) return undefined
    const onKeyDown = (event) => event.key === 'Escape' && setAnchor(null)
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [anchor])

  if (!anchor) return null

  /**
   * Rendered into `document.body`, not in place.
   *
   * `position: fixed` is only viewport-relative while no ancestor is a containing
   * block for fixed descendants, and the assistant dock's wrapper is one: it
   * carries `contain: layout paint`, which per spec makes an element exactly that —
   * and, with `overflow-hidden` beside it, clips anything that lands outside its
   * box. Mounted in place, this control was positioned against the dock rather than
   * the viewport and then clipped away, so selecting an answer appeared to do
   * nothing at all.
   *
   * A portal is the fix rather than removing the containment: `contain` is what
   * bounds the reflow of a 360px width animation to the panel, and that is worth
   * more than the convenience of rendering in the tree. It also means any future
   * caller inside a transformed or contained ancestor — a sticky rail, a card that
   * animates — gets correct positioning without discovering this the hard way.
   */
  return createPortal(
    <div
      /* Above the selection and centred on it, clamped so a highlight at the edge
         of the viewport does not push the control off it. */
      className="fixed z-50 -translate-x-1/2 -translate-y-full pb-2"
      style={{
        top: `${Math.max(anchor.top, 44)}px`,
        left: `${Math.min(Math.max(anchor.left, 92), window.innerWidth - 92)}px`,
      }}
    >
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          onAsk(quote.current)
          setAnchor(null)
          window.getSelection()?.removeAllRanges()
        }}
        /**
         * Deliberately quiet.
         *
         * This started as an `ai-gradient` fill, which is the affordance the
         * design system spends on buttons that make the machine WRITE something —
         * Investigate, the assistant's own entry points. This one only carries a
         * quote into a panel, and a gradient on it competed with the analysis it
         * was floating over.
         *
         * So it is the shape every other floating surface in this product takes:
         * a card fill, a hairline, the glass in dark mode. The Violet Reservation
         * is kept as a MARK rather than a fill — the icon is violet and nothing
         * else is, which is the same call `AiBadge` makes.
         */
        className={cn(
          'flex items-center gap-1.5 rounded-sm border border-hairline bg-card px-2.5 py-1.5',
          'text-body-sm text-ink shadow-lift',
          'dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]',
          'transition-colors hover:bg-sunken',
        )}
      >
        <Icon name="ai" size="xs" className="text-violet" />
        {t('anomalies.detail.askForge')}
      </button>
    </div>,
    document.body,
  )
}
