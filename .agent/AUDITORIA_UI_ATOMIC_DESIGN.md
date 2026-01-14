# 📋 AUDITORÍA COMPLETA DE UI - ATOMIC DESIGN

## 🎯 Objetivo
Identificar todos los componentes UI del proyecto para refactorizar con metodología Atomic Design.

---

## 📊 INVENTARIO POR VISTA

### 1️⃣ **DASHBOARD**
**Ubicación:** Vista principal al abrir la app
**Elementos identificados:**
- [ ] **Cards de estadísticas** (7 tarjetas)
  - Total Facturas
  - Total Proveedores
  - NITs Únicos
  - Subtotal Total
  - Descuentos Total
  - IVA Total
  - Total General
- [ ] **Rango de fechas** (badge informativo)
- [ ] **Estado de carga** (loading spinner)
- [ ] **Layout en grid** (2 filas: 4 cols + 4 cols)

**Componentes a crear:**
- `StatCard` - Tarjeta de estadística con icono, label y valor
- `LoadingSpinner` - Spinner de carga
- `Badge` - Indicador de información (rango de fechas)

---

### 2️⃣ **EXTRAER DE GMAIL**
**Ubicación:** Menú → Extraer de Gmail
**Elementos identificados:**
- [ ] **Input de directorio** (con botón browse)
- [ ] **Input numérico** (máximo de correos)
- [ ] **Botón de acción principal** ("Extraer Facturas")
- [ ] **Indicador de estado** (idle/loading/success/error)
- [ ] **Card de resultados** con:
  - Estadísticas de procesamiento (5 métricas)
  - Mensaje de resultado
- [ ] **Tabla de detalles** con columnas:
  - Fecha
  - Emisor
  - Asunto
  - Archivos
  - Estado
- [ ] **Sorting en tabla** (columnas clickeables)
- [ ] **Badges de estado** (Éxito/Error/Vacío)

**Componentes a crear:**
- `DirectoryInput` - Input con botón de browse
- `NumberInput` - Input numérico con label
- `Button` - Botón reutilizable (primary/secondary/ghost)
- `StatusMessage` - Mensaje con icono según estado
- `SummaryCard` - Card de resumen con estadísticas
- `DataTable` - Tabla genérica con sorting
- `TableHeader` - Header de tabla con icono de sorting
- `StatusBadge` - Badge de estado colorizado

---

### 3️⃣ **CARGA BASE DATOS**
**Ubicación:** Menú → Carga Base Datos
**Elementos identificados:**
- [ ] **Input de directorio** (con botón browse)
- [ ] **Botones de filtros rápidos** (8 opciones):
  - Mes Actual
  - Mes Ant.
  - Últ. 3 Meses
  - Últ. 6 Meses
  - YTD
  - Año Ant.
  - 12 Meses
- [ ] **Filtros de fecha** (Desde/Hasta)
- [ ] **Select de proveedor**
- [ ] **Botón "Previsualizar"**
- [ ] **Card "Modo Previsualización"** con:
  - Mensaje informativo
  - Botones: Cancelar / Confirmar Carga
- [ ] **Tarjetas de estadísticas** (8 tarjetas):
  - Total Leídos
  - Duplicados
  - Para Importar / Importados
  - Errores
  - Subtotal Total
  - Descuentos Total
  - IVA Total
  - Total General
- [ ] **Tabla de detalles** con columnas:
  - Fecha
  - Emisor
  - NIT
  - Factura
  - Subtotal
  - Descuentos
  - IVA
  - Total
  - Archivo XML
  - Estado
- [ ] **Sorting en todas las columnas**

**Componentes a crear:**
- `QuickFilterButton` - Botón de filtro rápido con estado activo
- `DateInput` - Input de fecha con label e icono
- `Select` - Dropdown reutilizable
- `PreviewModeCard` - Card especial de modo previsualización
- `ImportStatCard` - Tarjeta de estadística de importación
- `ImportTable` - Tabla de registros de importación

---

### 4️⃣ **EXPORTAR FACTURAS**
**Ubicación:** Menú → Exportar Facturas
**Elementos identificados:**
- [ ] **Input de directorio** (salida)
- [ ] **Filtros de fecha** (Desde/Hasta)
- [ ] **Select de proveedor**
- [ ] **Checkboxes de formato**:
  - CSV
  - Excel
  - PDF
- [ ] **Botón "Exportar Facturas"**
- [ ] **Indicador de estado**
- [ ] **Mensaje de resultado**

**Componentes a crear:**
- `Checkbox` - Checkbox reutilizable con label
- `FormatSelector` - Grupo de checkboxes de formatos

---

### 5️⃣ **REPORTE DE FACTURAS**
**Ubicación:** Menú → Reporte de Facturas
**Elementos identificados:**
- [ ] **Botones de filtros rápidos** (mismos 8 que Carga BD)
- [ ] **Filtros de fecha** (Desde/Hasta)
- [ ] **Select de proveedor**
- [ ] **Tabla de facturas** con columnas:
  - Fecha
  - Proveedor
  - NIT
  - Factura
  - Subtotal
  - Descuentos
  - IVA
  - Total
- [ ] **Sorting en todas las columnas**
- [ ] **Mensaje de resultados** ("Se encontraron X facturas")

**Componentes a crear:**
- `ReportTable` - Tabla de reporte (similar a ImportTable)
- `ResultMessage` - Mensaje de cantidad de resultados

