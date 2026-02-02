# Script para sincronizar cambios con GitHub
# Repositorio: https://github.com/SergioLalinde59/Facturas

$ErrorActionPreference = "Stop"

Clear-Host
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Sincronizacion con GitHub" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Mostrar informacion del ultimo push/commit
Write-Host "Ultimo commit registrado:" -ForegroundColor Magenta
try {
    $formatString = "%h - %s (%cr)"
    $ultimoCommit = git log -1 --pretty=format:$formatString 2>$null
    if ($ultimoCommit) {
        Write-Host "   $ultimoCommit" -ForegroundColor White
    } else {
        Write-Host "   No hay commits previos" -ForegroundColor Gray
    }
} catch {
    Write-Host "   No se pudo obtener informacion del ultimo commit" -ForegroundColor Gray
}
Write-Host ""
Write-Host "------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# 1. Pedir descripcion para la actualizacion
$descripcion = Read-Host "Ingrese una descripcion para la actualizacion"

# Validar descripcion
if ([string]::IsNullOrWhiteSpace($descripcion)) {
    Write-Host "Error: La descripcion no puede estar vacia." -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 1
}

try {
    # 2. Agregar todos los cambios
    Write-Host "1. Agregando cambios..." -ForegroundColor Yellow
    git add .

    # 3. Realizar commit
    Write-Host "2. Confirmando cambios (Commit)..." -ForegroundColor Yellow
    
    $commitOutput = git commit -m "$descripcion" 2>&1
    if ($LASTEXITCODE -ne 0) {
        if ($commitOutput -match "nothing to commit") {
            Write-Host "No hay cambios nuevos para confirmar." -ForegroundColor Yellow
        }
        else {
            throw "Error en git commit: $commitOutput"
        }
    }
    else {
        Write-Host "   Commit realizado: $descripcion" -ForegroundColor Green
    }

    # 4. Enviar cambios (Push)
    Write-Host "3. Enviando cambios a GitHub (Push)..." -ForegroundColor Yellow
    git push origin main

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Actualizacion completada exitosamente." -ForegroundColor Green
    }
    else {
        throw "Error al ejecutar git push."
    }

}
catch {
    Write-Host ""
    Write-Host "Ocurrio un error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Presione cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
