# Plan de Mejoras y Sugerencias - Sistema de Facturas Electrónicas

Este documento detalla oportunidades de mejora para elevar la calidad, mantenibilidad y escalabilidad del sistema de gestión de facturas electrónicas colombianas.

## 1. Frontend: Evolución y Diseño

### ✅ Adopción de Atomic Design (Completado)
Se ha implementado una estructura clara:
- **Atoms**: `Button`, `Input`, `Select`, `Badge`, `CurrencyValue`.
- **Molecules**: `DateRangeFilter`, `DirectoryInput`, `QuickFilterButton`, `StatCard`.
- **Organisms**: `Sidebar`, `FilterBar`, `StatCardGrid`, `DetailModal`, `TaxClassificationModal`.

### ✅ Gestión de Estado con TanStack Query (Completado)
Se migró la lógica de fetch y cache manual a `useQuery` y `useMutation`.
- Catálogos de impuestos y agrupaciones cacheados automáticamente.
- Invalidación de queries tras ediciones exitosas.

### ✅ Separación de Páginas por Dominio (Completado)
Cada módulo tiene su propia página dedicada:
- Dashboard, Extracción, Importación, Exportación, Reportes.
- Configuración: TaxMaster, TaxRates, Groupings.

### 🔴 Sugerencia: Modo Oscuro
Aprovechar Tailwind CSS 4 para implementar un modo oscuro nativo usando `dark:` variants.

### 🔴 Sugerencia: Pruebas de Componentes
Implementar tests unitarios para los átomos y moléculas más críticos (e.g., `CurrencyValue`, `StatCard`) usando **Vitest** y **React Testing Library**.

### 🔴 Sugerencia: Virtualización de Listas
Implementar virtualización con `react-window` o `@tanstack/react-virtual` para manejar eficientemente listados grandes de facturas.

## 2. Backend: Robustez y Calidad

### ✅ Arquitectura Hexagonal (Completado)
Clara separación en capas:
- **Domain**: Modelos (`Invoice`, `Tax`, `TaxRate`, `Grouping`) y Puertos.
- **Application**: Servicios de negocio (`InvoiceProcessorService`, `ExporterService`, `TaxService`).
- **Infrastructure**: Repositorios PostgreSQL, API FastAPI, Integración Gmail.

### ✅ Motor de Impuestos DIAN (Completado)
Sistema configurable para clasificar códigos tributarios colombianos:
- Mapeo de códigos DIAN a nombres descriptivos.
- Agrupaciones contables (suma, resta, ignora).
- Soporte para múltiples tasas por impuesto.

### ✅ Integración con Gmail API (Completado)
Extracción automática de facturas desde correo electrónico:
- Autenticación OAuth2.
- Parsing de adjuntos ZIP/XML.
- Etiquetado automático de correos procesados.

### 🔴 Sugerencia: Pruebas Unitarias del Dominio
El `InvoiceProcessorService` contiene lógica de parsing XML crítica. Se recomienda crear una suite de pruebas con **Pytest** y mocks para los servicios externos.

### 🔴 Sugerencia: Logging Estructurado
Migrar el logging actual a `structlog` o `loguru` para facilitar el rastreo de errores en producción y auditorías del procesamiento de facturas.

### 🔴 Sugerencia: Validación de XML más Robusta
Implementar validación contra esquemas XSD oficiales de la DIAN para detectar facturas malformadas antes del procesamiento.

## 3. Código y Patrones (Mantenimiento Continuo)

### ✅ Servicios Frontend Separados por Dominio (Completado)
- `TaxService.ts`: CRUD de impuestos.
- `TaxRateService.ts`: CRUD de tasas.
- `GroupingService.ts`: CRUD de agrupaciones.

### ✅ Tipos TypeScript Centralizados (Completado)
Interfaces bien definidas en `types/index.ts`:
- `Invoice`, `DashboardStats`, `ProcessingStats`, `ImportStats`.
- Tipos de vistas y ordenamiento.

### 🔴 Sugerencia: API Client Centralizado
Considerar crear un cliente API centralizado usando Axios con interceptores para manejo de errores y autenticación.

### 🔴 Sugerencia: Validación de Formularios
Implementar validación robusta con `zod` o `yup` para los formularios de configuración de impuestos.

## 4. Historial de Logros (Checklist)

1.  ✅ **Arquitectura Hexagonal Backend**: Separación clara en Domain, Application, Infrastructure.
2.  ✅ **Atomic Design Frontend**: Atoms, Molecules, Organisms bien definidos.
3.  ✅ **React Query**: Implementado para catálogos y mutaciones.
4.  ✅ **Motor de Impuestos DIAN**: Configuración flexible de códigos tributarios colombianos.
5.  ✅ **Integración Gmail**: Extracción automática con OAuth2 y SSE para progreso.
6.  ✅ **Exportación Multi-formato**: Excel, CSV, PDF con filtros avanzados.
7.  ✅ **Docker Ready**: Dockerfiles para desarrollo y producción.
8.  ✅ **Tipado Estricto**: TypeScript en frontend, Pydantic en backend.

## 5. Próximos Pasos Estratégicos

1.  **Observabilidad**: Integrar Sentry para capturar errores en el parsing de XML y la integración con Gmail.
2.  **Reportes Avanzados**: Dashboard con gráficos de tendencias por proveedor, comparativos mensuales.
3.  **Notificaciones**: Alertas por email cuando se detecten facturas con impuestos desconocidos.
4.  **Seguridad**: Implementar autenticación si la aplicación se vuelve multiusuario.
5.  **Conciliación**: Módulo para cruzar facturas importadas contra la contabilidad real.
6.  **Backup Automático**: Script para respaldo periódico de la base de datos PostgreSQL.





