# Meeting Simulator - Frontend Startup Script with OneDrive Fix
Write-Host "🚀 Starting Meeting Simulator Frontend..." -ForegroundColor Green

# Change to frontend directory
$frontendPath = "C:\Users\vince\OneDrive\Documents\Board_Simulator_001\frontend"
$nextPath = Join-Path $frontendPath ".next"

Set-Location -Path $frontendPath

# Clean up any locked .next folder from OneDrive
if (Test-Path $nextPath) {
    Write-Host "Removing existing .next folder to prevent OneDrive locks..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $nextPath -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Start Next.js dev server
Write-Host "Starting Next.js server on http://localhost:3000" -ForegroundColor Cyan
Write-Host "Note: If you see EBUSY errors, close this window and move the project outside OneDrive" -ForegroundColor Yellow
npm run dev
