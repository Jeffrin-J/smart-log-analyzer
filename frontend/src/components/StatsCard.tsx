import { type ReactNode } from 'react'

interface Props {
  label: string
  value: string | number
  sub?: string
  icon: ReactNode
  accent?: string
}

export function StatsCard({ label, value, sub, icon, accent = 'text-blue-400' }: Props) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`mt-0.5 ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}
