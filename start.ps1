# Start Smart Log Analyzer (backend + frontend)
Write-Host "Starting Smart Log Analyzer..." -ForegroundColor Cyan

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "cd '$PSScriptRoot\backend'; py -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" `
  -WindowStyle Normal

Start-Sleep -Seconds 1

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "cd '$PSScriptRoot\frontend'; npm run dev" `
  -WindowStyle Normal

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "App running at: http://localhost:5173" -ForegroundColor Green
Write-Host "API running at: http://localhost:8000" -ForegroundColor Green
Start-Process "http://localhost:5173"
