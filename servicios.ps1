# Script de gestión de servicios Backend y Frontend - Gmail Invoice Processor
# Uso: .\servicios.ps1

# Función para arrancar el Backend
function Start-Backend {
    Write-Host "Iniciando Backend..." -ForegroundColor Cyan
    $rootDir = Get-Location
    $backendPath = Join-Path $rootDir "backend"
    
    if (-not (Test-Path $backendPath)) {
        Write-Error "No se encontró el directorio 'backend'"
        return
    }

    $backendCmd = "cd '$backendPath'; python -m uvicorn src.infrastructure.api.main:app --reload --host 0.0.0.0 --port 8002"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
    Write-Host "Backend iniciado en ventana separada (Puerto 8002)" -ForegroundColor Green
}

# Función para arrancar el Frontend
function Start-Frontend {
    Write-Host "Iniciando Frontend..." -ForegroundColor Cyan
    $rootDir = Get-Location
    $frontendPath = Join-Path $rootDir "frontend"

    if (-not (Test-Path $frontendPath)) {
        Write-Error "No se encontró el directorio 'frontend'"
        return
    }

    $frontendCmd = "cd '$frontendPath'; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
    Write-Host "Frontend iniciado en ventana separada" -ForegroundColor Green
}

# Función para arrancar ambos servicios
function Start-AllServices {
    Write-Host "Iniciando todos los servicios..." -ForegroundColor Cyan
    Start-Backend
    Start-Sleep -Seconds 2
    Start-Frontend
    Write-Host "Todos los servicios están arrancando." -ForegroundColor Green
}

# Función para terminar procesos Python (Backend)
function Stop-Backend {
    Write-Host "Terminando procesos del Backend (Python)..." -ForegroundColor Red
    $processes = Get-Process python -ErrorAction SilentlyContinue
    if ($processes) {
        Stop-Process -Name python -Force
        Write-Host "Procesos del Backend terminados." -ForegroundColor Green
    }
    else {
        Write-Host "No hay procesos del Backend activos." -ForegroundColor Yellow
    }
}

# Función para terminar procesos Node (Frontend)
function Stop-Frontend {
    Write-Host "Terminando procesos del Frontend (Node)..." -ForegroundColor Red
    $processes = Get-Process node -ErrorAction SilentlyContinue
    if ($processes) {
        Stop-Process -Name node -Force
        Write-Host "Procesos del Frontend terminados." -ForegroundColor Green
    }
    else {
        Write-Host "No hay procesos del Frontend activos." -ForegroundColor Yellow
    }
}

# Función para detener todos los servicios
function Stop-AllServices {
    Write-Host "Deteniendo todos los servicios..." -ForegroundColor Red
    Stop-Backend
    Stop-Frontend
    Write-Host "Todos los servicios han sido detenidos." -ForegroundColor Green
}

# Función para reiniciar Backend
function Restart-Backend {
    Stop-Backend
    Start-Sleep -Seconds 1
    Start-Backend
}

# Función para listar procesos Python activos
function Get-PythonProcesses {
    Write-Host "Buscando procesos Python..." -ForegroundColor Yellow
    $processes = Get-Process python -ErrorAction SilentlyContinue
    if ($processes) {
        $processes | Select-Object Id, ProcessName, StartTime, CPU, @{Name = "Memory(MB)"; Expression = { [math]::Round($_.WS / 1MB, 2) } } | Format-Table -AutoSize
    }
    else {
        Write-Host "No hay procesos Python activos" -ForegroundColor Green
    }
}

# Función para verificar el estado de los servicios
function Get-ServiceStatus {
    Write-Host ""
    Write-Host "===== ESTADO DE SERVICIOS =====" -ForegroundColor Cyan
    Write-Host ""
    
    # Verificar Backend (Python)
    Write-Host "BACKEND (Python/FastAPI):" -ForegroundColor Yellow
    $pythonProcesses = Get-Process python -ErrorAction SilentlyContinue
    if ($pythonProcesses) {
        Write-Host "  Estado: ACTIVO" -ForegroundColor Green
        Write-Host "  Procesos: $($pythonProcesses.Count)"
        $pythonProcesses | Select-Object Id, @{Name = "Uptime"; Expression = { (Get-Date) - $_.StartTime | ForEach-Object { "{0:hh\:mm\:ss}" -f $_ } } }, @{Name = "Memory(MB)"; Expression = { [math]::Round($_.WS / 1MB, 2) } } | Format-Table -AutoSize
    }
    else {
        Write-Host "  Estado: INACTIVO" -ForegroundColor Red
    }
    
    Write-Host ""
    
    # Verificar Frontend (Node)
    Write-Host "FRONTEND (Node/npm):" -ForegroundColor Yellow
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-Host "  Estado: ACTIVO" -ForegroundColor Green
        Write-Host "  Procesos: $($nodeProcesses.Count)"
        $nodeProcesses | Select-Object Id, @{Name = "Uptime"; Expression = { (Get-Date) - $_.StartTime | ForEach-Object { "{0:hh\:mm\:ss}" -f $_ } } }, @{Name = "Memory(MB)"; Expression = { [math]::Round($_.WS / 1MB, 2) } } | Format-Table -AutoSize
    }
    else {
        Write-Host "  Estado: INACTIVO" -ForegroundColor Red
    }
    
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
}

# Ayuda
# Menú Interactivo
function Show-Menu {
    Clear-Host
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "   GMAIL INVOICE PROCESSOR - SERVICIOS" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host " ESTADO" -ForegroundColor Yellow
    Write-Host "  1. Ver Estado de Servicios"
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
    Write-Host "  0. Salir"
    Write-Host "=============================================" -ForegroundColor Cyan
}

# Función para reiniciar todos los servicios
function Restart-AllServices {
    Write-Host "Reiniciando todos los servicios..." -ForegroundColor Cyan
    Stop-AllServices
    Start-Sleep -Seconds 2
    Start-AllServices
}

# Ejecución del menú una sola vez
Show-Menu
$selection = Read-Host " Seleccione una opción (0-10)"
Write-Host ""

switch ($selection) {
    '1' { Get-ServiceStatus }
    '2' { Start-AllServices }
    '3' { Stop-AllServices }
    '4' { Restart-AllServices }
    '5' { Start-Backend }
    '6' { Stop-Backend }
    '7' { Restart-Backend }
    '8' { Start-Frontend }
    '9' { Stop-Frontend }
    '10' { Restart-Frontend }
    '0' { Write-Host "Saliendo..." -ForegroundColor Gray; exit }
    default { Write-Host "Opción no válida." -ForegroundColor Red }
}
