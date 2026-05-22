import re
import json
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field

LEVEL_MAP = {
    "emerg": "FATAL", "emergency": "FATAL", "fatal": "FATAL",
    "crit": "FATAL", "critical": "FATAL", "panic": "FATAL",
    "err": "ERROR", "error": "ERROR",
    "warn": "WARN", "warning": "WARN",
    "notice": "INFO", "info": "INFO", "information": "INFO", "informational": "INFO",
    "debug": "DEBUG", "trace": "TRACE", "verbose": "DEBUG", "fine": "DEBUG",
}

LEVEL_ORDER = {"FATAL": 0, "ERROR": 1, "WARN": 2, "INFO": 3, "DEBUG": 4, "TRACE": 5, "UNKNOWN": 6}


def normalize_level(raw: str) -> str:
    return LEVEL_MAP.get(raw.lower().strip(), "UNKNOWN")


def http_status_to_level(status: int) -> str:
    if status >= 500:
        return "ERROR"
    if status >= 400:
        return "WARN"
    return "INFO"


@dataclass
class LogEntry:
    id: int
    timestamp: Optional[str]
    level: str
    source: Optional[str]
    message: str
    raw: str
    line_number: int
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "level": self.level,
            "source": self.source,
            "message": self.message,
            "raw": self.raw,
            "lineNumber": self.line_number,
            "extra": self.extra,
        }


# ── Regex patterns ────────────────────────────────────────────────────────────

_APACHE_COMMON = re.compile(
    r'^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*?)"\s+(\d{3})\s+(\S+)'
)
_APACHE_COMBINED = re.compile(
    r'^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*?)"\s+(\d{3})\s+(\S+)\s+"([^"]*)"\s+"([^"]*)"'
)
_NGINX_ACCESS = re.compile(
    r'^(\S+)\s+-\s+\S+\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d{3})\s+(\d+)'
    r'(?:\s+"([^"]*)"\s+"([^"]*)")?(?:\s+(\d+\.\d+))?'
)
_SYSLOG_RFC3164 = re.compile(
    r'^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s+(.*)'
)
_SYSLOG_RFC5424 = re.compile(
    r'^<\d+>\d+\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+\S+\s+(.*)'
)
_ISO_LOG = re.compile(
    r'^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)'
    r'(?:\s+\[([^\]]*)\])?\s+'
    r'(FATAL|CRITICAL|ERROR|WARN(?:ING)?|INFO(?:RMATION)?|DEBUG|TRACE|NOTICE|VERBOSE)\s*'
    r'(?:\[([^\]]*)\]|\(([^)]*)\))?'
    r'(?:\s+(\S+)\s+[-–:])?\s*(.*)',
    re.IGNORECASE,
)
_ISO_LOG_ALT = re.compile(
    r'^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)'
    r'\s+(FATAL|CRITICAL|ERROR|WARN(?:ING)?|INFO(?:RMATION)?|DEBUG|TRACE|NOTICE)\s+'
    r'(\S+)\s+(.*)',
    re.IGNORECASE,
)
_DOTNET_LOG = re.compile(
    r'^(FATAL|CRITICAL|ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|VERBOSE)\s*'
    r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(.*)',
    re.IGNORECASE,
)
_GENERIC_TS = re.compile(
    r'(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)'
)
_GENERIC_LEVEL = re.compile(
    r'\b(FATAL|CRITICAL|ERROR|WARN(?:ING)?|INFO(?:RMATION)?|DEBUG|TRACE|NOTICE|VERBOSE)\b',
    re.IGNORECASE,
)
_GENERIC_SOURCE = re.compile(r'\b([A-Za-z][\w./]+(?:Service|Controller|Manager|Handler|Router|Processor|Client|Server|Repository|Dao|Util|Helper|Worker|Task|Job|Component))\b')


def _parse_apache_ts(ts: str) -> str:
    try:
        return datetime.strptime(ts, "%d/%b/%Y:%H:%M:%S %z").isoformat()
    except Exception:
        return ts


def _try_parse_iso(ts: str) -> str:
    ts = ts.replace(",", ".")
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(ts.split("+")[0].split("Z")[0].rstrip(), fmt).isoformat()
        except Exception:
            continue
    return ts


# ── Format detection ──────────────────────────────────────────────────────────

def _sample_lines(text: str, n: int = 30) -> List[str]:
    return [l.rstrip() for l in text.splitlines() if l.strip()][:n]


def _match_rate(lines: List[str], pattern) -> float:
    if not lines:
        return 0.0
    return sum(1 for l in lines if pattern.match(l)) / len(lines)


