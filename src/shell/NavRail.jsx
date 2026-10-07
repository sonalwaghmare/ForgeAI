import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'
import { initialsFrom } from '@/lib/format'
import { Icon } from '@/components/forge/Icon'
import { useSession, useSignOut } from '@/features/auth/mutations'
import { useEntitlements } from '@/features/operations/queries'
import { useDemoRole } from '@/providers/DemoRoleProvider'
import { NAV_GROUPS } from './navigation'

/**
 * The 212px global sidebar, collapsing to 60px.
 *
 * Active state is not colour alone: the accent tint, Forge Orange ink, a
 * semibold weight and a 3px leading edge, with compensating inline-start
 * padding so the label does not shift by 3px when it becomes active.
 *
 * Collapsed, group headings become hairline rules rather than disappearing —
 * the grouping is information, not decoration.
 */
export function NavRail({ collapsed }) {
  const { t } = useTranslation(['app', 'common'])
  const { data: entitlements } = useEntitlements()
  // `person` is deliberately NOT read from here. The role switcher below drives
  // the AI briefing, and the fixture person attached to a role is not whoever is
  // signed in — rendering them as the account holder states something false.
  const { role, setRole, roles } = useDemoRole()
  const { data: session } = useSession()
  const navigate = useNavigate()
  const signOut = useSignOut()
  const modules = entitlements?.modules
  const user = session?.user ?? null

  function handleSignOut() {
    // `replace` so Back cannot return to a screen the guard will now refuse,
    // which would present as the app flickering between two pages.
    signOut.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
  }

  return (
    <nav
      aria-label={t('common:nav.main')}
      className={cn(
        'flex shrink-0 flex-col overflow-y-auto border-e border-hairline bg-nav py-2',
        '[contain:layout_paint] [transition:width_.18s_ease]',
        collapsed ? 'w-15' : 'w-53',
      )}
      style={{ width: collapsed ? 'var(--rail-w-collapsed)' : 'var(--rail-w)' }}
    >
      {NAV_GROUPS.map((group) => {
        // Plan entitlement decides what renders. An empty group renders nothing
        // rather than an empty heading.
        const items = group.items.filter((item) => modules?.[item.entitlement] !== false)
        if (!items.length) return null

        return (
          <div key={group.id}>
            {collapsed ? (
              <div className="mx-3 my-2 h-px bg-subtle" aria-hidden="true" />
            ) : (
              <div className="eyebrow px-4 pt-2.5 pb-1.5 tracking-[0.7px]">
                {t(`modules.${group.id}`)}
              </div>
            )}
            {items.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                title={t(`screens.${item.id}`)}
                className={({ isActive }) =>
                  cn(
                    'mx-1.5 my-px flex items-center gap-2.5 rounded-md border-s-[3px] border-s-transparent',
                    'py-1.5 text-body-sm transition-colors',
                    collapsed ? 'justify-center border-s-0 px-0' : 'px-4',
                    isActive
                      ? 'tint-forge border-s-forge font-semibold text-on-forge'
                      : 'text-ink-dim hover:bg-sunken hover:text-ink',
                    // Compensate for the 3px edge so the label holds position.
                    isActive && !collapsed && 'ps-[13px]',
                    // Floor legibility: bigger target and type on a tablet.
                    'max-lg:py-2.5 max-lg:text-body',
                  )
                }
              >
                <Icon name={item.icon} size="nav" />
                {!collapsed ? (
                  /* Label and tag share one row of their own so the gap between
                     them is 6px rather than the item's 10px, and `truncate` is
                     the floor: at 212px a two-word module name plus a tag is
                     within a few pixels of wrapping, and a rail item that
                     silently becomes two lines tall breaks the rhythm of the
                     whole column. */
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate">{t(`screens.${item.id}`)}</span>
                    {/* Said in the rail rather than only on the screen, so
                        nobody walks into an unfinished module expecting a
                        finished one. Hidden when collapsed: at 60px the label
                        is already gone and a bare pill would be unreadable —
                        the title attribute carries the name there, and maturity
                        is not urgent enough to spend the only visible pixels
                        on. */}
                    {item.beta ? (
                      <span className="shrink-0 rounded-xs tint-violet px-1 py-px text-[8px] font-bold tracking-[0.3px] text-on-violet uppercase">
                        {t('common:badge.beta')}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </div>
        )
      })}

      <div className="mt-auto border-t border-hairline p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-start transition-colors hover:bg-sunken"
              aria-label={t('user.menu')}
            >
              {/* The signed-in account, from the sign-in response. Initials are
                  derived from the name because the API returns no avatar and no
                  initials field. */}
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-sunken text-label font-bold text-ink-dim">
                {user?.name ? initialsFrom(user.name) : '—'}
              </span>
              {!collapsed ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold">
                    {user?.name ?? '—'}
                  </span>
                  {/* The role being PREVIEWED, which is this switcher's own
                      state — not a claim about the account.

                      It used to print the email, on the reasoning that the API
                      returns no role and a job title under someone's name reads
                      as fact. That reasoning still holds for a job title; it
                      does not hold for this, because the value is whatever the
                      menu below was last set to and the menu says "Preview as
                      role" over it. Showing it here is what tells you which
                      briefing you are looking at without opening the menu. */}
                  <span className="block truncate text-label font-bold text-ink-dim">
                    {t(`common:roles.${role}`)}
                  </span>
                </span>
              ) : null}
              {!collapsed ? <Icon name="up" size="sm" className="text-ink-mute" /> : null}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="min-w-[240px]">
            {/* The role switcher. A demo affordance that changes the briefing and
                nothing else — it grants no permission and hides no data.

                That used to be spelled out in a line of copy under the options.
                The menu's own heading is "Preview as role", which carries it:
                "preview" is the word that says this is a view and not a grant,
                and a sentence repeating it under three items made a two-line
                menu into a paragraph. The claim is unchanged and still recorded
                in `DemoRoleProvider`, where the behaviour is. */}
            {/* `text-label` for the reason spelled out at the same pairing in
                TopBar: the primitive's own `text-sm` outlives `eyebrow`. */}
            <DropdownMenuLabel className="eyebrow text-label">
              {t('home.roleSwitch.label')}
            </DropdownMenuLabel>
            {roles.map((option) => (
              <DropdownMenuItem
                key={option}
                onSelect={() => setRole(option)}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-body-sm">{t(`common:roles.${option}`)}</span>
                {option === role ? <Icon name="check" size="sm" className="text-forge" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut} className="text-body-sm">
              <Icon name="lock" size="sm" className="text-ink-mute" />
              {t('home.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
