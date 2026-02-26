# Problema de Conexión BD - Backend Docker vs PostgreSQL Local

## Fecha
2026-02-11

## Contexto
La aplicación corre en Docker Compose con 3 servicios: `facturas_db` (PostgreSQL), `facturas_backend` (FastAPI) y `facturas_frontend` (Vite/React). Adicionalmente, existe una instalación de PostgreSQL local en Windows que escucha en el puerto 5433.

## Problema
El backend dentro del contenedor Docker no encontraba tablas ni datos al conectarse a la base de datos, aunque desde el equipo local (localhost:5433) la BD tenía 394 facturas y todas las tablas creadas.

## Diagnóstico

### Dos PostgreSQL en el puerto 5433
Se descubrió que había **dos procesos** escuchando en el puerto 5433:

| PID  | Proceso      | Descripción                                    |
|------|--------------|------------------------------------------------|
| 8428 | `postgres`   | PostgreSQL local instalado en Windows          |
| 5408 | `host-switch` | Proxy de Rancher Desktop (Docker) para el contenedor `facturas_db` |

### Flujo de conexión antes del fix

```
Backend container ──→ db:5432 ──→ Contenedor facturas_db ❌ (vacío, sin tablas)

localhost:5433 ──→ PostgreSQL LOCAL Windows ✅ (394 facturas, 5 tablas con datos)
```

El `docker-compose.yml` configuraba el backend con:
```yaml
- DB_HOST=db        # Nombre del servicio Docker (contenedor PostgreSQL vacío)
- DB_PORT=5432      # Puerto interno del contenedor
```

Esto hacía que el backend se conectara al contenedor `facturas_db` que estaba vacío, mientras que todos los datos reales estaban en el PostgreSQL local de Windows.

### Verificación
Desde dentro del contenedor backend:
```bash
docker exec facturas_backend python -c "..."
# Resultado: host=db, port=5432 → 0 tablas
```

Desde la máquina local:
```python
psycopg2.connect(host='localhost', port='5433', database='Facturas', ...)
# Resultado: 5 tablas, 394 facturas
```

## Solución

Se modificó `docker-compose.yml` para que el backend apunte al PostgreSQL local de Windows usando `host.docker.internal`:

### Antes
```yaml
backend:
  environment:
    - DB_HOST=db
    - DB_PORT=5432
```

### Después
```yaml
backend:
  environment:
    - DB_HOST=host.docker.internal
    - DB_PORT=5433
```

`host.docker.internal` es un DNS especial de Docker que resuelve a la IP del host (la máquina Windows), permitiendo que el contenedor acceda a servicios locales.

### Aplicar el cambio
Un simple `docker compose restart` **no** recarga variables de entorno del `docker-compose.yml`. Se requiere recrear el contenedor:

```bash
docker compose up -d backend
```

### Verificación post-fix
```bash
docker exec facturas_backend python -c "..."
# Resultado: host=host.docker.internal, port=5433 → 5 tablas, 394 facturas ✅
```

## Flujo de conexión actual

```
Backend container ──→ host.docker.internal:5433 ──→ PostgreSQL LOCAL Windows ✅
```

| Tabla             | Registros |
|-------------------|-----------|
| agrupaciones      | 5         |
| taxes             | 17        |
| tax_rates         | 3         |
| facturas          | 394       |
| facturas_detalle  | 372       |

## Notas importantes
- El contenedor `facturas_db` sigue activo pero no se usa. Puede detenerse o dejarse como respaldo.
- Si se desinstala el PostgreSQL local de Windows, habría que migrar los datos al contenedor y revertir `DB_HOST=db` / `DB_PORT=5432`.
- `host.docker.internal` funciona en Docker Desktop y Rancher Desktop (Windows/Mac). En Linux puede requerir configuración adicional (`extra_hosts`).
