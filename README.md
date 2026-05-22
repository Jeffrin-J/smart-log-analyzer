# Smart Log Analyzer

A full-stack log analysis tool that automatically detects log formats and identifies potential issues — no configuration required.

![Smart Log Analyzer](https://img.shields.io/badge/Python-3.13-blue?logo=python) ![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?logo=fastapi) ![React](https://img.shields.io/badge/React-18-61dafb?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)

## Features

- **Auto format detection** — drop any log file and the format is identified automatically
- **Smart issue detection** — 19 issue categories detected out-of-the-box with severity levels and recommendations
- **Multi-format support** — Apache, Nginx, Syslog, JSON, Log4j, Python logging, .NET/Serilog, and generic formats
- **Interactive log viewer** — search, filter by level, paginate through millions of entries
- **Issue deep-dive** — click any issue to see affected lines, timestamps, and actionable recommendations
- **Timeline charts** — visualise error spikes and activity over time with brush-to-zoom
- **Paste or upload** — drag & drop a file or paste log text directly

## Screenshots

| Upload | Overview | Issues | Timeline |
|--------|----------|--------|----------|
| Drag & drop any log file | Stats, level distribution, top errors | Categorised issues with severity | Error & activity charts |

## Detected Issue Categories

| Category | Issues Detected |
|----------|----------------|
| **Application** | Fatal errors, high error rate, repeated errors, stack traces, null pointer exceptions, config errors, error spikes |
| **Security** | Authentication failures / brute force, SSL/TLS errors |
| **Availability** | Connection refused/timeout, HTTP 5xx errors, HTTP 4xx spikes, service unavailability, disk full |
| **Performance** | Memory (OOM/heap), slow responses, repeated timeouts |

## Supported Log Formats

| Format | Example |
|--------|---------|
| Apache Common / Combined | `192.168.1.1 - - [22/May/2024:10:00:00 +0000] "GET / HTTP/1.1" 200 1234` |
| Nginx Access | `192.168.1.1 - - [22/May/2024:10:00:00 +0000] "GET / HTTP/1.1" 200 1234 "-" "curl/7.x"` |
| Syslog RFC 3164 / 5424 | `May 22 10:00:00 hostname sshd[1234]: Failed password for root` |
| JSON structured logs | `{"timestamp":"2024-05-22T10:00:00Z","level":"error","message":"DB timeout"}` |
| Log4j / Python logging | `2024-05-22 10:00:00,123 ERROR com.example.App - Connection refused` |
| .NET / Serilog | `ERROR 2024-05-22 10:00:00.123 Object reference not set` |
| Generic | Any log with an ISO timestamp and a level keyword |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+

### Installation

```bash
git clone https://github.com/Jeffrin-J/smart-log-analyzer.git
cd smart-log-analyzer
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

### Running

**Option 1 — PowerShell convenience script (Windows):**
```powershell
.\start.ps1
```

**Option 2 — manually in two terminals:**

Terminal 1 (backend):
```bash
cd backend
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Project Structure

```
smart-log-analyzer/
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI routes
│   │   ├── parsers.py     # Log format detection & parsing
│   │   └── analyzer.py    # Smart issue detection
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FileUpload.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── LogViewer.tsx
│   │   │   ├── IssuesPanel.tsx
│   │   │   └── TimelineChart.tsx
│   │   └── types/index.ts
│   └── package.json
└── start.ps1
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Upload a log file (multipart/form-data) |
| `/api/analyze-text` | POST | Analyse raw log text (JSON body) |
| `/api/demo` | GET | Run analysis on a built-in demo log |
| `/api/health` | GET | Health check |

## Tech Stack

- **Backend:** Python, FastAPI, Uvicorn
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide icons
