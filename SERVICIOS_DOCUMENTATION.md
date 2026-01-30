# Documentación de Servicios (servicios.ps1)

Este documento describe la funcionalidad de cada opción disponible en el menú interactivo del script `servicios.ps1`.

## Descripción General
El script `servicios.ps1` está diseñado para gestionar el ciclo de vida de los servicios Backend y Frontend de la aplicación **Gmail Invoice Processor**. Permite iniciar, detener, reiniciar y verificar el estado de los servicios.

## Opciones del Menú

### 1. Iniciar Todos los Servicios
*   **Función interna:** `Start-AllServices`
*   **Descripción:** Esta opción inicia tanto el backend como el frontend.
*   **Comportamiento detallado:**
    1.  Ejecuta la función para iniciar el Backend.
    2.  Espera 2 segundos.
    3.  Ejecuta la función para iniciar el Frontend.
*   **Resultado:** Se abren dos nuevas ventanas de terminal, una para cada servicio.

### 2. Iniciar Backend
*   **Función interna:** `Start-Backend`
*   **Descripción:** Inicia únicamente el servicio del servidor Backend (API).
*   **Comportamiento detallado:**
    1.  Verifica la existencia del directorio `backend`.
    2.  Navega al directorio `backend`.
    3.  Ejecuta el servidor `uvicorn` (`python -m uvicorn src.infrastructure.api.main:app --reload --host 0.0.0.0 --port 8002`).
*   **Resultado:** Se abre una nueva ventana de terminal ejecutando el servidor en el puerto 8002.

### 3. Iniciar Frontend
*   **Función interna:** `Start-Frontend`
*   **Descripción:** Inicia únicamente el servicio de interfaz de usuario Frontend.
*   **Comportamiento detallado:**
    1.  Verifica la existencia del directorio `frontend`.
    2.  Navega al directorio `frontend`.
    3.  Ejecuta `npm run dev` para levantar el servidor de desarrollo.
*   **Resultado:** Se abre una nueva ventana de terminal con el servidor de desarrollo del frontend.

### 4. Ver Estado de Servicios
*   **Función interna:** `Get-ServiceStatus`
*   **Descripción:** Muestra un reporte actual de los procesos relacionados con la aplicación.
*   **Comportamiento detallado:**
    1.  **Backend (Python/FastAPI):** Busca procesos `python` activos, mostrando su ID, Tiempo de actividad (Uptime) y uso de memoria.
    2.  **Frontend (Node/npm):** Busca procesos `node` activos, mostrando su ID, Tiempo de actividad y uso de memoria.
*   **Resultado:** Imprime en la consola actual una tabla con el estado (ACTIVO/INACTIVO) y detalles de los procesos.

### 5. Detener Backend
*   **Función interna:** `Stop-Backend`
*   **Descripción:** Detiene la ejecución del servidor Backend.
*   **Comportamiento detallado:**
    1.  Busca todos los procesos con nombre `python`.
    2.  Si existen, los detiene forzosamente (`Stop-Process -Force`).
*   **Resultado:** Los procesos de Python se terminan, cerrando efectivamente el servidor backend.

### 6. Reiniciar Backend
*   **Función interna:** `Restart-Backend`
*   **Descripción:** Realiza un reinicio rápido del servicio Backend.
*   **Comportamiento detallado:**
    1.  Llama a `Stop-Backend` para detener los procesos actuales.
    2.  Espera 1 segundo.
    3.  Llama a `Start-Backend` para iniciar nuevamente el servicio.
*   **Resultado:** El backend se detiene y se vuelve a abrir en una nueva ventana.