def detect_format(text: str) -> Dict:
    lines = _sample_lines(text, 30)
    if not lines:
        return {"name": "unknown", "confidence": 0, "description": "Empty file"}

    # JSON log lines
    json_hits = 0
    for l in lines:
        try:
            obj = json.loads(l)
            if isinstance(obj, dict):
                json_hits += 1
        except Exception:
            pass
    if json_hits / len(lines) > 0.5:
        return {"name": "json", "confidence": round(json_hits / len(lines), 2),
                "description": "JSON structured logs (one JSON object per line)"}

    scores = {
        "apache_combined": _match_rate(lines, _APACHE_COMBINED),
        "apache_common":   _match_rate(lines, _APACHE_COMMON),
        "nginx":           _match_rate(lines, _NGINX_ACCESS),
        "syslog_rfc3164":  _match_rate(lines, _SYSLOG_RFC3164),
        "syslog_rfc5424":  _match_rate(lines, _SYSLOG_RFC5424),
        "iso_log":         _match_rate(lines, _ISO_LOG),
        "iso_log_alt":     _match_rate(lines, _ISO_LOG_ALT),
        "dotnet":          _match_rate(lines, _DOTNET_LOG),
    }

    best_fmt, best_score = max(scores.items(), key=lambda kv: kv[1])

    descriptions = {
        "apache_combined": "Apache Combined Log Format (access log)",
        "apache_common":   "Apache Common Log Format (access log)",
        "nginx":           "Nginx Access Log",
        "syslog_rfc3164":  "Syslog RFC 3164",
        "syslog_rfc5424":  "Syslog RFC 5424",
        "iso_log":         "Application Log (ISO timestamp + level)",
        "iso_log_alt":     "Application Log (ISO timestamp + level + logger)",
        "dotnet":          ".NET / Serilog structured log",
    }

    if best_score >= 0.3:
        return {"name": best_fmt, "confidence": round(best_score, 2),
                "description": descriptions.get(best_fmt, best_fmt)}

    # Fall back to generic
    ts_hits = sum(1 for l in lines if _GENERIC_TS.search(l))
    lv_hits = sum(1 for l in lines if _GENERIC_LEVEL.search(l))
    conf = max(ts_hits, lv_hits) / len(lines)
    return {"name": "generic", "confidence": round(conf, 2),
            "description": "Generic log file (auto-detected patterns)"}


# ── Per-format parsers ────────────────────────────────────────────────────────

def _parse_apache_line(line: str, idx: int, line_no: int) -> Optional[LogEntry]:
    m = _APACHE_COMBINED.match(line) or _APACHE_COMMON.match(line)
    if not m:
        return None
    groups = m.groups()
    ip, ts_raw, request, status_str = groups[0], groups[1], groups[2], groups[3]
    status = int(status_str)
    method, path, proto = (request.split() + ["", "", ""])[:3]
    return LogEntry(
        id=idx, timestamp=_parse_apache_ts(ts_raw),
        level=http_status_to_level(status),
        source=ip, message=f"{method} {path} → {status}",
        raw=line, line_number=line_no,
        extra={"status_code": status, "method": method, "path": path,
               "protocol": proto, "ip": ip},
    )


def _parse_nginx_line(line: str, idx: int, line_no: int) -> Optional[LogEntry]:
    m = _NGINX_ACCESS.match(line)
    if not m:
        return None
    ip, ts_raw, request, status_str, bytes_sent = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
    status = int(status_str)
    method, path, proto = (request.split() + ["", "", ""])[:3]
    rt = m.group(8)
    extra: Dict[str, Any] = {"status_code": status, "method": method, "path": path, "ip": ip}
    if rt:
        extra["response_time_ms"] = float(rt) * 1000
    return LogEntry(
        id=idx, timestamp=_parse_apache_ts(ts_raw),
        level=http_status_to_level(status),
        source=ip, message=f"{method} {path} → {status}",
        raw=line, line_number=line_no, extra=extra,
    )


def _parse_syslog_line(line: str, idx: int, line_no: int) -> Optional[LogEntry]:
    m = _SYSLOG_RFC5424.match(line)
    if m:
        ts, host, app, pid, msg = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        lv_m = _GENERIC_LEVEL.search(msg)
        level = normalize_level(lv_m.group(1)) if lv_m else "INFO"
        return LogEntry(id=idx, timestamp=ts, level=level,
                        source=f"{app}[{pid}]" if pid != "-" else app,
                        message=msg.strip(), raw=line, line_number=line_no,
                        extra={"host": host})
    m = _SYSLOG_RFC3164.match(line)
    if m:
        ts_raw, host, app, pid, msg = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        try:
            ts = datetime.strptime(ts_raw, "%b %d %H:%M:%S").replace(year=datetime.now().year).isoformat()
        except Exception:
            ts = ts_raw
        lv_m = _GENERIC_LEVEL.search(msg)
        level = normalize_level(lv_m.group(1)) if lv_m else "INFO"
        return LogEntry(id=idx, timestamp=ts, level=level,
                        source=f"{app}[{pid}]" if pid else app,
                        message=msg.strip(), raw=line, line_number=line_no,
                        extra={"host": host})
    return None


