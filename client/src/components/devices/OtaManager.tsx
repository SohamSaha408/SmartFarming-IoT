/**
 * OtaManager.tsx
 * Lets a farmer upload a .bin firmware file for a specific device
 * and see the currently stored version.
 *
 * Usage: <OtaManager deviceId="node_a1" />
 */
import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  CpuChipIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props { deviceId: string }

interface FirmwareMeta {
  version:    string
  uploadedAt: string
  size:       number
  deviceId:   string
}

export default function OtaManager({ deviceId }: Props) {
  const [meta, setMeta]           = useState<FirmwareMeta | null>(null)
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [version, setVersion]     = useState('1.0.1')
  const fileRef                   = useRef<HTMLInputElement>(null)

  const fetchMeta = async () => {
    try {
      const res = await api.get(`/ota/version/${deviceId}`)
      setMeta(res.data)
    } catch {
      setMeta(null) // 404 = no firmware yet, that's fine
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMeta() }, [deviceId])

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { toast.error('Select a .bin file first'); return }
    if (!file.name.endsWith('.bin')) { toast.error('Only .bin files accepted'); return }

    const formData = new FormData()
    formData.append('firmware', file)
    formData.append('version', version)

    setUploading(true)
    const tid = toast.loading(`Uploading v${version}…`)
    try {
      await api.post(`/ota/upload/${deviceId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(`Firmware v${version} uploaded — ESP32 will update on next boot`, { id: tid })
      if (fileRef.current) fileRef.current.value = ''
      await fetchMeta()
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Upload failed', { id: tid })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Remove stored firmware for ${deviceId}?`)) return
    try {
      await api.delete(`/ota/${deviceId}`)
      toast.success('Firmware removed')
      setMeta(null)
    } catch {
      toast.error('Failed to remove firmware')
    }
  }

  if (loading) return (
    <div className="card animate-pulse h-24 flex items-center justify-center">
      <span className="text-xs text-gray-400">Loading firmware info…</span>
    </div>
  )

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CpuChipIcon className="w-5 h-5 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-800">OTA Firmware Update</h3>
        <span className="ml-auto text-xs text-gray-400 font-mono">{deviceId}</span>
      </div>

      {/* Current firmware badge */}
      {meta ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200
                        rounded-lg px-3 py-2.5">
          <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-green-800">
              Stored: v{meta.version}
            </p>
            <p className="text-xs text-green-600 truncate">
              {(meta.size / 1024).toFixed(1)} KB ·{' '}
              {new Date(meta.uploadedAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="p-1 text-green-400 hover:text-red-500 transition-colors"
            title="Remove firmware"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">
          No firmware stored yet — upload a .bin to enable OTA updates.
        </p>
      )}

      {/* Upload form */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">New version tag</label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="e.g. 1.0.1"
              className="input-field text-sm w-full"
            />
          </div>
          <div className="flex-[2]">
            <label className="text-xs text-gray-500 block mb-1">Firmware .bin file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".bin"
              className="block w-full text-xs text-gray-500
                file:mr-2 file:py-1.5 file:px-3
                file:rounded-lg file:border file:border-gray-300
                file:text-xs file:font-medium file:bg-white
                file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading}
          className={clsx(
            'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
            uploading
              ? 'bg-indigo-300 cursor-not-allowed text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          )}
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          {uploading ? 'Uploading…' : 'Upload & Activate'}
        </button>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        The ESP32 polls for updates on every boot and every hour.
        After upload it will automatically download, flash, and reboot.
      </p>
    </div>
  )
}
