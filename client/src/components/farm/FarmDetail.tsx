import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useFarmStore } from '../../store/farmStore'
import { farmsAPI, cropsAPI, devicesAPI } from '../../services/api'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { MapPinIcon, SunIcon, BeakerIcon, ChevronLeftIcon, PlusIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import SensorChart from '../common/SensorChart'
import AddDeviceModal from '../devices/AddDeviceModal'

// Fix for missing marker icon
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useMap } from 'react-leaflet'

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// Component to handle map resizing
function ResizeMap() {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
  }, [map])
  return null
}

const customIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export default function FarmDetail() {
  const { id } = useParams<{ id: string }>()
  const { selectedFarm, fetchFarmById, isLoading } = useFarmStore()
  const [weather, setWeather] = useState<any>(null)
  const [crops, setCrops] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [readings, setReadings] = useState<any[]>([])
  const [isReadingsLoading, setIsReadingsLoading] = useState(false)
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false)

  useEffect(() => {
    if (id) {
      fetchFarmById(id)

      // Fetch weather
      farmsAPI.getWeather(id).then((res) => {
        setWeather(res.data)
      }).catch(console.error)

      // Fetch crops
      cropsAPI.getByFarm(id).then((res) => {
        setCrops(res.data.crops)
      }).catch(console.error)

      // Fetch devices
      devicesAPI.getAll().then((res) => {
        const farmDevices = res.data.devices.filter((d: any) => d.farmId === id)
        setDevices(farmDevices)
        if (farmDevices.length > 0) {
          setSelectedDevice(farmDevices[0].id)
        }
      }).catch(console.error)
    }
  }, [id, fetchFarmById])

  const refreshDevices = () => {
    if (id) {
      devicesAPI.getAll().then((res) => {
        const farmDevices = res.data.devices.filter((d: any) => d.farmId === id)
        setDevices(farmDevices)
        // If we just added a device and none were selected, select the new one (simplification: select first)
        if (farmDevices.length > 0 && !selectedDevice) {
          setSelectedDevice(farmDevices[0].id)
        }
      }).catch(console.error)
    }
  }

  // Fetch readings when device selected
  useEffect(() => {
    if (selectedDevice) {
      setIsReadingsLoading(true)
      devicesAPI.getReadings(selectedDevice, { limit: 50 })
        .then((res) => {
          // Sort by date ascending for chart
          const sorted = [...res.data.readings].sort((a: any, b: any) =>
            new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
          )
          setReadings(sorted)
        })
        .catch(console.error)
        .finally(() => setIsReadingsLoading(false))
    }
  }, [selectedDevice])

  if (isLoading || !selectedFarm) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const lat = parseFloat(selectedFarm.latitude.toString())
  const lng = parseFloat(selectedFarm.longitude.toString())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/farms"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{selectedFarm.name}</h1>
          <div className="flex items-center text-gray-500 mt-1">
            <MapPinIcon className="w-4 h-4 mr-1" />
            {selectedFarm.village || selectedFarm.district || 'Unknown location'}
            {selectedFarm.state && `, ${selectedFarm.state}`}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 card p-0 overflow-hidden relative z-0">
          <div className="h-[400px]">
            {lat && lng ? (
              <MapContainer
                key={`${lat}-${lng}`} // Force re-render on coord change
                center={[lat, lng]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <ResizeMap />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat, lng]} icon={customIcon}>
                  <Popup>{selectedFarm.name}</Popup>
                </Marker>
              </MapContainer>
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
                Invalid coordinates
              </div>
            )}
          </div>
        </div>

        {/* Weather Card */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Weather</h3>
          {weather?.current ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <SunIcon className="w-10 h-10 text-yellow-500" />
                  <div className="ml-3">
                    <p className="text-3xl font-bold text-gray-900">
                      {Math.round(weather.current.main?.temp || 0)}°C
                    </p>
                    <p className="text-sm text-gray-500 capitalize">
                      {weather.current.weather?.[0]?.description || 'Clear'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-sm text-gray-500">Humidity</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {weather.current.main?.humidity || 0}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Wind</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {weather.current.wind?.speed || 0} m/s
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Weather data unavailable</p>
          )}
        </div>
      </div>

      {/* Sensor Data Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">Sensor History</h2>
            <button
              onClick={() => setIsAddDeviceModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors font-medium"
            >
              <PlusIcon className="w-4 h-4" />
              Add Device
            </button>
          </div>
          {devices.length > 0 && (
            <select
              value={selectedDevice || ''}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="input-field max-w-xs"
            >
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.deviceType})</option>
              ))}
            </select>
          )}
        </div>

        {isReadingsLoading ? (
          <div className="lg:col-span-2 text-center py-12">Loading chart data...</div>
        ) : readings.length > 0 ? (
          <>
            <SensorChart
              data={readings}
              dataKey="soilMoisture"
              color="#0ea5e9" // Sky 500
              title="Soil Moisture"
              unit="%"
            />
            <SensorChart
              data={readings}
              dataKey="airTemperature"
              color="#f97316" // Orange 500
              title="Temperature"
              unit="°C"
            />
          </>
        ) : (
          <p className="lg:col-span-2 text-gray-500 text-center py-8">
            {devices.length > 0 ? "No sensor data available for this device." : "No devices connected to this farm."}
          </p>
        )}
      </div>

      {isAddDeviceModalOpen && id && (
        <AddDeviceModal
          onClose={() => setIsAddDeviceModalOpen(false)}
          onDeviceAdded={refreshDevices}
          preselectedFarmId={id}
        />
      )}

      {/* Farm Details */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Land Type</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {selectedFarm.landType || 'Not specified'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Area</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {selectedFarm.areaHectares ? `${selectedFarm.areaHectares} hectares` : 'Not specified'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Soil pH</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {selectedFarm.soilPh || 'Not tested'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Coordinates</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Crops Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Crops</h3>
          <Link
            to="/crops"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Manage Crops
          </Link>
        </div>

        {crops.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {crops.map((crop) => (
              <div
                key={crop.id}
                className="p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <BeakerIcon className="w-5 h-5 text-green-600 mr-2" />
                    <span className="font-medium text-gray-900">{crop.cropType}</span>
                  </div>
                  <span className={clsx(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    crop.status === 'active' ? 'bg-green-100 text-green-700' :
                      crop.status === 'harvested' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                  )}>
                    {crop.status}
                  </span>
                </div>
                {crop.healthRecords?.[0] && (
                  <div className="mt-2 text-sm text-gray-500">
                    Health: {crop.healthRecords[0].healthScore}%
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No crops added to this farm yet</p>
        )}
      </div>
    </div>
  )
}
