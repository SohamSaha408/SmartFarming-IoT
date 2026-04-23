import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { cropsAPI } from '../../services/api'
import toast from 'react-hot-toast'

interface AddCropModalProps {
  onClose: () => void
  onSuccess: () => void
  farmId: string
}

export default function AddCropModal({ onClose, onSuccess, farmId }: AddCropModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    cropType: 'Wheat',
    variety: '',
    plantedDate: '',
    expectedHarvestDate: '',
    areaHectares: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!farmId) {
      toast.error('Please select a farm first in the dropdown')
      return
    }

    try {
      setIsLoading(true)
      await cropsAPI.create(farmId, {
        cropType: formData.cropType,
        variety: formData.variety || undefined,
        plantedDate: formData.plantedDate || undefined,
        expectedHarvestDate: formData.expectedHarvestDate || undefined,
        areaHectares: formData.areaHectares ? parseFloat(formData.areaHectares) : undefined,
      })
      toast.success('Crop added successfully!')
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add crop')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Add New Crop</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="cropType" className="block text-sm font-medium text-gray-700">
              Crop Type *
            </label>
            <select
              id="cropType"
              name="cropType"
              required
              value={formData.cropType}
              onChange={handleChange}
              className="mt-1 input-field"
            >
              <option value="Wheat">Wheat</option>
              <option value="Rice">Rice</option>
              <option value="Cotton">Cotton</option>
              <option value="Sugarcane">Sugarcane</option>
              <option value="Maize">Maize</option>
              <option value="Soybean">Soybean</option>
              <option value="Groundnut">Groundnut</option>
              <option value="Bajra">Bajra</option>
              <option value="Jowar">Jowar</option>
              <option value="Potato">Potato</option>
              <option value="Tomato">Tomato</option>
              <option value="Onion">Onion</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="variety" className="block text-sm font-medium text-gray-700">
              Variety (Optional)
            </label>
            <input
              type="text"
              id="variety"
              name="variety"
              value={formData.variety}
              onChange={handleChange}
              className="mt-1 input-field"
              placeholder="e.g., Basmati, Durum"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="plantedDate" className="block text-sm font-medium text-gray-700">
                Planted Date
              </label>
              <input
                type="date"
                id="plantedDate"
                name="plantedDate"
                value={formData.plantedDate}
                onChange={handleChange}
                className="mt-1 input-field"
              />
            </div>

            <div>
              <label htmlFor="expectedHarvestDate" className="block text-sm font-medium text-gray-700">
                Expected Harvest
              </label>
              <input
                type="date"
                id="expectedHarvestDate"
                name="expectedHarvestDate"
                value={formData.expectedHarvestDate}
                onChange={handleChange}
                className="mt-1 input-field"
              />
            </div>
          </div>

          <div>
            <label htmlFor="areaHectares" className="block text-sm font-medium text-gray-700">
              Area (Hectares)
            </label>
            <input
              type="number"
              step="0.01"
              id="areaHectares"
              name="areaHectares"
              min="0.01"
              value={formData.areaHectares}
              onChange={handleChange}
              className="mt-1 input-field"
              placeholder="e.g., 5.5"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Adding...' : 'Add Crop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
