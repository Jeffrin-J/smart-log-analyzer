import { useState, useCallback } from 'react'
import {
  LayoutDashboard, ScrollText, AlertTriangle, Activity,
  Upload, FileText, X, ChevronDown,
} from 'lucide-react'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import LogViewer from './components/LogViewer'
import IssuesPanel from './components/IssuesPanel'
import TimelineChart from './components/TimelineChart'
import { type AnalyzeResponse, type ActiveTab } from './types'

const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview',  icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'logs',     label: 'Logs',      icon: <ScrollText className="w-4 h-4" /> },
  { id: 'issues',   label: 'Issues',    icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'timeline', label: 'Timeline',  icon: <Activity className="w-4 h-4" /> },
]

function SeverityDot({ n, cls }: { n: number; cls: string }) {
  if (!n) return null
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls}`}>{n}</span>
}

export default function App() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [highlightLines, setHighlightLines] = useState<number[]>([])
  const [fileMenuOpen, setFileMenuOpen] = useState(false)

  const handleResult = useCallback((r: AnalyzeResponse) => {
    setResult(r)
    setActiveTab('overview')
    setHighlightLines([])
  }, [])

  const handleViewLines = useCallback((lines: number[]) => {
    setHighlightLines(lines)
    setActiveTab('logs')
  }, [])

  const handleTabChange = useCallback((t: 'issues' | 'logs') => {
    setActiveTab(t)
  }, [])

  if (!result) {
    return <FileUpload onResult={handleResult} />
  }

  const { analysis } = result
  const criticalCount = analysis.issues.filter(i => i.severity === 'critical').length
  const highCount = analysis.issues.filter(i => i.severity === 'high').length

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-[#0d1117] border-b border-[#30363d] px-4 lg:px-6">
        <div className="flex items-center gap-4 h-14">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30
              flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <span className="font-semibold text-white text-sm hidden sm:block">Smart Log Analyzer</span>
          </div>

          {/* File selector */}
          <div className="relative">
            <button
              onClick={() => setFileMenuOpen(o => !o)}
              className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] hover:border-slate-500
                rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors max-w-xs">
              <span className="truncate max-w-[180px]">{result.filename}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            </button>
            {fileMenuOpen && (
              <div className="absolute top-full mt-1 left-0 bg-[#161b22] border border-[#30363d]
                rounded-xl shadow-2xl p-1 z-50 min-w-[200px]">
                <button
                  onClick={() => { setResult(null); setFileMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300
                    hover:bg-[#1c2128] rounded-lg transition-colors">
                  <Upload className="w-4 h-4 text-blue-400" /> Analyse new file
                </button>
                <div className="border-t border-[#30363d] my-1" />
                <div className="px-3 py-1.5 text-xs text-slate-500">
                  {result.parsedEntries.toLocaleString()} entries · {result.format.description}
                </div>
              </div>
            )}
          </div>

          {/* Issue badges */}
          <div className="flex items-center gap-1.5 ml-1">
            <SeverityDot n={criticalCount} cls="bg-red-500 text-white" />
            <SeverityDot n={highCount} cls="bg-orange-500 text-white" />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* New analysis button */}
          <button
            onClick={() => setResult(null)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white
              hover:bg-[#1c2128] px-3 py-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 -mb-px">
          {TABS.map(tab => {
            const badge = tab.id === 'issues' ? analysis.issues.length : null
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2
                  ${activeTab === tab.id
                    ? 'text-white border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 border-transparent'}`}
              >
                {tab.icon}
                {tab.label}
                {badge !== null && badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                    ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-[#30363d] text-slate-400'}`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 lg:px-6 py-6 max-w-screen-2xl w-full mx-auto">
        {activeTab === 'overview' && (
          <Dashboard data={result} onTabChange={handleTabChange} />
        )}
        {activeTab === 'logs' && (
          <LogViewer entries={result.entries} highlightLines={highlightLines} />
        )}
        {activeTab === 'issues' && (
          <IssuesPanel issues={analysis.issues} onViewLines={handleViewLines} />
        )}
        {activeTab === 'timeline' && (
          <TimelineChart timeline={analysis.timeline} />
        )}
      </main>

      {/* Click-outside to close file menu */}
      {fileMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setFileMenuOpen(false)} />
      )}
    </div>
  )
}
