# Documentación del Backend - Sistema de Facturas Electrónicas

## Stack Tecnológico

El backend está construido sobre Python utilizando un enfoque moderno y asíncrono para el procesamiento de facturas electrónicas colombianas (XML UBL 2.1).

*   **Lenguaje**: Python 3.x
*   **Framework Web**: FastAPI (v0.109.2)
*   **Servidor ASGI**: Uvicorn (v0.27.1)
*   **Base de Datos**: PostgreSQL
*   **Driver BD**: psycopg2-binary (v2.9.9)
*   **Validación de Datos**: Pydantic (v2.6.1) + Pydantic Settings (v2.1.0)

### Librerías Clave

*   **Procesamiento de Datos**:
    *   `pandas`: Manipulación de datos y exportación a Excel.
    *   `openpyxl`: Soporte para archivos Excel (.xlsx).
    *   `lxml`: Parsing de XML de facturas electrónicas colombianas (UBL 2.1).
*   **Generación de Reportes**:
    *   `fpdf`: Generación de reportes PDF.
*   **Integración Gmail**:
    *   `google-api-python-client`: Cliente de la API de Google.
    *   `google-auth-httplib2`, `google-auth-oauthlib`: Autenticación OAuth2 para Gmail.
*   **Utilidades**:
    *   `python-dotenv`: Gestión de variables de entorno.
    *   `python-multipart`: Manejo de subida de archivos.
    *   `rich`: Logging formateado y visualización en consola.

## Arquitectura

El proyecto sigue una arquitectura limpia (**Clean Architecture**) con una clara separación de responsabilidades en capas hexagonales:

### 1. Domain (`src/domain`)
Contiene la lógica de negocio pura, entidades y contratos (puertos).
*   `models/`: Entidades de datos del dominio de facturas:
    *   `invoice.py`: Modelo `InvoiceMetadata` e `InvoiceTaxDetail` para representar facturas y sus impuestos.
    *   `tax.py`: Modelo `Tax` para configuración de códigos de impuestos DIAN.
    *   `tax_rate.py`: Modelo `TaxRate` para tasas específicas de cada impuesto.
    *   `grouping.py`: Modelo `Grouping` para agrupaciones contables (suma, resta, ignora).
*   `ports/`: Interfaces (contratos) que definen los repositorios y servicios externos:
    *   `factura_repository.py`: Puerto para persistencia de facturas.
    *   `tax_repository.py`, `tax_rate_repository.py`, `grouping_repository.py`: Puertos de catálogos.
    *   `gmail_port.py`: Puerto para integración con Gmail API.

### 2. Application (`src/application`)
Implementa los casos de uso orquestando el dominio y la infraestructura.
*   `services/`: Servicios de aplicación que implementan la lógica de negocio:
    *   `InvoiceProcessorService`: Corazón del sistema; extrae facturas de Gmail, parsea XML UBL, y persiste datos.
    *   `ExporterService`: Genera reportes en Excel/CSV/PDF con datos de facturas filtradas.
    *   `TaxService`: Gestión de la configuración de impuestos DIAN y su relación con agrupaciones.
    *   `TaxRateService`: Gestión de tasas de impuestos (IVA 19%, ReteFuente 2.5%, etc.).
    *   `GroupingService`: Gestión de agrupaciones contables para clasificación de impuestos.

### 3. Infrastructure (`src/infrastructure`)
Implementaciones concretas de los puertos y servicios externos.
*   `api/`: Capa de presentación con FastAPI:
    *   `main.py`: Configuración de la app, CORS, y registro de routers.
    *   `routes/`: Endpoints organizados por dominio:
        *   `invoice_routes.py`: CRUD de facturas, importación, filtros.
        *   `tax_routes.py`: Configuración de códigos de impuestos DIAN.
        *   `tax_rate_routes.py`: Gestión de tasas de impuestos.
        *   `grouping_routes.py`: Gestión de agrupaciones contables.
        *   `util_routes.py`: Utilidades (health check, etc.).
*   `database/`: Implementación PostgreSQL de los repositorios:
    *   `connection.py`: Pool de conexiones y configuración de BD.
    *   `postgres_factura_repository.py`: Queries de facturas con filtros complejos.
    *   `postgres_tax_repository.py`: Persistencia de configuración de impuestos.
    *   `postgres_tax_rate_repository.py`: Persistencia de tasas de impuestos.
    *   `postgres_grouping_repository.py`: Persistencia de agrupaciones.
*   `external/`: Adaptadores para servicios externos:
    *   `google_gmail_service.py`: Implementación del puerto Gmail usando Google API.

## Módulos y Lógica Clave

### Procesamiento de Facturas Electrónicas XML
El sistema extrae facturas electrónicas colombianas en formato UBL 2.1:
1.  **Extracción de Gmail**: Busca correos con adjuntos ZIP/XML, filtra por etiquetas.
2.  **Parsing XML**: Soporta `Invoice`, `CreditNote` y `AttachedDocument` con facturas embebidas.
3.  **Normalización de Impuestos**: Extrae códigos DIAN (01=IVA, 04=ICA, 05=ReteIVA, 06=ReteFuente, etc.) y los clasifica según la configuración del maestro de impuestos.
4.  **Detección de Duplicados**: Evita reimportar facturas ya procesadas mediante combinación de NIT + número de factura.

### Motor de Impuestos (Tax Engine)
Sistema configurable para clasificar y agrupar impuestos:
*   **Códigos DIAN**: Mapeo de códigos tributarios colombianos a nombres descriptivos.
*   **Agrupaciones**: Permite definir si un impuesto suma, resta o se ignora en el total.
*   **Tasas Múltiples**: Soporta múltiples tasas por impuesto (IVA 0%, 5%, 19%, etc.).

### Exportación y Reportes
*   **Excel/CSV**: Exportación de listados filtrados por fecha, proveedor, NIT.
*   **PDF**: Generación de reportes consolidados con totales por agrupación.
*   **Organización de Archivos**: Los XML procesados se mueven a carpetas por año/mes.

### Integración con Docker
La aplicación está diseñada para correr en contenedores Docker:
*   Volúmenes montados para datos persistentes (`/app/data/`).
*   Variables de entorno para configuración de rutas y BD.
*   Soporte para desarrollo local y producción.

