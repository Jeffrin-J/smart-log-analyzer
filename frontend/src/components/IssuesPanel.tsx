import { useState } from 'react'
import { Shield, TrendingUp, AlertTriangle, Bug, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { type Issue, type IssueSeverity, type IssueCategory } from '../types'

const SEV_CONFIG: Record<IssueSeverity, { label: string; badge: string; border: string; bg: string }> = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-500 text-white',
    border: 'border-red-800/60',
    bg: 'bg-red-950/20',
  },
  high: {
    label: 'High',
    badge: 'bg-orange-500 text-white',
    border: 'border-orange-800/60',
    bg: 'bg-orange-950/20',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-amber-500 text-black',
    border: 'border-amber-800/60',
    bg: 'bg-amber-950/15',
  },
  low: {
    label: 'Low',
    badge: 'bg-slate-600 text-white',
    border: 'border-slate-700',
    bg: 'bg-slate-800/30',
  },
}

const CAT_CONFIG: Record<IssueCategory, { label: string; icon: React.ReactNode; color: string }> = {
  security:     { label: 'Security',     icon: <Shield className="w-4 h-4" />,       color: 'text-purple-400' },
  performance:  { label: 'Performance',  icon: <TrendingUp className="w-4 h-4" />,   color: 'text-blue-400'   },
  availability: { label: 'Availability', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-orange-400' },
  application:  { label: 'Application',  icon: <Bug className="w-4 h-4" />,           color: 'text-red-400'    },
}

function IssueCard({ issue, onViewLines }: { issue: Issue; onViewLines: (lines: number[]) => void }) {
  const [open, setOpen] = useState(false)
  const sev = SEV_CONFIG[issue.severity]
  const cat = CAT_CONFIG[issue.category]

  return (
    <div className={`card border ${sev.border} ${sev.bg} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className={`mt-0.5 ${cat.color}`}>{cat.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm leading-snug flex-1">{issue.title}</span>
            <span className={`shrink-0 text-xs font-bold uppercase px-2 py-0.5 rounded ${sev.badge}`}>
              {sev.label}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">{issue.description}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            <span className={`text-xs flex items-center gap-1 ${cat.color}`}>
              {cat.icon} {cat.label}
            </span>
            <span className="text-xs text-slate-500">
              {issue.count} occurrence{issue.count !== 1 ? 's' : ''}
            </span>
            {issue.affectedLines.length > 0 && (
              <span className="text-xs text-slate-500">
                Lines: {issue.affectedLines.slice(0, 5).join(', ')}{issue.affectedLines.length > 5 ? '…' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-slate-500 mt-0.5">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-[#30363d] px-4 py-4 space-y-4">
          {/* Timestamps */}
          {(issue.firstOccurrence || issue.lastOccurrence) && (
            <div className="grid grid-cols-2 gap-4">
              {issue.firstOccurrence && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">First Occurrence</p>
                  <p className="text-xs font-mono text-slate-300">{issue.firstOccurrence.replace('T', ' ')}</p>
                </div>
              )}
              {issue.lastOccurrence && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Last Occurrence</p>
                  <p className="text-xs font-mono text-slate-300">{issue.lastOccurrence.replace('T', ' ')}</p>
                </div>
              )}
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-[#0d1117] rounded-lg p-3 border border-[#30363d]">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Recommendation</p>
            <p className="text-sm text-slate-200 leading-relaxed">{issue.recommendation}</p>
          </div>

          {/* Affected lines */}
          {issue.affectedLines.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Affected Lines ({issue.affectedLines.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {issue.affectedLines.slice(0, 30).map(ln => (
                  <span key={ln}
                    className="text-xs font-mono text-blue-400 bg-blue-950/30 border border-blue-900/50
                      px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-900/40 transition-colors"
                    title={`Line ${ln}`}>
                    {ln}
                  </span>
                ))}
                {issue.affectedLines.length > 30 && (
                  <span className="text-xs text-slate-500 py-0.5">+{issue.affectedLines.length - 30} more</span>
                )}
              </div>
              {issue.affectedLines.length > 0 && (
                <button
                  onClick={() => onViewLines(issue.affectedLines)}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                  <ExternalLink className="w-3 h-3" /> View in Log Viewer
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  issues: Issue[]
  onViewLines: (lines: number[]) => void
}

const CATEGORIES: IssueCategory[] = ['security', 'performance', 'availability', 'application']

export default function IssuesPanel({ issues, onViewLines }: Props) {
  const [catFilter, setCatFilter] = useState<IssueCategory | 'all'>('all')
  const [sevFilter, setSevFilter] = useState<IssueSeverity | 'all'>('all')

  const filtered = issues.filter(i =>
    (catFilter === 'all' || i.category === catFilter) &&
    (sevFilter === 'all' || i.severity === sevFilter)
  )

  const counts = {
    critical: issues.filter(i => i.severity === 'critical').length,
    high:     issues.filter(i => i.severity === 'high').length,
    medium:   issues.filter(i => i.severity === 'medium').length,
    low:      issues.filter(i => i.severity === 'low').length,
  }

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-900/30 border border-emerald-800/40
          flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Issues Detected</h3>
        <p className="text-slate-400 max-w-sm">
          The log analyzer found no significant issues. The system appears to be operating normally.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="card p-4 flex flex-wrap gap-3">
        {(['critical', 'high', 'medium', 'low'] as IssueSeverity[]).map(s => (
          counts[s] > 0 && (
            <button key={s}
              onClick={() => setSevFilter(sev => sev === s ? 'all' : s)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium
                transition-colors ${sevFilter === s ? SEV_CONFIG[s].badge + ' border-transparent'
                  : `${SEV_CONFIG[s].bg} ${SEV_CONFIG[s].border} ${SEV_CONFIG[s].badge.split(' ')[1]}`}`}>
              {SEV_CONFIG[s].label}: {counts[s]}
            </button>
          )
        ))}

        <div className="ml-auto flex gap-1.5">
          {CATEGORIES.filter(c => issues.some(i => i.category === c)).map(c => {
            const cfg = CAT_CONFIG[c]
            return (
              <button key={c}
                onClick={() => setCatFilter(cat => cat === c ? 'all' : c)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs
                  transition-colors ${catFilter === c
                    ? `${cfg.color} bg-[#1c2128] border-[#484f58]`
                    : 'text-slate-400 bg-[#161b22] border-[#30363d] hover:border-slate-500'}`}>
                {cfg.icon} {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Issue list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No issues match the selected filters.</div>
        ) : (
          filtered.map(issue => (
            <IssueCard key={issue.id} issue={issue} onViewLines={onViewLines} />
          ))
        )}
      </div>
    </div>
  )
}
