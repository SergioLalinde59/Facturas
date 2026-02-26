# Refactoring: Eliminar tenant_id del schema supplier_invoice

**Fecha**: 2026-02-20
**Estado**: Propuesta
**Autor**: Análisis Claude Code

---

## Contexto

Las facturas de proveedor pertenecen a la **copropiedad** (property), no a la empresa administradora (tenant). Si una copropiedad cambia de administradora, el `tenant_id` cambia pero los datos deben permanecer intactos. Mantener `tenant_id` en las tablas obliga a migrar datos cada vez que cambia la administradora — una complejidad innecesaria.

**Decisión**: Eliminar `tenant_id` de TODAS las tablas del schema `supplier_invoice` y usar `property_id` como única clave de particionamiento.

**Seguridad**: Se mantiene via `@RequiresPermission` (JWT + permisos RBAC) + `PropertyContextService` (frontend solo muestra properties del tenant actual).

---

## Alcance del Cambio

| Capa | Archivos | Cambios |
|------|----------|---------|
| Flyway Migration | 1 nuevo (V11) | Drop tenant_id, add property_id a tax tables |
| Domain Aggregates | 5 | Reemplazar tenantId → propertyId |
| Domain Services | 1 | TaxResolutionService: tenantId → propertyId |
| Repository Ports | 5 | ~25 method signatures |
| Use Case Ports | 9 | ~40 method signatures |
| Use Case Impls | 9 | ~40 methods + lógica interna |
| JPA Entities | 6 | Remove @Filter, remove/replace tenant_id |
| JPA Repositories | 5 | JPQL queries: tenant_id → property_id |
| Persistence Adapters | 5 | Passthrough updates |
| Mappers | 5 | Remove tenantId mapping |
| DTOs | 2 | Remove tenantId field |
| REST Controllers | 9 | Remove SecurityUtils, add propertyId a tax endpoints |
| Angular Model | 1 | Remove tenantId field |
| Angular Service | 1 | Add propertyId a 13 tax endpoints |
| Angular Components | 1 | TaxConfigComponent: add PropertyContextService |
| **TOTAL** | **~65 archivos** | |

---

## Fase 1: Flyway Migration V11

**Archivo nuevo**: `V11__remove_tenant_id_use_property_id.sql`

