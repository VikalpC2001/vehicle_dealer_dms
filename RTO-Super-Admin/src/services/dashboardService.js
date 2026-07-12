import {
  mockStats, dealerGrowthData, agentGrowthData, revenueData, registrationData, mockActivityLogs,
} from '@/data/mockData'

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms))

export const dashboardService = {
  async getStats() {
    await delay()
    return mockStats
  },
  async getDealerGrowth() {
    await delay(400)
    return dealerGrowthData
  },
  async getAgentGrowth() {
    await delay(400)
    return agentGrowthData
  },
  async getRevenue() {
    await delay(400)
    return revenueData
  },
  async getRegistrations() {
    await delay(400)
    return registrationData
  },
  async getActivityLogs() {
    await delay(500)
    return mockActivityLogs
  },
}
