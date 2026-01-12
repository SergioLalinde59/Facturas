# Configuración Docker - Facturas

Este documento describe la configuración Docker de la aplicación **Facturas**.

---

## Tecnologías Usadas

| Componente | Tecnología | Versión | Imagen Docker |
|------------|------------|---------|---------------|
| **Base de Datos** | PostgreSQL | 18 | `postgres:18-alpine` |
| **Backend** | Python | 3.11 | `python:3.11-slim` |
| **Framework API** | FastAPI | 0.109.2 | - |
| **Servidor ASGI** | Uvicorn | 0.27.1 | - |
| **Frontend** | React | 19 | - |
| **Build Tool** | Vite | 7 | - |
| **Node.js** | Node.js | 22 | `node:22-alpine` |
| **Servidor Web** | Nginx | stable | `nginx:stable-alpine` |
| **TypeScript** | TypeScript | 5 | - |

---

## Puertos Expuestos

| Servicio | Puerto Interno | Puerto Externo |
|----------|----------------|----------------|
| **PostgreSQL** | 5432 | **5434** |
| **Backend (API)** | 8000 | **8002** |
| **Frontend** | 80 | **5174** |

---

## Estructura de Contenedores

```
┌─────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │ facturas_db  │   │facturas_back │   │facturas_front│     │
│  │  PostgreSQL  │◄──│   FastAPI    │◄──│    React     │     │
│  │  :5434       │   │    :8002     │   │    :5174     │     │
│  └──────────────┘   └──────────────┘   └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Archivos Docker

| Archivo | Descripción |
|---------|-------------|
| `docker-compose.yml` | Define los 3 servicios: db, backend, frontend |
| `backend/Dockerfile` | Imagen Python 3.11-slim, puerto 8000 |
| `frontend/Dockerfile` | Multi-stage build: Node 22 + Nginx |
| `frontend/nginx.conf` | Config SPA con Gzip y cache |

---

## Comandos de Arranque

### Opción 1: Usar script PowerShell
```powershell
.\arranque_app.ps1
```

### Opción 2: Comandos manuales
```powershell
# Navegar al directorio
cd "f:\1. Cloud\4. AI\1. Antigravity\Facturas"

# Construir y levantar contenedores
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## Acceso a la Aplicación

| URL | Descripción |
|-----|-------------|
| http://localhost:5174 | Frontend |
| http://facturas.local:5174 | Frontend (dominio local) |
| http://localhost:8002 | Backend API |
| http://localhost:8002/docs | Swagger Docs |

---

## Variables de Entorno (.env)

```env
DB_USER=postgres
DB_PASSWORD=<tu_contraseña>
DB_NAME=Facturas
```

---

## Dominio Local

Para acceder via `http://facturas.local:5174`, agregar al archivo hosts:

```
C:\Windows\System32\drivers\etc\hosts
```

Línea a agregar:
```
127.0.0.1   facturas.local
```

---

## Comandos Útiles

```powershell
# Ver contenedores corriendo
docker ps --filter "name=facturas_"

# Reiniciar un servicio
docker-compose restart backend

# Reconstruir solo un servicio
docker-compose up -d --build backend

# Limpiar todo (incluye volúmenes)
docker-compose down -v
```

---

## Repositorio GitHub

https://github.com/SergioLalinde59/Facturas
