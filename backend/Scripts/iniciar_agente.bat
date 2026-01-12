@echo off
REM ============================================================================
REM Sistema de Procesamiento Automático de Facturas Electrónicas
REM Lanzador Autoconfigurable con Instalación de Dependencias
REM Versión: 1.0
REM ============================================================================

setlocal enabledelayedexpansion

REM Configuración de rutas
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_NAME=procesador_facturas.py"
set "SCRIPT_PATH=%SCRIPT_DIR%%SCRIPT_NAME%"

echo ========================================================================
echo   SISTEMA DE PROCESAMIENTO AUTOMATICO DE FACTURAS ELECTRONICAS
echo ========================================================================
echo.

REM ============================================================================
REM PASO 1: Verificar que Python esté instalado
REM ============================================================================

echo [1/4] Verificando instalacion de Python...

python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Python no esta instalado o no esta en el PATH del sistema.
    echo.
    echo Por favor:
    echo   1. Descarga Python desde https://www.python.org/downloads/
    echo   2. Instala Python marcando la opcion "Add Python to PATH"
    echo   3. Reinicia la terminal y ejecuta este script nuevamente
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo    %PYTHON_VERSION% detectado correctamente
echo.

REM ============================================================================
REM PASO 2: Verificar si el script existe
REM ============================================================================

echo [2/4] Verificando script de procesamiento...

if not exist "%SCRIPT_PATH%" (
    echo.
    echo [ERROR] No se encuentra el script: %SCRIPT_NAME%
    echo Ruta esperada: %SCRIPT_PATH%
    echo.
    pause
    exit /b 1
)

echo    Script encontrado: %SCRIPT_NAME%
echo.

REM ============================================================================
REM PASO 3: Verificar e instalar dependencias
REM ============================================================================

echo [3/4] Verificando dependencias de Python...

REM Crear un pequeño script Python para verificar módulos
set "CHECK_SCRIPT=%TEMP%\check_modules.py"

(
echo import sys
echo try:
echo     import imapclient
echo     import lxml
echo     import dateutil
echo     print^("OK"^)
echo except ImportError as e:
echo     print^(f"MISSING: {e}"^)
echo     sys.exit^(1^)
) > "%CHECK_SCRIPT%"

REM Ejecutar verificación
python "%CHECK_SCRIPT%" >nul 2>&1

if errorlevel 1 (
    echo    Faltan dependencias. Instalando automaticamente...
    echo.
    
    echo    Instalando: imapclient
    python -m pip install --quiet imapclient
    if errorlevel 1 (
        echo    [WARNING] Error al instalar imapclient
    )
    
    echo    Instalando: lxml
    python -m pip install --quiet lxml
    if errorlevel 1 (
        echo    [WARNING] Error al instalar lxml
    )
    
    echo    Instalando: python-dateutil
    python -m pip install --quiet python-dateutil
    if errorlevel 1 (
        echo    [WARNING] Error al instalar python-dateutil
    )
    
    echo.
    echo    Dependencias instaladas correctamente
) else (
    echo    Todas las dependencias estan instaladas
)

REM Limpiar script temporal
del "%CHECK_SCRIPT%" >nul 2>&1

echo.

REM ============================================================================
REM PASO 4: Ejecutar el script de procesamiento
REM ============================================================================

echo [4/4] Ejecutando procesador de facturas...
echo ========================================================================
echo.

REM Ejecutar el script Python
python "%SCRIPT_PATH%"

REM Capturar código de salida
set EXIT_CODE=%errorlevel%

echo.
echo ========================================================================

REM ============================================================================
REM Gestión de cierre según resultado
REM ============================================================================

if %EXIT_CODE% equ 0 (
    echo.
    echo [EXITO] Procesamiento completado correctamente
    echo.
    echo Este script se cerrara automaticamente en 3 segundos...
    timeout /t 3 /nobreak >nul
    exit /b 0
) else (
    echo.
    echo [ERROR] El procesamiento termino con errores ^(codigo: %EXIT_CODE%^)
    echo.
    echo Revisa los logs para mas informacion:
    echo   - F:\1.Facturas\procesamiento_log.txt
    echo   - F:\1.Facturas\error_log.txt
    echo.
    echo Presiona cualquier tecla para cerrar...
    pause >nul
    exit /b %EXIT_CODE%
)
