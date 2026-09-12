import { useQuery } from '@tanstack/react-query'
import { dealerRoleService } from '@/services/dealerRoleService'
import { useAuth } from '@/context/AuthContext'

/**
 * Resolves the current dealer user's effective capabilities from `GET /dealer-roles/me`.
 *
 * Only dealer-role users are gated: for super-admin / agent / unlinked users the hook is a no-op
 * that returns a fully-permissive shape (`can()` always true) so it never hides UI for them.
 *
 * `can(key)` is PERMISSIVE while the query is still loading (undefined data) to avoid nav flicker
 * and accidental lockout — it only returns `false` once the resolved capabilities are known and the
 * (non-owner) key is absent. Items queried with no `key` are always allowed.
 *
 * @returns {{ isOwner: boolean, capabilities: string[], can: (key?: string) => boolean, isLoading: boolean, isDealer: boolean }}
 */
export function useCapabilities() {
  const { user } = useAuth()
  const isDealer = user?.role === 'dealer'

  const { data, isLoading } = useQuery({
    queryKey: ['dealer-roles', 'me'],
    queryFn: () => dealerRoleService.getMe(),
    enabled: isDealer,
    staleTime: 5 * 60 * 1000,
  })

  // Non-dealers are never capability-gated — return a permissive no-op shape.
  if (!isDealer) {
    return { isOwner: false, capabilities: [], can: () => true, isLoading: false, isDealer: false }
  }

  const isOwner = Boolean(data?.isOwner)
  const capabilities = data?.capabilities ?? []
  const loaded = data !== undefined

  const can = (key) => {
    if (!key) return true
    // Permissive until we actually know the answer (avoids flicker / lockout during load).
    if (!loaded) return true
    if (isOwner) return true
    return capabilities.includes(key)
  }

  return { isOwner, capabilities, can, isLoading, isDealer: true }
}
