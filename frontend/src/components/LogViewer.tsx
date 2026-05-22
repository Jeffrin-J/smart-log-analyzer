import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, ChevronDown, ChevronRight, X } from 'lucide-react'
import { LevelBadge, levelRowClass } from './LevelBadge'
import { type LogEntry, type LogLevel } from '../types'

const LEVELS: LogLevel[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN']
const PAGE_SIZE = 200

interface Props {
  entries: LogEntry[]
  highlightLines?: number[]
}

function EntryRow({ entry, highlight }: { entry: LogEntry; highlight: boolean }) {
  const [open, setOpen] = useState(false)
  const hasExtra = Object.keys(entry.extra).length > 0

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        className={`border-b border-[#21262d] cursor-pointer transition-colors
          ${levelRowClass(entry.level)}
          ${highlight ? 'ring-1 ring-inset ring-blue-500/60' : ''}`}
      >
        <td className="pl-4 pr-2 py-2 text-xs text-slate-500 tabular-nums font-mono whitespace-nowrap w-12">
          {entry.lineNumber}
        </td>
        <td className="px-2 py-2 whitespace-nowrap w-44">
          <span className="text-xs font-mono text-slate-400">
            {entry.timestamp ? entry.timestamp.replace('T', ' ').slice(0, 23) : '—'}
          </span>
        </td>
        <td className="px-2 py-2 whitespace-nowrap w-24">
          <LevelBadge level={entry.level} />
        </td>
        <td className="px-2 py-2 w-36 max-w-[9rem]">
          {entry.source && (
            <span className="text-xs text-slate-400 font-mono truncate block" title={entry.source}>
              {entry.source.length > 24 ? '…' + entry.source.slice(-22) : entry.source}
            </span>
          )}
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-2">
            {hasExtra && (
              open
                ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <span className="text-sm font-mono text-slate-200 break-all">{entry.message}</span>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-[#0d1117] border-b border-[#21262d]">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Raw line</p>
                <pre className="text-xs font-mono text-slate-300 break-all whitespace-pre-wrap bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
                  {entry.raw}
                </pre>
              </div>
              {hasExtra && (
                <div>
                  <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Fields</p>
                  <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d] space-y-1">
                    {Object.entries(entry.extra).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs font-mono">
                        <span className="text-blue-400 shrink-0">{k}:</span>
                        <span className="text-slate-300">{JSON.stringify(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function LogViewer({ entries, highlightLines = [] }: Props) {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(new Set())
  const [page, setPage] = useState(0)
  const highlightSet = useMemo(() => new Set(highlightLines), [highlightLines])
  const tableRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    let result = entries
    if (levelFilter.size > 0) {
      result = result.filter(e => levelFilter.has(e.level))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.message.toLowerCase().includes(q) ||
        (e.source?.toLowerCase().includes(q) ?? false) ||
        (e.timestamp?.includes(q) ?? false) ||
        e.raw.toLowerCase().includes(q)
      )
    }
    return result
  }, [entries, levelFilter, search])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [search, levelFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleLevel = (l: LogLevel) => {
    setLevelFilter(prev => {
      const next = new Set(prev)
      next.has(l) ? next.delete(l) : next.add(l)
      return next
    })
  }

  const levelCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of entries) c[e.level] = (c[e.level] ?? 0) + 1
    return c
  }, [entries])

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages, sources, timestamps…"
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-sm
              text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Level filters */}
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.filter(l => levelCounts[l]).map(l => (
            <button key={l} onClick={() => toggleLevel(l)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono font-medium transition-colors
                ${levelFilter.has(l)
                  ? l === 'FATAL' || l === 'ERROR' ? 'bg-red-900/60 border-red-700 text-red-300'
                    : l === 'WARN' ? 'bg-amber-900/60 border-amber-700 text-amber-300'
                    : 'bg-blue-900/60 border-blue-700 text-blue-300'
                  : 'bg-[#161b22] border-[#30363d] text-slate-400 hover:border-slate-500'}`}>
              {l} <span className="opacity-60">({levelCounts[l]})</span>
            </button>
          ))}
          {levelFilter.size > 0 && (
            <button onClick={() => setLevelFilter(new Set())}
              className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-300 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing {pageEntries.length.toLocaleString()} of {filtered.length.toLocaleString()} entries
          {filtered.length !== entries.length && ` (filtered from ${entries.length.toLocaleString()})`}
        </span>
        {totalPages > 1 && (
          <span>Page {page + 1} / {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <div ref={tableRef} className="card overflow-auto flex-1" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <table className="w-full text-sm border-collapse min-w-[700px]">
          <thead className="sticky top-0 z-10 bg-[#161b22] border-b border-[#30363d]">
            <tr>
              <th className="pl-4 pr-2 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">#</th>
              <th className="px-2 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-44">Timestamp</th>
              <th className="px-2 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Level</th>
              <th className="px-2 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-36">Source</th>
              <th className="px-2 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Message</th>
            </tr>
          </thead>
          <tbody>
            {pageEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-slate-500">
                  No entries match the current filters.
                </td>
              </tr>
            ) : (
              pageEntries.map(entry => (
                <EntryRow key={entry.id} entry={entry}
                  highlight={highlightSet.has(entry.lineNumber)} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 0}
            onClick={() => { setPage(0); tableRef.current?.scrollTo(0, 0) }}
            className="btn-ghost text-xs disabled:opacity-30">« First</button>
          <button disabled={page === 0}
            onClick={() => { setPage(p => p - 1); tableRef.current?.scrollTo(0, 0) }}
            className="btn-ghost text-xs disabled:opacity-30">‹ Prev</button>
          <span className="text-xs text-slate-400 px-2">
            {page + 1} / {totalPages}
          </span>
          <button disabled={page === totalPages - 1}
            onClick={() => { setPage(p => p + 1); tableRef.current?.scrollTo(0, 0) }}
            className="btn-ghost text-xs disabled:opacity-30">Next ›</button>
          <button disabled={page === totalPages - 1}
            onClick={() => { setPage(totalPages - 1); tableRef.current?.scrollTo(0, 0) }}
            className="btn-ghost text-xs disabled:opacity-30">Last »</button>
        </div>
      )}
    </div>
  )
}
