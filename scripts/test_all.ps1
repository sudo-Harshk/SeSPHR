# SeSPHR: local test workflow with auto venv activation (robust version)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$FeUrl = 'http://127.0.0.1:5173'
$ApiUrl = 'http://127.0.0.1:5000'

# ----------------------------
# Auto-detect and activate venv
# ----------------------------
function Activate-Venv {
    $venvPaths = @(
        "backend\venv\Scripts\Activate.ps1",
        "backend\.venv\Scripts\Activate.ps1"
    )

    foreach ($path in $venvPaths) {
        if (Test-Path $path) {
            Write-Host "Activating venv: $path"
            & $path
            return $true
        }
    }

    Write-Host "WARNING: No venv found. Using system Python." -ForegroundColor Yellow
    return $false
}

# ----------------------------
# Backend health check
# ----------------------------
function Test-BackendAlive {
  try {
    $be = Invoke-WebRequest -Uri "$ApiUrl/api/session" -UseBasicParsing -TimeoutSec 5
    $sc = [int]$be.StatusCode
  } catch {
    $resp = $_.Exception.Response
    if ($null -ne $resp) {
      $sc = [int]$resp.StatusCode
    } else {
      return $false
    }
  }
  return ($sc -eq 200 -or $sc -eq 401 -or $sc -eq 403)
}

# ----------------------------
# Start backend if not running
# ----------------------------
function Ensure-BackendRunning {
    if (Test-BackendAlive) {
        Write-Host "Backend already running."
        return
    }

    Write-Host "Starting backend..."

    $backendCmd = @"
cd backend
`$env:FLASK_ENV='development'
if (Test-Path '.\venv\Scripts\Activate.ps1') { . .\venv\Scripts\Activate.ps1 }
elseif (Test-Path '.\.venv\Scripts\Activate.ps1') { . .\.venv\Scripts\Activate.ps1 }
python run.py
"@

    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

    # Wait until backend is alive (retry loop)
    $maxAttempts = 10
    for ($i = 0; $i -lt $maxAttempts; $i++) {
        Start-Sleep -Seconds 1
        if (Test-BackendAlive) {
            Write-Host "Backend started."
            return
        }
    }

    Write-Host "ERROR: Backend failed to start." -ForegroundColor Red
    exit 1
}

# ----------------------------
# Start frontend if not running
# ----------------------------
function Ensure-FrontendRunning {
    try {
        $fe = Invoke-WebRequest -Uri $FeUrl -UseBasicParsing -TimeoutSec 5
        if ($fe.StatusCode -eq 200) {
            Write-Host "Frontend already running."
            return
        }
    } catch {}

    Write-Host "Starting frontend..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

    Start-Sleep -Seconds 3
}

# ----------------------------
# MAIN FLOW
# ----------------------------

Write-Host "== Ensuring services =="

Ensure-BackendRunning
Ensure-FrontendRunning

Write-Host "== Resetting state =="

try {
  Invoke-WebRequest -Uri "$ApiUrl/api/debug/clear-uploads" -Method POST -UseBasicParsing | Out-Null
  Invoke-WebRequest -Uri "$ApiUrl/api/debug/clear-audit-log" -Method POST -UseBasicParsing | Out-Null
} catch {
  Write-Host "ERROR: Reset failed. Ensure backend is in development mode." -ForegroundColor Red
  exit 1
}

Write-Host "== Running backend tests =="

Activate-Venv | Out-Null
python -m pytest tests/backend -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== Running E2E tests =="

Push-Location (Join-Path $Root 'frontend')
$env:E2E_BASE_URL = $FeUrl

npm run test:e2e
$code = $LASTEXITCODE

Remove-Item Env:E2E_BASE_URL -ErrorAction SilentlyContinue
Pop-Location

if ($code -ne 0) { exit $code }

# ----------------------------
# Open Playwright report (non-blocking)
# ----------------------------
$reportPath = Join-Path $Root 'frontend\playwright-report'
if (Test-Path $reportPath) {
    Write-Host "Opening Playwright report..."
    Start-Process npx -ArgumentList "playwright show-report"
}

Write-Host "Done."