---

## 🧩 COMPONENTES GLOBALES COMUNES

### **Elementos compartidos en todas las vistas:**
- [ ] **Sidebar de navegación** con:
  - Logo/título
  - Items de menú con iconos
  - Estados activo/inactivo
- [ ] **Contenedor principal** (layout)
- [ ] **Encabezado de vista** con título e ícono

**Componentes a crear:**
- `Sidebar` - Barra lateral de navegación
- `NavItem` - Item de navegación con icono
- `ViewHeader` - Encabezado de vista
- `PageLayout` - Layout principal de página

---

## 📦 RESUMEN DE COMPONENTES A CREAR

### **ATOMS** (Elementos básicos - 15 componentes)
1. `Button` - Botón genérico con variantes
2. `Input` - Input de texto genérico
3. `DateInput` - Input de fecha
4. `NumberInput` - Input numérico
5. `Checkbox` - Checkbox con label
6. `Select` - Dropdown/Select
7. `Badge` - Indicador de información
8. `StatusBadge` - Badge de estado colorizado
9. `Icon` - Wrapper de iconos Lucide
10. `LoadingSpinner` - Spinner de carga
11. `Label` - Label reutilizable
12. `DirectoryBrowseButton` - Botón de explorar directorio
13. `SortIcon` - Ícono de ordenamiento (↑↓)
14. `StatusIcon` - Ícono de estado (✓✗⚠)
15. `Tooltip` - Tooltip para información adicional

### **MOLECULES** (Combinaciones simples - 10 componentes)
1. `DateRangeFilter` - Par de inputs Desde/Hasta
2. `ProviderFilter` - Label + Select de proveedores
3. `QuickFilterButton` - Botón de filtro con estado activo
4. `DirectoryInput` - Input + botón de browse
5. `FormatSelector` - Grupo de checkboxes de formatos
6. `StatCard` - Tarjeta de estadística (icono + label + valor)
7. `SummaryMetric` - Métrica de resumen en línea
8. `ResultMessage` - Mensaje con contador de resultados
9. `StatusMessage` - Mensaje con icono de estado
10. `TableHeaderCell` - Celda de header con sorting

### **ORGANISMS** (Secciones complejas - 8 componentes)
1. `FilterBar` - Barra completa de filtros (rápidos + fechas + proveedor)
2. `PreviewModeCard` - Card de modo previsualización con acciones
3. `StatCardGrid` - Grid de tarjetas de estadísticas
4. `DataTable` - Tabla genérica con sorting y columnas configurables
5. `ProcessLogTable` - Tabla de log de procesos
6. `ImportTable` - Tabla de registros de importación
7. `ReportTable` - Tabla de reporte de facturas
8. `Sidebar` - Barra lateral de navegación completa

### **TEMPLATES** (Layouts de página - 3 componentes)
1. `DashboardLayout` - Layout del dashboard
2. `ProcessLayout` - Layout para vistas de proceso (extract/import/export)
3. `ReportLayout` - Layout para vista de reporte

---

## 🎨 TOKENS DE DISEÑO A DEFINIR

### **Colores**
```css
--primary-color
--secondary-color
--accent-color
--success-color
--warning-color
--error-color
--info-color
--text-primary
--text-secondary
--bg-primary
--bg-secondary
--border-color
```

### **Espaciado**
```css
--spacing-xs: 0.25rem
--spacing-sm: 0.5rem
--spacing-md: 1rem
--spacing-lg: 1.5rem
--spacing-xl: 2rem
```

### **Tipografía**
```css
--font-size-xs: 0.75rem
--font-size-sm: 0.875rem
--font-size-md: 1rem
--font-size-lg: 1.125rem
--font-size-xl: 1.25rem
--font-size-2xl: 1.5rem
```

### **Sombras**
```css
--shadow-sm
--shadow-md
--shadow-lg
```

### **Radios de borde**
```css
--radius-sm: 6px
--radius-md: 10px
--radius-lg: 12px
```

---

## 📝 NOTAS IMPORTANTES

### **Prioridades de refactorización:**
1. **Alta**: Componentes compartidos entre múltiples vistas (FilterBar, DataTable)
2. **Media**: Componentes específicos pero reutilizables (StatCard, PreviewModeCard)
3. **Baja**: Componentes muy específicos de una sola vista

### **Estado compartido:**
- Los componentes deberán recibir `props` y emitir `callbacks`
- La lógica de estado permanece en `App.tsx` (por ahora)
- Futura migración a Context API o Redux si es necesario

### **Comportamientos críticos a preservar:**
- Sorting en tablas (con persistencia de estado)
- Filtros rápidos actualizan fechas automáticamente
- Modo previsualización en Carga BD
- Actualización automática de proveedores según filtros de fecha (solo en Report/Export)

---

## ✅ CRITERIOS DE ACEPTACIÓN

Cada componente debe:
- ✅ Ser 100% reutilizable
- ✅ Tener props bien definidas con TypeScript
- ✅ Usar tokens de diseño (variables CSS)
- ✅ Ser responsivo
- ✅ Mantener la funcionalidad actual
- ✅ Estar documentado (comentarios JSDoc)

---

**Fecha de auditoría:** 2026-01-14
**Total de componentes a crear:** 36 componentes
**Total de vistas a refactorizar:** 5 vistas
