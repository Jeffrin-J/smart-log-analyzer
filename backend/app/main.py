import io
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .parsers import detect_format, parse_logs
from .analyzer import analyze_logs

app = FastAPI(title="Smart Log Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


class TextRequest(BaseModel):
    text: str
    filename: str = "pasted_log.txt"


def _build_response(text: str, filename: str) -> dict:
    fmt = detect_format(text)
    entries = parse_logs(text, fmt["name"])
    analysis = analyze_logs(entries, fmt)
    return {
        "filename": filename,
        "format": fmt,
        "totalLines": text.count("\n") + 1,
        "parsedEntries": len(entries),
        "analysis": analysis,
        "entries": [e.to_dict() for e in entries],
    }


@app.post("/api/analyze")
async def analyze_file(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > _MAX_SIZE_BYTES:
        raise HTTPException(413, "File exceeds 50 MB limit.")
    try:
        text = content.decode("utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(400, f"Could not read file: {exc}") from exc
    return _build_response(text, file.filename or "upload.log")


@app.post("/api/analyze-text")
async def analyze_text(req: TextRequest):
    if len(req.text.encode()) > _MAX_SIZE_BYTES:
        raise HTTPException(413, "Text exceeds 50 MB limit.")
    return _build_response(req.text, req.filename)


@app.get("/api/demo")
async def demo():
    sample = """\
2024-03-15 08:00:01,123 INFO  com.example.App - Application starting up
2024-03-15 08:00:02,456 INFO  com.example.DatabasePool - Database connection pool initialised (size=10)
2024-03-15 08:00:03,789 INFO  com.example.HttpServer - Listening on port 8080
2024-03-15 08:01:12,001 INFO  com.example.AuthService - User 'alice' logged in successfully
2024-03-15 08:01:45,321 WARN  com.example.RateLimiter - Rate limit threshold approaching for IP 192.168.1.10
2024-03-15 08:02:00,100 ERROR com.example.PaymentService - Payment processing failed: Connection timed out after 5000ms
2024-03-15 08:02:00,200 ERROR com.example.PaymentService - Payment processing failed: Connection timed out after 5000ms
2024-03-15 08:02:00,310 ERROR com.example.PaymentService - Payment processing failed: Connection timed out after 5000ms
2024-03-15 08:02:01,000 WARN  com.example.AuthService - Authentication failed for user 'bob' from IP 10.0.0.5
2024-03-15 08:02:01,100 WARN  com.example.AuthService - Authentication failed for user 'bob' from IP 10.0.0.5
2024-03-15 08:02:01,200 WARN  com.example.AuthService - Authentication failed for user 'bob' from IP 10.0.0.5
2024-03-15 08:02:01,300 WARN  com.example.AuthService - Authentication failed for user 'bob' from IP 10.0.0.5
2024-03-15 08:02:01,400 WARN  com.example.AuthService - Authentication failed for user 'bob' from IP 10.0.0.5
2024-03-15 08:02:01,500 WARN  com.example.AuthService - Authentication failed for user 'bob' from IP 10.0.0.5
2024-03-15 08:02:01,600 ERROR com.example.AuthService - Account locked after too many failed attempts: user 'bob'
2024-03-15 08:02:30,000 INFO  com.example.OrderService - Order #4521 created successfully for user 'alice'
2024-03-15 08:03:00,001 ERROR com.example.DatabasePool - Connection pool exhausted: all 10 connections in use
2024-03-15 08:03:00,100 ERROR com.example.UserService - Failed to fetch user profile: Connection refused
2024-03-15 08:03:00,200 ERROR com.example.OrderService - Failed to persist order: Connection refused
2024-03-15 08:03:05,001 FATAL com.example.App - Unhandled exception in main thread
2024-03-15 08:03:05,002 FATAL com.example.App - java.lang.OutOfMemoryError: Java heap space
2024-03-15 08:03:05,003 FATAL com.example.App - \tat com.example.App.processRequests(App.java:123)
2024-03-15 08:03:05,004 FATAL com.example.App - \tat com.example.App.main(App.java:45)
2024-03-15 08:03:10,000 WARN  com.example.DiskMonitor - Disk usage at 92%% on /var/log
2024-03-15 08:03:15,000 ERROR com.example.DiskMonitor - No space left on device: write failed
2024-03-15 08:04:00,000 INFO  com.example.App - Attempting graceful restart...
2024-03-15 08:04:05,000 INFO  com.example.App - Application restarted successfully
2024-03-15 08:04:10,100 INFO  com.example.AuthService - User 'alice' logged in successfully
2024-03-15 08:04:12,000 ERROR com.example.PaymentService - Payment processing failed: Connection timed out after 5000ms
2024-03-15 08:04:13,000 ERROR com.example.PaymentService - Payment processing failed: Connection timed out after 5000ms
2024-03-15 08:05:00,000 INFO  com.example.HealthCheck - All systems nominal"""
    return _build_response(sample, "demo_app.log")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
