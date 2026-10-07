import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import {
  addEscalationLevel,
  configureChannel,
  createRule,
  fetchNotifications,
  removeRule,
  setPreference,
  setRuleEnabled,
  testChannel,
  updateRule,
} from './api'

/**
 * The alert-rule configuration.
 *
 * Gated at the hook, as everywhere behind the demo flag. Cached hard — this is
 * settings, not telemetry. Nothing about it changes because the clock moved;
 * only the two mutations below touch it.
 */
export const useNotifications = () =>
  useQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ signal }) => fetchNotifications(signal),
    enabled: config.demoMode,
    staleTime: 10 * 60_000,
  })

/**
 * Toggle a rule.
 *
 * Sweeps the whole key rather than patching the one row in place: turning a
 * rule off changes how many anomalies nothing covers, how many live rules each
 * channel carries, and whether the broken count moves. Those are three other
 * places on the same screen, and a surgical cache write would leave all three
 * stale beside the switch that changed them.
 */
export const useToggleRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setRuleEnabled,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  })
}

export const useCreateRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  })
}

/**
 * Turn a personal digest on or off.
 *
 * Sweeps the same key: the preferences ride on the configuration payload, so a
 * surgical write would have to know where in it they sit.
 */
export const useSetPreference = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setPreference,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  })
}

/**
 * The remaining writes, all sweeping the one key.
 *
 * Every one of them moves a figure somewhere else on the same screen — deleting
 * a rule changes what nothing covers, connecting a channel un-breaks the rules
 * routed to it — so a surgical cache write would leave those stale beside the
 * thing that changed them.
 */
const sweeping = (mutationFn) => () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  })
}

export const useUpdateRule = sweeping(updateRule)
export const useRemoveRule = sweeping(removeRule)
export const useConfigureChannel = sweeping(configureChannel)
export const useAddEscalationLevel = sweeping(addEscalationLevel)

/** A test changes nothing, so it sweeps nothing. */
export const useTestChannel = () => useMutation({ mutationFn: testChannel })
