# Plan de Integración Facturas Proveedor en PH360

**Fecha**: 2026-02-19
**Estado**: Propuesta
**Autor**: Análisis Claude Code

---

## 1. Contexto

El directorio `Facturas/` contiene una aplicación personal de procesamiento de facturas de proveedores colombianas (formato UBL 2.1 XML, estándar DIAN) con las siguientes capacidades:

- **Extracción de Gmail**: OAuth2, descarga ZIPs con XML+PDF, etiquetado, gestión de hilos
- **Parsing XML UBL 2.1**: Invoice directo y AttachedDocument con CDATA embebido (estándar DIAN Colombia)
- **Clasificación Tributaria**: IVA, ICA, ReteFuente, ReteICA, con operaciones contextuales (add/subtract/ignore)
- **Importación a BD**: Parsing, validación de totales con tolerancia, deduplicación por NIT+factura
- **Dashboard**: KPIs, gráficos de tendencia mensual, top proveedores
- **Exportación**: CSV, Excel multi-hoja (facturas + detalle impuestos), PDF

Este dominio debe integrarse en **PH360**, la plataforma de microservicios empresarial ubicada en `F:\1. Cloud\4. AI\1. Antigravity\PH360`.

---

## 2. Comparación de Stacks

| Aspecto | Facturas (actual) | PH360 (destino) |
|---------|-------------------|------------------|
| **Backend** | Python 3.11 + FastAPI | Java 21 + Spring Boot 3.2.1 |
| **Frontend** | React 19 + TypeScript + Vite | Angular 20 + TypeScript 5.8 |
| **BD** | PostgreSQL 18, tabla única sin schema | PostgreSQL 16, schema-per-service |
| **ORM** | psycopg2 (SQL raw, pool manual) | Spring Data JPA + Hibernate |
| **Migraciones** | Scripts SQL/Python manuales | Flyway (versionado) |
| **Arquitectura** | Hexagonal simple (ports+adapters) | DDD + CQRS + Clean Architecture |
| **Seguridad** | Ninguna (app personal) | JWT (HS512) + RBAC + Multi-tenant |
| **Mensajería** | Ninguna | Spring Cloud Stream (Kafka) |
| **Deploy** | Docker Compose | Kubernetes (K8s) |
| **Testing** | 0% cobertura | JaCoCo 85% línea / 80% branch |
| **CSS** | TailwindCSS 4 | TailwindCSS 3.4 |
| **XML Parsing** | lxml (Python) | JAXP DOM (Java) |
| **Excel** | openpyxl/pandas | Apache POI |
| **PDF Gen** | fpdf2 | iText7 o OpenPDF |
| **Gmail** | google-api-python-client | google-api-services-gmail (Java) |
| **API Docs** | Ninguna | Springdoc OpenAPI (Swagger 3.x) |

---

## 3. Decisión: Reescribir en Java + Angular

### Justificación

1. **El frontend se reescribe de cualquier forma** (React → Angular). Eso representa ~50% del esfuerzo total.

2. **El backend Java obtiene gratis**: seguridad, multi-tenancy, eventos, Swagger, Flyway, testing infrastructure.

3. **La arquitectura hexagonal actual mapea 1:1 al patrón PH360**:

```
Python (actual)                    →  Java (PH360)
───────────────────────────────────────────────────────
domain/models/                     →  domain/aggregate/
domain/ports/                      →  domain/port/out/
application/services/              →  application/usecase/
api/routes/                        →  infrastructure/adapter/in/rest/controller/
infrastructure/database/postgres_* →  infrastructure/adapter/out/persistence/
infrastructure/external/google_*   →  infrastructure/adapter/out/external/
```

4. **PH360 ya tiene las herramientas equivalentes**:

| Herramienta PH360 | Reemplaza en Facturas |
|-------------------|----------------------|
| JAXP DOM / javax.xml.xpath | lxml (parsing XML UBL 2.1) |
| Apache POI | openpyxl + pandas (Excel) |
| iText7 / OpenPDF | fpdf2 (generación PDF) |
| google-api-services-gmail | google-api-python-client (Gmail) |
| Spring Data JPA | psycopg2 raw SQL |
| Flyway | Scripts SQL manuales |
| Springdoc OpenAPI | Sin documentación API |
| shared-java (JWT + @RequiresPermission) | Sin seguridad |
| shared-java (TenantContext + @Filter) | Sin multi-tenant |

