import { useState, useCallback, useRef } from 'react'
import { Upload, FileText, Zap, ChevronRight, Clipboard } from 'lucide-react'
import { type AnalyzeResponse } from '../types'

interface Props {
  onResult: (r: AnalyzeResponse) => void
}

const SUPPORTED = [
  { fmt: 'Apache / Nginx', example: '192.168.1.1 - - [22/May/2024:10:00:00 +0000] "GET / HTTP/1.1" 200 1234' },
  { fmt: 'JSON Logs', example: '{"timestamp":"2024-05-22T10:00:00Z","level":"error","message":"DB timeout"}' },
  { fmt: 'Syslog', example: 'May 22 10:00:00 hostname sshd[1234]: Failed password for root from 1.2.3.4' },
  { fmt: 'Log4j / Python', example: '2024-05-22 10:00:00,123 ERROR com.example.App - Connection refused' },
  { fmt: '.NET / Serilog', example: 'ERROR 2024-05-22 10:00:00.123 Object reference not set to an instance' },
  { fmt: 'Generic', example: '2024-05-22 10:00:00 [ERROR] Something went wrong: timeout after 5000ms' },
]

export default function FileUpload({ onResult }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = useCallback(async (body: FormData | { text: string; filename: string }) => {
    setLoading(true)
    setError(null)
    try {
      let res: Response
      if (body instanceof FormData) {
        res = await fetch('/api/analyze', { method: 'POST', body })
      } else {
        res = await fetch('/api/analyze-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `HTTP ${res.status}`)
      }
      const data: AnalyzeResponse = await res.json()
      onResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [onResult])

  const handleFile = useCallback((file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    submit(fd)
  }, [submit])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const loadDemo = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/demo')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onResult(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-5">
          <FileText className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Smart Log Analyzer</h1>
        <p className="text-slate-400 text-lg max-w-xl">
          Upload any log file and get instant AI-powered analysis — format detection, issue identification,
          and actionable recommendations.
        </p>
      </div>

      {/* Upload card */}
      <div className="w-full max-w-2xl">
        {!pasteMode ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`card p-12 flex flex-col items-center cursor-pointer transition-all duration-200 select-none
              ${dragging ? 'border-blue-500 bg-blue-950/20' : 'hover:border-slate-500 hover:bg-[#1c2128]'}`}
          >
            <input ref={fileRef} type="file" className="hidden"
              accept=".log,.txt,.json,.csv,text/*"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400">Analysing…</p>
              </div>
            ) : (
              <>
                <Upload className={`w-12 h-12 mb-4 ${dragging ? 'text-blue-400' : 'text-slate-500'}`} />
                <p className="text-lg font-semibold text-white mb-1">
                  {dragging ? 'Drop it here' : 'Drop a log file or click to browse'}
                </p>
                <p className="text-sm text-slate-500">Supports .log, .txt, .json — up to 50 MB</p>
              </>
            )}
          </div>
        ) : (
          <div className="card p-5 flex flex-col gap-3">
            <textarea
              autoFocus
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste log content here…"
              className="w-full h-52 bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm font-mono text-slate-200
                placeholder:text-slate-600 resize-none focus:outline-none focus:border-blue-500 transition-colors"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPasteMode(false)} className="btn-ghost text-sm">Cancel</button>
              <button
                disabled={!pasteText.trim() || loading}
                onClick={() => submit({ text: pasteText, filename: 'pasted.log' })}
                className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Analysing…' : 'Analyse'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {!pasteMode && (
            <button onClick={() => setPasteMode(true)}
              className="btn-ghost text-sm flex items-center gap-1.5">
              <Clipboard className="w-4 h-4" /> Paste text
            </button>
          )}
          <button onClick={loadDemo}
            className="btn-ghost text-sm flex items-center gap-1.5 text-blue-400 hover:text-blue-300">
            <Zap className="w-4 h-4" /> Try with demo logs
          </button>
        </div>
      </div>

      {/* Supported formats */}
      <div className="w-full max-w-2xl mt-10">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-4 text-center">Supported Formats</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUPPORTED.map(s => (
            <div key={s.fmt} className="card px-4 py-3 flex items-start gap-3 group">
              <ChevronRight className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200">{s.fmt}</p>
                <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{s.example}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
