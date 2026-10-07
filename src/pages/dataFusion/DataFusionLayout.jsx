import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { Eyebrow } from '@/components/forge/primitives'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { ALL_FUSION_SECTIONS, FUSION_GROUPS, fusionPath } from './sections'

/**
 * Data Fusion carries its own section navigation inside the content region — the
 * same arrangement Settings uses, and for the same reason DESIGN.md gives there:
 * eleven source families promoted into the global rail would bury the six
 * operational modules an operator uses on shift. 240px, off the documented panel
 * ladder.
 *
 * ── No counts in the rail ────────────────────────────────────────────────
 * The prototype badges Documents with 12 and Media with 4. Those are counts of
 * things in sections that do not exist here, so a number beside them would be
 * invented — and it would sit next to a label that opens a "not built yet"
 * screen, which is worse than no number at all. Counts belong on the screen that
 * owns them, where they can also be filters.
 *
 * ── The document title belongs to the leaf screen, never here ────────────
 * React runs effects bottom-up, so a title set by this layout would land AFTER
 * the child's on a first paint and overwrite it — a pasted deep link would open
 * showing "Data Fusion" instead of the section. Same arrangement as Settings.
 */
export function DataFusionLayout() {
  const { t } = useTranslation('app')

  return (
    <div className="flex min-h-full items-stretch">
      <nav
        aria-label={t('dataFusion.nav.label')}
        className="w-60 shrink-0 border-e border-hairline bg-nav py-4 max-lg:hidden"
      >
        <div className="px-4 pb-2">
          <h2 className="m-0 text-title">{t('screens.dataFusion')}</h2>
          <p className="mt-1 mb-0 text-body-sm text-ink-dim">{t('dataFusion.nav.tagline')}</p>
        </div>

        {FUSION_GROUPS.map((group) => (
          <div key={group.id} className="mb-2">
            <Eyebrow className="px-4 pt-2.5 pb-1.5">{t(`dataFusion.groups.${group.id}`)}</Eyebrow>
            {group.sections.map((section) => (
              <NavLink
                key={section.id}
                to={fusionPath(section.id)}
                className={({ isActive }) =>
                  cn(
                    'mx-1.5 my-px flex items-center gap-2.5 rounded-md border-s-[3px] border-s-transparent',
                    'px-4 py-1.5 text-body-sm transition-colors',
                    isActive
                      ? 'tint-forge border-s-forge ps-[13px] font-semibold text-on-forge'
                      : 'text-ink-dim hover:bg-sunken hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      name={section.icon}
                      size="nav"
                      className={cn(!isActive && 'text-ink-mute')}
                    />
                    <span className="min-w-0 flex-1">{t(`dataFusion.sections.${section.id}`)}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Below lg the rail becomes a scrolling strip. Data Fusion is a desk
          surface — a 240px column beside the 212px global rail and a seven-column
          table does not fit a tablet — but the sections still have to be
          reachable from one. */}
      <div className="min-w-0 flex-1">
        <div className="hidden overflow-x-auto border-b border-hairline bg-nav px-4 py-2 max-lg:block">
          <div className="flex gap-1.5">
            {ALL_FUSION_SECTIONS.map((section) => (
              <NavLink
                key={section.id}
                to={fusionPath(section.id)}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 rounded-sm border px-3 py-2.5 text-body-sm whitespace-nowrap',
                    isActive
                      ? 'border-forge/40 tint-forge font-semibold text-on-forge'
                      : 'border-hairline bg-card text-ink-dim',
                  )
                }
              >
                {t(`dataFusion.sections.${section.id}`)}
              </NavLink>
            ))}
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}

/**
 * A source family that exists in the IA and has no screen yet.
 *
 * It names what that section will hold rather than saying "coming soon", because
 * the useful question a reader has here is "can this platform ingest my
 * historian" — and the answer is yes, not through this screen. The generic
 * ModulePlaceholder cannot say that; each section's own sentence can.
 */
export function FusionSectionPlaceholder() {
  const { t } = useTranslation(['app', 'common'])
  const { pathname } = useLocation()
  const section = ALL_FUSION_SECTIONS.find((entry) => fusionPath(entry.id) === pathname)

  const title = section ? t(`dataFusion.sections.${section.id}`) : t('screens.dataFusion')
  useDocumentTitle(`${title} · ${t('common:brand.name')}`)

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <h1 className="m-0 text-headline">{title}</h1>

      <Panel className="mt-5 max-w-[64ch]">
        <div className="flex items-start gap-3">
          <Icon name={section?.icon ?? 'plug'} size="lg" className="mt-0.5 text-ink-mute" />
          <div className="min-w-0">
            <p className="m-0 text-body">
              {section
                ? t(`dataFusion.sectionIntros.${section.id}`)
                : t('dataFusion.placeholder.unknown')}
            </p>
            <p className="mt-2.5 mb-0 text-body-sm text-ink-dim">
              {t('dataFusion.placeholder.notBuilt')}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}
