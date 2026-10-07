import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { useDeleteRole, useRoles } from '@/features/people/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { useToast } from '@/providers/ToastProvider'
import { cn } from '@/lib/cn'
import { PermissionMatrixDialog } from './PermissionMatrixDialog'
import { RoleEditorDrawer } from './RoleEditorDrawer'

/**
 * Settings → Roles & permissions.
 *
 * DEMO. See `DEMO-MODE.md` §8.15.
 *
 * ── The modules are this product's modules ────────────────────────────────
 * The catalogue is the navigation rail: every permission names a screen with a
 * route, an icon and a name the product already gives it. The design invents its
 * own list — "Root Cause Analysis", "Integrations" — half of which does not
 * exist here, and a permission naming a screen nobody can open is one nobody can
 * ever test.
 *
 * ── The grid has a consequence you can look at ────────────────────────────
 * Each module declares the feature that means "can reach it at all", and the
 * role detail draws the rail as somebody holding that role would find it. Strip
 * `anomalies.view` and Anomalies leaves the list while you watch. Without that,
 * a permission grid is a wall of checkboxes nobody can check the effect of —
 * which is what the prototype's is.
 *
 * ── The eight system roles are the vocabulary, not a copy of it ───────────
 * `common:roles` is what the Users table prints, what the create dialog offers
 * and what the bulk import validates against. This page lists exactly those and
 * cannot edit or delete them: removing `maintenanceTechnician` would leave two
 * people holding a role that no longer exists. Duplicate makes an editable copy,
 * which is the design's own answer and the only safe one.
 *
 * ── How many people hold a role is counted ────────────────────────────────
 * The design writes `users: 3` beside each role, free to disagree with the
 * directory. Here it is a count over the registry the Users screen reads, and
 * the names are listed and open.
 */