---

## 4. Decisión: Un Solo Microservicio

A diferencia de conciliación (que tiene dos dominios acoplados: movimientos + presupuesto), **Facturas es un dominio único y cohesivo**:

- Agrupaciones, Taxes y TaxRates son **datos maestros** del mismo dominio
- Facturas + FacturasDetalle son el **aggregate root** central
- Gmail es un **adaptador externo** (no un dominio separado)

### Microservicio resultante

| Servicio | Puerto K8s | Context Path | Schema | Responsabilidad |
|----------|-----------|-------------|--------|-----------------|
| `backend-supplier-invoice` | 30088 | `/api/supplier-invoice` | `supplier_invoice` | Facturas proveedor, impuestos, Gmail, exportación |

### Integración futura con Conciliación (preparada, desactivada)

```
backend-supplier-invoice                    backend-conciliation
         │                                          │
         │ SupplierInvoiceImportedEvent              │
         │ ────────────────────────────────────────► │
         │                                          │
         │ (Conciliación recibe y crea              │
         │  movimiento de egreso                    │
         │  automáticamente)                        │
```

---

## 5. Arquitectura de Eventos (Future-Ready)

### 5.1 Catálogo de Eventos (Fase Futura)

| Evento | Topic Kafka | Trigger | Payload clave |
|--------|-------------|---------|---------------|
| `SupplierInvoiceImportedEvent` | `supplier-invoice.invoice.imported` | Factura importada a BD | tenant_id, invoice_id, nit, supplier_name, date, subtotal, taxes, retentions, total |
| `SupplierInvoiceDeletedEvent` | `supplier-invoice.invoice.deleted` | Factura eliminada | tenant_id, invoice_id, nit, factura_number |

### 5.2 Implementación NoOp Inicial

```java
// Port (application layer)
public interface SupplierInvoiceEventPublisherPort {
    boolean publishInvoiceImported(SupplierInvoiceImportedEvent event);
    boolean publishInvoiceDeleted(SupplierInvoiceDeletedEvent event);
}

// NoOp Adapter (Fase 1 - sin Kafka activo)
@Component
@Profile({"local", "dev"})
public class SupplierInvoiceEventPublisherNoOpAdapter
    implements SupplierInvoiceEventPublisherPort {
    @Override
    public boolean publishInvoiceImported(SupplierInvoiceImportedEvent event) {
        log.debug("NoOp: SupplierInvoiceImportedEvent for {}", event.invoiceNumber());
        return true;
    }
}
```

---

## 6. Modelo de Dominio (Python → Java DDD)

### 6.1 Mapeo de Modelos

| Python Model | Java Aggregate/Entity | Tipo DDD |
|-------------|----------------------|----------|
| `Grouping` | `TaxGrouping` | Entity (maestro) |
| `Tax` | `TaxCode` | Aggregate Root |
| `TaxRate` | `TaxRate` | Entity (parte del aggregate TaxCode) |
| `facturas` (cabecera) | `SupplierInvoice` | **Aggregate Root** |
| `facturas_detalle` | `InvoiceTaxLine` | Entity (parte del aggregate SupplierInvoice) |
| `InvoiceMetadata` | `ParsedInvoiceData` | Value Object (resultado parsing) |
| `InvoiceTaxDetail` | `ParsedTaxDetail` | Value Object |
| Gmail credentials/token | `GmailCredentials` | Entity (config multi-tenant) |

### 6.2 Value Objects

```java
public record ParsedInvoiceData(
    String invoiceNumber, LocalDate issueDate, String supplierName, String nit,
    BigDecimal subtotal, BigDecimal discounts, BigDecimal taxes,
    BigDecimal retentions, BigDecimal otherTaxes, BigDecimal total,
    List<ParsedTaxDetail> taxDetails, String validationError,
    String otherConceptsJson, String pdfFilename, String xmlFilename
) {}

public record ParsedTaxDetail(
    String taxCode, String taxName, BigDecimal percentage,
    BigDecimal amount, TaxOperation operation, XmlTaxContext xmlContext
) {}

public enum XmlTaxContext { TAX, WITHHOLDING }
public enum TaxOperation { ADD, SUBTRACT, IGNORE }
```

