Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " RECUERDA: Asegúrate de que DOCKER DESKTOP esté abierto." -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Levantamos el Puente Lógico (LocalServer)
$localServerPath = "F:\1. Cloud\4. AI\1. Antigravity\ConciliacionWeb\LocalServer"
Write-Host "Verificando el Puente Lógico (LocalServer)..." -ForegroundColor Yellow
if (Test-Path $localServerPath) {
    # Guardamos la carpeta actual para volver luego
    $currentDir = Get-Location
    Set-Location $localServerPath
    docker-compose up -d 2>$null
    Set-Location $currentDir
    Write-Host "Puente Lógico activo." -ForegroundColor Green
}
else {
    Write-Host "ADVERTENCIA: No se encontró la carpeta del LocalServer en $localServerPath" -ForegroundColor Red
}

# 2. Run docker-compose - SOLAMENTE BACKEND
Write-Host "`nRestarting Backend in Docker..."
docker-compose down 2>$null
docker-compose up -d --build backend

# Vite (Frontend dev) - Forzamos 127.0.0.1 para evitar error EACCES de IPv6
Write-Host "Starting Vite on port 5174 (Forcing 127.0.0.1)..."
$old = Get-NetTCPConnection -LocalPort 5174 -ErrorAction SilentlyContinue
if ($old) { 
    Write-Host "Closing ghost process on port 5174..."
    Stop-Process -Id $old.OwningProcess -Force -ErrorAction SilentlyContinue 
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npx vite --port 5174 --host 127.0.0.1"

Write-Host "`nESPERA: Dándole 3 segundos a Docker para sincronizar la interfaz..."
Start-Sleep -Seconds 3

Write-Host "`nACCESO AL PROYECTO:" -ForegroundColor Green
Write-Host "Proxy Lógico: http://facturas.local" -ForegroundColor White
Write-Host "Vite Dev (HMR): http://localhost:5174" -ForegroundColor White

docker-compose logs --tail=50 -f