export function RolesPage() {
  const { t } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('settings.roles.title')} · ${t('common:brand.name')}`)
  const { toast } = useToast()

  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [matrix, setMatrix] = useState(false)

  const roles = useRoles()
  const remove = useDeleteRole()

  const items = roles.data?.items ?? []
  const stats = roles.data?.stats ?? {}
  const catalogue = roles.data?.catalogue ?? []

  /* Derived rather than held in an effect: the first role is the selection until
     somebody picks another, and a role that has just been deleted must not stay
     selected by a state nobody reset. */
  const selected = items.find((role) => role.id === selectedId) ?? items[0] ?? null

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 text-headline">{t('settings.roles.title')}</h1>
          <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
            {t('settings.roles.intro')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ForgeButton disabled={!items.length} onClick={() => setMatrix(true)}>
            <Icon name="board" size="xs" />
            {t('settings.roles.matrix')}
          </ForgeButton>
          <ForgeButton variant="primary" onClick={() => setEditing({ mode: 'create' })}>
            {t('settings.roles.create')}
          </ForgeButton>
        </div>
      </header>

      {roles.isPending ? (
        <SkeletonRows count={5} />
      ) : roles.isError ? (
        <ErrorState
          error={roles.error}
          title={t('settings.roles.loadFailed')}
          onRetry={roles.refetch}
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
            {['total', 'system', 'custom', 'assigned'].map((key) => (
              <div key={key} className="rounded-sm border border-hairline bg-card px-3.5 py-3">
                <Num className="block text-display-sm text-ink">
                  {formatInteger(stats[key] ?? 0)}
                </Num>
                <span className="eyebrow mt-1.5 block">{t(`settings.roles.facets.${key}`)}</span>
                <span className="mt-0.5 block text-micro font-normal text-ink-mute">
                  {t(`settings.roles.facetHints.${key}`)}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 max-xl:grid-cols-1">
            <Panel flush className="overflow-hidden">
              <div className="border-b border-hairline px-3.5 py-2.5">
                <Eyebrow>{t('settings.roles.listLabel')}</Eyebrow>
              </div>
              <ul className="m-0 flex max-h-[34rem] list-none flex-col overflow-y-auto p-0">
                {items.map((role) => (
                  <li key={role.id}>
                    <button
                      type="button"
                      aria-current={selected?.id === role.id ? 'true' : undefined}
                      onClick={() => setSelectedId(role.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 border-s-[3px] px-3.5 py-2.5 text-start transition-colors',
                        selected?.id === role.id
                          ? 'border-s-forge tint-forge'
                          : 'border-s-transparent hover:bg-sunken',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-body-sm font-semibold text-ink">
                            <RoleName role={role} />
                          </span>
                          <TypePill system={role.system} />
                        </span>
                        <Num className="mt-0.5 block text-micro font-normal text-ink-dim">
                          {t('settings.roles.summary', {
                            permissions: role.grantCount,
                            users: role.userCount,
                          })}
                        </Num>
                      </span>
                      <Icon name="right" size="xs" className="mirror-rtl text-ink-mute" />
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>

            {selected ? (
              <RoleDetail
                role={selected}
                catalogue={catalogue}
                onDuplicate={() => setEditing({ mode: 'duplicate', role: selected })}
                onEdit={() => setEditing({ mode: 'edit', role: selected })}
                onDelete={() =>
                  remove.mutate(selected.id, {
                    onSuccess: () => {
                      toast(t('settings.roles.deleted'), 'ok')
                      setSelectedId(null)
                    },
                    onError: () => toast(t('settings.roles.deleteRefused'), 'critical'),
                  })
                }
                deleting={remove.isPending}
              />
            ) : null}
          </div>
        </>
      )}

      <RoleEditorDrawer
        request={editing}
        catalogue={catalogue}
        onClose={() => setEditing(null)}
        onSaved={(role) => setSelectedId(role.id)}
      />
      <PermissionMatrixDialog
        open={matrix}
        roles={items}
        catalogue={catalogue}
        onClose={() => setMatrix(false)}
      />
    </div>
  )
}

/** A system role's name is a translated key; a custom one's is what somebody typed. */
function RoleName({ role }) {
  const { t } = useTranslation(['app', 'common'])
  return <>{role.system ? t(`common:roles.${role.id}`) : role.name}</>
}

function TypePill({ system }) {
  const { t } = useTranslation('app')
  return (
    <span
      className={cn(
        'shrink-0 rounded-pill px-2 py-[2px] text-micro whitespace-nowrap',
        system ? 'bg-sunken text-ink-dim' : cn(TINT_CLASS.forge, ON_TINT_CLASS.forge),
      )}
    >
      {t(system ? 'settings.roles.system' : 'settings.roles.custom')}
    </span>
  )
}

/* ══ DETAIL ══════════════════════════════════════════════════════════════ */

function RoleDetail({ role, catalogue, onDuplicate, onEdit, onDelete, deleting }) {
  const { t } = useTranslation(['app', 'common'])
  const total = catalogue.reduce((sum, module) => sum + module.features.length, 0)

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
          <div className="min-w-0">
            <h2 className="m-0 flex items-center gap-2.5 text-title">
              <RoleName role={role} />
              <TypePill system={role.system} />
            </h2>
            <p className="mt-1.5 mb-0 max-w-[60ch] text-body-sm text-ink-dim">
              {role.system
                ? t(`settings.roles.descriptions.${role.id}`)
                : (role.description ?? t('settings.roles.noDescription'))}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ForgeButton size="sm" onClick={onDuplicate}>
              {t('settings.roles.duplicate')}
            </ForgeButton>
            {!role.system ? (
              <>
                <ForgeButton size="sm" onClick={onEdit}>
                  {t('common:actions.edit')}
                </ForgeButton>
                <ForgeButton size="sm" disabled={deleting} onClick={onDelete}>
                  {t('common:actions.delete')}
                </ForgeButton>
              </>
            ) : null}
          </div>
        </div>

        <dl className="mt-4 mb-0 grid grid-cols-3 gap-3.5 border-t border-subtle pt-3.5 max-sm:grid-cols-2">
          {[
            ['permissions', `${role.grantCount} / ${total}`],
            ['modules', `${role.moduleCount} / ${catalogue.length}`],
            ['holders', formatInteger(role.userCount)],
          ].map(([key, value]) => (
            <div key={key}>
              <dt className="eyebrow">{t(`settings.roles.stat.${key}`)}</dt>
              <dd className="m-0 mt-1">
                <Num className="text-title">{value}</Num>
              </dd>
            </div>
          ))}
        </dl>

        {role.system ? (
          <p className="mt-3.5 mb-0 max-w-[60ch] text-micro font-normal text-ink-dim">
            {t('settings.roles.systemNote')}
          </p>
        ) : null}
      </Panel>

      {/* The consequence. A grid without this is a wall of checkboxes nobody can
          check the effect of. */}
      <Panel className="p-4">
        <Eyebrow className="mb-2">{t('settings.roles.reaches')}</Eyebrow>
        {role.reaches.length ? (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {catalogue
              .filter((module) => role.reaches.includes(module.id))
              .map((module) => (
                <li key={module.id}>
                  <Link
                    to={module.to}
                    className="flex items-center gap-1.5 rounded-pill tint-green px-2.5 py-1 text-micro text-on-green"
                  >
                    <Icon name={module.icon} size="xs" />
                    {t(`screens.${module.id}`)}
                  </Link>
                </li>
              ))}
          </ul>
        ) : (
          <p className="m-0 text-body-sm text-on-amber">{t('settings.roles.reachesNothing')}</p>
        )}
        <p className="mt-2.5 mb-0 max-w-[60ch] text-micro font-normal text-ink-mute">
          {t('settings.roles.reachesNote')}
        </p>
      </Panel>

      <Panel flush className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-hairline px-3.5 py-2.5">
          <Eyebrow className="flex-1">{t('settings.roles.granted')}</Eyebrow>
          <Num className="text-micro font-normal text-ink-dim">
            {role.grantCount} / {total}
          </Num>
        </div>
        <ul className="m-0 flex max-h-[26rem] list-none flex-col overflow-y-auto p-0">
          {catalogue.map((module) => {
            const on = module.features.filter((f) => role.grant[`${module.id}.${f}`])
            return (
              <li key={module.id} className="border-b border-subtle px-3.5 py-3 last:border-0">
                <div className="flex items-center gap-2.5">
                  <Icon
                    name={module.icon}
                    size="sm"
                    className={on.length ? 'text-on-forge' : 'text-ink-mute'}
                  />
                  <span className="flex-1 text-body-sm font-semibold text-ink">
                    {t(`screens.${module.id}`)}
                  </span>
                  <Num className="text-micro font-normal text-ink-dim">
                    {on.length} / {module.features.length}
                  </Num>
                </div>
                <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0 ps-7">
                  {module.features.map((feature) => {
                    const granted = Boolean(role.grant[`${module.id}.${feature}`])
                    return (
                      <li
                        key={feature}
                        className={cn(
                          'rounded-pill px-2.5 py-[3px] text-micro whitespace-nowrap',
                          granted
                            ? cn(TINT_CLASS.green, ON_TINT_CLASS.green)
                            : 'bg-sunken text-ink-mute line-through decoration-ink-mute',
                        )}
                      >
                        {t(`settings.roles.features.${feature}`)}
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}
