import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Brush,
} from 'recharts'
import { type TimelinePoint } from '../types'

interface Props {
  timeline: TimelinePoint[]
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-3 shadow-xl text-xs">
      <p className="text-slate-300 font-medium mb-2">{label}</p>
      {payload.map(p => (
        p.value > 0 && (
          <div key={p.name} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-400 capitalize">{p.name}:</span>
            <span className="font-mono font-semibold" style={{ color: p.color }}>{p.value}</span>
          </div>
        )
      ))}
    </div>
  )
}

export default function TimelineChart({ timeline }: Props) {
  if (timeline.length === 0) {
    return (
      <div className="card flex items-center justify-center py-20 text-slate-500">
        No timestamped entries — timeline unavailable.
      </div>
    )
  }

  const hasErrors = timeline.some(p => p.errors > 0)
  const hasWarnings = timeline.some(p => p.warnings > 0)
  const hasInfo = timeline.some(p => p.info > 0)

  return (
    <div className="space-y-6">
      {/* Error / Warning bars */}
      <div className="card p-5">
        <h3 className="font-semibold text-white mb-1">Error & Warning Timeline</h3>
        <p className="text-xs text-slate-500 mb-6">Event counts per time bucket — use the brush to zoom in</p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={timeline} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#8b949e', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#30363d' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#8b949e', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#8b949e', paddingTop: 12 }}
            />
            {hasErrors && (
              <Bar dataKey="errors" name="Errors" fill="#ef4444" fillOpacity={0.85}
                radius={[2, 2, 0, 0]} maxBarSize={40} />
            )}
            {hasWarnings && (
              <Bar dataKey="warnings" name="Warnings" fill="#f59e0b" fillOpacity={0.75}
                radius={[2, 2, 0, 0]} maxBarSize={40} />
            )}
            {timeline.length > 4 && (
              <Brush
                dataKey="time"
                height={22}
                stroke="#30363d"
                fill="#161b22"
                travellerWidth={6}
                style={{ fontSize: 10 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Full activity line chart */}
      {hasInfo && (
        <div className="card p-5">
          <h3 className="font-semibold text-white mb-1">Full Activity</h3>
          <p className="text-xs text-slate-500 mb-6">All log levels over time</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={timeline} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#8b949e', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#30363d' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#8b949e', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#8b949e', paddingTop: 8 }} />
              {hasInfo && (
                <Line type="monotone" dataKey="info" name="Info"
                  stroke="#3b82f6" strokeWidth={2} dot={false} />
              )}
              {hasWarnings && (
                <Line type="monotone" dataKey="warnings" name="Warnings"
                  stroke="#f59e0b" strokeWidth={2} dot={false} />
              )}
              {hasErrors && (
                <Line type="monotone" dataKey="errors" name="Errors"
                  stroke="#ef4444" strokeWidth={2.5} dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Peak Errors', value: Math.max(...timeline.map(t => t.errors)), color: 'text-red-400' },
          { label: 'Peak Warnings', value: Math.max(...timeline.map(t => t.warnings)), color: 'text-amber-400' },
          { label: 'Time Buckets', value: timeline.length, color: 'text-slate-300' },
          { label: 'Quietest Period',
            value: timeline.reduce((best, cur) =>
              (cur.errors + cur.warnings) < (best.errors + best.warnings) ? cur : best
            ).time,
            color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
