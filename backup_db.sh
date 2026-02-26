#!/bin/bash
# =============================================================================
# Backup completo de la base de datos Facturas (PostgreSQL)
# Incluye: DDL (tablas, índices, FK, secuencias, triggers) + datos
# Genera: .sql (texto plano) + .dump (formato custom comprimido)
# =============================================================================

set -euo pipefail

CONTAINER="facturas_db"
DB_NAME="Facturas"
DB_USER="postgres"
BACKUP_DIR="./Data/Backup"
DATE=$(date +%Y-%m-%d)
BASE_NAME="${DATE} facturas full back"

# Verificar que el contenedor está corriendo
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "ERROR: El contenedor '${CONTAINER}' no está corriendo."
    echo "Inicia la aplicación con: docker compose up -d"
    exit 1
fi

# Crear directorio de backup si no existe
mkdir -p "${BACKUP_DIR}"

echo "=========================================="
echo " Backup de BD Facturas - ${DATE}"
echo "=========================================="

# --- Backup formato SQL (texto plano, legible) ---
SQL_FILE="${BACKUP_DIR}/${BASE_NAME}.sql"
echo ""
echo "[1/2] Generando backup SQL: ${SQL_FILE}"
docker exec "${CONTAINER}" pg_dump \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --create \
    --clean \
    --if-exists \
    --verbose \
    --format=plain \
    --no-owner \
    --no-privileges \
    2>/dev/null > "${SQL_FILE}"
echo "      OK - $(du -h "${SQL_FILE}" | cut -f1)"

# --- Backup formato Custom (comprimido, restauración selectiva) ---
DUMP_FILE="${BACKUP_DIR}/${BASE_NAME}.dump"
echo ""
echo "[2/2] Generando backup DUMP: ${DUMP_FILE}"
docker exec "${CONTAINER}" pg_dump \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --create \
    --clean \
    --if-exists \
    --verbose \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-privileges \
    2>/dev/null > "${DUMP_FILE}"
echo "      OK - $(du -h "${DUMP_FILE}" | cut -f1)"

echo ""
echo "=========================================="
echo " Backup completado exitosamente"
echo "=========================================="
echo ""
echo " Archivos generados:"
echo "   SQL:  ${SQL_FILE}"
echo "   DUMP: ${DUMP_FILE}"
echo ""
echo " Para restaurar desde SQL:"
echo "   docker exec -i ${CONTAINER} psql -U ${DB_USER} < \"${SQL_FILE}\""
echo ""
echo " Para restaurar desde DUMP:"
echo "   docker exec -i ${CONTAINER} pg_restore -U ${DB_USER} -d ${DB_NAME} --clean --if-exists < \"${DUMP_FILE}\""
echo ""