import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const { isAuthenticated, login, sendOTP, verifyOTP, error } = useAuthStore()

  const [mode, setMode] = useState<'password' | 'otp'>('password')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier || !password) {
      toast.error('Please enter email/phone and password')
      return
    }

    setIsLoading(true)
    const success = await login(identifier, password)
    setIsLoading(false)

    if (success) {
      toast.success('Login successful!')
      navigate('/')
    } else {
      toast.error(error || 'Login failed')
    }
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier) {
      toast.error('Please enter your phone number')
      return
    }

    setIsLoading(true)
    const success = await sendOTP(identifier)
    setIsLoading(false)

    if (success) {
      setIsOtpSent(true)
      toast.success('OTP sent! Check your server console (Dev Mode).')
    } else {
      toast.error(error || 'Failed to send OTP')
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier || !otp) {
      toast.error('Please enter phone and OTP')
      return
    }

    setIsLoading(true)
    const success = await verifyOTP(identifier, otp)
    setIsLoading(false)

    if (success) {
      toast.success('Login successful!')
      navigate('/')
    } else {
      toast.error(error || 'Invalid OTP')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Agri IoT</h1>
          <p className="text-gray-500 mt-2">Monitor and manage your farm intelligently</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`flex-1 py-2 text-center text-sm font-medium ${mode === 'password'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setMode('password')}
          >
            Password Login
          </button>
          <button
            className={`flex-1 py-2 text-center text-sm font-medium ${mode === 'otp'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setMode('otp')}
          >
            OTP Login
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email or Phone
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@smartagri.com"
                className="input"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={isOtpSent ? handleVerifyOTP : handleSendOTP}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="+91 98765 43210"
                className="input"
                required
                disabled={isOtpSent}
              />
            </div>

            {isOtpSent && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="input tracking-widest text-center text-xl"
                  required
                  maxLength={6}
                />
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setIsOtpSent(false)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Change Phone Number
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? 'Processing...'
                : isOtpSent
                  ? 'Verify & Login'
                  : 'Send OTP'}
            </button>

            {!isOtpSent && (
              <p className="mt-4 text-xs text-center text-gray-500">
                Note: In development mode, check server console for OTP.
                <br />
                Universal OTP: 123456
              </p>
            )}
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>Default Admin: admin@smartagri.com / admin123</p>
        </div>
      </div>
    </div>
  )
}
