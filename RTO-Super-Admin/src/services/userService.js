import { mockUsers } from '@/data/mockData'

const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

let users = [...mockUsers]

export const userService = {
  async getAll(filters = {}) {
    await delay()
    let result = [...users]
    if (filters.role && filters.role !== 'all') {
      result = result.filter((u) => u.role === filters.role)
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter((u) => u.status === filters.status)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q)
      )
    }
    return result
  },

  async getById(id) {
    await delay()
    const user = users.find((u) => u.id === id)
    if (!user) throw new Error('User not found')
    return user
  },

  async updateStatus(id, status) {
    await delay()
    users = users.map((u) => (u.id === id ? { ...u, status } : u))
    return users.find((u) => u.id === id)
  },

  async delete(id) {
    await delay()
    users = users.filter((u) => u.id !== id)
    return { success: true }
  },

  async getStats() {
    await delay(300)
    return {
      dealers: users.filter((u) => u.role === 'dealer').length,
      agents: users.filter((u) => u.role === 'agent').length,
      pending: users.filter((u) => u.status === 'pending').length,
      suspended: users.filter((u) => u.status === 'suspended').length,
    }
  },
}