---

## 7. Estructura de Directorios

### 7.1 Backend: backend-supplier-invoice

```
PH360/backend-supplier-invoice/
├── src/main/java/com/ph360/supplierinvoice/
│   ├── domain/
│   │   ├── aggregate/
│   │   │   ├── invoice/
│   │   │   │   ├── SupplierInvoice.java           ← Aggregate Root
│   │   │   │   └── InvoiceTaxLine.java
│   │   │   ├── taxcode/
│   │   │   │   ├── TaxCode.java                    ← Aggregate Root
│   │   │   │   ├── TaxRate.java
│   │   │   │   └── TaxGrouping.java
│   │   │   └── gmailconfig/
│   │   │       └── GmailCredentials.java
│   │   ├── port/
│   │   │   ├── in/                                 ← Use Cases
│   │   │   │   ├── ImportInvoicesUseCase.java
│   │   │   │   ├── ProcessGmailUseCase.java
│   │   │   │   ├── ListInvoicesUseCase.java
│   │   │   │   ├── GetInvoiceDetailUseCase.java
│   │   │   │   ├── GetInvoiceStatsUseCase.java
│   │   │   │   ├── ExportInvoicesUseCase.java
│   │   │   │   ├── ManageTaxCodesUseCase.java
│   │   │   │   ├── ManageTaxRatesUseCase.java
│   │   │   │   ├── ManageTaxGroupingsUseCase.java
│   │   │   │   └── ConfigureGmailUseCase.java
│   │   │   └── out/                                ← Repository + Event ports
│   │   │       ├── SupplierInvoiceRepository.java
│   │   │       ├── TaxCodeRepository.java
│   │   │       ├── TaxRateRepository.java
│   │   │       ├── TaxGroupingRepository.java
│   │   │       ├── GmailCredentialsRepository.java
│   │   │       └── SupplierInvoiceEventPublisherPort.java
│   │   ├── service/
│   │   │   ├── UblXmlParsingService.java           ← Parsing XML UBL 2.1
│   │   │   ├── TaxResolutionService.java           ← Clasificación contextual
│   │   │   └── InvoiceValidationService.java       ← Validación con tolerancia
│   │   ├── valueobject/
│   │   │   ├── ParsedInvoiceData.java
│   │   │   ├── ParsedTaxDetail.java
│   │   │   ├── XmlTaxContext.java
│   │   │   └── TaxOperation.java
│   │   ├── event/
│   │   │   ├── DomainEvent.java
│   │   │   └── pubsub/
│   │   │       ├── SupplierInvoiceImportedEvent.java
│   │   │       └── SupplierInvoiceDeletedEvent.java
│   │   └── exception/
│   │       ├── InvoiceNotFoundException.java
│   │       ├── DuplicateInvoiceException.java
│   │       ├── InvalidXmlException.java
│   │       ├── TaxCodeNotFoundException.java
│   │       └── GmailAuthenticationException.java
│   │
│   ├── application/
│   │   ├── usecase/
│   │   │   ├── invoice/
│   │   │   │   ├── ImportInvoicesUseCaseImpl.java
│   │   │   │   ├── ListInvoicesUseCaseImpl.java
│   │   │   │   ├── GetInvoiceDetailUseCaseImpl.java
│   │   │   │   └── GetInvoiceStatsUseCaseImpl.java
│   │   │   ├── gmail/
│   │   │   │   ├── ProcessGmailUseCaseImpl.java
│   │   │   │   └── ConfigureGmailUseCaseImpl.java
│   │   │   ├── export/
│   │   │   │   └── ExportInvoicesUseCaseImpl.java
│   │   │   └── tax/
│   │   │       ├── ManageTaxCodesUseCaseImpl.java
│   │   │       ├── ManageTaxRatesUseCaseImpl.java
│   │   │       └── ManageTaxGroupingsUseCaseImpl.java
│   │   ├── command/
│   │   │   ├── ImportInvoicesCommand.java
│   │   │   ├── ProcessGmailCommand.java
│   │   │   └── ExportInvoicesCommand.java
│   │   ├── dto/
│   │   │   ├── InvoiceSummaryDTO.java
│   │   │   ├── InvoiceDetailDTO.java
│   │   │   ├── InvoiceStatsDTO.java
│   │   │   ├── MonthlyStatsDTO.java
│   │   │   ├── TopProviderDTO.java
│   │   │   ├── ImportResultDTO.java
│   │   │   ├── GmailProcessingEventDTO.java
│   │   │   └── ExportResultDTO.java
│   │   └── service/
│   │       ├── ExcelExportService.java             ← Apache POI
│   │       ├── CsvExportService.java
│   │       ├── PdfExportService.java               ← iText7 o OpenPDF
│   │       └── ZipExtractionService.java
│   │
│   └── infrastructure/
│       ├── adapter/
│       │   ├── in/rest/
│       │   │   ├── controller/
│       │   │   │   ├── InvoiceController.java
│       │   │   │   ├── InvoiceImportController.java
│       │   │   │   ├── GmailProcessingController.java
│       │   │   │   ├── InvoiceExportController.java
│       │   │   │   ├── InvoiceStatsController.java
│       │   │   │   ├── TaxCodeController.java
│       │   │   │   ├── TaxRateController.java
│       │   │   │   ├── TaxGroupingController.java
│       │   │   │   └── GmailConfigController.java
│       │   │   └── dto/ (request DTOs)
│       │   └── out/
│       │       ├── persistence/
│       │       │   ├── entity/ (JPA entities)
│       │       │   ├── repository/ (JpaRepositories)
│       │       │   ├── adapter/ (RepositoryAdapters)
│       │       │   └── mapper/ (Domain ↔ Entity)
│       │       ├── external/
│       │       │   └── GmailApiAdapter.java
│       │       └── messaging/
│       │           ├── SupplierInvoiceEventPublisherAdapter.java
│       │           └── SupplierInvoiceEventPublisherNoOpAdapter.java
│       ├── config/
│       │   ├── SecurityConfig.java
│       │   ├── JpaConfig.java
│       │   └── WebConfig.java
│       └── exception/
│           └── GlobalExceptionHandler.java
│
├── src/main/resources/
│   ├── db/migration/ (V1-V9 Flyway)
│   ├── application.yml
│   ├── application-local.yml
│   └── application-kafka.yml
│
├── src/test/ (golden data from Python system)
├── Dockerfile
└── pom.xml
```

