import { useState, useEffect, useCallback } from 'react'
import { irrigationAPI, farmsAPI, cropsAPI } from '../../services/api'
import {
  PlayIcon, StopIcon, ClockIcon, BeakerIcon,
  CloudIcon, ArrowPathIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'

// ── helpers ────────────────────────────────────────────────────────────────
const URGENCY_STYLE: Record<string, string> = {
  critical: 'bg-red-50 border-red-300 text-red-900',
  high:     'bg-orange-50 border-orange-300 text-orange-900',
  medium:   'bg-yellow-50 border-yellow-200 text-yellow-900',
  low:      'bg-green-50 border-green-200 text-green-900',
}
const URGENCY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-green-100 text-green-700',
}

function AIReasoningBadge({ urgency, reason }: { urgency: string; reason: string }) {
  const icons: Record<string, string> = {
    critical: '🚨', high: '⚠️', medium: '💧', low: '✅',
  }
  return (
    <div className={clsx('flex items-start gap-2 mt-2 p-3 rounded-lg text-sm', URGENCY_BADGE[urgency] ?? 'bg-gray-100 text-gray-700')}>
      <span className="text-base leading-none shrink-0">{icons[urgency] ?? '🤖'}</span>
      <p><span className="font-semibold">AI Reasoning: </span>{reason}</p>
    </div>
  )
}

function AgronomyPill({ label, value, unit }: { label: string; value: any; unit?: string }) {
  if (value == null) return null
  return (
    <span className="inline-flex flex-col items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-center min-w-[80px]">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="font-bold text-gray-900 text-sm">{value}{unit}</span>
    </span>
  )
}

