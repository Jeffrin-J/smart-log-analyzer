import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import List, Dict, Any, Optional

from .parsers import LogEntry

_SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

# ── Pattern libraries ─────────────────────────────────────────────────────────

_AUTH_PAT = re.compile(
    r"authentication.?fail|login.?fail|invalid.?(password|credential|token|user)|"
    r"access.?denied|unauthorized|permission.?denied|forbidden|"
    r"brute.?force|too.?many.?attempt|account.?lock|invalid.?api.?key|"
    r"401\b|403\b",
    re.IGNORECASE,
)
_MEM_PAT = re.compile(
    r"out.?of.?memory|outofmemory|\boom\b|memory.?leak|heap.?space|"
    r"gc.?overhead|memory.?exhaust|cannot.?allocat|allocation.?fail|"
    r"java\.lang\.OutOfMemory|MemoryError",
    re.IGNORECASE,
)
_CONN_PAT = re.compile(
    r"connection.?refus|connection.?timed?.?out|connection.?reset|"
    r"network.?unreachable|host.?unreachable|connect.?fail|socket.?timeout|"
    r"connection.?pool.?exhaust|no.?route.?to.?host|ECONNREFUSED|ETIMEDOUT",
    re.IGNORECASE,
)
_DB_PAT = re.compile(
    r"(sql|database|db|mysql|postgres|postgresql|mongodb|redis|cassandra|oracle|sqlite)"
    r"[.\s]*(error|exception|fail|timeout|refus|unavailable|connect)",
    re.IGNORECASE,
)
_DISK_PAT = re.compile(
    r"disk.?full|no.?space.?left|storage.?full|disk.?usage|quota.?exceed|"
    r"write.?fail.*disk|i\/o.?error|ENOSPC|filesystem.?full",
    re.IGNORECASE,
)
_STACK_PAT = re.compile(
    r"Traceback.?\(most.?recent|at \w+\.\w+\.\w+\(|\tat [\w.$]+\(|"
    r"Exception in thread|raised [A-Z]\w+Error|NullPointerException|"
    r"StackOverflow|Segmentation.?fault|core.?dump",
    re.IGNORECASE,
)
_EXC_TYPE_PAT = re.compile(
    r"([A-Z][a-zA-Z]+(?:Exception|Error|Fault|Panic|Failure))",
)
_SLOW_PAT = re.compile(r"(\d+)\s*ms\b", re.IGNORECASE)
_NPE_PAT = re.compile(r"NullPointerException|NullReferenceException|AttributeError.*None|TypeError.*None", re.IGNORECASE)
_TIMEOUT_PAT = re.compile(r"\btimeout\b|\btimed?\s+out\b", re.IGNORECASE)
_SERVICE_DOWN_PAT = re.compile(r"503|service.?unavailable|service.?down|upstream.?fail|backend.?unavailable", re.IGNORECASE)
_SSL_PAT = re.compile(r"ssl|tls|certificate|handshake.?fail|cert.?(error|invalid|expired)", re.IGNORECASE)
_CONFIG_PAT = re.compile(r"config.?(error|invalid|missing|not.?found)|missing.?config|environment.?variable.?not.?set", re.IGNORECASE)


# ── Statistics ────────────────────────────────────────────────────────────────

def _compute_stats(entries: List[LogEntry]) -> Dict:
    level_counts: Counter = Counter()
    sources: set = set()
    timestamps = []

    for e in entries:
        level_counts[e.level] += 1
        if e.source:
            sources.add(e.source)
        if e.timestamp:
            timestamps.append(e.timestamp)

    total = len(entries)
    error_count = level_counts.get("ERROR", 0) + level_counts.get("FATAL", 0)

    time_range = {"start": None, "end": None, "durationSeconds": None}
    if timestamps:
        timestamps_sorted = sorted(timestamps)
        time_range["start"] = timestamps_sorted[0]
        time_range["end"] = timestamps_sorted[-1]
        try:
            def _parse(ts: str):
                for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
                            "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
                    try:
                        return datetime.strptime(ts[:26], fmt)
                    except Exception:
                        continue
                return None
            t0 = _parse(timestamps_sorted[0])
            t1 = _parse(timestamps_sorted[-1])
            if t0 and t1:
                time_range["durationSeconds"] = int((t1 - t0).total_seconds())
        except Exception:
            pass

    return {
        "totalEntries": total,
        "errorCount": level_counts.get("ERROR", 0),
        "fatalCount": level_counts.get("FATAL", 0),
        "warnCount": level_counts.get("WARN", 0),
        "infoCount": level_counts.get("INFO", 0),
        "debugCount": level_counts.get("DEBUG", 0),
        "otherCount": level_counts.get("UNKNOWN", 0) + level_counts.get("TRACE", 0),
        "uniqueSources": len(sources),
        "errorRate": round(error_count / total, 4) if total else 0,
        "timeRange": time_range,
        "levelCounts": dict(level_counts),
    }