### 7.2 Frontend: Feature Module Angular

```
PH360/frontend-web/src/app/features/supplier-invoice/
├── dashboard/supplier-invoice-dashboard/
├── extraction/gmail-extraction/          ← SSE con EventSource
├── import/invoice-import/                ← Preview + confirm
├── invoices/
│   ├── invoice-list/
│   └── invoice-detail/
├── export/invoice-export/
├── tax-config/
│   ├── tax-codes/
│   ├── tax-rates/
│   └── tax-groupings/
├── gmail-config/gmail-setup/             ← OAuth2 setup por tenant
├── shared/ (currency-display, date-range-filter, filter-bar)
├── models/ (supplier-invoice.model.ts, tax-code.model.ts, etc.)
├── services/ (supplier-invoice.service.ts, gmail-processing.service.ts, etc.)
└── supplier-invoice.routes.ts
```

---

## 8. Schema de Base de Datos (Flyway Migrations)

### V1: Schema
```sql
CREATE SCHEMA IF NOT EXISTS supplier_invoice;
```

### V2: Tax Groupings (agrupaciones)
```sql
CREATE TABLE supplier_invoice.tax_groupings (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    name        VARCHAR(100) NOT NULL,
    operation   VARCHAR(20) NOT NULL CHECK (operation IN ('add', 'subtract', 'ignore')),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    version     BIGINT DEFAULT 0,
    UNIQUE(tenant_id, name)
);
```

### V3: Tax Codes (taxes)
```sql
CREATE TABLE supplier_invoice.tax_codes (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    code        VARCHAR(10) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    grouping_id BIGINT REFERENCES supplier_invoice.tax_groupings(id),
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    version     BIGINT DEFAULT 0,
    UNIQUE(tenant_id, code)
);
```

### V4: Tax Rates
```sql
CREATE TABLE supplier_invoice.tax_rates (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    tax_code_id BIGINT NOT NULL REFERENCES supplier_invoice.tax_codes(id) ON DELETE CASCADE,
    percentage  DECIMAL(8,4) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    version     BIGINT DEFAULT 0,
    UNIQUE(tenant_id, tax_code_id, percentage)
);
```

