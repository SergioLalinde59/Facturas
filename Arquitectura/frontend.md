# Documentación del Frontend - Sistema de Facturas Electrónicas

## Stack Tecnológico

El frontend es una Single Page Application (SPA) moderna construida con el ecosistema de React para la gestión de facturas electrónicas colombianas.

*   **Core**: React 19 (v19.2.3)
*   **Lenguaje**: TypeScript (~5.9.3)
*   **Empaquetador/Build Tool**: Vite (v7.2.4)
*   **Estilos**: Tailwind CSS (v4.1.18) con plugin de Vite
*   **Enrutamiento**: React Router DOM (v7.11.0)
*   **Estado y Data Fetching**: TanStack Query (v5.90.16)
*   **HTTP Client**: Axios (v1.13.4)

### Librerías Clave

*   **UI/Iconos**: `lucide-react` (v0.562.0)
*   **Visualización de Datos**: `recharts` (v3.6.0) - Gráficos estadísticos para dashboards
*   **Manejo de Archivos**:
    *   `xlsx` (v0.18.5): Exportación a Excel.
    *   `jspdf` (v4.0.0), `jspdf-autotable` (v5.0.7): Generación de reportes PDF.
*   **Notificaciones**: `react-hot-toast` (v2.6.0)

## Arquitectura (Atomic Design)

El proyecto ha adoptado una estructura modular basada en **Atomic Design** para mejorar la reutilización y mantenibilidad.

### Estructura de Directorios (`src/`)

*   **`pages/`**: Vistas completas que representan cada módulo de la aplicación:
    *   `DashboardPage.tsx`: Vista principal con estadísticas y gráficos de facturas.
    *   `ExtractionPage.tsx`: Extracción automática de facturas desde Gmail.
    *   `ImportPage.tsx`: Importación manual de archivos XML de facturas.
    *   `ExportPage.tsx`: Exportación de facturas a Excel/CSV/PDF.
    *   `ReportPage.tsx`: Generación de reportes personalizados.
    *   `TaxMasterPage.tsx`: Configuración del maestro de impuestos DIAN.
    *   `TaxRatesPage.tsx`: Gestión de tasas de impuestos (IVA, ReteFuente, etc.).
    *   `GroupingsPage.tsx`: Configuración de agrupaciones contables.

*   **`components/`**: Organizados por nivel de complejidad (Atomic Design):
    *   **`atoms/`**: Componentes base indivisibles:
        *   `Button/`: Botones con variantes y estados.
        *   `Input/`: Campos de entrada de texto.
        *   `Select/`: Selectores dropdown.
        *   `Badge/`: Etiquetas de estado visuales.
        *   `CurrencyValue/`: Formateo de valores monetarios (COP).
    *   **`molecules/`**: Combinaciones de átomos con lógica simple:
        *   `DateRangeFilter/`: Selector de rango de fechas.
        *   `DirectoryInput/`: Input para rutas de directorios.
        *   `QuickFilterButton/`: Botones de filtro rápido.
        *   `StatCard/`: Tarjetas de estadísticas individuales.
    *   **`organisms/`**: Componentes complejos con lógica de negocio:
        *   `Sidebar/`: Navegación lateral de la aplicación.
        *   `FilterBar/`: Barra de filtros avanzados.
        *   `StatCardGrid/`: Grid de tarjetas de estadísticas.
        *   `DetailModal.tsx`: Modal para ver detalles de factura.
        *   `TaxClassificationModal.tsx`: Modal para clasificación de impuestos.

*   **`services/`**: Capa de comunicación con el Backend (API REST):
    *   `TaxService.ts`: CRUD de configuración de impuestos DIAN.
    *   `TaxRateService.ts`: CRUD de tasas de impuestos.
    *   `GroupingService.ts`: CRUD de agrupaciones contables.

*   **`hooks/`**: Custom React Hooks:
    *   `useDateFilters.ts`: Hook para gestión de filtros de fecha.

*   **`types/`**: Definiciones de tipos TypeScript centralizadas:
    *   `index.ts`: Interfaces principales (`Invoice`, `DashboardStats`, `ProcessingStats`, etc.).

*   **`utils/`**: Funciones utilitarias (formateo, validación, etc.).

*   **`styles/`**: Estilos globales y configuración de Tailwind.

## Integración y Estado

### TanStack Query
Se utiliza para toda la comunicación con la API:
*   **Cacheo Automático**: Los catálogos (Impuestos, Agrupaciones, Tasas) se cachean automáticamente.
*   **Sincronización**: Las mutaciones invalidan las queries relacionadas para mantener la UI actualizada.
*   **Estados de Loading/Error**: Manejo consistente de estados asíncronos.

### Comunicación con Backend
*   **Proxy de Vite**: Las llamadas a `/api/*` se proxean al backend (configurable en `vite.config.ts`).
*   **Streaming SSE**: La extracción de facturas desde Gmail usa Server-Sent Events para mostrar progreso en tiempo real.

### Componentes Clave

*   **`Sidebar`**: Navegación principal con secciones colapsables (Principal, Procesos, Reportes, Configuración).
*   **`StatCardGrid`**: Grid de métricas con totales de facturas, subtotales, impuestos y retenciones.
*   **`DetailModal`**: Modal para visualizar el detalle completo de una factura incluyendo desglose de impuestos.
*   **`TaxClassificationModal`**: Modal para configurar la clasificación de códigos de impuestos desconocidos.

## Vistas Principales

### Dashboard
*   Estadísticas generales: total facturas, subtotal, impuestos, retenciones.
*   Gráficos de distribución por proveedor y por mes.
*   Filtros por rango de fechas.

### Extracción (Gmail)
*   Conexión OAuth2 con Gmail.
*   Búsqueda de correos con facturas adjuntas.
*   Procesamiento en tiempo real con SSE.
*   Movimiento automático de correos procesados.

### Importación Manual
*   Drag & drop de archivos XML.
*   Validación de formato UBL 2.1.
*   Detección de duplicados.

### Configuración de Impuestos
*   Maestro de códigos DIAN (01=IVA, 04=ICA, 05=ReteIVA, etc.).
*   Asignación de agrupaciones contables.
*   Gestión de tasas por impuesto.

## Docker y Despliegue

*   **Dockerfile**: Build multi-stage con Node.js y Nginx.
*   **Dockerfile.dev**: Configuración para desarrollo con hot-reload.
*   **nginx.conf**: Proxy reverso al backend y SPA routing.

