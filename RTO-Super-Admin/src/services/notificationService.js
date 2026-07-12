import { mockNotifications } from '@/data/mockData'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

let notifications = [...mockNotifications]

export const notificationService = {
  async getAll(filter = 'all') {
    await delay()
    if (filter === 'unread') return notifications.filter((n) => !n.read)
    return [...notifications]
  },

  async markAsRead(id) {
    await delay(200)
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    return notifications
  },

  async markAllRead() {
    await delay(200)
    notifications = notifications.map((n) => ({ ...n, read: true }))
    return notifications
  },

  async getUnreadCount() {
    await delay(100)
    return notifications.filter((n) => !n.read).length
  },
}
