from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.application.services.invoice_processor_service import InvoiceProcessorService
from src.application.services.exporter_service import ExporterService
from src.infrastructure.external.google_gmail_service import GoogleGmailService
from src.infrastructure.database.postgres_factura_repository import PostgresFacturaRepository
import os
import asyncio
import subprocess
import logging
import sys
from datetime import date
from typing import Optional, List

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

app = FastAPI(title="Gmail Invoice Processor API")

# Configurar CORS robusto
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

class ProcessRequest(BaseModel):
    target_directory: str
    max_emails: int = 5
    dry_run: bool = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    provider: Optional[str] = None

CREDENTIALS_PATH = os.path.abspath("credentials.json")
TOKEN_PATH = os.path.abspath("token.json")

# Instancia global del repositorio
factura_repo = PostgresFacturaRepository()

@app.get("/api/v1/utils/list-directory")
async def list_directory(path: str = Query("/app/data")):
    logger.info(f"Listando directorio: {path}")
    try:
        if not os.path.exists(path):
             raise HTTPException(status_code=404, detail="Ruta no encontrada")
        
        if not os.path.isdir(path):
             raise HTTPException(status_code=400, detail="La ruta no es un directorio")

        items = []
        with os.scandir(path) as it:
            for entry in it:
                if entry.name.startswith('.'): continue
                items.append({
                    "name": entry.name,
                    "type": "directory" if entry.is_dir() else "file",
                    "path": entry.path
                })
        
        items.sort(key=lambda x: (x["type"] != "directory", x["name"].lower()))
        parent_path = os.path.dirname(path)
        
        return {
            "current_path": path,
            "parent_path": parent_path,
            "items": items
        }
    except Exception as e:
        logger.error(f"Error listando directorio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/invoices/process")
async def process_invoices(request: ProcessRequest):
    logger.info(f"Petición POST /api/v1/invoices/process - Dir: {request.target_directory}, Límite: {request.max_emails}")
    try:
        if not os.path.exists(CREDENTIALS_PATH):
            logger.error(f"Archivo de credenciales no encontrado en: {CREDENTIALS_PATH}")
            raise FileNotFoundError(f"Falta 'credentials.json' en {CREDENTIALS_PATH}")

        gmail_service = GoogleGmailService(CREDENTIALS_PATH, TOKEN_PATH)
        processor = InvoiceProcessorService(gmail_service)
        
        process_data = processor.process_all_new_invoices(request.target_directory, request.max_emails)
        results = process_data["results"]
        stats = process_data["stats"]
        
        logger.info(f"Proceso completado. Resultados: {len(results)} correos.")
        return {
            "status": "completed",
            "results": results,
            "stats": stats,
            "message": f"Se procesaron {len(results)} correos."
        }
    except FileNotFoundError as e:
        logger.warning(f"Configuration error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Falta archivo de configuración: {str(e)}")
    except Exception as e:
        logger.error(f"Error crítico en process_invoices: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.post("/api/v1/invoices/import-db")
async def import_invoices_to_db(request: ProcessRequest):
    logger.info(f"Petición POST /api/v1/invoices/import-db - Dir: {request.target_directory}, Preview: {request.dry_run}, Filtros: {request.start_date} a {request.end_date}, Prov: {request.provider}")
    try:
        exporter = ExporterService()
        filters = {
            'start_date': request.start_date,
            'end_date': request.end_date,
            'provider': request.provider
        }
        result = exporter.import_to_db(request.target_directory, factura_repo, dry_run=request.dry_run, filters=filters)
        return result
    except Exception as e:
        logger.error(f"Error en import_invoices_to_db: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/invoices/stats")
async def get_invoices_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None)
):
    """Endpoint para obtener estadísticas del dashboard"""
    logger.info(f"Petición GET /api/v1/invoices/stats - Filtros: {start_date} a {end_date}")
    try:
        stats = factura_repo.get_stats(start_date, end_date)
        return {"stats": stats}
    except Exception as e:
        logger.error(f"Error en get_invoices_stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/invoices/providers")
async def get_providers(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None)
):
    logger.info(f"Petición GET /api/v1/invoices/providers - Filtros: {start_date} a {end_date}")
    try:
        providers = factura_repo.get_distinct_providers(start_date, end_date)
        logger.info(f"Proveedores encontrados: {len(providers)}")
        return {"providers": providers}
    except Exception as e:
        logger.error(f"Error en get_providers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class ExportDBRequest(BaseModel):
    output_directory: str
    formats: List[str]
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    provider: Optional[str] = None

@app.get("/api/v1/invoices")
async def get_invoices_list(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    provider: Optional[str] = Query(None)
):
    logger.info(f"Petición GET /api/v1/invoices - Filtros: {start_date} a {end_date}, Prov: {provider}")
    try:
        invoices = factura_repo.get_invoices(start_date, end_date, provider)
        return {"invoices": invoices, "count": len(invoices)}
    except Exception as e:
        logger.error(f"Error en get_invoices_list: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/invoices/export-db")
async def export_invoices_db(request: ExportDBRequest):
    logger.info(f"Petición POST /api/v1/invoices/export-db - Formatos: {request.formats}")
    try:
        exporter = ExporterService()
        filters = {
            'start_date': request.start_date,
            'end_date': request.end_date,
            'provider': request.provider
        }
        result = exporter.export_from_db(factura_repo, filters, request.formats, request.output_directory)
        return result
    except Exception as e:
        logger.error(f"Error en export_invoices_db: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok"}
