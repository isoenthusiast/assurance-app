# Pull dev.db from Railway volume back into local repo
# Usage: .\pull-db.ps1

$ErrorActionPreference = "Stop"

Write-Host "Pulling dev.db from Railway..." -ForegroundColor Cyan

# Download from Railway volume (mount path /data)
railway volume files download /data/dev.db ./dev.db

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to download dev.db from Railway." -ForegroundColor Red
    exit 1
}

Write-Host "Downloaded successfully." -ForegroundColor Green

# Run backup
Write-Host "Running backup..." -ForegroundColor Cyan
Push-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
python backup.py
Pop-Location

Write-Host "Done. dev.db is now in your repo." -ForegroundColor Green
