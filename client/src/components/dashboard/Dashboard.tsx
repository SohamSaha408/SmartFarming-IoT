// IMPROVED:
// 1. Auto-refreshes dashboard data every 30 seconds
// 2. pendingIrrigations now fetched from actual irrigation API
// 3. Server-error toast via api:server-error event
// 4. Last-refreshed timestamp + manual refresh button
// 5. Live Sensor Feed widget embedded

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { farmsAPI, cropsAPI, notificationsAPI, irrigationAPI } from '../../services/api'
import {
  MapIcon, BeakerIcon, CloudIcon, BellAlertIcon,
  ExclamationTriangleIcon, PlusIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import AddCropModal from '../crops/AddCropModal'
import LiveSensorFeed from '../devices/LiveSensorFeed'

interface DashboardStats {
  totalFarms:         number
  totalCrops:         number
  activeCrops:        number
  pendingIrrigations: number
  criticalAlerts:     number
}

export default function Dashboard() {
  const [stats, setStats]                   = useState<DashboardStats | null>(null)
  const [recentNotifications, setNotifs]    = useState<any[]>([])
  const [isLoading, setIsLoading]           = useState(true)
  const [farms, setFarms]                   = useState<any[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string>('')
  const [crops, setCrops]                   = useState<any[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [lastRefreshed, setLastRefreshed]   = useState<Date | null>(null)
  const [serverError, setServerError]       = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setServerError(detail?.message || 'A server error occurred')
      setTimeout(() => setServerError(null), 6000)
    }
    window.addEventListener('api:server-error', handler)
    return () => window.removeEventListener('api:server-error', handler)
  }, [])

  const fetchCrops = useCallback(() => {
    if (selectedFarmId) {
      cropsAPI.getByFarm(selectedFarmId)
        .then((res) => setCrops(res.data.crops))
        .catch(console.error)
    }
  }, [selectedFarmId])

  useEffect(() => { fetchCrops() }, [fetchCrops])

  const fetchDashboardData = useCallback(async () => {
    try {
      const [farmsRes, notificationsRes, irrigationRes] = await Promise.all([
        farmsAPI.getAll(),
        notificationsAPI.getAll({ limit: 5 }),
        irrigationAPI.getSchedules({ status: 'pending' }),
      ])
      const fetchedFarms = farmsRes.data.farms
      setFarms(fetchedFarms)
      if (fetchedFarms.length > 0 && !selectedFarmId) {
        setSelectedFarmId(fetchedFarms[0].id)
      }
      const totalCrops  = fetchedFarms.reduce((s: number, f: any) => s + (f.crops?.length || 0), 0)
      const activeCrops = fetchedFarms.reduce((s: number, f: any) =>
        s + (f.crops?.filter((c: any) => c.status === 'active').length || 0), 0)
      setStats({
        totalFarms:         fetchedFarms.length,
        totalCrops,
        activeCrops,
        pendingIrrigations: irrigationRes.data?.schedules?.length ?? 0,
        criticalAlerts:     notificationsRes.data.notifications.filter(
          (n: any) => n.priority === 'critical' && !n.readAt
        ).length,
      })
      setNotifs(notificationsRes.data.notifications)
      setLastRefreshed(new Date())
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedFarmId])

  useEffect(() => { fetchDashboardData() }, [fetchDashboardData])

  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 30_000)
    return () => clearInterval(interval)
  }, [fetchDashboardData])

  const getHealthColor = (status: string) => {
    const colors: Record<string, string> = {
      excellent: 'bg-green-100 text-green-700',
      healthy:   'bg-emerald-100 text-emerald-700',
      moderate:  'bg-yellow-100 text-yellow-700',
      stressed:  'bg-orange-100 text-orange-700',
      critical:  'bg-red-100 text-red-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Server error toast */}
      {serverError && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>⚠️ {serverError}</span>
          <button onClick={() => setServerError(null)} className="ml-4 text-red-500 hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's an overview of your farm operations.</p>
        </div>
        <div className="flex items-center space-x-3 text-sm text-gray-400">
          {lastRefreshed && <span>Updated {lastRefreshed.toLocaleTimeString()}</span>}
          <button onClick={fetchDashboardData} title="Refresh" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Live Sensor Feed */}
      {selectedFarmId && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Live Sensor Feed</h2>
          <LiveSensorFeed farmId={selectedFarmId} />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg"><MapIcon className="w-6 h-6 text-blue-600" /></div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Total Farms</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalFarms || 0}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg"><BeakerIcon className="w-6 h-6 text-green-600" /></div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Active Crops</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.activeCrops || 0}</p>
            </div>
          </div>
        </div>
        <Link to="/irrigation" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-cyan-100 rounded-lg"><CloudIcon className="w-6 h-6 text-cyan-600" /></div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Irrigation Due</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.pendingIrrigations || 0}</p>
            </div>
          </div>
        </Link>
        <Link to="/notifications" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className={clsx('p-3 rounded-lg', (stats?.criticalAlerts || 0) > 0 ? 'bg-red-100' : 'bg-gray-100')}>
              <BellAlertIcon className={clsx('w-6 h-6', (stats?.criticalAlerts || 0) > 0 ? 'text-red-600' : 'text-gray-600')} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Critical Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.criticalAlerts || 0}</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Farm Selector */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between space-y-4 sm:space-y-0">
        <div className="w-full sm:max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-2">Viewing Farm:</label>
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="input w-full shadow-sm"
          >
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>{farm.name}</option>
            ))}
            {farms.length === 0 && <option value="">No farms available</option>}
          </select>
        </div>
        {selectedFarmId && (
          <button onClick={() => setIsAddModalOpen(true)} className="btn-primary">
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Crop Here
          </button>
        )}
      </div>

      {/* Crops Grid */}
      {crops.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {crops.map((crop) => {
            const health = crop.healthRecords?.[0]
            return (
              <div key={crop.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <BeakerIcon className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="font-semibold text-gray-900">{crop.cropType}</h3>
                      {crop.variety && <p className="text-sm text-gray-500">{crop.variety}</p>}
                    </div>
                  </div>
                  <span className={clsx(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    crop.status === 'active'    ? 'bg-green-100 text-green-700' :
                    crop.status === 'harvested' ? 'bg-blue-100 text-blue-700'  :
                    'bg-gray-100 text-gray-700'
                  )}>
                    {crop.status}
                  </span>
                </div>
                {health && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Health Score</span>
                      <span className={clsx('px-2 py-1 text-xs font-medium rounded-full', getHealthColor(health.healthStatus))}>
                        {health.healthStatus}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={clsx('h-2 rounded-full',
                          health.healthScore >= 80 ? 'bg-green-500'  :
                          health.healthScore >= 60 ? 'bg-emerald-500':
                          health.healthScore >= 40 ? 'bg-yellow-500' :
                          health.healthScore >= 20 ? 'bg-orange-500' : 'bg-red-500'
                        )}
                        style={{ width: `${health.healthScore}%` }}
                      />
                    </div>
                    <p className="text-right text-sm font-medium text-gray-900 mt-1">{health.healthScore}%</p>
                  </div>
                )}
                <div className="space-y-2 text-sm border-t border-gray-100 pt-4">
                  {crop.plantedDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Planted:</span>
                      <span className="text-gray-900">{new Date(crop.plantedDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {crop.expectedHarvestDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expected Harvest:</span>
                      <span className="text-gray-900">{new Date(crop.expectedHarvestDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {crop.areaHectares && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Area:</span>
                      <span className="text-gray-900">{crop.areaHectares} ha</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <Link to={`/crops/${crop.id}/health`} className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                    View Health Dashboard &rarr;
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <BeakerIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No crops active</h3>
          <p className="text-gray-500">Select a farm and add crops to view analytics.</p>
        </div>
      )}

      {/* Recent Notifications */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Notifications</h2>
          <Link to="/notifications" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
        </div>
        {recentNotifications.length > 0 ? (
          <div className="space-y-3">
            {recentNotifications.map((notification) => (
              <div
                key={notification.id}
                className={clsx('flex items-start p-3 rounded-lg', notification.readAt ? 'bg-gray-50' : 'bg-primary-50')}
              >
                <div className={clsx('p-2 rounded-lg',
                  notification.priority === 'critical' ? 'bg-red-100'  :
                  notification.priority === 'high'     ? 'bg-orange-100': 'bg-blue-100'
                )}>
                  {notification.priority === 'critical' || notification.priority === 'high' ? (
                    <ExclamationTriangleIcon className={clsx('w-5 h-5',
                      notification.priority === 'critical' ? 'text-red-600' : 'text-orange-600'
                    )} />
                  ) : (
                    <BellAlertIcon className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className="font-medium text-gray-900">{notification.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No notifications</p>
        )}
      </div>

      {isAddModalOpen && (
        <AddCropModal
          farmId={selectedFarmId}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={fetchCrops}
        />
      )}
    </div>
  )
}