### V5: Supplier Invoices (facturas)
```sql
CREATE TABLE supplier_invoice.supplier_invoices (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    invoice_date    DATE NOT NULL,
    nit             VARCHAR(50) NOT NULL,
    supplier_name   VARCHAR(500) NOT NULL,
    invoice_number  VARCHAR(100) NOT NULL,
    subtotal        DECIMAL(18,2) DEFAULT 0,
    discounts       DECIMAL(18,2) DEFAULT 0,
    taxes           DECIMAL(18,2) DEFAULT 0,
    retentions      DECIMAL(18,2) DEFAULT 0,
    other_taxes     DECIMAL(18,2) DEFAULT 0,
    total           DECIMAL(18,2) NOT NULL,
    other_concepts  JSONB,
    pdf_filename    VARCHAR(500),
    xml_filename    VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    version         BIGINT DEFAULT 0,
    UNIQUE(tenant_id, nit, invoice_number)
);
CREATE INDEX idx_invoices_date ON supplier_invoice.supplier_invoices(tenant_id, invoice_date);
CREATE INDEX idx_invoices_supplier ON supplier_invoice.supplier_invoices(tenant_id, supplier_name);
```

### V6: Invoice Tax Lines (facturas_detalle)
```sql
CREATE TABLE supplier_invoice.invoice_tax_lines (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    UUID NOT NULL,
    invoice_id   BIGINT NOT NULL REFERENCES supplier_invoice.supplier_invoices(id) ON DELETE CASCADE,
    invoice_date DATE NOT NULL,
    tax_code_id  BIGINT NOT NULL REFERENCES supplier_invoice.tax_codes(id),
    tax_rate_id  BIGINT REFERENCES supplier_invoice.tax_rates(id),
    percentage   DECIMAL(8,4) NOT NULL DEFAULT 0,
    amount       DECIMAL(18,2) NOT NULL,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_tax_lines_invoice ON supplier_invoice.invoice_tax_lines(invoice_id);
```

### V7: Gmail Credentials (multi-tenant)
```sql
CREATE TABLE supplier_invoice.gmail_credentials (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      UUID NOT NULL UNIQUE,
    client_id      VARCHAR(500) NOT NULL,
    client_secret  VARCHAR(500) NOT NULL,     -- Encrypted at rest (AES-256)
    refresh_token  TEXT,                       -- Encrypted at rest
    access_token   TEXT,                       -- Encrypted at rest
    token_expiry   TIMESTAMP,
    target_label   VARCHAR(100) DEFAULT 'Factura_Procesada',
    status         VARCHAR(50) DEFAULT 'pending',
    last_sync_at   TIMESTAMP,
    created_at     TIMESTAMP DEFAULT NOW(),
    updated_at     TIMESTAMP DEFAULT NOW(),
    version        BIGINT DEFAULT 0
);
```

### V8: Processed Events + V9: Seed Data
```sql
-- V8: Processed events (idempotencia estándar PH360)
CREATE TABLE supplier_invoice.processed_events (
    id           BIGSERIAL PRIMARY KEY,
    event_id     UUID NOT NULL UNIQUE,
    event_type   VARCHAR(200) NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW(),
    payload      JSONB
);

-- V9: Seed data se inicializa via endpoint POST /tax-config/initialize por tenant
```

---

## 9. Endpoints API

### Prefijo: `/api/supplier-invoice/`

