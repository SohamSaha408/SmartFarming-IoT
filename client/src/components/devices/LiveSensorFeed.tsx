/**
 * LiveSensorFeed
 * Drop this anywhere — pass a farmId and it will show live sensor values
 * updating in real-time via WebSocket without any page refresh.
 *
 * Usage: <LiveSensorFeed farmId={farm.id} />
 */
import { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { LineChart, Line, Tooltip, ResponsiveContainer, YAxis } from 'recharts';
import {
    SignalIcon,
    ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface Props {
    farmId: string;
}

interface SensorCardProps {
    label: string;
    value: number | undefined;
    unit: string;
    history: number[];
    color: string;
    min?: number;
    max?: number;
}

function SensorCard({ label, value, unit, history, color, min = 0, max = 100 }: SensorCardProps) {
    const pct = value !== undefined ? Math.round(((value - min) / (max - min)) * 100) : null;
    const data = history.map((v, i) => ({ i, v }));

    return (
        <div className="card p-4 flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium uppercase tracking-wide">
                <span>{label}</span>
            </div>
            <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-gray-900">
                    {value !== undefined ? value.toFixed(1) : '—'}
                </span>
                <span className="text-sm text-gray-400 mb-1">{unit}</span>
            </div>
            {pct !== null && (
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
                    />
                </div>
            )}
            {data.length > 1 && (
                <div className="h-12 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <YAxis domain={[min, max]} hide />
                            <Tooltip
                                formatter={(v: any) => [`${Number(v).toFixed(1)} ${unit}`, label]}
                                contentStyle={{ fontSize: 11, padding: '2px 8px' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="v"
                                stroke={color}
                                strokeWidth={1.5}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

export default function LiveSensorFeed({ farmId }: Props) {
    const { isConnected, latestReading, readings, deviceStatuses } = useSocket(farmId);
    const [flash, setFlash] = useState(false);

    // Flash the border green on every new reading
    useEffect(() => {
        if (!latestReading) return;
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 800);
        return () => clearTimeout(t);
    }, [latestReading]);

    // Build per-sensor history arrays from the rolling readings list
    const moistureHistory = readings
        .filter(r => r.nodeId === latestReading?.nodeId)
        .map(r => r.data.moisture ?? r.data.soilMoisture ?? 0);
    const tempHistory = readings
        .filter(r => r.nodeId === latestReading?.nodeId)
        .map(r => r.data.temperature ?? 0);
    const humHistory = readings
        .filter(r => r.nodeId === latestReading?.nodeId)
        .map(r => r.data.humidity ?? 0);
    const luxHistory = readings
        .filter(r => r.nodeId === latestReading?.nodeId)
        .map(r => r.data.lux ?? 0);

    const d = latestReading?.data;

    return (
        <div className={clsx(
            'rounded-xl border transition-all duration-500',
            flash ? 'border-green-400 shadow-md shadow-green-100' : 'border-gray-200'
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <SignalIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Live Sensor Feed</span>
                    {latestReading && (
                        <span className="text-xs text-gray-400">
                            · {latestReading.nodeId}
                            · {new Date(latestReading.timestamp).toLocaleTimeString()}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={clsx(
                        'w-2 h-2 rounded-full',
                        isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                    )} />
                    <span className={clsx('text-xs', isConnected ? 'text-green-600' : 'text-red-500')}>
                        {isConnected ? 'Live' : 'Disconnected'}
                    </span>
                </div>
            </div>

            {/* Device status pills */}
            {Object.keys(deviceStatuses).length > 0 && (
                <div className="flex gap-2 flex-wrap px-4 pt-3">
                    {Object.entries(deviceStatuses).map(([id, status]) => (
                        <span
                            key={id}
                            className={clsx(
                                'text-xs px-2 py-0.5 rounded-full font-medium',
                                status === 'online'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                            )}
                        >
                            {id}: {status}
                        </span>
                    ))}
                </div>
            )}

            {/* Sensor cards */}
            {d ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
                    <SensorCard label="Soil Moisture" value={d.moisture ?? d.soilMoisture}
                        unit="%" history={moistureHistory} color="#0ea5e9" min={0} max={100} />
                    <SensorCard label="Temperature" value={d.temperature}
                        unit="°C" history={tempHistory} color="#f97316" min={0} max={50} />
                    <SensorCard label="Humidity" value={d.humidity}
                        unit="%" history={humHistory} color="#8b5cf6" min={0} max={100} />
                    <SensorCard label="Light" value={d.lux}
                        unit="lux" history={luxHistory} color="#eab308" min={0} max={100000} />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                    <ExclamationCircleIcon className="w-8 h-8" />
                    <p className="text-sm">Waiting for sensor data…</p>
                    <p className="text-xs">Make sure your ESP32 is powered and connected to MQTT</p>
                </div>
            )}
        </div>
    );
}
