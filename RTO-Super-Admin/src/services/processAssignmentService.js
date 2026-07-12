import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

/**
 * Process ↔ agent assignments (a dealer assigns a process + RTO service to an agent; the agent
 * works it via their kanban statuses). Dealer-side and agent-side methods share this service.
 */
export const processAssignmentService = {
  // ---- Dealer side ----

  /** GET /process-assignments?processId= — assignments on one process (dealer view). */
  async listForProcess(processId) {
    const { data } = await api.get('/process-assignments', { params: { processId } })
    return asArray(unwrap(data))
  },

  /** POST /process-assignments — assign a process + RTO service to a granted agent. */
  async create({ processId, agentId, serviceId, note }) {
    const { data } = await api.post('/process-assignments', { processId, agentId, serviceId, note })
    return unwrap(data)
  },

  /** DELETE /process-assignments/:id — cancel an assignment (kept for history). */
  async remove(assignmentId) {
    const { data } = await api.delete(`/process-assignments/${assignmentId}`)
    return unwrap(data)
  },

  // ---- Agent side ----

  /** GET /process-assignments/agent — the agent's assignments, optionally filtered by dealer. */
  async listForAgent({ dealerId } = {}) {
    const { data } = await api.get('/process-assignments/agent', {
      params: dealerId ? { dealerId } : {},
    })
    return asArray(unwrap(data))
  },

  /** GET /process-assignments/:id/details — full process detail + assignment + source dealer. */
  async getDetails(assignmentId) {
    const { data } = await api.get(`/process-assignments/${assignmentId}/details`)
    return unwrap(data)
  },

  /** PATCH /process-assignments/:id/agent-status — agent moves the RTO status. */
  async updateAgentStatus(assignmentId, agentStatusId) {
    const { data } = await api.patch(`/process-assignments/${assignmentId}/agent-status`, {
      agentStatusId,
    })
    return unwrap(data)
  },
}