```sql
-- ══════════════════════════════════════════════════════════════
-- V11: Remove tenant_id, use property_id as sole partitioning key
-- ══════════════════════════════════════════════════════════════

-- 1. tax_groupings: add property_id, remove tenant_id
ALTER TABLE supplier_invoice.tax_groupings ADD COLUMN property_id UUID;
UPDATE supplier_invoice.tax_groupings SET property_id = '00000000-0000-0000-0000-000000000000' WHERE property_id IS NULL;
ALTER TABLE supplier_invoice.tax_groupings ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE supplier_invoice.tax_groupings DROP CONSTRAINT uk_tax_grouping_tenant_name;
ALTER TABLE supplier_invoice.tax_groupings ADD CONSTRAINT uk_tax_grouping_property_name UNIQUE (property_id, name);
DROP INDEX IF EXISTS supplier_invoice.idx_tax_groupings_tenant;
CREATE INDEX idx_tax_groupings_property ON supplier_invoice.tax_groupings(property_id);
ALTER TABLE supplier_invoice.tax_groupings DROP COLUMN tenant_id;

-- 2. tax_codes: add property_id, remove tenant_id
ALTER TABLE supplier_invoice.tax_codes ADD COLUMN property_id UUID;
UPDATE supplier_invoice.tax_codes SET property_id = '00000000-0000-0000-0000-000000000000' WHERE property_id IS NULL;
ALTER TABLE supplier_invoice.tax_codes ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE supplier_invoice.tax_codes DROP CONSTRAINT uk_tax_code_tenant_code;
ALTER TABLE supplier_invoice.tax_codes ADD CONSTRAINT uk_tax_code_property_code UNIQUE (property_id, code);
DROP INDEX IF EXISTS supplier_invoice.idx_tax_codes_tenant;
DROP INDEX IF EXISTS supplier_invoice.idx_tax_codes_tenant_code;
CREATE INDEX idx_tax_codes_property ON supplier_invoice.tax_codes(property_id);
ALTER TABLE supplier_invoice.tax_codes DROP COLUMN tenant_id;

-- 3. tax_rates: add property_id, remove tenant_id
ALTER TABLE supplier_invoice.tax_rates ADD COLUMN property_id UUID;
UPDATE supplier_invoice.tax_rates SET property_id = '00000000-0000-0000-0000-000000000000' WHERE property_id IS NULL;
ALTER TABLE supplier_invoice.tax_rates ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE supplier_invoice.tax_rates DROP CONSTRAINT uk_tax_rate_tenant_code_pct;
ALTER TABLE supplier_invoice.tax_rates ADD CONSTRAINT uk_tax_rate_property_code_pct UNIQUE (property_id, tax_code_id, percentage);
DROP INDEX IF EXISTS supplier_invoice.idx_tax_rates_tenant;
CREATE INDEX idx_tax_rates_property ON supplier_invoice.tax_rates(property_id);
ALTER TABLE supplier_invoice.tax_rates DROP COLUMN tenant_id;

-- 4. supplier_invoices: remove tenant_id (property_id already exists from V10)
ALTER TABLE supplier_invoice.supplier_invoices DROP CONSTRAINT uk_invoice_tenant_property_nit_number;
ALTER TABLE supplier_invoice.supplier_invoices ADD CONSTRAINT uk_invoice_property_nit_number UNIQUE (property_id, nit, invoice_number);
DROP INDEX IF EXISTS supplier_invoice.idx_si_tenant;
DROP INDEX IF EXISTS supplier_invoice.idx_si_date;
DROP INDEX IF EXISTS supplier_invoice.idx_si_supplier;
DROP INDEX IF EXISTS supplier_invoice.idx_si_nit;
DROP INDEX IF EXISTS supplier_invoice.idx_si_property;
CREATE INDEX idx_si_property ON supplier_invoice.supplier_invoices(property_id);
CREATE INDEX idx_si_date ON supplier_invoice.supplier_invoices(property_id, invoice_date);
CREATE INDEX idx_si_supplier ON supplier_invoice.supplier_invoices(property_id, supplier_name);
CREATE INDEX idx_si_nit ON supplier_invoice.supplier_invoices(property_id, nit);
ALTER TABLE supplier_invoice.supplier_invoices DROP COLUMN tenant_id;

-- 5. invoice_tax_lines: remove tenant_id (inherits property via invoice_id FK)
DROP INDEX IF EXISTS supplier_invoice.idx_itl_tenant;
ALTER TABLE supplier_invoice.invoice_tax_lines DROP COLUMN tenant_id;

-- 6. gmail_credentials: remove tenant_id (property_id already exists from V10)
ALTER TABLE supplier_invoice.gmail_credentials DROP CONSTRAINT uk_gmail_creds_tenant_property;
ALTER TABLE supplier_invoice.gmail_credentials ADD CONSTRAINT uk_gmail_creds_property UNIQUE (property_id);
DROP INDEX IF EXISTS supplier_invoice.idx_gmail_creds_tenant;
CREATE INDEX idx_gmail_creds_property ON supplier_invoice.gmail_credentials(property_id);
ALTER TABLE supplier_invoice.gmail_credentials DROP COLUMN tenant_id;
```

---

## Fase 2: Domain Layer

### 2.1 Aggregates (5 archivos)

**Patrón**: Reemplazar `private final UUID tenantId` → `private final UUID propertyId` (o eliminar si ya existe propertyId)

