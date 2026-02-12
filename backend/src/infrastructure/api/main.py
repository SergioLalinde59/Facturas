from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from src.infrastructure.database.postgres_factura_repository import PostgresFacturaRepository
import os
import json
import subprocess
import logging
import sys
from datetime import date
from typing import Optional, List
from dotenv import load_dotenv

# Cargar variables de entorno desde el volumen montado
load_dotenv('/app/data/.env')

# Configuración
# Configuración
EXPORT_DIRECTORY = os.getenv('EXPORT_DIRECTORY', '/app/data/Data/Exportadas')
FACTURAS_PENDIENTES = os.getenv('FACTURAS_PENDIENTES', '/app/data/Data/Pendientes')
FACTURAS_PROCESADAS = os.getenv('FACTURAS_PROCESADAS', '/app/data/Data/Procesadas')

# Log important paths for debugging
logging.info(f"CONFIG: FACTURAS_PENDIENTES resolved to: {FACTURAS_PENDIENTES}")
logging.info(f"CONFIG: FACTURAS_PROCESADAS resolved to: {FACTURAS_PROCESADAS}")
logging.info(f"CONFIG: EXPORT_DIRECTORY resolved to: {EXPORT_DIRECTORY}")


# Configurar Logging - Usar ruta absoluta
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(BASE_DIR))), "app.log")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_PATH, encoding='utf-8')
    ]
)
logger = logging.getLogger("api")
logger.info(f"Iniciando API. Log en: {LOG_PATH}")

from src.api.routes import tax_routes, grouping_routes, tax_rate_routes, invoice_routes, util_routes

app = FastAPI(title="Gmail Invoice Processor API")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir el frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tax_routes.router)
app.include_router(grouping_routes.router)
app.include_router(tax_rate_routes.router)
app.include_router(invoice_routes.router)
app.include_router(util_routes.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
