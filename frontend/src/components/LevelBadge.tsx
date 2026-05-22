import { type LogLevel } from '../types'

const CONFIG: Record<LogLevel, { bg: string; text: string; dot: string; label: string }> = {
  FATAL:   { bg: 'bg-red-950/80',    text: 'text-red-400',    dot: 'bg-red-500',    label: 'FATAL'   },
  ERROR:   { bg: 'bg-red-950/50',    text: 'text-red-400',    dot: 'bg-red-500',    label: 'ERROR'   },
  WARN:    { bg: 'bg-amber-950/50',  text: 'text-amber-400',  dot: 'bg-amber-500',  label: 'WARN'    },
  INFO:    { bg: 'bg-blue-950/40',   text: 'text-blue-400',   dot: 'bg-blue-500',   label: 'INFO'    },
  DEBUG:   { bg: 'bg-slate-800/60',  text: 'text-slate-400',  dot: 'bg-slate-500',  label: 'DEBUG'   },
  TRACE:   { bg: 'bg-slate-800/40',  text: 'text-slate-500',  dot: 'bg-slate-600',  label: 'TRACE'   },
  UNKNOWN: { bg: 'bg-slate-800/40',  text: 'text-slate-500',  dot: 'bg-slate-600',  label: '?'       },
}

export function LevelBadge({ level }: { level: LogLevel }) {
  const c = CONFIG[level] ?? CONFIG.UNKNOWN
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

export function levelTextClass(level: LogLevel): string {
  return CONFIG[level]?.text ?? 'text-slate-400'
}

export function levelRowClass(level: LogLevel): string {
  const map: Record<LogLevel, string> = {
    FATAL:   'bg-red-950/20 hover:bg-red-950/30',
    ERROR:   'bg-red-950/10 hover:bg-red-950/20',
    WARN:    'bg-amber-950/10 hover:bg-amber-950/20',
    INFO:    'hover:bg-[#1c2128]',
    DEBUG:   'hover:bg-[#1c2128]',
    TRACE:   'hover:bg-[#1c2128]',
    UNKNOWN: 'hover:bg-[#1c2128]',
  }
  return map[level] ?? 'hover:bg-[#1c2128]'
}
