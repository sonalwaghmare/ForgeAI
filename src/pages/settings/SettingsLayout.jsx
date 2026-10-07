import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eyebrow } from '@/components/forge/primitives'
import { config } from '@/services/config'
import { cn } from '@/lib/cn'

/**
 * Settings carries its own side navigation inside the content region rather than
 * extending the global rail.
 *
 * That is deliberate, and DESIGN.md records why: Settings is a configuration
 * world with its own vocabulary, and promoting its twelve items into the global
 * rail would drown the six operational ones an operator actually uses on shift.
 * 240px, per the documented panel ladder.
 */

/**
 * The settings rail, in the design's own grouping.
 *
 * Reconciled with `platform/screens-settings.jsx` rather than left as it was.
 * Two items here had nothing behind them and never would:
 *
 *   - **Data Sources** is Data Fusion. That module owns the source registry,
 *     four screens read it, and a second list of connections in Settings is the
 *     defect this effort has caught four times over.
 *   - **AI & Assistant** is not a page the design has. Building one would have
 *     meant inventing a screen rather than reproducing one.
 *
 * `API & Webhooks` takes the second slot, because the design does have it.
 * `Asset Classes` stays although the design does not list it: it is a live API
 * resource of this product's own, and dropping a built screen to match a
 * prototype would be the tail wagging the dog.
 */
export const SETTINGS_SECTIONS = [
  {
    id: 'organisation',
    pages: [
      { id: 'general', to: '/app/settings/general', built: false, demoBuilt: true },
      // Above the hierarchy on purpose: a class is what a hierarchy record is an
      // instance of, so the library is defined before the plant is described.
      { id: 'assetClasses', to: '/app/settings/asset-classes', built: true },
      { id: 'hierarchy', to: '/app/settings/hierarchy', built: true },
      { id: 'modules', to: '/app/settings/modules', built: false, demoBuilt: true },
    ],
  },
  {
    id: 'people',
    pages: [
      { id: 'users', to: '/app/settings/users', built: false, demoBuilt: true },
      { id: 'roles', to: '/app/settings/roles', built: false, demoBuilt: true },
      { id: 'security', to: '/app/settings/security', built: false, demoBuilt: true },
    ],
  },
  {
    id: 'connectivity',
    pages: [
      { id: 'integrations', to: '/app/settings/integrations', built: false, demoBuilt: true },
      { id: 'notifications', to: '/app/settings/notifications', built: false, demoBuilt: true },
      { id: 'api', to: '/app/settings/api', built: false, demoBuilt: true },
    ],
  },
  {
    id: 'platform',
    pages: [
      { id: 'audit', to: '/app/settings/audit', built: false, demoBuilt: true },
      { id: 'billing', to: '/app/settings/billing', built: false, demoBuilt: true },
    ],
  },
]

export const ALL_SETTINGS_PAGES = SETTINGS_SECTIONS.flatMap((section) => section.pages)

/**
 * Whether a settings page has a screen behind it.
 *
 * The same three-state arrangement `shell/navigation.js` and
 * `pages/dataFusion/sections.js` use: `built` is the live product, `demoBuilt` is
 * a screen that only exists behind the flag. With the flag off those fall back to
 * the placeholder, so the router and the rail cannot disagree about what is
 * there.
 */
export const isSettingsPageBuilt = (page) =>
  Boolean(page.built || (config.demoMode && page.demoBuilt))

export function SettingsLayout() {
  const { t } = useTranslation('app')

  return (
    <div className="flex min-h-full items-stretch">
      {/* The rail stays put while the page scrolls.

          Settings is thirteen pages and several of them are long — Billing runs
          to six panels. With the rail in normal flow it scrolled away with the
          content, so by the time you reached the invoices there was no way to
          reach another page without scrolling back up.

          Two elements rather than one, and the split is load-bearing: a sticky
          box cannot also stretch to its parent's height, so the COLUMN keeps
          `items-stretch` and carries the border and the background full height,
          and the `<nav>` inside it is what sticks. One element doing both left
          the rule ending halfway down the page.

          `top-0` is the top of `#content`, which is the scrollport — the top bar
          is outside it, so no offset is needed. */}
      <div className="w-60 shrink-0 border-e border-hairline bg-nav max-lg:hidden">
        <nav
          aria-label={t('settings.nav.label')}
          className="sticky top-0 max-h-[100dvh] overflow-y-auto py-4"
        >
          {SETTINGS_SECTIONS.map((section) => (
            <div key={section.id} className="mb-2">
              <Eyebrow className="px-4 pt-2.5 pb-1.5">{t(`settings.sections.${section.id}`)}</Eyebrow>
              {section.pages.map((page) => (
                <NavLink
                  key={page.id}
                  to={page.to}
                  className={({ isActive }) =>
                    cn(
                      'mx-1.5 my-px flex items-center gap-2 rounded-md border-s-[3px] border-s-transparent px-4 py-1.5',
                      'text-body-sm transition-colors',
                      isActive
                        ? 'tint-forge border-s-forge ps-[13px] font-semibold text-on-forge'
                        : 'text-ink-dim hover:bg-sunken hover:text-ink',
                    )
                  }
                >
                  {t(`settings.pages.${page.id}`)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* On a tablet the nested nav collapses to a scrolling strip — a 240px
          column plus a 212px rail plus content does not fit, and Settings is a
          desk surface anyway. */}
      <div className="min-w-0 flex-1">
        <div className="hidden overflow-x-auto border-b border-hairline bg-nav px-4 py-2 max-lg:block">
          <div className="flex gap-1.5">
            {ALL_SETTINGS_PAGES.map((page) => (
              <NavLink
                key={page.id}
                to={page.to}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 rounded-sm border px-3 py-2.5 text-body-sm whitespace-nowrap',
                    isActive
                      ? 'border-forge/40 tint-forge font-semibold text-on-forge'
                      : 'border-hairline bg-card text-ink-dim',
                  )
                }
              >
                {t(`settings.pages.${page.id}`)}
              </NavLink>
            ))}
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}

/** A settings page that exists in the IA but has not been built. */
export function SettingsPlaceholder() {
  const { t } = useTranslation('app')
  return (
    <div className="max-w-[60ch] px-8 py-6 max-xl:px-5.5">
      <Eyebrow className="mb-2.5">{t('placeholder.eyebrow')}</Eyebrow>
      <h1 className="m-0 text-headline">{t('settings.title')}</h1>
      <p className="mt-3 text-body text-ink-dim">{t('settings.placeholderPage.body')}</p>
    </div>
  )
}