```
# ═══ Facturas (CRUD + filtros) ═══════════════════════
GET    /invoices                           ← Lista con filtros (fecha, proveedor)
GET    /invoices/detail                    ← Detalle con desglose impuestos (nit+factura)
GET    /invoices/providers                 ← Lista proveedores únicos

# ═══ Estadísticas / Dashboard ════════════════════════
GET    /stats                              ← KPIs agregados
GET    /stats/monthly                      ← Tendencia mensual
GET    /stats/top-providers                ← Top N proveedores

# ═══ Gmail Processing ════════════════════════════════
POST   /gmail/process                      ← Procesar emails (síncrono)
GET    /gmail/process-stream               ← Procesar emails (SSE streaming)

# ═══ Import a BD ═════════════════════════════════════
POST   /import                             ← Importar XMLs a BD (dry-run + confirm)

# ═══ Export desde BD ═════════════════════════════════
POST   /export                             ← Exportar a CSV/XLSX/PDF

# ═══ Config Impuestos (CRUD) ═════════════════════════
CRUD   /tax-groupings                      ← Agrupaciones (add/subtract/ignore)
CRUD   /tax-codes                          ← Códigos de impuesto
CRUD   /tax-rates                          ← Tarifas por código
POST   /tax-config/initialize              ← Inicializar config por tenant (seed)

# ═══ Config Gmail (Multi-tenant) ═════════════════════
GET    /gmail/config                       ← Estado conexión Gmail del tenant
POST   /gmail/config                       ← Registrar credenciales OAuth2
POST   /gmail/config/authorize             ← Iniciar flujo OAuth2
POST   /gmail/config/callback              ← Callback OAuth2
DELETE /gmail/config                       ← Revocar credenciales
```

---

## 10. Gmail Multi-Tenant Strategy

### Flujo de Configuración por Tenant

```
1. Admin accede a "Configuración Gmail"
2. Ingresa Client ID + Client Secret (de Google Cloud Console)
3. Backend guarda credenciales (encriptadas AES-256) en gmail_credentials
4. Admin hace click "Autorizar" → redirect a Google consent screen
5. Google redirige a callback con authorization code
6. Backend intercambia code por access_token + refresh_token
7. Guarda tokens encriptados → status = 'active'
8. A partir de ahora, el tenant puede procesar emails
```

### Token Refresh Automático

```java
@Service
public class GmailApiAdapter {
    public Gmail getGmailService(UUID tenantId) {
        GmailCredentials creds = credentialsRepo.findByTenantId(tenantId)
            .orElseThrow(() -> new GmailAuthenticationException("Gmail not configured"));

        if (creds.isTokenExpired()) {
            Credential refreshed = refreshToken(creds);
            creds.updateTokens(refreshed.getAccessToken(), refreshed.getExpiresInSeconds());
            credentialsRepo.save(creds);
        }

        return new Gmail.Builder(httpTransport, jsonFactory, buildCredential(creds))
            .setApplicationName("PH360-SupplierInvoice").build();
    }
}
```

---

## 11. XML Parsing Strategy (lxml → JAXP DOM)

### Reemplazo de Tecnología

| Python (lxml) | Java (JAXP DOM) |
|---------------|-----------------|
| `etree.fromstring(xml)` | `DocumentBuilder.parse(new ByteArrayInputStream(xml))` |
| `element.xpath('...')` | `XPath.compile("...").evaluate(doc, XPathConstants.NODESET)` |
| `etree.QName(root).localname` | `root.getLocalName()` |

### Lógica Crítica: Extracción de Impuestos Contextual

```java
/**
 * El código 'ZZ' es especial: la operación se determina por ubicación XML,
 * no por la configuración de la BD.
 * - ZZ en <TaxTotal> → ADD
 * - ZZ en <WithholdingTaxTotal> → SUBTRACT
 */
public Map<TaxKey, TaxValue> extractDetailedTaxes(Element invoiceElement) {
    Map<TaxKey, TaxValue> taxes = new LinkedHashMap<>();
    // 1. TaxTotal → contexto TAX (impuestos que SE SUMAN)
    processTaxNodes(evaluateXPath(invoiceElement, "...*[local-name()='TaxTotal']"),
                    XmlTaxContext.TAX, taxes);
    // 2. WithholdingTaxTotal → contexto WITHHOLDING (retenciones que SE RESTAN)
    processTaxNodes(evaluateXPath(invoiceElement, "...*[local-name()='WithholdingTaxTotal']"),
                    XmlTaxContext.WITHHOLDING, taxes);
    return taxes;
}
```

---

## 12. Export Strategy

| Formato | Python | Java |
|---------|--------|------|
| **Excel** | openpyxl multi-hoja | Apache POI XSSFWorkbook (hoja "Facturas" + "Detalle Impuestos") |
| **CSV** | csv.DictWriter | OpenCSV CSVWriter |
| **PDF** | fpdf2 | iText7 o OpenPDF (tabla landscape con totales) |

---

## 13. Sidebar Integration (PH360)

