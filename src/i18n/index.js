import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ICU from 'i18next-icu'
import LanguageDetector from 'i18next-browser-languagedetector'

import commonEn from './locales/en/common.json'
import appEn from './locales/en/app.json'
import marketingEn from './locales/en/marketing.json'
import authEn from './locales/en/auth.json'

/**
 * English ships alone, but nothing here assumes it.
 *
 * ICU is wired from day one so plurals are `{count, plural, one{...} other{...}}`
 * rather than `count !== 1 ? 's' : ''` — a hand-built plural cannot be
 * translated, and this product shows live counts everywhere.
 *
 * Resources are bundled statically because one locale does not justify a
 * network round-trip. Adding a second locale means swapping to
 * i18next-http-backend and code-splitting these namespaces; call sites are
 * untouched by that change.
 */

export const SUPPORTED_LOCALES = ['en']
export const DEFAULT_LOCALE = 'en'

export const NAMESPACES = ['common', 'app', 'marketing', 'auth']

i18n
  .use(ICU)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: commonEn, app: appEn, marketing: marketingEn, auth: authEn },
    },
    supportedLngs: SUPPORTED_LOCALES,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: 'common',
    ns: NAMESPACES,
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'forge.locale',
      caches: ['localStorage'],
    },
    interpolation: {
      // React escapes for us; double-escaping mangles copy.
      escapeValue: false,
    },
    returnNull: false,
    // A missing key is a bug. Loud in dev, silent in production.
    saveMissing: false,
    missingKeyHandler: import.meta.env.DEV
      ? (_lng, ns, key) => console.warn(`[i18n] missing key: ${ns}:${key}`)
      : undefined,
    react: { useSuspense: false },
  })

/** Keep the document in sync so CSS `:lang()` and `dir` conditions work. */
function syncDocument(lng) {
  const html = document.documentElement
  html.lang = lng
  html.dir = i18n.dir(lng)
}
syncDocument(i18n.resolvedLanguage || DEFAULT_LOCALE)
i18n.on('languageChanged', syncDocument)

export default i18n