def _parse_iso_line(line: str, idx: int, line_no: int) -> Optional[LogEntry]:
    m = _ISO_LOG.match(line)
    if m:
        ts_raw, thread, level_raw, logger1, logger2, logger3, msg = m.groups()
        source = logger1 or logger2 or logger3
        return LogEntry(id=idx, timestamp=_try_parse_iso(ts_raw),
                        level=normalize_level(level_raw),
                        source=source, message=msg.strip() if msg else "",
                        raw=line, line_number=line_no,
                        extra={"thread": thread} if thread else {})
    m = _ISO_LOG_ALT.match(line)
    if m:
        ts_raw, level_raw, source, msg = m.groups()
        return LogEntry(id=idx, timestamp=_try_parse_iso(ts_raw),
                        level=normalize_level(level_raw),
                        source=source, message=msg.strip(),
                        raw=line, line_number=line_no, extra={})
    return None


def _parse_dotnet_line(line: str, idx: int, line_no: int) -> Optional[LogEntry]:
    m = _DOTNET_LOG.match(line)
    if not m:
        return None
    level_raw, ts_raw, msg = m.groups()
    return LogEntry(id=idx, timestamp=_try_parse_iso(ts_raw),
                    level=normalize_level(level_raw),
                    source=None, message=msg.strip(),
                    raw=line, line_number=line_no, extra={})


def _parse_json_line(line: str, idx: int, line_no: int) -> Optional[LogEntry]:
    try:
        obj = json.loads(line)
    except Exception:
        return None
    if not isinstance(obj, dict):
        return None

    # Detect timestamp field
    ts = None
    for k in ("timestamp", "time", "ts", "@timestamp", "datetime", "date", "created_at"):
        if k in obj:
            ts = str(obj[k])
            break

    # Detect level field
    level_raw = None
    for k in ("level", "severity", "loglevel", "log_level", "lvl", "type"):
        if k in obj:
            level_raw = str(obj[k])
            break
    level = normalize_level(level_raw) if level_raw else "INFO"

    # Detect message field
    msg = None
    for k in ("message", "msg", "text", "body", "content", "error", "err"):
        if k in obj:
            msg = str(obj[k])
            break
    if msg is None:
        msg = line[:200]

    # Detect source/logger
    source = None
    for k in ("logger", "source", "service", "app", "component", "module", "class", "name"):
        if k in obj:
            source = str(obj[k])
            break

    extra = {k: v for k, v in obj.items()
             if k not in ("timestamp", "time", "ts", "@timestamp", "datetime", "date",
                          "level", "severity", "loglevel", "log_level", "lvl",
                          "message", "msg", "text", "logger", "source", "service")}
    if "status_code" not in extra:
        for k in ("status", "status_code", "http_status", "code"):
            if k in obj and str(obj[k]).isdigit():
                extra["status_code"] = int(obj[k])
                break

    return LogEntry(id=idx, timestamp=ts, level=level, source=source,
                    message=msg, raw=line, line_number=line_no, extra=extra)


def _parse_generic_line(line: str, idx: int, line_no: int) -> LogEntry:
    ts_m = _GENERIC_TS.search(line)
    ts = _try_parse_iso(ts_m.group(1)) if ts_m else None

    lv_m = _GENERIC_LEVEL.search(line)
    level = normalize_level(lv_m.group(1)) if lv_m else "UNKNOWN"

    src_m = _GENERIC_SOURCE.search(line)
    source = src_m.group(1) if src_m else None

    # Use everything after the level token as message, or full line
    if lv_m:
        msg = line[lv_m.end():].lstrip(" -:›|").strip() or line.strip()
    else:
        msg = line.strip()

    return LogEntry(id=idx, timestamp=ts, level=level, source=source,
                    message=msg, raw=line, line_number=line_no, extra={})


# ── Main entry points ─────────────────────────────────────────────────────────

_PARSER_MAP = {
    "apache_combined": _parse_apache_line,
    "apache_common":   _parse_apache_line,
    "nginx":           _parse_nginx_line,
    "syslog_rfc3164":  _parse_syslog_line,
    "syslog_rfc5424":  _parse_syslog_line,
    "iso_log":         _parse_iso_line,
    "iso_log_alt":     _parse_iso_line,
    "dotnet":          _parse_dotnet_line,
    "json":            _parse_json_line,
}

_MAX_ENTRIES = 50_000


def parse_logs(text: str, fmt_name: str) -> List[LogEntry]:
    lines = text.splitlines()
    parser = _PARSER_MAP.get(fmt_name, None)
    entries: List[LogEntry] = []
    idx = 0

    for line_no, raw in enumerate(lines, start=1):
        if idx >= _MAX_ENTRIES:
            break
        line = raw.rstrip()
        if not line:
            continue

        entry: Optional[LogEntry] = None
        if parser:
            entry = parser(line, idx, line_no)
        if entry is None:
            entry = _parse_generic_line(line, idx, line_no)

        entries.append(entry)
        idx += 1

    return entries