```typescript
// sidebar.component.ts → menuItems[]
{
  labelKey: 'sidebar.menu.supplierInvoices',
  icon: '...', feature: 'supplierInvoice',
  permissions: ['supplierinvoice.read.invoice', 'supplierinvoice.read.dashboard'],
  children: [
    { labelKey: 'sidebar.menu.siDashboard', route: '/supplier-invoices', permissions: ['supplierinvoice.read.dashboard'] },
    { labelKey: 'sidebar.menu.siExtraction', route: '/supplier-invoices/extraction', permissions: ['supplierinvoice.process.gmail'] },
    { labelKey: 'sidebar.menu.siImport', route: '/supplier-invoices/import', permissions: ['supplierinvoice.import.invoice'] },
    { labelKey: 'sidebar.menu.siInvoices', route: '/supplier-invoices/invoices', permissions: ['supplierinvoice.read.invoice'] },
    { labelKey: 'sidebar.menu.siExport', route: '/supplier-invoices/export', permissions: ['supplierinvoice.export.invoice'] },
    { labelKey: 'sidebar.menu.siTaxConfig', route: '/supplier-invoices/tax-codes', permissions: ['supplierinvoice.read.taxcode'] },
    { labelKey: 'sidebar.menu.siGmailConfig', route: '/supplier-invoices/gmail-config', permissions: ['supplierinvoice.manage.gmail'] }
  ]
}

// app.routes.ts
{ path: 'supplier-invoices', loadChildren: () => import('./features/supplier-invoice/supplier-invoice.routes').then(m => m.SUPPLIER_INVOICE_ROUTES) }
```

---

## 14. K8s Configuration

```yaml
# k8s/local/28-backend-supplier-invoice.yaml
# Deployment + ClusterIP Service + NodePort(30088)
# Same pattern as backend-financial
# Resources: 512Mi-1Gi memory, 250m-500m cpu
# Probes: liveness@120s, readiness@90s
```

---

## 15. Permisos IAM

```
supplierinvoice.read.dashboard
supplierinvoice.read.invoice        supplierinvoice.import.invoice
supplierinvoice.delete.invoice      supplierinvoice.export.invoice
supplierinvoice.process.gmail       supplierinvoice.manage.gmail
supplierinvoice.read.taxcode        supplierinvoice.create.taxcode
supplierinvoice.update.taxcode      supplierinvoice.delete.taxcode
supplierinvoice.read.taxrate        supplierinvoice.create.taxrate
supplierinvoice.update.taxrate      supplierinvoice.delete.taxrate
supplierinvoice.read.taxgrouping    supplierinvoice.create.taxgrouping
supplierinvoice.update.taxgrouping  supplierinvoice.delete.taxgrouping
supplierinvoice.admin.initialize
```

---

## 16. Fases de Implementación

### Fase 0: Setup de Infraestructura
**Objetivo**: Servicio Java levantando en K8s con schema vacío.
- Crear `PH360/backend-supplier-invoice/` copiando estructura de `backend-financial/`
- `pom.xml`: shared-java, POI, iText7, google-api-services-gmail, Spring Cloud Stream
- `application.yml`: schema `supplier_invoice`, port 30088
- Flyway V1-V9
- K8s manifest `28-backend-supplier-invoice.yaml`
- Verificar: Swagger UI accesible

### Fase 1: Datos Maestros - Impuestos
**Objetivo**: CRUD completo de agrupaciones, códigos y tarifas.
- Aggregates: TaxGrouping, TaxCode, TaxRate
- JPA entities con `@Filter` tenant + `@Version` optimistic locking
- Use cases + Controllers + DTOs con `@RequiresPermission`
- Angular: tax-codes, tax-rates, tax-groupings components

### Fase 2: Parsing XML UBL 2.1
**Objetivo**: Parser Java con misma precisión que Python.
- `UblXmlParsingService` (JAXP DOM): Invoice directo + AttachedDocument CDATA + CreditNote
- `TaxResolutionService`: Clasificación contextual (TaxTotal vs WithholdingTaxTotal, ZZ especial)
- `InvoiceValidationService`: Tolerancia configurable (±1.0 COP)
- `ZipExtractionService`
- **Tests**: Golden data XMLs del sistema Python