export default function Irrigation() {
  const [farms, setFarms]                       = useState<any[]>([])
  const [selectedFarmId, setSelectedFarmId]     = useState('')
  const [recommendations, setRecommendations]   = useState<any[]>([])
  const [schedules, setSchedules]               = useState<any[]>([])
  const [history, setHistory]                   = useState<any>({ history: [], statistics: {} })
  const [crops, setCrops]                       = useState<any[]>([])
  const [isLoading, setIsLoading]               = useState(true)
  const [isRefreshing, setIsRefreshing]         = useState(false)
  const [manualDuration, setManualDuration]     = useState<number>(15)
  const [isTriggering, setIsTriggering]         = useState(false)

  useEffect(() => {
    farmsAPI.getAll().then((res) => {
      setFarms(res.data.farms)
      if (res.data.farms.length > 0) setSelectedFarmId(res.data.farms[0].id)
    }).finally(() => setIsLoading(false))
  }, [])

  const loadFarmData = useCallback(async (farmId: string) => {
    if (!farmId) return
    setIsRefreshing(true)
    try {
      const [recRes, schedRes, histRes, cropRes] = await Promise.all([
        irrigationAPI.getRecommendations(farmId),
        irrigationAPI.getSchedules({ farmId }),
        irrigationAPI.getHistory({ farmId, days: 30 }),
        cropsAPI.getByFarm(farmId),
      ])
      setRecommendations(recRes.data.recommendations || [])
      setSchedules(schedRes.data.schedules || [])
      setHistory(histRes.data || { history: [], statistics: {} })
      setCrops(cropRes.data.crops || [])
    } catch { /* silently show stale data */ }
    finally { setIsRefreshing(false) }
  }, [])

  useEffect(() => { loadFarmData(selectedFarmId) }, [selectedFarmId, loadFarmData])

  const handleTrigger = async (cropId: string | null, duration: number) => {
    try {
      setIsTriggering(true)
      const payload: any = { farmId: selectedFarmId, durationMinutes: duration }
      if (cropId) payload.cropId = cropId   // only include when it's a real UUID
      await irrigationAPI.triggerIrrigation(payload)
      toast.success(`Irrigation started for ${duration} min`)
      await loadFarmData(selectedFarmId)
    } catch { toast.error('Failed to start irrigation') }
    finally { setIsTriggering(false) }
  }

  const handleStop = async () => {
    try {
      setIsTriggering(true)
      await irrigationAPI.stop({ farmId: selectedFarmId })
      toast.success('Irrigation stopped')
      await loadFarmData(selectedFarmId)
    } catch { toast.error('Failed to stop irrigation') }
    finally { setIsTriggering(false) }
  }

  const handleCancel = async (id: string) => {
    try {
      await irrigationAPI.cancelSchedule(id)
      toast.success('Schedule cancelled')
      await loadFarmData(selectedFarmId)
    } catch { toast.error('Failed to cancel') }
  }

  // History chart data — last 10 completed sessions
  const historyChartData = (history.history || []).slice(0, 10).map((s: any) => ({
    label: new Date(s.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    minutes: s.durationMinutes,
    liters: s.actualVolumeLiters ? Math.round(parseFloat(s.actualVolumeLiters)) : null,
  })).reverse()

  // Crop agronomy data for context
  const cropAgronomyMap = Object.fromEntries(
    (crops || []).map((c: any) => [c.id, c.agronomy])
  )

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>
  )

  const stats = history.statistics || {}

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Irrigation</h1>
          <p className="text-gray-500 mt-1">AI-powered decisions from live sensor + weather + NDVI data</p>
        </div>
        <button onClick={() => loadFarmData(selectedFarmId)} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowPathIcon className={clsx('w-4 h-4', isRefreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Farm selector */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Farm</label>
        <select value={selectedFarmId} onChange={e => setSelectedFarmId(e.target.value)} className="input max-w-md">
          {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sessions (30d)</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">{stats.totalSessions ?? 0}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Duration</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">{stats.totalDurationMinutes ?? 0}<span className="text-sm font-normal"> min</span></p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Duration</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">{stats.averageDurationMinutes ?? 0}<span className="text-sm font-normal"> min</span></p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active Now</p>
          <p className="text-3xl font-bold mt-1 text-blue-600">
            {schedules.filter((s: any) => s.status === 'in_progress').length}
          </p>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Irrigation Recommendations</h3>
        </div>
        {recommendations.length > 0 ? (
          <div className="space-y-5">
            {recommendations.map((rec: any) => {
              const agro = cropAgronomyMap[rec.cropId] ?? {}
              return (
                <div key={rec.cropId} className={clsx('p-4 rounded-xl border', URGENCY_STYLE[rec.urgency])}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-base">{rec.cropType}</h4>
                        <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full uppercase', URGENCY_BADGE[rec.urgency])}>
                          {rec.urgency}
                        </span>
                        <span className="text-xs bg-white/60 border rounded px-2 py-0.5">
                          {rec.recommendedDuration} min recommended
                        </span>
                      </div>

                      <AIReasoningBadge urgency={rec.urgency} reason={rec.reason} />

                      {/* Agronomy context */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <AgronomyPill label="NDVI" value={rec.ndvi?.toFixed ? rec.ndvi.toFixed(2) : agro.ndvi?.toFixed?.(2)} />
                        <AgronomyPill label="Yield Potential" value={agro.yieldPotential} unit="%" />
                        <AgronomyPill label="GDD" value={agro.cumulativeGDD} unit=" heat units" />
                        {agro.diseaseRisk && (
                          <AgronomyPill label="Disease Risk" value={agro.diseaseRisk.level} />
                        )}
                      </div>

                      <p className="text-xs mt-3 opacity-80 flex items-center gap-1">
                        <CloudIcon className="w-3.5 h-3.5 shrink-0" />
                        {rec.weatherForecast}
                      </p>
                    </div>

                    <button
                      onClick={() => handleTrigger(rec.cropId, rec.recommendedDuration)}
                      disabled={isTriggering}
                      className="btn-primary shrink-0"
                    >
                      <PlayIcon className="w-4 h-4 mr-1" />
                      Start {rec.recommendedDuration} min
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">
            <BeakerIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium">All crops are well-watered</p>
            <p className="text-sm">No AI recommendations right now — sensor levels are optimal.</p>
          </div>
        )}
      </div>

      {/* Manual override */}
      <div className="card border-primary-100 bg-primary-50">
        <h3 className="text-lg font-semibold text-primary-900 mb-1">Manual Pump Override</h3>
        <p className="text-sm text-primary-700 mb-4">Bypass AI and run the pump immediately. Hardware auto-stops when soil moisture peaks.</p>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-primary-800 mb-1">Duration (min)</label>
            <input type="number" min="1" max="120" value={manualDuration}
              onChange={e => setManualDuration(Number(e.target.value))}
              className="input w-28 bg-white" />
          </div>
          <button onClick={() => handleTrigger(null, manualDuration)} disabled={isTriggering} className="btn-primary">
            <PlayIcon className="w-5 h-5 mr-2" />
            {isTriggering ? 'Starting…' : 'Turn Pump ON'}
          </button>
          <button onClick={handleStop} disabled={isTriggering} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
            <StopIcon className="w-5 h-5 mr-2" />
            Stop Pump
          </button>
        </div>
      </div>

      {/* Scheduled / active sessions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheduled &amp; Active Sessions</h3>
        {schedules.length > 0 ? (
          <div className="space-y-3">
            {schedules.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <ClockIcon className="w-5 h-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {s.farm?.name} — {s.crop?.cropType || 'Manual'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(s.scheduledTime).toLocaleString()} · {s.durationMinutes} min
                      {s.device ? ` · ${s.device.name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full',
                    s.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    s.status === 'completed'   ? 'bg-green-100 text-green-700' :
                    s.status === 'scheduled'   ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  )}>{s.status}</span>
                  {['scheduled', 'pending'].includes(s.status) && (
                    <button onClick={() => handleCancel(s.id)} className="text-xs text-red-500 hover:text-red-700">Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No scheduled sessions</p>
        )}
      </div>

      {/* History chart */}
      {historyChartData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Irrigation History (last 30 days)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" min" />
                <Tooltip formatter={(v: any, name: string) => [v, name === 'minutes' ? 'Duration (min)' : 'Volume (L)']} />
                <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Duration" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  )
}
