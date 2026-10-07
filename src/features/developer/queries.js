import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, get, post, put } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Developer access — API keys, webhooks, the published specification.
 *
 * DEMO. See `DEMO-MODE.md` §8.19.
 */
export const useDeveloperAccess = () =>
  useQuery({
    queryKey: queryKeys.developer,
    queryFn: ({ signal }) => get(endpoints.developer.access, { signal }),
    enabled: config.demoMode,
  })

/**
 * Every write here sweeps the developer key AND the audit log, because each one
 * records an entry there. A key created and not recorded would be the one thing
 * on this page that mattered and did not happen.
 */
const sweeping = (mutationFn) => () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developer })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}

/**
 * Create a key.
 *
 * The response carries the secret. It is handed to the dialog that asked for it
 * and held nowhere else — not in the query cache, because this mutation's data
 * is read once and the cache entry is discarded with the dialog.
 */
export const useCreateKey = sweeping((body) => post(endpoints.developer.keys, body))
export const useRotateKey = sweeping((id) => post(endpoints.developer.keyRotate(id)))
export const useRevokeKey = sweeping((id) => del(endpoints.developer.key(id)))

export const useSaveWebhook = sweeping(({ id, ...body }) =>
  id ? put(endpoints.developer.webhook(id), body) : post(endpoints.developer.webhooks, body),
)
export const useDeleteWebhook = sweeping((id) => del(endpoints.developer.webhook(id)))

/** A preview of what would be delivered. It changes nothing, so it sweeps nothing. */
export const useTestWebhook = () =>
  useMutation({ mutationFn: (id) => post(endpoints.developer.webhookTest(id)) })

/** The specification and the collection, fetched only when somebody asks for one. */
export const fetchSpec = () => get(endpoints.developer.spec)
export const fetchPostman = () => get(endpoints.developer.postman)
