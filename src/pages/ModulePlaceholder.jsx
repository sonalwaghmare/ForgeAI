import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { Panel } from '@/components/forge/Panel'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow } from '@/components/forge/primitives'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ALL_NAV_ITEMS } from '@/shell/navigation'

/**
 * A module that exists in the information architecture but has not been built.
 *
 * Deliberately not a fake screen. The rail shows the real IA because that is
 * what the product is, and a placeholder that says so is more useful than
 * plausible-looking charts nobody can trust.
 */
export function ModulePlaceholder() {
  const { t } = useTranslation('app')
  const { pathname } = useLocation()
  const item = ALL_NAV_ITEMS.find((entry) => entry.to === pathname)

  return (
    <Page>
      <Eyebrow className="mb-2.5">{t('placeholder.eyebrow')}</Eyebrow>
      <h1 className="m-0 text-display">{item ? t(`screens.${item.id}`) : t('placeholder.title')}</h1>

      <Panel className="mt-5 max-w-[60ch]">
        <div className="flex items-start gap-3">
          <Icon name={item?.icon ?? 'layers'} size="lg" className="mt-0.5 text-ink-mute" />
          <div>
            <p className="m-0 text-body">{t('placeholder.body')}</p>
            <p className="mt-2 mb-0 text-body-sm text-ink-dim">{t('placeholder.builtSoFar')}</p>
            <ForgeButton asChild variant="primary" className="mt-4">
              <Link to="/app/anomalies">{t('screens.anomalies')}</Link>
            </ForgeButton>
          </div>
        </div>
      </Panel>
    </Page>
  )
}

/** Route that matched nothing. */
export function NotFoundPage() {
  const { t } = useTranslation(['app', 'common'])
  return (
    <div className="mx-auto max-w-[52ch] px-6 py-20 text-center">
      <Icon name="search" size="lg" className="mx-auto text-ink-mute" />
      <h1 className="mt-4 text-headline">{t('notFound.title')}</h1>
      <p className="mt-2 text-body text-ink-dim">{t('notFound.body')}</p>
      <div className="mt-5 flex justify-center gap-2">
        <ForgeButton asChild variant="primary">
          <Link to="/">{t('notFound.home')}</Link>
        </ForgeButton>
        <ForgeButton asChild>
          <Link to="/app/anomalies">{t('notFound.app')}</Link>
        </ForgeButton>
      </div>
    </div>
  )
}
