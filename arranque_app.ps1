function Check-Docker {
    $dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
    if (-not $dockerProcess) {
        Write-Host "Docker Desktop not running. Starting it..." -ForegroundColor Cyan
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        Write-Host "Waiting for Docker..." -ForegroundColor Cyan
        do { Start-Sleep -Seconds 5; $dockerInfo = docker info 2>&1 } until ($LASTEXITCODE -eq 0)
        Write-Host "Docker is ready!" -ForegroundColor Cyan
    }
}

function Show-Status {
    Write-Host ""
    Write-Host "===== ESTADO DE CONTENEDORES =====" -ForegroundColor Cyan
    docker-compose ps
    Write-Host "==================================" -ForegroundColor Cyan
    Write-Host ""
}

Clear-Host
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "        MVTOS APP - DOCKER LAUNCHER          " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " ESTADO" -ForegroundColor Yellow
Write-Host "  1. Ver Estado de Contenedores"
Write-Host ""
Write-Host " TODOS LOS SERVICIOS" -ForegroundColor Yellow
Write-Host "  2. Iniciar Todos"
Write-Host "  3. Detener Todos"
Write-Host "  4. Reiniciar Todos"
Write-Host ""
Write-Host " BACKEND" -ForegroundColor Yellow
Write-Host "  5. Iniciar Backend"
Write-Host "  6. Detener Backend"
Write-Host "  7. Reiniciar Backend"
Write-Host ""
Write-Host " FRONTEND" -ForegroundColor Yellow
Write-Host "  8. Iniciar Frontend"
Write-Host "  9. Detener Frontend"
Write-Host " 10. Reiniciar Frontend"
Write-Host ""
Write-Host " MANTENIMIENTO" -ForegroundColor Yellow
Write-Host " 11. Limpiar Cache Docker & Reconstruir"
Write-Host " 12. Ver Logs (Ctrl+C para salir)"
Write-Host ""
Write-Host "  0. Salir"
Write-Host "=============================================" -ForegroundColor Cyan

$choice = Read-Host " Seleccione una opción (0-12)"

switch ($choice) {
    "1" {
        Show-Status
    }
    "2" {
        Check-Docker
        Write-Host "Iniciando TODOS los servicios..." -ForegroundColor Green
        docker-compose up -d --build
    }
    "3" {
        Write-Host "Deteniendo todos los contenedores..." -ForegroundColor Yellow
        docker-compose down
    }
    "4" {
        Write-Host "Reiniciando todos los servicios..." -ForegroundColor Yellow
        docker-compose down
        Check-Docker
        docker-compose up -d --build
    }
    "5" {
        Check-Docker
        Write-Host "Iniciando Backend..." -ForegroundColor Green
        docker-compose up -d --build backend
    }
    "6" {
        Write-Host "Deteniendo Backend..." -ForegroundColor Yellow
        docker-compose stop backend
    }
    "7" {
        Write-Host "Reiniciando Backend..." -ForegroundColor Yellow
        docker-compose restart backend
    }
    "8" {
        Check-Docker
        Write-Host "Iniciando Frontend..." -ForegroundColor Green
        docker-compose up -d --build frontend
    }
    "9" {
        Write-Host "Deteniendo Frontend..." -ForegroundColor Yellow
        docker-compose stop frontend
    }
    "10" {
        Write-Host "Reiniciando Frontend..." -ForegroundColor Yellow
        docker-compose restart frontend
    }
    "11" {
        Write-Host "Limpiando cache y reconstruyendo..." -ForegroundColor Yellow
        docker builder prune -af
        Check-Docker
        docker-compose up -d --build
    }
    "12" {
        Write-Host "Mostrando logs (Ctrl+C para salir)..." -ForegroundColor Cyan
        docker-compose logs -f
    }
    "0" {
        Write-Host "Saliendo..." -ForegroundColor Gray
        exit
    }
    Default {
        Write-Host "Opción no válida." -ForegroundColor Red
    }
}
