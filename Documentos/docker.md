# Configuración Docker - Facturas

Este documento describe la configuración Docker de la aplicación **Facturas** en modo **desarrollo**.

---

## Tecnologías Usadas

| Componente | Tecnología | Versión | Imagen Docker |
|------------|------------|---------|---------------|
| **Base de Datos** | PostgreSQL | 18 | `postgres:18-alpine` |
| **Backend** | Python | 3.11 | `python:3.11-slim` |
| **Framework API** | FastAPI | 0.109.2 | - |
| **Servidor ASGI** | Uvicorn | 0.27.1 | - |
| **Frontend** | React | 19.2.3 | - |
| **Build Tool** | Vite | 7.2.4 | - |
| **Node.js** | Node.js | 22 | `node:22-alpine` |
| **TypeScript** | TypeScript | 5.9.3 | - |

### Dependencias Backend (Python)
```
fastapi==0.109.2
uvicorn[standard]==0.27.1
psycopg2-binary==2.9.9
pydantic==2.6.1
pydantic-settings==2.1.0
python-dotenv==1.0.1
requests==2.31.0
python-multipart==0.0.9
email-validator==2.1.0.post1
pdfplumber
lxml
pandas
openpyxl
fpdf
google-api-python-client
google-auth-httplib2
google-auth-oauthlib
rich
```

### Dependencias Frontend (Node.js)
- React 19.2.3
- React Router DOM 7.11.0
- TanStack React Query 5.90.16
- TailwindCSS 4.1.18
- Axios 1.13.4
- Lucide React 0.562.0
- jsPDF 4.0.0 + jspdf-autotable 5.0.7
- Recharts 3.6.0
- React Hot Toast 2.6.0
- XLSX 0.18.5

---

## Puertos Expuestos

| Servicio | Puerto Interno | Puerto Externo | Descripción |
|----------|----------------|----------------|-------------|
| **PostgreSQL** | 5432 | 5434 | Base de datos |
| **Backend (API)** | 8000 | 8002 | API REST FastAPI |
| **Frontend** | 5174 | 5174 | Vite dev server (hot reload) |

---

## Estructura de Contenedores

```
┌─────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │     db       │   │   backend    │   │   frontend   │     │
│  │  PostgreSQL  │◄──│   FastAPI    │◄──│  Vite (dev)  │     │
│  │  :5434       │   │    :8002     │   │    :5174     │     │
│  └──────────────┘   └──────────────┘   └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Conexión Backend → DB**: El backend usa `host.docker.internal` para conectar a PostgreSQL en el puerto **5434** del host.

**Conexión Frontend → Backend**: El frontend usa un proxy interno (`API_PROXY_TARGET=http://backend:8000`) a través de la red Docker, sin pasar por el puerto externo.

---

## Archivos Docker

### docker-compose.yml (Raíz del proyecto)
Define los 3 servicios principales:
- **db**: Base de datos PostgreSQL con timezone `America/Bogota`
- **backend**: API FastAPI con hot reload (volúmenes montados)
- **frontend**: Vite dev server con hot reload (volúmenes montados)

### backend/Dockerfile
- Imagen base: `python:3.11-slim`
- Puerto interno: 8000
- Comando: `uvicorn src.infrastructure.api.main:app --host 0.0.0.0 --port 8000 --reload`

### frontend/Dockerfile.dev (usado en desarrollo)
- Imagen base: `node:22-alpine`
- Puerto interno: 5174
- Comando: `npm run dev -- --host 0.0.0.0`
- Hot reload habilitado via volúmenes montados

### frontend/Dockerfile (producción - no usado actualmente)
- Multi-stage build:
  1. **Build**: `node:22-alpine` - Compila la app React
  2. **Producción**: `nginx:stable-alpine` - Sirve los archivos estáticos
- Puerto interno: 80

### frontend/nginx.conf (producción - no usado actualmente)
- Configuración para SPA (Single Page Application)
- Compresión Gzip habilitada
- Cache de assets estáticos

---

## Variables de Entorno

### Base de Datos (db)
| Variable | Valor | Descripción |
|----------|-------|-------------|
| `TZ` | `America/Bogota` | Zona horaria |
| `POSTGRES_USER` | `${DB_USER:-postgres}` | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | `${DB_PASSWORD:-postgres}` | Contraseña de PostgreSQL |
| `POSTGRES_DB` | `${DB_NAME:-Facturas}` | Nombre de la base de datos |

### Backend
| Variable | Valor | Descripción |
|----------|-------|-------------|
| `DB_HOST` | `host.docker.internal` | Host de la BD (accede al host desde Docker) |
| `DB_PORT` | `5434` | Puerto externo de PostgreSQL |
| `DB_NAME` | `${DB_NAME:-Facturas}` | Nombre de la BD |
| `DB_USER` | `${DB_USER:-postgres}` | Usuario de la BD |
| `DB_PASSWORD` | `${DB_PASSWORD}` | Contraseña de la BD |
| `ENVIRONMENT` | `development` | Modo de ejecución |
| `FACTURAS_PENDIENTES` | `/app/data/Data/Pendientes` | Ruta de facturas por procesar |
| `FACTURAS_PROCESADAS` | `/app/data/Data/Procesadas` | Ruta de facturas procesadas |
| `EXPORT_DIRECTORY` | `/app/data/Data/Exportadas` | Ruta de facturas exportadas |

