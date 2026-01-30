import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          })

          const { accessToken, refreshToken: newRefreshToken } = response.data
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)

          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (identifier: string, password: string) => api.post('/auth/login', { identifier, password }),
  sendOTP: (phone: string) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone: string, otp: string) => api.post('/auth/verify-otp', { phone, otp }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: { name?: string; email?: string; address?: string }) =>
    api.put('/auth/profile', data),
}

// Farms API
export const farmsAPI = {
  getAll: () => api.get('/farms'),
  getById: (id: string) => api.get(`/farms/${id}`),
  create: (data: any) => api.post('/farms', data),
  update: (id: string, data: any) => api.put(`/farms/${id}`, data),
  delete: (id: string) => api.delete(`/farms/${id}`),
  getWeather: (id: string) => api.get(`/farms/${id}/weather`),
  getSatellite: (id: string) => api.get(`/farms/${id}/satellite`),
}

// Crops API
export const cropsAPI = {
  getByFarm: (farmId: string) => api.get(`/crops/farm/${farmId}`),
  getById: (id: string) => api.get(`/crops/${id}`),
  create: (farmId: string, data: any) => api.post(`/crops/farm/${farmId}`, data),
  update: (id: string, data: any) => api.put(`/crops/${id}`, data),
  delete: (id: string) => api.delete(`/crops/${id}`),
  getHealth: (id: string, params?: any) => api.get(`/crops/${id}/health`, { params }),
  getRankings: (landType?: string) => api.get('/crops/rankings/all', { params: { landType } }),
}

// Irrigation API
export const irrigationAPI = {
  getRecommendations: (farmId: string) =>
    api.get('/irrigation/recommendations', { params: { farmId } }),
  getSchedules: (params?: any) => api.get('/irrigation/schedule', { params }),
  createSchedule: (data: any) => api.post('/irrigation/schedule', data),
  triggerIrrigation: (data: any) => api.post('/irrigation/trigger', data),
  cancelSchedule: (id: string) => api.post(`/irrigation/schedule/${id}/cancel`),
  getHistory: (params?: any) => api.get('/irrigation/history', { params }),
}

// Fertilization API
export const fertilizationAPI = {
  getRecommendations: (farmId: string) =>
    api.get('/fertilization/recommendations', { params: { farmId } }),
  getHistory: (params?: any) => api.get('/fertilization/history', { params }),
  createSchedule: (data: any) => api.post('/fertilization/schedule', data),
  markAsApplied: (id: string, data: any) => api.post(`/fertilization/${id}/apply`, data),
  skip: (id: string, reason?: string) => api.post(`/fertilization/${id}/skip`, { reason }),
}

// Devices API
export const devicesAPI = {
  getAll: () => api.get('/devices'),
  getById: (id: string) => api.get(`/devices/${id}`),
  register: (data: any) => api.post('/devices/register', data),
  update: (id: string, data: any) => api.put(`/devices/${id}`, data),
  delete: (id: string) => api.delete(`/devices/${id}`),
  getReadings: (id: string, params?: any) => api.get(`/devices/${id}/readings`, { params }),
  sendCommand: (id: string, data: any) => api.post(`/devices/${id}/command`, data),
}

// Notifications API
export const notificationsAPI = {
  getAll: (params?: any) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
}

export default api
