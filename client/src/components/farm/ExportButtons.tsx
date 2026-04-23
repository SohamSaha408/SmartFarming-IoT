/**
 * ExportButtons — drop into any farm page
 * Usage: <ExportButtons farmId={farm.id} farmName={farm.name} />
 */
import { useState } from 'react'
import { farmsAPI } from '../../services/api'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Props {
  farmId:   string
  farmName: string
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportButtons({ farmId, farmName }: Props) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)

  const slug = farmName.replace(/\s+/g, '_')
  const date = new Date().toISOString().slice(0, 10)

  const handlePDF = async () => {
    setPdfLoading(true)
    const toastId = toast.loading('Generating PDF report…')
    try {
      const res  = await farmsAPI.exportPDF(farmId)
      triggerDownload(new Blob([res.data], { type: 'application/pdf' }),
        `farm-report-${slug}-${date}.pdf`)
      toast.success('PDF downloaded', { id: toastId })
    } catch {
      toast.error('Failed to generate PDF', { id: toastId })
    } finally {
      setPdfLoading(false)
    }
  }

  const handleCSV = async () => {
    setCsvLoading(true)
    const toastId = toast.loading('Exporting sensor data…')
    try {
      const res  = await farmsAPI.exportCSV(farmId)
      triggerDownload(new Blob([res.data], { type: 'text/csv' }),
        `sensor-readings-${slug}-${date}.csv`)
      toast.success('CSV downloaded', { id: toastId })
    } catch {
      toast.error('Failed to export CSV', { id: toastId })
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePDF}
        disabled={pdfLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
          border border-gray-300 rounded-lg bg-white hover:bg-gray-50
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ArrowDownTrayIcon className="w-3.5 h-3.5 text-red-500" />
        {pdfLoading ? 'Generating…' : 'PDF Report'}
      </button>

      <button
        onClick={handleCSV}
        disabled={csvLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
          border border-gray-300 rounded-lg bg-white hover:bg-gray-50
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ArrowDownTrayIcon className="w-3.5 h-3.5 text-green-600" />
        {csvLoading ? 'Exporting…' : 'Sensor CSV'}
      </button>
    </div>
  )
}
