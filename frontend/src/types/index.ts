export type LogLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'UNKNOWN'
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'
export type IssueCategory = 'security' | 'performance' | 'availability' | 'application'
export type ActiveTab = 'overview' | 'logs' | 'issues' | 'timeline'

export interface LogEntry {
  id: number
  timestamp: string | null
  level: LogLevel
  source: string | null
  message: string
  raw: string
  lineNumber: number
  extra: Record<string, unknown>
}

export interface Issue {
  id: string
  title: string
  description: string
  severity: IssueSeverity
  category: IssueCategory
  count: number
  affectedLines: number[]
  firstOccurrence: string | null
  lastOccurrence: string | null
  recommendation: string
}

export interface TimelinePoint {
  time: string
  errors: number
  warnings: number
  info: number
  debug: number
  others: number
}

export interface FormatInfo {
  name: string
  confidence: number
  description: string
}

export interface Stats {
  totalEntries: number
  errorCount: number
  fatalCount: number
  warnCount: number
  infoCount: number
  debugCount: number
  otherCount: number
  uniqueSources: number
  errorRate: number
  timeRange: { start: string | null; end: string | null; durationSeconds: number | null }
  levelCounts: Record<string, number>
}

export interface Analysis {
  stats: Stats
  issues: Issue[]
  timeline: TimelinePoint[]
  topErrors: { message: string; count: number }[]
}

export interface AnalyzeResponse {
  filename: string
  format: FormatInfo
  totalLines: number
  parsedEntries: number
  analysis: Analysis
  entries: LogEntry[]
}