# ── Timeline ──────────────────────────────────────────────────────────────────

def _compute_timeline(entries: List[LogEntry]) -> List[Dict]:
    timestamped = [(e.timestamp, e.level) for e in entries if e.timestamp]
    if len(timestamped) < 2:
        return []

    sorted_ts = sorted(timestamped, key=lambda x: x[0])
    start, end = sorted_ts[0][0], sorted_ts[-1][0]

    def _epoch(ts: str) -> Optional[float]:
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
                    "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(ts[:26], fmt).timestamp()
            except Exception:
                continue
        return None

    t0 = _epoch(start)
    t1 = _epoch(end)
    if t0 is None or t1 is None or t1 == t0:
        return []

    duration = t1 - t0
    # Aim for ~20 buckets
    if duration <= 60:
        bucket_sec = 5
    elif duration <= 600:
        bucket_sec = 30
    elif duration <= 3600:
        bucket_sec = 120
    elif duration <= 86400:
        bucket_sec = 3600
    elif duration <= 7 * 86400:
        bucket_sec = 6 * 3600
    else:
        bucket_sec = 86400

    buckets: Dict[int, Dict] = defaultdict(lambda: {"errors": 0, "warnings": 0, "info": 0, "debug": 0, "others": 0})

    for ts_str, level in sorted_ts:
        ep = _epoch(ts_str)
        if ep is None:
            continue
        key = int((ep - t0) // bucket_sec)
        lvl = level.upper()
        if lvl in ("ERROR", "FATAL"):
            buckets[key]["errors"] += 1
        elif lvl == "WARN":
            buckets[key]["warnings"] += 1
        elif lvl == "INFO":
            buckets[key]["info"] += 1
        elif lvl == "DEBUG":
            buckets[key]["debug"] += 1
        else:
            buckets[key]["others"] += 1

    result = []
    max_key = max(buckets.keys()) if buckets else 0
    for k in range(max_key + 1):
        bucket_start = datetime.fromtimestamp(t0 + k * bucket_sec)
        label = bucket_start.strftime("%H:%M" if bucket_sec < 3600 else "%m/%d %H:%M" if bucket_sec < 86400 else "%m/%d")
        entry = {"time": label, **buckets[k]}
        result.append(entry)

    return result


# ── Top errors ────────────────────────────────────────────────────────────────

def _top_errors(entries: List[LogEntry], n: int = 10) -> List[Dict]:
    ctr: Counter = Counter()
    for e in entries:
        if e.level in ("ERROR", "FATAL", "WARN"):
            key = re.sub(r'\b\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[^\s]*', '<ts>', e.message)
            key = re.sub(r'\b\d+\.\d+\.\d+\.\d+\b', '<ip>', key)
            key = re.sub(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', '<uuid>', key, flags=re.IGNORECASE)
            key = re.sub(r'\b\d{5,}\b', '<id>', key)
            key = key[:120]
            ctr[key] += 1
    return [{"message": msg, "count": cnt} for msg, cnt in ctr.most_common(n)]


# ── Issue detection ───────────────────────────────────────────────────────────

def _make_issue(id_: str, title: str, desc: str, severity: str, category: str,
                count: int, lines: List[int], recommendation: str,
                first_occ: Optional[str] = None, last_occ: Optional[str] = None) -> Dict:
    return {
        "id": id_,
        "title": title,
        "description": desc,
        "severity": severity,
        "category": category,
        "count": count,
        "affectedLines": lines[:100],
        "firstOccurrence": first_occ,
        "lastOccurrence": last_occ,
        "recommendation": recommendation,
    }


def _detect_issues(entries: List[LogEntry], stats: Dict, timeline: List[Dict]) -> List[Dict]:
    issues: List[Dict] = []
    total = stats["totalEntries"]
    if total == 0:
        return []

    # ── 1. Fatal / Critical entries ──
    fatals = [e for e in entries if e.level == "FATAL"]
    if fatals:
        issues.append(_make_issue(
            "fatal_errors", "Fatal Errors Detected",
            f"{len(fatals)} fatal/critical error(s) indicate unrecoverable failures.",
            "critical", "application", len(fatals),
            [e.line_number for e in fatals],
            "Immediate investigation required — fatal errors indicate the process may have crashed.",
            fatals[0].timestamp, fatals[-1].timestamp,
        ))

    # ── 2. High error rate ──
    error_rate = stats["errorRate"]
    if error_rate >= 0.5:
        issues.append(_make_issue(
            "critical_error_rate", "Critically High Error Rate",
            f"{error_rate*100:.1f}% of all log entries are errors — system may be failing.",
            "critical", "application",
            stats["errorCount"] + stats["fatalCount"],
            [e.line_number for e in entries if e.level in ("ERROR","FATAL")],
            "Investigate root cause immediately. The system appears to be in a failure state.",
        ))
    elif error_rate >= 0.2:
        issues.append(_make_issue(
            "high_error_rate", "Elevated Error Rate",
            f"{error_rate*100:.1f}% of all log entries are errors.",
            "high", "application",
            stats["errorCount"] + stats["fatalCount"],
            [e.line_number for e in entries if e.level in ("ERROR","FATAL")],
            "Review error patterns and resolve root causes to stabilise the system.",
        ))

    # ── 3. Repeated errors ──
    msg_counter: Counter = Counter()
    msg_lines: Dict[str, List[int]] = defaultdict(list)
    msg_ts: Dict[str, List[str]] = defaultdict(list)
    for e in entries:
        if e.level in ("ERROR", "FATAL"):
            key = e.message[:100]
            msg_counter[key] += 1
            msg_lines[key].append(e.line_number)
            if e.timestamp:
                msg_ts[key].append(e.timestamp)
    for msg, cnt in msg_counter.most_common(5):
        if cnt < 5:
            break
        sev = "high" if cnt >= 50 else "medium"
        tss = sorted(msg_ts[msg])
        issues.append(_make_issue(
            f"repeated_{abs(hash(msg)) % 100000}",
            f"Repeated Error ({cnt}×)",
            f'"{msg[:80]}…" occurred {cnt} times.',
            sev, "application", cnt, msg_lines[msg],
            "Resolve the underlying error so it stops repeating.",
            tss[0] if tss else None, tss[-1] if tss else None,
        ))

    # ── 4. Authentication failures ──
    auth_fails = [e for e in entries if _AUTH_PAT.search(e.message)]
    if len(auth_fails) >= 5:
        sev = "critical" if len(auth_fails) >= 100 else "high"
        issues.append(_make_issue(
            "auth_failures", "Authentication Failures Detected",
            f"{len(auth_fails)} authentication failure(s) — possible brute-force attack.",
            sev, "security", len(auth_fails),
            [e.line_number for e in auth_fails],
            "Implement rate limiting, IP blocking, and multi-factor authentication.",
            auth_fails[0].timestamp, auth_fails[-1].timestamp,
        ))

    # ── 5. Memory issues ──
    mem_issues = [e for e in entries if _MEM_PAT.search(e.message)]
    if mem_issues:
        sev = "critical" if len(mem_issues) >= 5 else "high"
        issues.append(_make_issue(
            "memory_issues", "Memory Issues Detected",
            f"{len(mem_issues)} memory-related error(s) found.",
            sev, "performance", len(mem_issues),
            [e.line_number for e in mem_issues],
            "Profile memory usage, check for leaks, and consider increasing heap/RAM allocation.",
            mem_issues[0].timestamp, mem_issues[-1].timestamp,
        ))

    # ── 6. Connection issues ──
    conn_issues = [e for e in entries if _CONN_PAT.search(e.message)]
    if len(conn_issues) >= 3:
        sev = "high" if len(conn_issues) >= 20 else "medium"
        issues.append(_make_issue(
            "connection_issues", "Connection Issues Detected",
            f"{len(conn_issues)} connection error(s) — services may be unreachable.",
            sev, "availability", len(conn_issues),
            [e.line_number for e in conn_issues],
            "Check network connectivity, firewall rules, and that dependent services are running.",
            conn_issues[0].timestamp, conn_issues[-1].timestamp,
        ))

    # ── 7. HTTP 5xx Server Errors ──
    http5xx = [e for e in entries if e.extra.get("status_code", 0) >= 500]
    if http5xx:
        sev = "high" if len(http5xx) >= 10 else "medium"
        issues.append(_make_issue(
            "http_5xx", "HTTP 5xx Server Errors",
            f"{len(http5xx)} HTTP 5xx response(s) — server is failing to handle requests.",
            sev, "availability", len(http5xx),
            [e.line_number for e in http5xx],
            "Review server-side exceptions, check application logs and upstream dependencies.",
            http5xx[0].timestamp, http5xx[-1].timestamp,
        ))

    # ── 8. HTTP 4xx spikes ──
    http4xx = [e for e in entries if 400 <= e.extra.get("status_code", 0) < 500]
    req_entries = [e for e in entries if e.extra.get("status_code")]
    if req_entries:
        rate_4xx = len(http4xx) / len(req_entries)
        if rate_4xx >= 0.3 and len(http4xx) >= 20:
            issues.append(_make_issue(
                "http_4xx_spike", "High HTTP 4xx Client Error Rate",
                f"{rate_4xx*100:.1f}% of requests returned 4xx errors ({len(http4xx)} requests).",
                "medium", "availability", len(http4xx),
                [e.line_number for e in http4xx],
                "Check for broken client integrations, misconfigured routes, or API contract violations.",
            ))

    # ── 9. Slow responses ──
    slow_entries = [e for e in entries if e.extra.get("response_time_ms", 0) > 2000]
    if slow_entries:
        avg_ms = sum(e.extra["response_time_ms"] for e in slow_entries) / len(slow_entries)
        issues.append(_make_issue(
            "slow_responses", "Slow Response Times",
            f"{len(slow_entries)} request(s) exceeded 2 s (avg {avg_ms:.0f} ms).",
            "medium", "performance", len(slow_entries),
            [e.line_number for e in slow_entries],
            "Profile slow endpoints, optimise database queries, and consider adding caching.",
        ))

    # ── 10. Inline slow durations (fallback for non-access-log formats) ──
    if not slow_entries:
        inline_slow = []
        for e in entries:
            m = _SLOW_PAT.search(e.message)
            if m and int(m.group(1)) > 2000:
                inline_slow.append(e)
        if inline_slow:
            issues.append(_make_issue(
                "slow_ops", "Slow Operations Detected",
                f"{len(inline_slow)} operation(s) with duration > 2 s mentioned in logs.",
                "medium", "performance", len(inline_slow),
                [e.line_number for e in inline_slow],
                "Investigate slow operations and add performance optimisations.",
            ))

    # ── 11. Database errors ──
    db_issues = [e for e in entries if e.level in ("ERROR", "FATAL", "WARN") and _DB_PAT.search(e.message)]
    if db_issues:
        issues.append(_make_issue(
            "db_errors", "Database Errors",
            f"{len(db_issues)} database error(s) detected.",
            "high", "availability", len(db_issues),
            [e.line_number for e in db_issues],
            "Check database connectivity, query performance, and connection pool settings.",
            db_issues[0].timestamp, db_issues[-1].timestamp,
        ))

    # ── 12. Disk / storage issues ──
    disk_issues = [e for e in entries if _DISK_PAT.search(e.message)]
    if disk_issues:
        issues.append(_make_issue(
            "disk_issues", "Disk Space Issues",
            f"{len(disk_issues)} disk-space error(s) — storage may be exhausted.",
            "critical", "availability", len(disk_issues),
            [e.line_number for e in disk_issues],
            "Free disk space immediately: archive old logs, remove temp files, expand storage.",
            disk_issues[0].timestamp, disk_issues[-1].timestamp,
        ))

    # ── 13. Stack traces / exceptions ──
    stack_entries = [e for e in entries if _STACK_PAT.search(e.message)]
    if stack_entries:
        exc_ctr: Counter = Counter()
        for e in stack_entries:
            for m in _EXC_TYPE_PAT.finditer(e.message):
                exc_ctr[m.group(1)] += 1
        summary = ", ".join(f"{t} ({c}×)" for t, c in exc_ctr.most_common(3))
        desc = f"{len(stack_entries)} exception/stack-trace entry(ies) found."
        if summary:
            desc += f" Types: {summary}."
        issues.append(_make_issue(
            "exceptions", "Exceptions / Stack Traces",
            desc,
            "high" if len(stack_entries) >= 5 else "medium",
            "application", len(stack_entries),
            [e.line_number for e in stack_entries],
            "Fix each exception class. Add proper error handling and increase test coverage.",
            stack_entries[0].timestamp, stack_entries[-1].timestamp,
        ))

    # ── 14. NullPointerException ──
    npe_entries = [e for e in entries if _NPE_PAT.search(e.message)]
    if npe_entries:
        issues.append(_make_issue(
            "null_pointer", "Null Pointer / None Reference Errors",
            f"{len(npe_entries)} null/None dereference error(s) detected.",
            "high", "application", len(npe_entries),
            [e.line_number for e in npe_entries],
            "Add null checks, use Optional types, and review code paths that produce null.",
        ))

    # ── 15. Timeouts ──
    timeout_entries = [e for e in entries if e.level in ("ERROR", "WARN") and _TIMEOUT_PAT.search(e.message)]
    if len(timeout_entries) >= 5:
        issues.append(_make_issue(
            "timeouts", "Repeated Timeouts",
            f"{len(timeout_entries)} timeout error(s) — operations are not completing in time.",
            "high" if len(timeout_entries) >= 20 else "medium",
            "performance", len(timeout_entries),
            [e.line_number for e in timeout_entries],
            "Increase timeout thresholds or improve performance of slow operations.",
            timeout_entries[0].timestamp, timeout_entries[-1].timestamp,
        ))

    # ── 16. Service unavailable ──
    svc_down = [e for e in entries if _SERVICE_DOWN_PAT.search(e.message) and e.level in ("ERROR","WARN","FATAL")]
    if svc_down:
        issues.append(_make_issue(
            "service_down", "Service Unavailability",
            f"{len(svc_down)} service-unavailable error(s) detected.",
            "critical" if len(svc_down) >= 10 else "high",
            "availability", len(svc_down),
            [e.line_number for e in svc_down],
            "Verify all dependent services are healthy. Implement retry logic and circuit breakers.",
            svc_down[0].timestamp, svc_down[-1].timestamp,
        ))

    # ── 17. SSL / TLS errors ──
    ssl_entries = [e for e in entries if e.level in ("ERROR","FATAL","WARN") and _SSL_PAT.search(e.message)]
    if ssl_entries:
        issues.append(_make_issue(
            "ssl_errors", "SSL/TLS Errors",
            f"{len(ssl_entries)} SSL/TLS error(s) — possible certificate issues.",
            "high", "security", len(ssl_entries),
            [e.line_number for e in ssl_entries],
            "Check certificate expiry, chain validity, and cipher suite compatibility.",
            ssl_entries[0].timestamp, ssl_entries[-1].timestamp,
        ))

    # ── 18. Error spike ──
    if len(timeline) >= 4:
        error_counts = [b["errors"] for b in timeline]
        avg = sum(error_counts) / len(error_counts)
        peak = max(error_counts)
        if avg > 0 and peak >= avg * 3 and peak >= 5:
            spike_time = timeline[error_counts.index(peak)]["time"]
            issues.append(_make_issue(
                "error_spike", "Error Rate Spike Detected",
                f"Peak of {peak} errors at {spike_time} (avg {avg:.1f}/bucket).",
                "high", "application", int(peak),
                [],
                "Investigate deployments, configuration changes, or traffic spikes at that time.",
            ))

    # ── 19. Configuration errors ──
    cfg_entries = [e for e in entries if e.level in ("ERROR","FATAL") and _CONFIG_PAT.search(e.message)]
    if cfg_entries:
        issues.append(_make_issue(
            "config_errors", "Configuration Errors",
            f"{len(cfg_entries)} configuration error(s) — the application may be misconfigured.",
            "high", "application", len(cfg_entries),
            [e.line_number for e in cfg_entries],
            "Review environment variables, config files, and deployment settings.",
            cfg_entries[0].timestamp, cfg_entries[-1].timestamp,
        ))

    return sorted(issues, key=lambda i: _SEVERITY_ORDER.get(i["severity"], 9))


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_logs(entries: List[LogEntry], format_info: Dict) -> Dict:
    if not entries:
        return {
            "stats": {"totalEntries": 0, "errorCount": 0, "fatalCount": 0,
                      "warnCount": 0, "infoCount": 0, "debugCount": 0, "otherCount": 0,
                      "uniqueSources": 0, "errorRate": 0,
                      "timeRange": {"start": None, "end": None, "durationSeconds": None},
                      "levelCounts": {}},
            "issues": [],
            "timeline": [],
            "topErrors": [],
        }

    stats = _compute_stats(entries)
    timeline = _compute_timeline(entries)
    stats["timeline"] = timeline
    issues = _detect_issues(entries, stats, timeline)
    top_errors = _top_errors(entries)
    stats.pop("timeline", None)

    return {
        "stats": stats,
        "issues": issues,
        "timeline": timeline,
        "topErrors": top_errors,
    }
