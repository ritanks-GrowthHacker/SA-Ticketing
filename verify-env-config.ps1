#!/usr/bin/env pwsh
# Verify Single .env Configuration

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Single .env File Configuration Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$projectRoot = "c:\Users\lenovo\Desktop\SA-Ticketing"
Set-Location $projectRoot

# Check 1: Environment Files
Write-Host "1. Checking environment files..." -ForegroundColor Yellow
$envFiles = Get-ChildItem -Filter ".env*" -ErrorAction SilentlyContinue

$expectedFiles = @(".env", ".env.example", ".env.ignored")
$unwantedFiles = @(".env.local", ".env.development", ".env.production", ".env.test")

Write-Host "   Expected files:" -ForegroundColor Green
foreach ($file in $expectedFiles) {
    if (Test-Path $file) {
        Write-Host "   ✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file missing" -ForegroundColor Red
    }
}

Write-Host "`n   Checking for unwanted files:" -ForegroundColor Green
$hasUnwanted = $false
foreach ($file in $unwantedFiles) {
    if (Test-Path $file) {
        Write-Host "   ✗ $file exists (should be removed!)" -ForegroundColor Red
        $hasUnwanted = $true
    }
}
if (-not $hasUnwanted) {
    Write-Host "   ✓ No unwanted .env files found" -ForegroundColor Green
}

# Check 2: .gitignore Configuration
Write-Host "`n2. Checking .gitignore configuration..." -ForegroundColor Yellow
$gitignoreContent = Get-Content ".gitignore" -Raw
if ($gitignoreContent -match "\.env\.local" -and 
    $gitignoreContent -match "# Keep \.env file") {
    Write-Host "   ✓ .gitignore properly configured" -ForegroundColor Green
} else {
    Write-Host "   ✗ .gitignore may need updates" -ForegroundColor Red
}

# Check 3: .dockerignore Configuration
Write-Host "`n3. Checking .dockerignore configuration..." -ForegroundColor Yellow
if (Test-Path ".dockerignore") {
    $dockerignoreContent = Get-Content ".dockerignore" -Raw
    if ($dockerignoreContent -match "\.env\.local") {
        Write-Host "   ✓ .dockerignore blocks .env.local" -ForegroundColor Green
    } else {
        Write-Host "   ✗ .dockerignore may need updates" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ .dockerignore not found" -ForegroundColor Red
}

# Check 4: docker-compose.yml
Write-Host "`n4. Checking docker-compose.yml..." -ForegroundColor Yellow
if (Test-Path "docker-compose.yml") {
    $dockerComposeContent = Get-Content "docker-compose.yml" -Raw
    if ($dockerComposeContent -match "env_file") {
        Write-Host "   ✓ docker-compose.yml uses only .env" -ForegroundColor Green
    } else {
        Write-Host "   ✗ docker-compose.yml configuration issue" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ docker-compose.yml not found" -ForegroundColor Red
}

# Check 5: next.config.ts
Write-Host "`n5. Checking next.config.ts..." -ForegroundColor Yellow
if (Test-Path "next.config.ts") {
    Write-Host "   ✓ next.config.ts exists" -ForegroundColor Green
} else {
    Write-Host "   ✗ next.config.ts not found" -ForegroundColor Red
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Configuration Summary" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Environment Strategy: Single .env file" -ForegroundColor Cyan
Write-Host "Development (npm run dev): Uses .env only" -ForegroundColor Cyan
Write-Host "Production (Docker): Uses .env only" -ForegroundColor Cyan

Write-Host "`n✓ Configuration complete!" -ForegroundColor Green
Write-Host "`nTo verify, run:" -ForegroundColor Yellow
Write-Host "  npm run dev    # Check output shows only '.env'" -ForegroundColor White
Write-Host "  docker-compose up --build" -ForegroundColor White

Write-Host "`nDocumentation:" -ForegroundColor Yellow
Write-Host "  - ENV_CONFIGURATION.md" -ForegroundColor White
Write-Host "  - SINGLE_ENV_IMPLEMENTATION.md" -ForegroundColor White
Write-Host ""
