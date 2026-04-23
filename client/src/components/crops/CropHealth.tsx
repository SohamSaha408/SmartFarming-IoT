import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { cropsAPI, farmsAPI } from '../../services/api'
import { ChevronLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Area, TooltipProps,
} from 'recharts'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import clsx from 'clsx'

// ─── helpers ────────────────────────────────────────────────────────────────
function ndviZoneColor(value: number | null): string {
  if (value === null) return '#9ca3af'
  if (value >= 0.7)  return '#15803d'   // dense vegetation
  if (value >= 0.5)  return '#22c55e'   // healthy
  if (value >= 0.3)  return '#eab308'   // moderate
  if (value >= 0.1)  return '#f97316'   // sparse / stressed
  return '#ef4444'                       // bare soil / critical
}

function ndviLabel(value: number | null): string {
  if (value === null) return 'No data'
  if (value >= 0.7)  return 'Dense Vegetation'
  if (value >= 0.5)  return 'Healthy'
  if (value >= 0.3)  return 'Moderate'
  if (value >= 0.1)  return 'Sparse / Stressed'
  return 'Bare Soil / Critical'
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
function NDVITooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const ndvi   = payload.find(p => p.dataKey === 'ndvi')?.value   as number | undefined
  const score  = payload.find(p => p.dataKey === 'score')?.value  as number | undefined
  const moist  = payload.find(p => p.dataKey === 'moisture')?.value as number | undefined
  const temp   = payload.find(p => p.dataKey === 'temperature')?.value as number | undefined
  const gdd    = payload.find(p => p.dataKey === 'gdd')?.value    as number | undefined

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm min-w-[200px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {ndvi != null && (
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: ndviZoneColor(ndvi) }} />
          <span className="text-gray-600">NDVI:</span>
          <span className="font-bold" style={{ color: ndviZoneColor(ndvi) }}>
            {ndvi.toFixed(3)} — {ndviLabel(ndvi)}
          </span>
        </div>
      )}
      {score  != null && <p className="text-gray-600">🌿 Health Score: <b>{score}%</b></p>}
      {moist  != null && <p className="text-gray-600">💧 Soil Moisture: <b>{moist}%</b></p>}
      {temp   != null && <p className="text-gray-600">🌡 Temperature: <b>{temp}°C</b></p>}
      {gdd    != null && <p className="text-gray-600">☀️ Daily GDD: <b>{gdd}</b></p>}
    </div>
  )
}

// ─── NDVI Zone Legend ────────────────────────────────────────────────────────
const NDVI_ZONES = [
  { color: '#15803d', label: '≥ 0.7  Dense Vegetation' },
  { color: '#22c55e', label: '0.5 – 0.7  Healthy' },
  { color: '#eab308', label: '0.3 – 0.5  Moderate' },
  { color: '#f97316', label: '0.1 – 0.3  Stressed' },
  { color: '#ef4444', label: '< 0.1  Bare / Critical' },
]

