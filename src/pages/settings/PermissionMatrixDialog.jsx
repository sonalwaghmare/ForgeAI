import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { cn } from '@/lib/cn'

/**
 * Every role against every permission.
 *
 * DEMO. See `DEMO-MODE.md` §8.15.
 *
 * ── Why this exists beside the per-role grid ──────────────────────────────
 * The role detail answers "what can this role do". This answers the other
 * question, which is the one an access review actually asks: "who can do this".
 * Reading a feature across the row is how somebody notices that four roles can
 * close a work order.
 *
 * ── A grid is a table, and a table needs headers in both directions ───────
 * The first column is `<th scope="row">` and the role columns are
 * `<th scope="col">`, so a screen reader announces "Approve work orders,
 * Reliability Engineer, granted" rather than reading a wall of ticks. The
 * prototype's is a div grid with no headers at all, which is unreadable by
 * anything that is not a pair of eyes.
 *
 * ── The tick is not the only signal ───────────────────────────────────────
 * Colour alone fails for a colour-blind reader and in print. Granted is a check
 * glyph and withheld is an em dash, both with a `title` naming the state.
 */
export function PermissionMatrixDialog({ open, roles, catalogue, onClose }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="xl"
      title={t('settings.roles.matrixTitle')}
      description={t('settings.roles.matrixSubtitle')}
      footer={
        <>
          <span className="flex-1" />
          <ForgeButton variant="primary" onClick={onClose}>
            {t('common:actions.close')}
          </ForgeButton>
        </>
      }
    >
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t('settings.roles.matrixCaption')}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="eyebrow sticky start-0 top-0 z-20 bg-sunken px-3.5 py-2.5 text-start"
              >
                {t('settings.roles.feature')}
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  scope="col"
                  className="eyebrow sticky top-0 z-10 bg-sunken px-2 py-2.5 text-center align-bottom"
                >
                  <span className="block max-w-[6rem] text-pretty">
                    {role.system ? t(`common:roles.${role.id}`) : role.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalogue.map((module) => (
              <Fragment key={module.id}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={roles.length + 1}
                    className="eyebrow sticky start-0 bg-card px-3.5 py-2 text-start"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name={module.icon} size="xs" className="text-ink-mute" />
                      {t(`screens.${module.id}`)}
                    </span>
                  </th>
                </tr>
                {module.features.map((feature) => (
                  <tr key={feature} className="border-t border-subtle">
                    <th
                      scope="row"
                      className="sticky start-0 bg-card px-3.5 py-2 ps-8 text-start text-body-sm font-normal text-ink-dim"
                    >
                      {t(`settings.roles.features.${feature}`)}
                    </th>
                    {roles.map((role) => {
                      const granted = Boolean(role.grant[`${module.id}.${feature}`])
                      return (
                        <td key={role.id} className="px-2 py-2 text-center">
                          <span
                            title={t(
                              granted
                                ? 'settings.roles.grantedOne'
                                : 'settings.roles.withheld',
                            )}
                            className={cn(
                              'text-body-sm',
                              granted ? 'font-semibold text-on-green' : 'text-ink-mute',
                            )}
                          >
                            {granted ? '✓' : '—'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </ForgeDialog>
  )
}
