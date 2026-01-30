
import { useState, useEffect } from 'react'
import { devicesAPI, farmsAPI } from '../../services/api'
import { XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Props {
    onClose: () => void
    onDeviceAdded: () => void
}

const DEVICE_TYPES = [
    { value: 'soil_sensor', label: 'Soil Sensor' },
    { value: 'water_pump', label: 'Water Pump' },
    { value: 'valve', label: 'Valve Controller' },
    { value: 'weather_station', label: 'Weather Station' },
    { value: 'npk_sensor', label: 'NPK Sensor' },
]

export default function AddDeviceModal({ onClose, onDeviceAdded }: Props) {
    const [isLoading, setIsLoading] = useState(false)
    const [farms, setFarms] = useState<any[]>([])
    const [formData, setFormData] = useState({
        name: '',
        deviceId: '',
        deviceType: 'soil_sensor',
        farmId: '',
        latitude: '',
        longitude: '',
    })

    useEffect(() => {
        farmsAPI.getAll()
            .then(res => setFarms(res.data.farms || []))
            .catch(err => console.error('Failed to load farms', err))
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name || !formData.deviceId || !formData.farmId) {
            toast.error('Please fill in required fields')
            return
        }

        setIsLoading(true)
        try {
            await devicesAPI.register({
                ...formData,
                latitude: formData.latitude ? parseFloat(formData.latitude) : null,
                longitude: formData.longitude ? parseFloat(formData.longitude) : null,
            })
            toast.success('Device added successfully!')
            onDeviceAdded()
            onClose()
        } catch (error) {
            console.error(error)
            toast.error('Failed to add device')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-gray-900/50" onClick={onClose} />

                <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Add New Device</h2>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg hover:bg-gray-100"
                        >
                            <XMarkIcon className="w-6 h-6 text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Device Name *
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="input"
                                placeholder="e.g., North Field Sensor"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Device ID *
                            </label>
                            <input
                                type="text"
                                name="deviceId"
                                value={formData.deviceId}
                                onChange={handleChange}
                                className="input"
                                placeholder="Unique Identifier"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Device Type *
                            </label>
                            <select
                                name="deviceType"
                                value={formData.deviceType}
                                onChange={handleChange}
                                className="input"
                                required
                            >
                                {DEVICE_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Assign to Farm *
                            </label>
                            <select
                                name="farmId"
                                value={formData.farmId}
                                onChange={handleChange}
                                className="input"
                                required
                            >
                                <option value="">Select a farm</option>
                                {farms.map((farm) => (
                                    <option key={farm.id} value={farm.id}>
                                        {farm.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Latitude
                                </label>
                                <input
                                    type="number"
                                    name="latitude"
                                    value={formData.latitude}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="e.g., 28.6139"
                                    step="any"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Longitude
                                </label>
                                <input
                                    type="number"
                                    name="longitude"
                                    value={formData.longitude}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="e.g., 77.2090"
                                    step="any"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {isLoading ? 'Adding...' : 'Add Device'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