### Frontend
| Variable | Valor | Descripción |
|----------|-------|-------------|
| `API_PROXY_TARGET` | `http://backend:8000` | URL interna del backend para el proxy |

### Archivo .env (raíz del proyecto)
```env
DB_USER=postgres
DB_PASSWORD=<tu_contraseña>
DB_NAME=Facturas
```

---

## Volúmenes

### Volúmenes Persistentes
| Volumen | Destino | Descripción |
|---------|---------|-------------|
| `facturas_postgres_data` | `/var/lib/postgresql/data` | Datos de PostgreSQL |

### Volúmenes de Desarrollo (bind mounts)
| Host | Contenedor | Servicio | Descripción |
|------|------------|----------|-------------|
| `./backend` | `/app` | backend | Código fuente del backend (hot reload) |
| `.` (raíz) | `/app/data` | backend | Acceso a carpetas Data/ del proyecto |
| `./frontend` | `/app` | frontend | Código fuente del frontend (hot reload) |
| `/app/node_modules` | - | frontend | Excluye node_modules del bind mount |

---

## Healthcheck

El servicio **db** tiene un healthcheck configurado que el backend espera antes de iniciar:

```yaml
healthcheck:
  test: [ "CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-Facturas}" ]
  interval: 10s
  timeout: 5s
  retries: 5
```

---

## Cómo Correr la Aplicación

### 1. Prerrequisitos
- Docker Desktop instalado y corriendo
- Archivo `.env` configurado en la raíz del proyecto

### 2. Comandos de Arranque

```powershell
# Navegar al directorio del proyecto
cd "f:\1. Cloud\4. AI\1. Antigravity\Facturas"

# Construir y levantar contenedores
docker-compose up -d --build

# Ver logs en tiempo real
docker-compose logs -f

# Detener contenedores
docker-compose down
```

### 3. Script de Arranque (arranque_app.sh)

También existe un script interactivo con menú para gestionar los contenedores:

```bash
bash arranque_app.sh
```

Opciones disponibles:
- Ver estado de contenedores
- Iniciar/Detener/Reiniciar todos los servicios
- Iniciar/Detener/Reiniciar backend o frontend individualmente
- Limpiar cache Docker y reconstruir
- Ver logs

### 4. Acceso a la Aplicación
- **Frontend (Web)**: http://localhost:5174
- **Backend (API)**: http://localhost:8002
- **API Docs (Swagger)**: http://localhost:8002/docs

---

## Configurar Nombre Personalizado (Dominio Local)

Para acceder via `http://facturas.local:5174`:

### 1. Editar archivo hosts (Como Administrador)
```powershell
notepad C:\Windows\System32\drivers\etc\hosts
```

### 2. Agregar línea
```
127.0.0.1   facturas.local
```

### 3. Acceder
- http://facturas.local:5174

---

## Resumen de Puertos (Facturas vs ConciliacionWeb)

| Servicio | ConciliacionWeb | Facturas |
|----------|-----------------|----------|
| PostgreSQL | 5432 | 5434 |
| Backend | 8000 | 8002 |
| Frontend | 5173 | 5174 |

---

## Comandos Útiles

```powershell
# Ver contenedores corriendo
docker ps

# Ver logs de un servicio específico
docker-compose logs -f backend

# Reiniciar un servicio
docker-compose restart backend

# Reconstruir solo un servicio
docker-compose up -d --build backend

# Limpiar todo (incluye volúmenes - BORRA datos de BD)
docker-compose down -v

# Limpiar cache de Docker
docker builder prune -af

# Ver uso de recursos
docker stats
```

---

## Notas Importantes

1. **Modo Desarrollo**: La configuración actual usa Vite dev server y volúmenes montados para hot reload tanto en backend como en frontend. Los cambios en código se reflejan automáticamente sin reconstruir los contenedores.

2. **Volúmenes persistentes**: Los datos de PostgreSQL se guardan en el volumen `facturas_postgres_data`, no se pierden al reiniciar. Solo se borran con `docker-compose down -v`.

3. **Puerto DB conflicto**: Si se ejecutan ambas apps (ConciliacionWeb + Facturas), cada una usa puertos diferentes para evitar conflictos.

4. **Host Docker**: El backend usa `host.docker.internal` para conectar a la BD del host (fuera del contenedor Docker).

5. **Rutas de archivos**: Las carpetas `Data/Pendientes`, `Data/Procesadas` y `Data/Exportadas` se montan desde la raíz del proyecto al contenedor del backend via el volumen `.:/app/data`.

6. **Producción**: Existen `frontend/Dockerfile` y `frontend/nginx.conf` listos para un despliegue en producción con Nginx, pero no se usan en la configuración actual de desarrollo.