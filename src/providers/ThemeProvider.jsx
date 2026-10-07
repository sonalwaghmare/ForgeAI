import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Theme and accessible-colour mode.
 *
 * Light is the default and it is not a category habit: the plant floor is
 * bright, often daylit through roof lights, and read at arm's length with glare
 * on the screen. Dark exists for the control room, which runs 24 hours and is
 * frequently dim. Both are real conditions for real users, so both are
 * first-class and the choice belongs to the person, persisted.
 *
 * Deliberately NOT seeded from prefers-color-scheme: an operator's laptop being
 * in dark mode says nothing about the light falling on the screen they are
 * reading a vibration threshold from.
 */

const ThemeContext = createContext(null)

const STORAGE_THEME = 'forge.theme'
const STORAGE_CB = 'forge.colourBlind'

const read = (key, fallback) => {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (read(STORAGE_THEME, 'light') === 'dark' ? 'dark' : 'light'))
  const [colourBlind, setColourBlind] = useState(() => read(STORAGE_CB, 'false') === 'true')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem(STORAGE_THEME, theme)
    } catch {
      /* Private browsing. The theme still applies for this session. */
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('cb', colourBlind)
    try {
      window.localStorage.setItem(STORAGE_CB, String(colourBlind))
    } catch {
      /* ignore */
    }
  }, [colourBlind])

  const value = useMemo(
    () => ({
      theme,
      colourBlind,
      isDark: theme === 'dark',
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      toggleColourBlind: () => setColourBlind((current) => !current),
      setTheme,
    }),
    [theme, colourBlind],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}

/**
 * Marks the document as the application shell rather than a document surface.
 * The shell never scrolls; the public page must. Scoping this by attribute
 * keeps both true without a stylesheet fork.
 */
export function useAppSurface(active) {
  useEffect(() => {
    if (!active) return undefined
    document.body.dataset.surface = 'app'
    return () => {
      delete document.body.dataset.surface
    }
  }, [active])
}

/** Read once, outside React, for anything that needs the current mode. */
export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export { ThemeContext }