| Archivo | Cambio |
|---------|--------|
| `SupplierInvoice.java` | Remove tenantId (ya tiene propertyId) |
| `GmailCredentials.java` | Remove tenantId (ya tiene propertyId) |
| `TaxGrouping.java` | Replace tenantId → propertyId |
| `TaxCode.java` | Replace tenantId → propertyId |
| `TaxRate.java` | Replace tenantId → propertyId |

En cada aggregate: actualizar constructor, `create()`, `reconstitute()`, getter.

**Nota**: `InvoiceTaxLine.java` — verificar si tiene tenantId; si sí, eliminarlo.

### 2.2 Domain Services (1 archivo)

| Archivo | Cambio |
|---------|--------|
| `TaxResolutionService.java` | `resolve(UUID tenantId, ...)` → `resolve(UUID propertyId, ...)` |

---

## Fase 3: Port Layer

### 3.1 Repository Ports — out (5 archivos)

Reemplazar `UUID tenantId` → `UUID propertyId` en todos los method signatures.

| Puerto | Métodos afectados |
|--------|-------------------|
| `SupplierInvoiceRepository` | findById, findByNitAndInvoiceNumber, findWithFilters, findDistinctProviders, existsByNitAndInvoiceNumber, delete → propertyId |
| `TaxCodeRepository` | findById, findByCode, findAll, existsByCode, delete → propertyId |
| `TaxGroupingRepository` | findById, findByName, findAll, existsByName, delete → propertyId |
| `TaxRateRepository` | findById, findByTaxCodeId, findAll, delete → propertyId |
| `GmailCredentialsRepository` | findByTenantAndProperty → findByProperty, delete → propertyId |

**Decisión clave**: `findById(Long id)` y `delete(Long id)` — ¿necesitan propertyId?
- `findById`: El id es PK global, pero agregar propertyId evita acceso cross-property. Usar `findById(UUID propertyId, Long id)`.
- `delete`: Mismo razonamiento. Usar `delete(UUID propertyId, Long id)`.

### 3.2 Use Case Ports — in (9 archivos)

Reemplazar `UUID tenantId` → `UUID propertyId` en TODOS los métodos de TODOS los use cases:

- ImportInvoicesUseCase
- ListInvoicesUseCase
- GetInvoiceStatsUseCase
- ExportInvoicesUseCase
- ConfigureGmailUseCase
- ManageTaxCodesUseCase ← **NUEVO**: agregar propertyId
- ManageTaxGroupingsUseCase ← **NUEVO**: agregar propertyId
- ManageTaxRatesUseCase ← **NUEVO**: agregar propertyId
- InitializeTaxConfigUseCase ← **NUEVO**: agregar propertyId

---

## Fase 4: Infrastructure — Persistence

### 4.1 JPA Entities (6 archivos)

| Entidad | Cambios |
|---------|---------|
| `SupplierInvoiceEntity` | Remove tenantId field + @Column, remove @FilterDef/@Filter, update @UniqueConstraint |
| `TaxGroupingEntity` | Replace tenantId → propertyId, remove @FilterDef/@Filter, update @UniqueConstraint |
| `TaxCodeEntity` | Replace tenantId → propertyId, remove @FilterDef/@Filter, update @UniqueConstraint |
| `TaxRateEntity` | Replace tenantId → propertyId, remove @FilterDef/@Filter, update @UniqueConstraint |
| `InvoiceTaxLineEntity` | Remove tenantId field + @Column, remove @FilterDef/@Filter |
| `GmailCredentialsEntity` | Remove tenantId field + @Column, update @UniqueConstraint |

### 4.2 JPA Repositories (5 archivos)

Actualizar JPQL queries: `i.tenantId = :tenantId` → `i.propertyId = :propertyId`

### 4.3 Mappers (5 archivos)

Remove `tenantId` mapping, add `propertyId` mapping donde no existe.

### 4.4 Persistence Adapters (5 archivos)

Update method signatures para pasar propertyId en lugar de tenantId.

---

## Fase 5: Infrastructure — REST + DTOs

