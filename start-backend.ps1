# Meeting Simulator - Backend Startup Script
Write-Host "🚀 Starting Meeting Simulator Backend..." -ForegroundColor Green

# Change to backend directory
Set-Location -Path "C:\Users\vince\OneDrive\Documents\Board_Simulator_001\backend"

# Activate virtual environment
& .\venv\Scripts\Activate.ps1

# Start uvicorn
Write-Host "Starting FastAPI server on http://localhost:8000" -ForegroundColor Cyan
uvicorn app.main:app --reload --port 8000
