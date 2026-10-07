import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { createTask, fetchTasks, updateTask } from './api'

/**
 * Tasks. Read-and-write, unlike the rest of Home's demo panels — the prototype
 * lets you create, reassign, edit and tick off, and a demo where the buttons do
 * nothing is worse than no buttons.
 */

export const useTasks = () =>
  useQuery({
    queryKey: queryKeys.tasks,
    queryFn: ({ signal }) => fetchTasks(signal),
    enabled: config.demoMode,
  })

/**
 * One mutation for both create and update.
 *
 * The form is the same form either way — the only difference is whether an id
 * came with it — and splitting this in two would mean the dialog picking a hook
 * based on its own mode, which is the kind of branch that gets it wrong once and
 * silently creates a duplicate instead of saving an edit.
 */
export function useTaskMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...task }) => (id ? updateTask(id, task) : createTask(task)),
    // Sweep the list rather than patching the cache by hand: the server decides
    // the id and the ordering, and guessing either here is how a created row
    // ends up in the wrong place until the next refetch.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}
