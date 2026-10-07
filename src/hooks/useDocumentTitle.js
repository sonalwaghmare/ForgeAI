import { useEffect } from 'react'

/**
 * Keeps the document title and meta description in step with the route.
 *
 * An SPA that only sets these in index.html shows the landing page's title on
 * every application screen, and never restores it when the user navigates back —
 * which also means a shared link's preview is wrong. Both values come from the
 * i18n layer, so they translate with everything else.
 */
export function useDocumentTitle(title, description) {
  useEffect(() => {
    if (!title) return undefined
    const previous = document.title
    document.title = title

    let meta = null
    let previousDescription = null
    if (description) {
      meta = document.querySelector('meta[name="description"]')
      if (meta) {
        previousDescription = meta.getAttribute('content')
        meta.setAttribute('content', description)
      }
    }

    return () => {
      document.title = previous
      if (meta && previousDescription !== null) meta.setAttribute('content', previousDescription)
    }
  }, [title, description])
}