### Fase 3: Import a BD + CRUD Facturas
**Objetivo**: Importar XMLs parseados con deduplicación.
- Aggregate: `SupplierInvoice` con `InvoiceTaxLine`
- UNIQUE(tenant_id, nit, invoice_number) → UPSERT
- Use cases: ImportInvoices (dry-run + confirm), ListInvoices, GetDetail
- Angular: invoice-import, invoice-list, invoice-detail

### Fase 4: Dashboard + Estadísticas
**Objetivo**: KPIs, tendencia mensual, top proveedores.
- Aggregate queries con `@Query(nativeQuery = true)`
- Angular dashboard con Chart.js

### Fase 5: Gmail Integration Multi-Tenant
**Objetivo**: Extracción de facturas de Gmail con OAuth2 por tenant.
- `GmailCredentials` entity con AES-256 encryption
- `GmailApiAdapter` (google-api-services-gmail Java)
- SSE via `SseEmitter` de Spring
- Angular: gmail-config + gmail-extraction

### Fase 6: Export
**Objetivo**: CSV, Excel multi-hoja, PDF.
- ExcelExportService (POI), CsvExportService (OpenCSV), PdfExportService (iText7)
- StreamingResponseBody para archivos grandes

### Fase 7: Testing + Polish
**Objetivo**: Cobertura ≥85%, E2E, polish UI.
- TestContainers + JaCoCo
- Dark mode, responsive, i18n
- Documentar API Swagger

---

## 17. Reglas de Negocio Críticas a Preservar

1. **Dos estructuras XML**: Invoice directo y AttachedDocument (CDATA embebido)
2. **ZZ contextual**: TaxTotal→ADD, WithholdingTaxTotal→SUBTRACT
3. **Validación tolerancia**: `|subtotal - descuentos + impuestos - retenciones - total| ≤ 1.0 COP`
4. **Deduplicación**: UPSERT por `(tenant_id, nit, invoice_number)`
5. **Gmail thread scanning**: Buscar ZIP en hilo completo, procesar oldest-first
6. **Naming**: `{YYYY-MM-DD} {supplier} [{invoice}].{xml|pdf}`

---

## 18. Verificación

### Backend
- `mvn clean test` → ≥85% cobertura
- Flyway → 9 migraciones OK
- Swagger UI accesible
- JWT + RBAC en todos los endpoints
- Multi-tenant via `@Filter`
- XML Parsing: tests con XMLs reales (golden data)

### Frontend
- `ng test` → componentes pasan
- Lazy loading OK
- Sidebar con permisos
- SSE streaming funcional
- Dark mode

### E2E
1. Inicializar impuestos → `POST /tax-config/initialize`
2. Configurar Gmail → OAuth2 flow completo
3. Extraer de Gmail → SSE streaming
4. Import preview → dry_run=true → confirm
5. Consultar + filtrar facturas
6. Dashboard con charts
7. Exportar CSV/XLSX/PDF

---

## 19. Decisiones Pendientes

1. **Almacenamiento de archivos**: Filesystem (PV) vs MinIO/S3
2. **¿Migrar datos existentes?** del sistema Python a PH360
3. **iText7 vs OpenPDF**: iText7 (AGPL) vs OpenPDF (LGPL)
4. **¿Qué tenant_id usar?** para desarrollo personal
5. **Dashboard PH360 o independiente**: widgets integrados vs página propia

---

## 20. Archivos Críticos de Referencia

| Archivo | Para qué |
|---------|----------|
| `Facturas/backend/src/application/services/exporter_service.py` | Lógica core de parsing XML y resolución tributaria |
| `Facturas/backend/src/application/services/invoice_processor_service.py` | Lógica Gmail y extracción ZIP |
| `Facturas/backend/src/infrastructure/database/postgres_factura_repository.py` | Queries SQL a traducir a JPA |
| `PH360/backend-financial/src/main/java/.../domain/aggregate/invoice/Invoice.java` | Patrón de aggregate root DDD |
| `PH360/backend-financial/pom.xml` | Referencia para dependencias Maven |
| `PH360/frontend-web/src/app/layout/sidebar/sidebar.component.ts` | Punto de integración sidebar |
| `PH360/frontend-web/src/app/features/financial/financial.routes.ts` | Patrón de routes Angular |
