#!/bin/bash

# Colores
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m' # Sin color

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${CYAN}Docker no está corriendo. Iniciándolo...${NC}"
        sudo service docker start
        echo -e "${CYAN}Esperando a Docker...${NC}"
        while ! docker info > /dev/null 2>&1; do
            sleep 5
        done
        echo -e "${CYAN}Docker está listo!${NC}"
    fi
}

show_status() {
    echo ""
    echo -e "${CYAN}===== ESTADO DE CONTENEDORES =====${NC}"
    docker-compose ps
    echo -e "${CYAN}==================================${NC}"
    echo ""
}

clear
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}        MVTOS APP - DOCKER LAUNCHER          ${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo -e "${YELLOW} ESTADO${NC}"
echo "  1. Ver Estado de Contenedores"
echo ""
echo -e "${YELLOW} TODOS LOS SERVICIOS${NC}"
echo "  2. Iniciar Todos"
echo "  3. Detener Todos"
echo "  4. Reiniciar Todos"
echo ""
echo -e "${YELLOW} BACKEND${NC}"
echo "  5. Iniciar Backend"
echo "  6. Detener Backend"
echo "  7. Reiniciar Backend"
echo ""
echo -e "${YELLOW} FRONTEND${NC}"
echo "  8. Iniciar Frontend"
echo "  9. Detener Frontend"
echo " 10. Reiniciar Frontend"
echo ""
echo -e "${YELLOW} MANTENIMIENTO${NC}"
echo " 11. Limpiar Cache Docker & Reconstruir"
echo " 12. Ver Logs (Ctrl+C para salir)"
echo ""
echo "  0. Salir"
echo -e "${CYAN}=============================================${NC}"

read -p " Seleccione una opción (0-12): " choice

case $choice in
    1)
        show_status
        ;;
    2)
        check_docker
        echo -e "${GREEN}Iniciando TODOS los servicios...${NC}"
        docker-compose up -d --build
        ;;
    3)
        echo -e "${YELLOW}Deteniendo todos los contenedores...${NC}"
        docker-compose down
        ;;
    4)
        echo -e "${YELLOW}Reiniciando todos los servicios...${NC}"
        docker-compose down
        check_docker
        docker-compose up -d --build
        ;;
    5)
        check_docker
        echo -e "${GREEN}Iniciando Backend...${NC}"
        docker-compose up -d --build backend
        ;;
    6)
        echo -e "${YELLOW}Deteniendo Backend...${NC}"
        docker-compose stop backend
        ;;
    7)
        echo -e "${YELLOW}Reiniciando Backend...${NC}"
        docker-compose restart backend
        ;;
    8)
        check_docker
        echo -e "${GREEN}Iniciando Frontend...${NC}"
        docker-compose up -d --build frontend
        ;;
    9)
        echo -e "${YELLOW}Deteniendo Frontend...${NC}"
        docker-compose stop frontend
        ;;
    10)
        echo -e "${YELLOW}Reiniciando Frontend...${NC}"
        docker-compose restart frontend
        ;;
    11)
        echo -e "${YELLOW}Limpiando cache y reconstruyendo...${NC}"
        docker builder prune -af
        check_docker
        docker-compose up -d --build
        ;;
    12)
        echo -e "${CYAN}Mostrando logs (Ctrl+C para salir)...${NC}"
        docker-compose logs -f
        ;;
    0)
        echo -e "${GRAY}Saliendo...${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Opción no válida.${NC}"
        ;;
esac