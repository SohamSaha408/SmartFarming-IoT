import { useState, useEffect } from 'react'
import { devicesAPI } from '../../services/api'
import { CpuChipIcon, PlusIcon, SignalIcon, SignalSlashIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import AddDeviceModal from './AddDeviceModal'

export default function Devices() {
  const [devices, setDevices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchDevices = () => {
    setIsLoading(true)
    devicesAPI.getAll().then((res) => {
      setDevices(res.data.devices)
    }).finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const getDeviceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      soil_sensor: 'Soil Sensor',
      water_pump: 'Water Pump',
      valve: 'Valve Controller',
      weather_station: 'Weather Station',
      npk_sensor: 'NPK Sensor',
    }
    return labels[type] || type
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      maintenance: 'bg-yellow-100 text-yellow-700',
      offline: 'bg-red-100 text-red-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IoT Devices</h1>
          <p className="text-gray-500 mt-1">Manage your connected sensors and controllers</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setIsModalOpen(true)}
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Device
        </button>
      </div>

      {devices.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <div key={device.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className={clsx(
                    'p-2 rounded-lg',
                    device.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
                  )}>
                    <CpuChipIcon className={clsx(
                      'w-6 h-6',
                      device.status === 'active' ? 'text-green-600' : 'text-gray-400'
                    )} />
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">{device.name}</h3>
                    <p className="text-sm text-gray-500">{getDeviceTypeLabel(device.deviceType)}</p>
                  </div>
                </div>
                {device.status === 'active' ? (
                  <SignalIcon className="w-5 h-5 text-green-500" />
                ) : (
                  <SignalSlashIcon className="w-5 h-5 text-red-500" />
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className={clsx(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    getStatusColor(device.status)
                  )}>
                    {device.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Farm:</span>
                  <span className="text-gray-900">{device.farm?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Device ID:</span>
                  <span className="text-gray-900 font-mono text-xs">
                    {device.deviceId.substring(0, 12)}...
                  </span>
                </div>
                {device.lastSeenAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Seen:</span>
                    <span className="text-gray-900">
                      {new Date(device.lastSeenAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {device.batteryLevel !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Battery:</span>
                    <span className={clsx(
                      'font-medium',
                      device.batteryLevel > 50 ? 'text-green-600' :
                        device.batteryLevel > 20 ? 'text-yellow-600' :
                          'text-red-600'
                    )}>
                      {device.batteryLevel}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <CpuChipIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No devices connected</h3>
          <p className="text-gray-500 mb-6">Add IoT devices to monitor your farm in real-time</p>
          <button
            className="btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Your First Device
          </button>
        </div>
      )}

      {isModalOpen && (
        <AddDeviceModal
          onClose={() => setIsModalOpen(false)}
          onDeviceAdded={fetchDevices}
        />
      )}
    </div>
  )
}
