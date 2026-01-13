# Servicios de Facturas.local

Este documento detalla los servicios necesarios para el funcionamiento de la aplicación **Facturas.local**, su propósito y los puertos en los que operan.

## Descripción de los Servicios

### 1. Frontend (Vite + React)
Es la interfaz de usuario de la aplicación. Permite visualizar el dashboard, consultar reportes de facturas, gestionar proveedores y realizar importaciones de archivos XML o correos electrónicos.
- **Entorno de Desarrollo:** Se ejecuta directamente en el host para permitir Hot Module Replacement (HMR).
- **Entorno de Producción:** Se sirve mediante un contenedor Nginx que también actúa como proxy inverso para la API.

### 2. Backend (FastAPI + Python)
Es el núcleo de la lógica de negocio. Se encarga de:
- Procesar correos electrónicos de Gmail para extraer facturas.
- Parsear archivos XML de facturas electrónicas.
- Gestionar la comunicación con la base de datos PostgreSQL.
- Exponer los endpoints de la API REST para el Frontend.

### 3. Base de Datos (PostgreSQL 18)
Servicio de almacenamiento persistente. Guarda toda la información de las facturas procesadas, datos de proveedores y configuraciones de la aplicación.
- **Ubicación:** Generalmente corre de forma nativa en el equipo o en un contenedor independiente accesible por el puerto 5433.

### 4. LocalServer (Puente Lógico / Nginx Proxy)
Un servidor Nginx externo (ubicado en la carpeta central de herramientas) que actúa como punto de entrada unificado. 
- Mapea el dominio local `http://facturas.local` hacia el puerto del Frontend.
- Facilita el acceso mediante nombres lógicos en lugar de direcciones IP y puertos.

---

## Tabla de Puertos y Accesos

A continuación se detallan los puertos utilizados por cada servicio:

| Servicio | Puerto Externo (Host) | Puerto Interno (Docker) | Acceso URL / Nota |
| :--- | :---: | :---: | :--- |
| **Frontend (Vite Dev)** | `5174` | - | `http://localhost:5174` |
| **Frontend (Nginx/Prod)** | `5174` | `80` | `http://facturas.local` (vía Proxy) |
| **Backend (API)** | `8002` | `8000` | `http://localhost:8002/api/docs` |
| **Base de Datos (Postgres)** | `5433` | `5432` | Host: `localhost:5433` |
| **LocalServer (Proxy)** | `80` | `80` | `http://facturas.local` |

---

## Interacción entre Servicios

1. El usuario accede a `http://facturas.local`.
2. El **LocalServer** redirige la petición al **Frontend** (puerto 5174).
3. El **Frontend** realiza peticiones a `/api/`, las cuales son interceptadas por el Nginx del frontend o redirigidas directamente al **Backend** (puerto 8002).
4. El **Backend** consulta y guarda datos en la **Base de Datos** (puerto 5433).
5. Para el procesamiento de correos, el **Backend** se conecta a los servidores IMAP de Gmail (puerto 993) utilizando las credenciales configuradas en el archivo `.env`.
