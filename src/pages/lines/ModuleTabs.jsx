import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

/**
 * Lines · Assets — the module's two views of one plant.
 *
 * ── Links, not local state ────────────────────────────────────────────────
 * The prototype holds the active tab in a `useState`, which means the assets
 * view has no URL: you cannot link somebody to it, cannot bookmark it, and the
 * back button takes you out of the module rather than back to the other tab.
 * Two routes cost nothing and fix all three.
 *
 * `end` on the Lines link because it sits at the module root, and without it
 * every deeper route — a line, an asset — would light it up as well.
 */
export function ModuleTabs() {
  const { t } = useTranslation('app')

  const tabs = [
    { to: '/app/assets', label: t('assets.tabs.lines'), end: true },
    { to: '/app/assets/all', label: t('assets.tabs.assets'), end: false },
  ]

  return (
    <nav aria-label={t('assets.tabsLabel')} className="mb-5 flex gap-1 border-b border-hairline">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              '-mb-px border-b-2 px-3.5 py-2.5 text-body transition-colors',
              isActive
                ? 'border-forge font-semibold text-ink'
                : 'border-transparent text-ink-dim hover:text-ink',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
