import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import Login from './components/auth/Login'
import Dashboard from './components/dashboard/Dashboard'
import Farms from './components/farm/Farms'
import FarmDetail from './components/farm/FarmDetail'
import Crops from './components/crops/Crops'
import CropHealth from './components/crops/CropHealth'
import Irrigation from './components/irrigation/Irrigation'
import Fertilization from './components/fertilization/Fertilization'
import Notifications from './components/notifications/Notifications'
import Profile from './components/profile/Profile'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="farms" element={<Farms />} />
        <Route path="farms/:id" element={<FarmDetail />} />
        <Route path="crops" element={<Crops />} />
        <Route path="crops/:id/health" element={<CropHealth />} />
        <Route path="irrigation" element={<Irrigation />} />
        <Route path="fertilization" element={<Fertilization />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