// ─── Component ───────────────────────────────────────────────────────────────
export default function CropHealth() {
  const { id } = useParams<{ id: string }>()
  const [crop, setCrop]               = useState<any>(null)
  const [farm, setFarm]               = useState<any>(null)
  const [healthHistory, setHealthHistory] = useState<any[]>([])
  const [agronomy, setAgronomy]       = useState<any>(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [activeLines, setActiveLines] = useState({
    ndvi: true, score: true, moisture: true, temperature: false, gdd: false,
  })

  useEffect(() => {
    if (id) {
      Promise.all([
        cropsAPI.getById(id),
        cropsAPI.getHealth(id, { limit: 60 }),
      ]).then(([cropRes, healthRes]) => {
        const fetchedCrop = cropRes.data.crop
        setCrop(fetchedCrop)
        setHealthHistory(healthRes.data.healthRecords || [])
        setAgronomy(healthRes.data.agronomy || null)
        // Fetch the farm to get lat/lon for the map
        if (fetchedCrop?.farmId) {
          farmsAPI.getById(fetchedCrop.farmId)
            .then(r => setFarm(r.data.farm))
            .catch(() => {})
        }
        setIsLoading(false)
      }).catch(() => setIsLoading(false))
    }
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!crop) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Crop not found</p>
        <Link to="/crops" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          Go back to crops
        </Link>
      </div>
    )
  }

  const latestHealth = healthHistory[0]

  // Build chart rows (oldest → newest)
  const chartData = healthHistory.slice().reverse().map((h) => ({
    date:        new Date(h.recordedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    ndvi:        h.ndviValue        ? parseFloat(h.ndviValue)    : null,
    score:       h.healthScore      ?? null,
    moisture:    h.moistureLevel    ?? null,
    temperature: h.temperature      ?? null,
    gdd:         h.dailyGDD         ?? null,
  }))

  // Dynamic dot colour per NDVI value
  const renderNDVIDot = (props: any) => {
    const { cx, cy, payload } = props
    if (payload.ndvi == null) return <g key={`dot-${cx}`} />
    return (
      <circle
        key={`dot-${cx}-${cy}`}
        cx={cx} cy={cy} r={4}
        fill={ndviZoneColor(payload.ndvi)}
        stroke="#fff" strokeWidth={1.5}
      />
    )
  }

  const toggleLine = (key: keyof typeof activeLines) =>
    setActiveLines(prev => ({ ...prev, [key]: !prev[key] }))

  // latest NDVI for the color badge
  const latestNDVI = latestHealth?.ndviValue ? parseFloat(latestHealth.ndviValue) : null

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Link to="/crops" className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeftIcon className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{crop?.cropType || 'Crop'} Health</h1>
          <p className="text-gray-500">{crop?.variety || 'Health monitoring and analytics'}</p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {latestHealth && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Health Score */}
          <div className="card col-span-1">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Health Score</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{latestHealth.healthScore ?? '—'}%</p>
            <span className={clsx(
              'inline-block px-2 py-0.5 text-xs font-medium rounded-full mt-2',
              latestHealth.healthStatus === 'excellent' ? 'bg-green-100 text-green-700' :
              latestHealth.healthStatus === 'healthy'   ? 'bg-emerald-100 text-emerald-700' :
              latestHealth.healthStatus === 'moderate'  ? 'bg-yellow-100 text-yellow-700' :
              latestHealth.healthStatus === 'stressed'  ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-700'
            )}>
              {latestHealth.healthStatus}
            </span>
          </div>

          {/* NDVI */}
          <div className="card col-span-1" style={{ borderLeft: `4px solid ${ndviZoneColor(latestNDVI)}` }}>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">NDVI</p>
            <p className="text-3xl font-bold mt-1" style={{ color: ndviZoneColor(latestNDVI) }}>
              {latestNDVI != null ? latestNDVI.toFixed(3) : '—'}
            </p>
            <p className="text-xs mt-1" style={{ color: ndviZoneColor(latestNDVI) }}>
              {ndviLabel(latestNDVI)}
            </p>
          </div>

          {/* Soil Moisture */}
          <div className="card col-span-1">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Soil Moisture</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              {latestHealth.moistureLevel != null ? `${latestHealth.moistureLevel}%` : '—'}
            </p>
            {latestHealth.moistureLevel != null && (
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${latestHealth.moistureLevel}%` }} />
              </div>
            )}
          </div>

          {/* Temperature */}
          <div className="card col-span-1">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Temperature</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">
              {latestHealth.temperature != null ? `${latestHealth.temperature}°C` : '—'}
            </p>
          </div>

          {/* Disease Risk */}
          {agronomy?.diseaseRisk && (
            <div className="card col-span-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Disease Risk</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{agronomy.diseaseRisk.level}</p>
              <span className={clsx(
                'inline-block px-2 py-0.5 text-xs font-medium rounded-full mt-2',
                agronomy.diseaseRisk.level === 'Low'      ? 'bg-green-100 text-green-700' :
                agronomy.diseaseRisk.level === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              )}>
                Score: {agronomy.diseaseRisk.score}
              </span>
            </div>
          )}

          {/* GDD */}
          {agronomy?.cumulativeGDD != null && (
            <div className="card col-span-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cumul. GDD</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{agronomy.cumulativeGDD}</p>
              <p className="text-xs text-gray-400 mt-1">Heat Units</p>
            </div>
          )}
        </div>
      )}

      {/* ── Actionable Agronomy Insights ── */}
      {agronomy && agronomy.yieldPotential != null && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-xl font-bold text-primary-900 mb-4">🌾 Harvest Forecast &amp; Action Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Yield */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-primary-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Yield Potential</p>
              <p className="text-3xl font-black text-primary-600">{agronomy.yieldPotential}%</p>
              <p className="text-gray-700 text-sm mt-2">
                {agronomy.yieldPotential >= 90
                  ? '✅ On track for an excellent harvest.'
                  : agronomy.yieldPotential >= 75
                  ? '⚠️ Doing well — room to improve.'
                  : '❗ Crop needs attention.'}
              </p>
            </div>

            {/* Nitrogen */}
            {agronomy.nitrogenReq != null && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-primary-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nitrogen Required</p>
                <p className="text-3xl font-black text-amber-600">
                  {agronomy.nitrogenReq > 0 ? `+${agronomy.nitrogenReq} kg/ha` : 'Sufficient'}
                </p>
                <p className="text-gray-700 text-sm mt-2">
                  {agronomy.nitrogenReq > 0
                    ? `Apply ${agronomy.nitrogenReq} kg/ha of Nitrogen to maximise yield.`
                    : 'No additional fertilizer needed right now.'}
                </p>
              </div>
            )}

            {/* Water Stress */}
            {agronomy.waterStressIndex != null && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-primary-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Water Stress Index</p>
                <p className={clsx('text-3xl font-black', agronomy.waterStressIndex > 0.6 ? 'text-red-600' : agronomy.waterStressIndex > 0.3 ? 'text-yellow-500' : 'text-green-600')}>
                  {agronomy.waterStressIndex.toFixed(2)}
                </p>
                <p className="text-gray-700 text-sm mt-2">
                  {agronomy.waterStressIndex > 0.6
                    ? '❗ High stress — irrigate soon.'
                    : agronomy.waterStressIndex > 0.3
                    ? '⚠️ Moderate — monitor closely.'
                    : '✅ Low stress — crop is comfortable.'}
                </p>
              </div>
            )}

            {/* Crop Stage */}
            {agronomy.cropStage && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-primary-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Growth Stage</p>
                <p className="text-2xl font-black text-indigo-600 capitalize">{agronomy.cropStage}</p>
                <p className="text-gray-700 text-sm mt-2">
                  {agronomy.daysToHarvest != null
                    ? `~${agronomy.daysToHarvest} days to expected harvest.`
                    : 'Based on accumulated GDD.'}
                </p>
              </div>
            )}

            {/* Pest Risk */}
            {agronomy.pestRisk && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-primary-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pest Risk</p>
                <p className={clsx('text-2xl font-black', agronomy.pestRisk === 'High' ? 'text-red-600' : agronomy.pestRisk === 'Medium' ? 'text-yellow-500' : 'text-green-600')}>
                  {agronomy.pestRisk}
                </p>
                {agronomy.pestNotes && <p className="text-gray-700 text-sm mt-2">{agronomy.pestNotes}</p>}
              </div>
            )}

            {/* Evapotranspiration */}
            {agronomy.et0 != null && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-primary-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Evapotranspiration (ET₀)</p>
                <p className="text-3xl font-black text-cyan-600">{agronomy.et0} mm/day</p>
                <p className="text-gray-700 text-sm mt-2">Reference ET — guides irrigation volume.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NDVI + Agronomy Composite Chart ── */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">NDVI &amp; Agronomy Trends</h3>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <InformationCircleIcon className="w-4 h-4" />
              Toggle layers below to compare metrics side-by-side
            </p>
          </div>
          {/* NDVI Zone Legend */}
          <div className="flex flex-wrap gap-2">
            {NDVI_ZONES.map(z => (
              <span key={z.color} className="flex items-center gap-1 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: z.color }} />
                {z.label}
              </span>
            ))}
          </div>
        </div>

        {/* Layer toggles */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(activeLines) as Array<keyof typeof activeLines>).map(key => (
            <button
              key={key}
              onClick={() => toggleLine(key)}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded-full border transition-all',
                activeLines[key]
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-500 border-gray-300'
              )}
            >
              {key === 'ndvi'        ? '🌿 NDVI'
               : key === 'score'    ? '❤️ Health Score'
               : key === 'moisture' ? '💧 Soil Moisture'
               : key === 'temperature' ? '🌡 Temperature'
               : '☀️ Daily GDD'}
            </button>
          ))}
        </div>

        {chartData.length > 0 ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />

                {/* Left axis: NDVI (0–1) */}
                <YAxis
                  yAxisId="ndvi"
                  domain={[-0.1, 1.0]}
                  tickCount={7}
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => v.toFixed(1)}
                  label={{ value: 'NDVI', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
                />

                {/* Right axis: Percentage & temperature */}
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 110]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => `${v}`}
                  label={{ value: '% / °C / GDD', angle: 90, position: 'insideRight', offset: 10, fontSize: 11 }}
                />

                <Tooltip content={<NDVITooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />

                {/* NDVI reference bands */}
                <ReferenceLine yAxisId="ndvi" y={0.7} stroke="#15803d" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '0.7', position: 'insideTopLeft', fontSize: 10, fill: '#15803d' }} />
                <ReferenceLine yAxisId="ndvi" y={0.5} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '0.5', position: 'insideTopLeft', fontSize: 10, fill: '#22c55e' }} />
                <ReferenceLine yAxisId="ndvi" y={0.3} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '0.3', position: 'insideTopLeft', fontSize: 10, fill: '#eab308' }} />
                <ReferenceLine yAxisId="ndvi" y={0.1} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '0.1', position: 'insideTopLeft', fontSize: 10, fill: '#f97316' }} />

                {/* NDVI Area + dynamic-coloured Line */}
                {activeLines.ndvi && (
                  <>
                    <Area
                      yAxisId="ndvi"
                      type="monotone"
                      dataKey="ndvi"
                      fill="#bbf7d0"
                      fillOpacity={0.35}
                      stroke="none"
                      name="NDVI Area"
                      legendType="none"
                      connectNulls
                    />
                    <Line
                      yAxisId="ndvi"
                      type="monotone"
                      dataKey="ndvi"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={renderNDVIDot}
                      activeDot={{ r: 6 }}
                      name="NDVI"
                      connectNulls
                    />
                  </>
                )}

                {/* Health Score */}
                {activeLines.score && (
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="score"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    name="Health Score (%)"
                    connectNulls
                  />
                )}

                {/* Soil Moisture */}
                {activeLines.moisture && (
                  <Bar
                    yAxisId="pct"
                    dataKey="moisture"
                    fill="#3b82f6"
                    fillOpacity={0.25}
                    name="Soil Moisture (%)"
                    radius={[2, 2, 0, 0]}
                  />
                )}

                {/* Temperature */}
                {activeLines.temperature && (
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                    name="Temperature (°C)"
                    connectNulls
                  />
                )}

                {/* Daily GDD */}
                {activeLines.gdd && (
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="gdd"
                    stroke="#eab308"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Daily GDD"
                    connectNulls
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p className="text-lg font-medium">No data yet</p>
            <p className="text-sm">Sensor readings will appear here once collected.</p>
          </div>
        )}
      </div>

      {/* ── Recommendations ── */}
      {Array.isArray(latestHealth?.recommendations) && latestHealth.recommendations.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Recommendations</h3>
          <ul className="space-y-2">
            {latestHealth.recommendations.map((rec: string, index: number) => (
              <li key={index} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                <span className="text-gray-700 text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── NDVI Vegetation Map (always shown) ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🛰 NDVI Vegetation Map</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Satellite view of farm location — marker colour reflects current NDVI health
            </p>
          </div>
          {/* NDVI badge */}
          {latestNDVI != null && (
            <span
              className="px-3 py-1 rounded-full text-sm font-semibold text-white"
              style={{ background: ndviZoneColor(latestNDVI) }}
            >
              NDVI {latestNDVI.toFixed(3)} · {ndviLabel(latestNDVI)}
            </span>
          )}
        </div>

        {/* Leaflet map — always rendered */}
        {(() => {
          const lat = farm?.latitude  ?? crop?.farm?.latitude  ?? 19.076
          const lon = farm?.longitude ?? crop?.farm?.longitude ?? 72.877
          const ndviColor = ndviZoneColor(latestNDVI)
          return (
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 420 }}>
              <MapContainer
                center={[lat, lon]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                {/* Satellite tile layer */}
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles © Esri"
                  maxZoom={19}
                />
                {/* NDVI-coloured farm marker */}
                <CircleMarker
                  center={[lat, lon]}
                  radius={22}
                  pathOptions={{
                    color: '#fff',
                    weight: 3,
                    fillColor: ndviColor,
                    fillOpacity: 0.75,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold mb-1">{crop?.cropType || 'Crop'} — {farm?.name || 'Farm'}</p>
                      <p style={{ color: ndviColor }} className="font-bold">
                        NDVI: {latestNDVI != null ? latestNDVI.toFixed(3) : 'No data'}
                      </p>
                      <p className="text-gray-500">{ndviLabel(latestNDVI)}</p>
                      {latestHealth?.healthScore != null && (
                        <p className="text-gray-500">Health: {latestHealth.healthScore}%</p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              </MapContainer>
            </div>
          )
        })()}

        {/* NDVI zone legend under map */}
        <div className="flex flex-wrap gap-3 mt-3">
          {NDVI_ZONES.map(z => (
            <span key={z.color} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: z.color }} />
              {z.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
