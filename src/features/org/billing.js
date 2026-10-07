import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, patch } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Settings — Billing & Usage.
 *
 * DEMO. See `DEMO-MODE.md` §8.23.
 *
 * One read for the page. The plan, its meters, the invoice history, the card on
 * file and the trend all describe one billing period, and fetching them apart
 * would let them describe different ones.
 */
export const useBilling = () =>
  useQuery({
    queryKey: queryKeys.billing,
    queryFn: ({ signal }) => get(endpoints.org.billing, { signal }),
    enabled: config.demoMode,
  })

/**
 * Change the billing contact — the only write this page has.
 *
 * There is no payment-method mutation here and there should never be one: a
 * form that looks like a card form teaches the person using it that it is safe
 * to type a card into this application, and there is nothing on the other end
 * of it.
 */
export function useSetBillingContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email) => patch(endpoints.org.billingContact, { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}
