import { AlertTriangle, AlertOctagon, Info, Bug, Clock, Database, TrendingUp, Shield } from 'lucide-react'
import { StatsCard } from './StatsCard'
import { LevelBadge } from './LevelBadge'
import { type AnalyzeResponse, type IssueSeverity } from '../types'

const SEV_STYLES: Record<IssueSeverity, string> = {
  critical: 'bg-red-950/60 text-red-400 border-red-800/60',
  high:     'bg-orange-950/60 text-orange-400 border-orange-800/60',
  medium:   'bg-amber-950/60 text-amber-400 border-amber-800/60',
  low:      'bg-slate-800/60 text-slate-400 border-slate-700/60',
}
const CAT_ICON: Record<string, React.ReactNode> = {
  security:     <Shield className="w-4 h-4" />,
  performance:  <TrendingUp className="w-4 h-4" />,
  availability: <AlertTriangle className="w-4 h-4" />,
  application:  <Bug className="w-4 h-4" />,
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return '—'
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`
  return `${(sec / 86400).toFixed(1)}d`
}

interface Props { data: AnalyzeResponse; onTabChange: (t: 'issues' | 'logs') => void }

export default function Dashboard({ data, onTabChange }: Props) {
  const { analysis, format } = data
  const { stats, issues, topErrors } = analysis
  const totalErrors = stats.errorCount + stats.fatalCount

  const levelDist = Object.entries(stats.levelCounts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      const order = ['FATAL','ERROR','WARN','INFO','DEBUG','TRACE','UNKNOWN']
      return order.indexOf(a[0]) - order.indexOf(b[0])
    })

  return (
    <div className="space-y-6">
      {/* File info banner */}
      <div className="card px-5 py-4 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">File analysed</p>
          <p className="font-semibold text-white truncate">{data.filename}</p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Format</p>
            <p className="text-slate-200 font-medium">{format.description}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Confidence</p>
            <p className="text-slate-200 font-medium">{Math.round(format.confidence * 100)}%</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Lines parsed</p>
            <p className="text-slate-200 font-medium">{stats.totalEntries.toLocaleString()}</p>
          </div>
          {stats.timeRange.start && (
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Time span</p>
              <p className="text-slate-200 font-medium">{fmtDuration(stats.timeRange.durationSeconds)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Entries" value={stats.totalEntries.toLocaleString()}
          icon={<Database className="w-5 h-5" />} accent="text-blue-400" />
        <StatsCard label="Errors" value={totalErrors.toLocaleString()}
          sub={totalErrors > 0 ? `${(stats.errorRate * 100).toFixed(1)}% of entries` : undefined}
          icon={<AlertOctagon className="w-5 h-5" />}
          accent={totalErrors > 0 ? 'text-red-400' : 'text-slate-500'} />
        <StatsCard label="Warnings" value={stats.warnCount.toLocaleString()}
          icon={<AlertTriangle className="w-5 h-5" />}
          accent={stats.warnCount > 0 ? 'text-amber-400' : 'text-slate-500'} />
        <StatsCard label="Issues Found" value={issues.length}
          sub={issues.length > 0 ? `${issues.filter(i => i.severity === 'critical').length} critical` : 'All clear'}
          icon={<Info className="w-5 h-5" />}
          accent={issues.length > 0 ? 'text-orange-400' : 'text-emerald-400'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issues summary */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Detected Issues</h3>
            {issues.length > 3 && (
              <button onClick={() => onTabChange('issues')}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View all →
              </button>
            )}
          </div>
          {issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-900/40 flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-medium">No issues detected</p>
              <p className="text-slate-500 text-sm mt-1">The log looks healthy!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {issues.slice(0, 5).map(issue => (
                <div key={issue.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${SEV_STYLES[issue.severity]}`}>
                  <span className="mt-0.5">{CAT_ICON[issue.category]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{issue.title}</p>
                    <p className="text-xs opacity-75 mt-0.5 leading-snug">{issue.description}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold uppercase px-2 py-0.5 rounded
                    ${SEV_STYLES[issue.severity]}`}>
                    {issue.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Level distribution + top errors */}
        <div className="space-y-4">
          {/* Level dist */}
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-4">Log Level Distribution</h3>
            <div className="space-y-2.5">
              {levelDist.map(([level, count]) => {
                const pct = stats.totalEntries > 0 ? (count / stats.totalEntries) * 100 : 0
                return (
                  <div key={level} className="flex items-center gap-3">
                    <div className="w-16 shrink-0">
                      <LevelBadge level={level as never} />
                    </div>
                    <div className="flex-1 bg-[#0d1117] rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: level === 'FATAL' || level === 'ERROR' ? '#ef4444'
                            : level === 'WARN' ? '#f59e0b'
                            : level === 'INFO' ? '#3b82f6'
                            : '#475569',
                        }} />
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums w-16 text-right">
                      {count.toLocaleString()} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top errors */}
          {topErrors.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Top Errors</h3>
                <button onClick={() => onTabChange('logs')}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  View logs →
                </button>
              </div>
              <div className="space-y-2">
                {topErrors.slice(0, 5).map((e, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="shrink-0 text-xs tabular-nums text-slate-500 mt-0.5 w-8">
                      ×{e.count}
                    </span>
                    <p className="text-xs font-mono text-slate-300 leading-relaxed break-all">{e.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Time range info */}
      {stats.timeRange.start && (
        <div className="card px-5 py-3 flex items-center gap-3">
          <Clock className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="text-sm text-slate-400 min-w-0">
            <span className="text-slate-300 font-mono">{stats.timeRange.start?.replace('T', ' ')}</span>
            <span className="mx-2 text-slate-600">→</span>
            <span className="text-slate-300 font-mono">{stats.timeRange.end?.replace('T', ' ')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
