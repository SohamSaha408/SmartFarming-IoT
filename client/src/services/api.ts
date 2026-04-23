// IMPROVED:
// 1. Added 15s request timeout — prevents UI hanging on slow/dead API calls
// 2. Global error handler fires a custom event so any component can show a toast
// 3. Added deleteNotification endpoint (was missing)
// 4. Added devicesAPI.getStats() for dashboard live stats
// 5. Refresh token failure now clears storage and redirects cleanly

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000, // IMPROVED: 15s timeout — prevents silent hangs
})

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: auto-refresh token, broadcast errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
          const { accessToken, refreshToken: newRefreshToken } = response.data
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch {
        // IMPROVED: clean logout on refresh failure
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
      }
    }

    // IMPROVED: Dispatch a global event so any component can show a toast/snackbar
    if (error.response?.status >= 500) {
      window.dispatchEvent(new CustomEvent('api:server-error', {
        detail: { message: error.response?.data?.error || 'Server error', status: error.response.status }
      }))
    }

    return Promise.reject(error)
  }
)

export const authAPI = {
  login:         (identifier: string, password: string) => api.post('/auth/login', { identifier, password }),
  sendOTP:       (phone: string) => api.post('/auth/send-otp', { phone }),
  verifyOTP:     (phone: string, otp: string) => api.post('/auth/verify-otp', { phone, otp }),
  getProfile:    () => api.get('/auth/profile'),
  updateProfile: (data: { name?: string; email?: string; address?: string }) => api.put('/auth/profile', data),
  changePassword:(data: { currentPassword: string; newPassword: string }) => api.put('/auth/password', data),
}

export const farmsAPI = {
  getAll:       () => api.get('/farms'),
  getById:      (id: string) => api.get(`/farms/${id}`),
  create:       (data: any) => api.post('/farms', data),
  update:       (id: string, data: any) => api.put(`/farms/${id}`, data),
  delete:       (id: string) => api.delete(`/farms/${id}`),
  getWeather:   (id: string) => api.get(`/farms/${id}/weather`),
  getSatellite: (id: string) => api.get(`/farms/${id}/satellite`),
  exportPDF:    (id: string) => api.get(`/farms/${id}/export/pdf`, { responseType: 'blob' }),
  exportCSV:    (id: string) => api.get(`/farms/${id}/export/csv`, { responseType: 'blob' }),
}

export const cropsAPI = {
  getByFarm:   (farmId: string) => api.get(`/crops/farm/${farmId}`),
  getById:     (id: string) => api.get(`/crops/${id}`),
  create:      (farmId: string, data: any) => api.post(`/crops/farm/${farmId}`, data),
  update:      (id: string, data: any) => api.put(`/crops/${id}`, data),
  delete:      (id: string) => api.delete(`/crops/${id}`),
  getHealth:   (id: string, params?: any) => api.get(`/crops/${id}/health`, { params }),
  getRankings: (landType?: string) => api.get('/crops/rankings/all', { params: { landType } }),
}

export const irrigationAPI = {
  getRecommendations: (farmId: string) => api.get('/irrigation/recommendations', { params: { farmId } }),
  getSchedules:       (params?: any) => api.get('/irrigation/schedule', { params }),
  createSchedule:     (data: any) => api.post('/irrigation/schedule', data),
  triggerIrrigation:  (data: any) => api.post('/irrigation/trigger', data),
  stop:               (data: any) => api.post('/irrigation/stop', data),
  cancelSchedule:     (id: string) => api.post(`/irrigation/schedule/${id}/cancel`),
  getHistory:         (params?: any) => api.get('/irrigation/history', { params }),
}

export const fertilizationAPI = {
  getRecommendations: (farmId: string) => api.get('/fertilization/recommendations', { params: { farmId } }),
  getHistory:         (params?: any) => api.get('/fertilization/history', { params }),
  createSchedule:     (data: any) => api.post('/fertilization/schedule', data),
  markAsApplied:      (id: string, data: any) => api.post(`/fertilization/${id}/apply`, data),
  skip:               (id: string, reason?: string) => api.post(`/fertilization/${id}/skip`, { reason }),
}

export const devicesAPI = {
  getAll:      () => api.get('/devices'),
  // FIXED: new targeted endpoint — fetches only devices belonging to a specific farm.
  // Avoids the previous pattern of getAll() + client-side .filter(d => d.farmId === id).
  getByFarm:   (farmId: string) => api.get('/devices', { params: { farmId } }),
  getById:     (id: string) => api.get(`/devices/${id}`),
  register:    (data: any) => api.post('/devices/register', data),
  update:      (id: string, data: any) => api.put(`/devices/${id}`, data),
  delete:      (id: string) => api.delete(`/devices/${id}`),
  getReadings: (id: string, params?: any) => api.get(`/devices/${id}/readings`, { params }),
  sendCommand: (id: string, data: any) => api.post(`/devices/${id}/command`, data),
  getStats:    (id: string, hours = 24) => api.get(`/devices/${id}`, { params: { hours } }),
}

export const notificationsAPI = {
  getAll:        (params?: any) => api.get('/notifications', { params }),
  getUnreadCount:() => api.get('/notifications/unread-count'),
  markAsRead:    (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  // IMPROVED: delete notification endpoint was missing
  delete:        (id: string) => api.delete(`/notifications/${id}`),
}

export default api
