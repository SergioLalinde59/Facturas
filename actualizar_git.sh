#!/bin/bash
# Script para sincronizar cambios con GitHub
# Repositorio: https://github.com/SergioLalinde59/conciliacion

set -e

clear
echo "=========================================="
echo "   Sincronizacion con GitHub"
echo "=========================================="
echo ""

# Mostrar informacion del ultimo commit
echo "Ultimo commit registrado:"
ultimo_commit=$(git log -1 --pretty=format:"%h - %s (%cr)" 2>/dev/null)
if [ -n "$ultimo_commit" ]; then
    echo "   $ultimo_commit"
else
    echo "   No hay commits previos"
fi
echo ""

# Mostrar resumen de cambios pendientes
echo "Cambios pendientes:"
change_count=$(git status --short 2>/dev/null | wc -l)
if [ "$change_count" -gt 0 ]; then
    echo "   $change_count archivos modificados/nuevos"
else
    echo "   No hay cambios pendientes"
fi
echo ""
echo "------------------------------------------"
echo ""

# 1. Pedir descripcion
read -p "Ingrese una descripcion para la actualizacion: " descripcion

# Validar descripcion
if [ -z "$descripcion" ]; then
    echo "Error: La descripcion no puede estar vacia."
    exit 1
fi

# 2. Agregar todos los cambios
echo "1. Agregando cambios..."
git add .

# 3. Realizar commit
echo "2. Confirmando cambios (Commit)..."
if git commit -m "$descripcion" 2>&1; then
    echo "   Commit realizado: $descripcion"
else
    if git status | grep -q "nothing to commit"; then
        echo "   No hay cambios nuevos para confirmar."
    else
        echo "Error en git commit."
        exit 1
    fi
fi

# 4. Traer cambios remotos
echo "3. Verificando cambios remotos (Pull)..."
if git pull origin main --rebase; then
    echo "   Repositorio local actualizado"
else
    echo "Error al traer cambios remotos. Resuelva conflictos manualmente."
    exit 1
fi

# 5. Enviar cambios (Push)
echo "4. Enviando cambios a GitHub (Push)..."
if git push origin main; then
    echo ""
    echo "Actualizacion completada exitosamente."
else
    echo ""
    echo "Error al ejecutar git push."
    exit 1
fi

echo ""
read -p "Presione Enter para salir..."
