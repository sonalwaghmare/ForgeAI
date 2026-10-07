import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Field } from '@/components/forge/Field'
import { useConfigureChannel } from '@/features/notifications/queries'
import { useToast } from '@/providers/ToastProvider'

/**
 * Point a delivery channel somewhere.
 *
 * DEMO. Its own file because two screens open it: Notifications, where the
 * channel cards sit beside the rules that route to them, and Settings →
 * Integrations, where the same five channels are the design's Notifications
 * connector cards. Two copies of a one-field dialog would be two places for the
 * rule below to be got right once and wrong once.
 *
 * One field, because one field is what a channel is: an address to deliver to.
 * Clearing it DISCONNECTS the channel, which is the honest inverse of
 * configuring it — and every rule routed there goes to "undeliverable" as it
 * happens, which is the join the Notifications screen exists to show.
 */
export function ChannelDialog({ channel, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const configure = useConfigureChannel()
  const [target, setTarget] = useState(channel.target ?? '')

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="sm"
      title={t('notifications.channels.dialogTitle', {
        channel: t(`notifications.channel.${channel.id}`),
      })}
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <span className="flex-1" />
          <ForgeButton
            variant="primary"
            disabled={configure.isPending}
            onClick={() =>
              configure.mutate(
                { id: channel.id, target },
                {
                  onSuccess: () => {
                    toast(
                      t(
                        target.trim()
                          ? 'notifications.channels.configured'
                          : 'notifications.channels.disconnected',
                      ),
                      'ok',
                    )
                    onClose()
                  },
                },
              )
            }
          >
            {t('common:actions.save')}
          </ForgeButton>
        </>
      }
    >
      <Field
        id="channel-target"
        label={t(`notifications.channels.targetLabel.${channel.id}`)}
        hint={t('notifications.channels.targetHint')}
        value={target}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => setTarget(event.target.value)}
      />
    </ForgeDialog>
  )
}
