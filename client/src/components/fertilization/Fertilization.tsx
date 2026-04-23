import { useState, useEffect, useCallback } from 'react'
import { fertilizationAPI, farmsAPI, cropsAPI } from '../../services/api'
import {
  BeakerIcon, CheckIcon, ArrowPathIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, RadarChart,
  PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'

const URGENCY_STYLE: Record<string, string> = {
  high:   'bg-orange-50 border-orange-300 text-orange-900',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  low:    'bg-green-50 border-green-200 text-green-900',
}
const URGENCY_BADGE: Record<string, string> = {
  high:   'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-green-100 text-green-700',
}

// Decode NPK ratio string "46:0:0" → usable chart data
function parseNPK(ratio: string | undefined) {
  if (!ratio) return null
  const parts = ratio.split(':').map(Number)
  if (parts.length < 3) return null
  return { N: parts[0], P: parts[1], K: parts[2] }
}

function AIReasoningBadge({ reason, growthStage }: { reason: string; growthStage?: string }) {
  return (
    <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-900">
      <span className="text-base leading-none shrink-0">🤖</span>
      <div>
        <p><span className="font-semibold">AI Reasoning: </span>{reason}</p>
        {growthStage && (
          <p className="mt-1 text-xs text-blue-700">Growth stage: <span className="font-medium">{growthStage}</span></p>
        )}
      </div>
    </div>
  )
}

export default function Fertilization() {
  const [farms, setFarms]                     = useState<any[]>([])
  const [selectedFarmId, setSelectedFarmId]   = useState('')
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [history, setHistory]                 = useState<any[]>([])
  const [crops, setCrops]                     = useState<any[]>([])
  const [isLoading, setIsLoading]             = useState(true)
  const [isRefreshing, setIsRefreshing]       = useState(false)
  const [applyingId, setApplyingId]           = useState<string | null>(null)
  const [applyModal, setApplyModal]           = useState<any | null>(null)
  const [applyQty, setApplyQty]               = useState('')
  const [applyMethod, setApplyMethod]         = useState('broadcasting')

  useEffect(() => {
    farmsAPI.getAll().then((res) => {
      setFarms(res.data.farms)
      if (res.data.farms.length > 0) setSelectedFarmId(res.data.farms[0].id)
    }).finally(() => setIsLoading(false))
  }, [])

  const loadData = useCallback(async (farmId: string) => {
    if (!farmId) return
    setIsRefreshing(true)
    try {
      const [recRes, histRes, cropRes] = await Promise.all([
        fertilizationAPI.getRecommendations(farmId),
        fertilizationAPI.getHistory({ farmId, days: 60 }),
        cropsAPI.getByFarm(farmId),
      ])
      setRecommendations(recRes.data.recommendations || [])
      setHistory(histRes.data.records || [])
      setCrops(cropRes.data.crops || [])
    } catch { /* show stale */ }
    finally { setIsRefreshing(false) }
  }, [])

  useEffect(() => { loadData(selectedFarmId) }, [selectedFarmId, loadData])

  const handleMarkApplied = async () => {
    if (!applyModal) return
    try {
      setApplyingId(applyModal.id)
      await fertilizationAPI.markAsApplied(applyModal.id, {
        actualQuantityKg: parseFloat(applyQty) || applyModal.quantityKg,
        actualCost: Math.round((parseFloat(applyQty) || applyModal.quantityKg) * (applyModal.estimatedCost / (applyModal.quantityKg || 1))),
        applicationMethod: applyMethod,
      })
      toast.success(`${applyModal.fertilizerType} marked as applied`)
      setApplyModal(null)
      await loadData(selectedFarmId)
    } catch { toast.error('Failed to mark as applied') }
    finally { setApplyingId(null) }
  }

  // Crop agronomy lookup
  const agronomyByCropId = Object.fromEntries((crops || []).map((c: any) => [c.id, c.agronomy]))

  // History chart: group by fertilizerType
  const historyByType = (history || []).reduce((acc: any, r: any) => {
    const t = r.fertilizerType || r.fertilzerType || 'Unknown'
    acc[t] = (acc[t] || 0) + (parseFloat(r.quantityKg) || 0)
    return acc
  }, {} as Record<string, number>)
  const historyChartData = Object.entries(historyByType).map(([name, qty]) => ({ name, qty }))

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Fertilization</h1>
          <p className="text-gray-500 mt-1">AI nutrient recommendations driven by NDVI, soil sensors &amp; growth stage</p>
        </div>
        <button onClick={() => loadData(selectedFarmId)} className="btn-secondary flex items-center gap-2 text-sm">
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

      {/* AI Recommendations */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Fertilization Recommendations</h3>
        </div>

        {recommendations.length > 0 ? (
          <div className="space-y-6">
            {recommendations.map((rec: any) => {
              const agro = agronomyByCropId[rec.cropId] ?? {}
              const npk  = parseNPK(rec.npkRatio)
              const npkRadar = npk
                ? [
                    { nutrient: 'N', value: npk.N },
                    { nutrient: 'P', value: npk.P },
                    { nutrient: 'K', value: npk.K },
                  ]
                : null

              return (
                <div key={rec.cropId} className={clsx('p-4 rounded-xl border', URGENCY_STYLE[rec.urgency])}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">

                      {/* Title row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <BeakerIcon className="w-5 h-5 shrink-0" />
                        <h4 className="font-semibold text-base">{rec.cropType}</h4>
                        <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full uppercase', URGENCY_BADGE[rec.urgency])}>
                          {rec.urgency}
                        </span>
                      </div>

                      {/* AI reasoning */}
                      <AIReasoningBadge reason={rec.reason} growthStage={rec.growthStage} />

                      {/* Fertilizer specs */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        {[
                          { label: 'Fertilizer', value: rec.fertilizerType },
                          { label: 'Quantity', value: `${rec.quantityKg} kg/ha` },
                          { label: 'NPK Ratio', value: rec.npkRatio },
                          { label: 'Est. Cost', value: `₹${rec.estimatedCost}` },
                        ].map(item => (
                          <div key={item.label} className="bg-white/70 rounded-lg p-2 border border-white">
                            <p className="text-xs text-gray-500">{item.label}</p>
                            <p className="font-semibold text-gray-900 text-sm mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Agronomy context row */}
                      <div className="flex flex-wrap gap-2 mt-3 text-xs">
                        {agro.yieldPotential != null && (
                          <span className="bg-white border rounded px-2 py-1">
                            🌾 Yield Potential: <b>{agro.yieldPotential}%</b>
                          </span>
                        )}
                        {agro.nitrogenReq != null && agro.nitrogenReq > 0 && (
                          <span className="bg-white border rounded px-2 py-1 text-amber-700">
                            ⚗️ N deficit: <b>+{agro.nitrogenReq} kg/ha</b> (NDVI model)
                          </span>
                        )}
                        {agro.diseaseRisk && (
                          <span className={clsx('bg-white border rounded px-2 py-1',
                            agro.diseaseRisk.level === 'High' ? 'text-red-700' :
                            agro.diseaseRisk.level === 'Moderate' ? 'text-yellow-700' : 'text-green-700')}>
                            🍄 Disease Risk: <b>{agro.diseaseRisk.level}</b>
                          </span>
                        )}
                        {agro.cumulativeGDD != null && (
                          <span className="bg-white border rounded px-2 py-1">
                            ☀️ GDD: <b>{agro.cumulativeGDD}</b>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* NPK radar + action */}
                    <div className="flex flex-col items-center gap-3 shrink-0">
                      {npkRadar && (
                        <div className="w-28 h-28">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={npkRadar} cx="50%" cy="50%" outerRadius={40}>
                              <PolarGrid />
                              <PolarAngleAxis dataKey="nutrient" tick={{ fontSize: 11 }} />
                              <Radar dataKey="value" stroke="#16a34a" fill="#16a34a" fillOpacity={0.35} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <button
                        onClick={() => { setApplyModal(rec); setApplyQty(String(rec.quantityKg)) }}
                        className="btn-primary text-sm"
                      >
                        <CheckIcon className="w-4 h-4 mr-1" />
                        Mark Applied
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">
            <BeakerIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Nutrient levels are balanced</p>
            <p className="text-sm">No AI recommendations right now — all crops are within range.</p>
          </div>
        )}
      </div>

      {/* Recent application history */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Applications</h3>
        {history.length > 0 ? (
          <>
            {/* Bar chart of usage by type */}
            {historyChartData.length > 0 && (
              <div className="h-44 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit=" kg" />
                    <Tooltip formatter={(v: any) => [`${v} kg`, 'Total applied']} />
                    <Bar dataKey="qty" fill="#16a34a" radius={[4, 4, 0, 0]} name="Applied (kg)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="space-y-2">
              {history.slice(0, 10).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg flex-wrap gap-2">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{r.fertilizerType || r.fertilzerType}</p>
                    <p className="text-xs text-gray-500">
                      {r.crop?.cropType} · {r.quantityKg} kg
                      {r.applicationMethod ? ` · ${r.applicationMethod}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full',
                      r.status === 'applied'      ? 'bg-green-100 text-green-700' :
                      r.status === 'recommended'  ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    )}>{r.status}</span>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(r.recommendedDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-center py-8">No application records yet</p>
        )}
      </div>

      {/* Mark Applied modal */}
      {applyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Mark as Applied</h3>
            <p className="text-sm text-gray-600">
              Recording application of <strong>{applyModal.fertilizerType}</strong> to <strong>{applyModal.cropType}</strong>.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Quantity Applied (kg)</label>
              <input type="number" value={applyQty} onChange={e => setApplyQty(e.target.value)}
                className="input w-full" min="0" step="0.1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Application Method</label>
              <select value={applyMethod} onChange={e => setApplyMethod(e.target.value)} className="input w-full">
                <option value="broadcasting">Broadcast</option>
                <option value="drip">Drip / Fertigation</option>
                <option value="foliar">Foliar Spray</option>
                <option value="band">Band Placement</option>
                <option value="spot">Spot Application</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleMarkApplied} disabled={!!applyingId} className="btn-primary flex-1">
                <CheckIcon className="w-4 h-4 mr-1" />
                {applyingId ? 'Saving…' : 'Confirm Application'}
              </button>
              <button onClick={() => setApplyModal(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
