import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts'
import { format } from 'date-fns'

interface SensorChartProps {
    data: any[]
    dataKey: string
    color: string
    title: string
    unit: string
}

export default function SensorChart({ data, dataKey, color, title, unit }: SensorChartProps) {
    return (
        <div className="card h-80">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="recordedAt"
                            tickFormatter={(str) => format(new Date(str), 'HH:mm')}
                        />
                        <YAxis />
                        <Tooltip
                            labelFormatter={(label) => format(new Date(label), 'MMM d, HH:mm')}
                            formatter={(value: number) => [`${value}${unit}`, title]}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                            name={title}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
