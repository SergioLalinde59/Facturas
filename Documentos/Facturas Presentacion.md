# Facturas - Sistema de Gestión de Facturación Electrónica

## El Problema

Las empresas colombianas reciben decenas de facturas electrónicas por correo cada mes. Gestionarlas manualmente implica:

- Descargar archivos XML/PDF uno por uno
- Extraer datos de cada factura a mano
- Verificar impuestos y retenciones
- Consolidar información en hojas de cálculo
- Generar reportes para contabilidad

**Resultado**: horas de trabajo repetitivo, errores humanos y falta de visibilidad financiera.

---

## La Solución

Sistema integral que **automatiza todo el ciclo** de la factura electrónica: desde la extracción del correo hasta el reporte final.

---

## Funcionalidades Principales

### 1. Extracción Automática desde Gmail

- Conexión segura vía OAuth con Gmail
- Escaneo automático de correos con facturas adjuntas
- Extracción de archivos XML y PDF (incluyendo ZIPs)
- Progreso en tiempo real con estadísticas
- Marcado automático de correos procesados

### 2. Procesamiento Inteligente de Facturas

- Lectura automática de XML estándar UBL (DIAN)
- Extracción de datos clave: proveedor, NIT, número de factura, fecha
- Desglose financiero completo: subtotal, descuentos, impuestos, retenciones, total
- Detección de duplicados por NIT + número de factura
- Validación de consistencia financiera antes de importar
- Vista previa (dry-run) antes de confirmar la carga

### 3. Dashboard Analítico

- Métricas clave: total facturas, proveedores, rango de fechas
- Composición financiera (subtotal, descuentos, impuestos, retenciones)
- Top 10 proveedores por monto
- Tendencia mensual de facturación
- Filtros por rango de fechas (7 presets + personalizado)

### 4. Reportes y Consultas

- Búsqueda con filtros por fecha y proveedor
- Tabla ordenable con detalle completo
- Vista de detalle con desglose de impuestos
- Visualización directa del PDF original

### 5. Exportación Multi-formato

- **Excel** (.xlsx) - para análisis en hojas de cálculo
- **CSV** - para integración con otros sistemas
- **PDF** - para archivo y presentación
- Filtros por fecha y proveedor aplicados a la exportación

### 6. Configuración Tributaria

- Maestro de impuestos con códigos DIAN
- Agrupaciones de impuestos (suma, resta, ignora)
- Tarifas configurables por tipo de impuesto
- Adaptable a cambios normativos

---

## Arquitectura Técnica

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, TypeScript, TailwindCSS |
| Backend | Python, FastAPI |
| Base de Datos | PostgreSQL 18 |
| Despliegue | Docker Compose |

- **Arquitectura hexagonal**: separación clara entre lógica de negocio e infraestructura
- **Streaming en tiempo real**: progreso visible durante extracciones largas
- **Sin ORM**: consultas SQL optimizadas para máximo rendimiento

---

## Flujo de Trabajo Típico

```
Gmail → Extracción automática → Vista previa → Carga a BD → Dashboard → Reportes → Exportación
```

1. **Extraer**: Un clic para escanear el correo y descargar facturas
2. **Revisar**: Vista previa con validación antes de importar
3. **Analizar**: Dashboard con métricas y gráficos actualizados
4. **Reportar**: Consultas filtradas y exportación en el formato que necesite

---

## Beneficios Clave

- **Ahorro de tiempo**: de horas a minutos en el procesamiento mensual
- **Cero errores de transcripción**: lectura directa del XML oficial
- **Visibilidad inmediata**: dashboard con el estado financiero actualizado
- **Cumplimiento DIAN**: compatible con el estándar UBL de facturación electrónica colombiana
- **Escalable**: maneja desde decenas hasta miles de facturas mensuales
- **Portable**: despliegue con Docker en cualquier servidor