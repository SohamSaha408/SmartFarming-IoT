import { create } from 'zustand'
import { authAPI } from '../services/api'

interface Farmer {
  id: string
  phone: string
  name: string | null
  email: string | null
  address: string | null
  isVerified: boolean
}

interface AuthState {
  farmer: Farmer | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  sendOTP: (phone: string) => Promise<boolean>
  verifyOTP: (phone: string, otp: string) => Promise<boolean>
  login: (identifier: string, password: string) => Promise<boolean>
  loadProfile: () => Promise<void>
  updateProfile: (data: { name?: string; email?: string; address?: string }) => Promise<boolean>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  farmer: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: true,
  error: null,

  sendOTP: async (phone: string) => {
    try {
      set({ error: null })
      await authAPI.sendOTP(phone)
      return true
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to send OTP' })
      return false
    }
  },

  verifyOTP: async (phone: string, otp: string) => {
    try {
      set({ error: null })
      const response = await authAPI.verifyOTP(phone, otp)
      const { farmer, accessToken, refreshToken } = response.data

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)

      set({
        farmer,
        isAuthenticated: true,
        isLoading: false,
      })

      return true
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Invalid OTP' })
      return false
    }
  },

  login: async (identifier: string, password: string) => {
    try {
      set({ error: null })
      const response = await authAPI.login(identifier, password)
      const { farmer, accessToken, refreshToken } = response.data

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)

      set({
        farmer,
        isAuthenticated: true,
        isLoading: false,
      })

      return true
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Login failed' })
      return false
    }
  },

  loadProfile: async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        set({ isLoading: false, isAuthenticated: false })
        return
      }

      const response = await authAPI.getProfile()
      set({
        farmer: response.data.farmer,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      set({
        farmer: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  updateProfile: async (data) => {
    try {
      const response = await authAPI.updateProfile(data)
      set({ farmer: response.data.farmer })
      return true
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to update profile' })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({
      farmer: null,
      isAuthenticated: false,
      isLoading: false,
    })
  },
}))

// Initialize auth state on app load
const initAuth = async () => {
  const { loadProfile } = useAuthStore.getState()
  await loadProfile()
}

initAuth()