### 5.1 DTOs (2 archivos)

| DTO | Cambio |
|-----|--------|
| `InvoiceSummaryDTO` | Remove tenantId field (ya tiene propertyId) |
| `InvoiceDetailDTO` | Remove tenantId field (ya tiene propertyId) |

### 5.2 Controllers (9 archivos)

**Patrón general**:
- Eliminar: `UUID tenantId = SecurityUtils.getCurrentTenantId();`
- Las líneas que pasaban `tenantId` ahora pasan `propertyId` (que ya viene como `@RequestParam`)

| Controller | Cambio específico |
|-----------|-------------------|
| `InvoiceController` | Remove SecurityUtils, usar propertyId existente |
| `InvoiceImportController` | Remove SecurityUtils, usar propertyId existente |
| `InvoiceStatsController` | Remove SecurityUtils, usar propertyId existente |
| `InvoiceExportController` | Remove SecurityUtils, usar propertyId existente |
| `GmailConfigController` | Remove SecurityUtils, usar propertyId existente |
| `TaxCodeController` | Remove SecurityUtils, **agregar @RequestParam UUID propertyId** |
| `TaxGroupingController` | Remove SecurityUtils, **agregar @RequestParam UUID propertyId** |
| `TaxRateController` | Remove SecurityUtils, **agregar @RequestParam UUID propertyId** |
| `TaxConfigController` | Remove SecurityUtils, **agregar @RequestParam UUID propertyId** |

---

## Fase 6: Angular Frontend

### 6.1 Model

**supplier-invoice.model.ts**: Remove `tenantId: string` de `SupplierInvoice` interface.

### 6.2 Service

**supplier-invoice.service.ts**: Agregar `propertyId` a los 13 endpoints de tax config:
- getTaxGroupings, createTaxGrouping, updateTaxGrouping, deleteTaxGrouping
- getTaxCodes, createTaxCode, updateTaxCode, deleteTaxCode
- getTaxRates, getTaxRatesByTaxCode, createTaxRate, updateTaxRate, deleteTaxRate
- initializeTaxConfig

Patrón: `{ params: { propertyId } }` para GET/DELETE, `?propertyId=${propertyId}` para POST/PUT.

### 6.3 Component

**tax-config.component.ts**: Agregar `PropertyContextService` + `effect()` para recargar cuando cambia la property.

---

## Resumen de Constraints Finales

| Tabla | UNIQUE Constraint | Clave de partición |
|-------|-------------------|-------------------|
| tax_groupings | (property_id, name) | property_id |
| tax_codes | (property_id, code) | property_id |
| tax_rates | (property_id, tax_code_id, percentage) | property_id |
| supplier_invoices | (property_id, nit, invoice_number) | property_id |
| invoice_tax_lines | — (hereda via invoice_id FK) | — |
| gmail_credentials | (property_id) | property_id |

---

## Verificación

1. **Backend compila**: `mvn clean compile` sin errores
2. **Flyway migra**: V11 se aplica correctamente
3. **Tax init funciona**: `POST /tax-config/initialize?propertyId=...` crea configuración
4. **Import funciona**: XMLs se importan con propertyId como única clave
5. **Deduplicación**: UNIQUE(property_id, nit, invoice_number) — sin tenant_id
6. **Frontend**: Tax config recarga al cambiar property
7. **Swagger**: Todos los endpoints documentan propertyId, ninguno muestra tenantId

---

## Notas

- Este cambio es **incompatible** con los datos existentes si no tienen property_id. La V11 usa un UUID placeholder para datos existentes.
- En desarrollo: se puede hacer `DROP SCHEMA supplier_invoice CASCADE` y re-ejecutar todas las migraciones para un schema limpio.
- `@RequiresPermission` sigue funcionando: valida que el usuario (dentro de su tenant) tiene el permiso adecuado.
- `SecurityUtils` ya no se importa en ningún controller del microservicio.