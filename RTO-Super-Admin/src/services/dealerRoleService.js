import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/** Resolves a dealer role's id across common backend shapes. */
export function getDealerRoleId(role) {
  return role?.roleId ?? role?.id ?? role?._id
}

export const dealerRoleService = {
  /**
   * GET /dealer-roles/capabilities — the fixed capability catalog for the checklist.
   * Returns [{ key, label, group }].
   */
  async getCapabilities() {
    const { data } = await api.get('/dealer-roles/capabilities')
    const result = unwrap(data)
    if (Array.isArray(result?.capabilities)) return result.capabilities
    return Array.isArray(result) ? result : []
  },

  /**
   * GET /dealer-roles/me — the caller's effective capabilities, resolved fresh.
   * Returns { isOwner: boolean, capabilities: string[] }.
   */
  async getMe() {
    const { data } = await api.get('/dealer-roles/me')
    const result = unwrap(data)
    return {
      isOwner: Boolean(result?.isOwner),
      capabilities: Array.isArray(result?.capabilities) ? result.capabilities : [],
    }
  },

  /**
   * GET /dealer-roles — the caller's dealer roles with member counts (needs roles.manage / owner).
   * Returns [{ roleId, dealerId, roleName, capabilities, memberCount, createdAt, updatedAt }].
   */
  async getAll() {
    const { data } = await api.get('/dealer-roles')
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /dealer-roles — { roleName, capabilities[] }. */
  async create(payload) {
    const { data } = await api.post('/dealer-roles', payload)
    return unwrap(data)
  },

  /** PATCH /dealer-roles/:id — { roleName?, capabilities? }. */
  async update(id, payload) {
    const { data } = await api.patch(`/dealer-roles/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /dealer-roles/:id — members drop to the read-only default. */
  async remove(id) {
    const { data } = await api.delete(`/dealer-roles/${id}`)
    return unwrap(data)
  },

  /**
   * POST /dealer-roles/assign — assign a role to an employee, or clear it (roleId: null →
   * read-only default). Returns the updated DealerWiseUser row.
   */
  async assign(userId, roleId) {
    const { data } = await api.post('/dealer-roles/assign', { userId, roleId: roleId ?? null })
    return unwrap(data)
  },
}
