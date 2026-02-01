from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import os
import json
import asyncio
import logging

from src.application.services.invoice_processor_service import InvoiceProcessorService
from src.application.services.exporter_service import ExporterService
from src.infrastructure.external.google_gmail_service import GoogleGmailService
from src.infrastructure.database.postgres_factura_repository import PostgresFacturaRepository

router = APIRouter(prefix="/api/v1/invoices", tags=["Invoices"])
logger = logging.getLogger("api.invoices")

# Configuración (shared with main or from env)
EXPORT_DIRECTORY = os.getenv('EXPORT_DIRECTORY', '/app/data/Data/Exportadas')
FACTURAS_PENDIENTES = os.getenv('FACTURAS_PENDIENTES', '/app/data/Data/Pendientes')
CREDENTIALS_PATH = os.path.abspath("credentials.json")
TOKEN_PATH = os.path.abspath("token.json")

# Repository instance
factura_repo = PostgresFacturaRepository()

class ProcessRequest(BaseModel):
    target_directory: Optional[str] = None
    max_emails: int = 5
    dry_run: bool = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    provider: Optional[str] = None
    filenames: Optional[List[str]] = None

class ExportDBRequest(BaseModel):
    output_directory: Optional[str] = None
    formats: List[str]
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    provider: Optional[str] = None

@router.post("/process")
async def process_invoices(request: ProcessRequest):
    logger.info(f"Petición POST /api/v1/invoices/process - Dir: {request.target_directory}, Límite: {request.max_emails}")
    try:
        if not os.path.exists(CREDENTIALS_PATH):
            logger.error(f"Archivo de credenciales no encontrado en: {CREDENTIALS_PATH}")
            raise FileNotFoundError(f"Falta 'credentials.json' en {CREDENTIALS_PATH}")

        gmail_service = GoogleGmailService(CREDENTIALS_PATH, TOKEN_PATH)
        processor = InvoiceProcessorService(gmail_service)
        
        actual_directory = request.target_directory or FACTURAS_PENDIENTES
        process_data = processor.process_all_new_invoices(actual_directory, request.max_emails)
        results = process_data["results"]
        stats = process_data["stats"]
        
        logger.info(f"Proceso completado en {actual_directory}. Resultados: {len(results)} correos.")
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

@router.get("/process-stream")
async def process_invoices_stream(
    target_directory: Optional[str] = Query(None),
    max_emails: int = Query(5),
    search_query: Optional[str] = Query(None)
):
    actual_directory = target_directory or FACTURAS_PENDIENTES
    logger.info(f"Petición GET /api/v1/invoices/process-stream - Dir: {actual_directory}, Límite: {max_emails}, Query: {search_query}")
    
    async def event_generator():
        try:
            if not os.path.exists(CREDENTIALS_PATH):
                yield f"data: {json.dumps({'type': 'error', 'message': f'Falta credentials.json en {CREDENTIALS_PATH}'})}\n\n"
                return

            gmail_service = GoogleGmailService(CREDENTIALS_PATH, TOKEN_PATH)
            processor = InvoiceProcessorService(gmail_service)
            
            for event in processor.process_all_new_invoices_generator(actual_directory, max_emails, search_query):
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.01)
                
        except Exception as e:
            logger.error(f"Error en streaming: {str(e)}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/import-db")
async def import_invoices_to_db(request: ProcessRequest):
    logger.info(f"Petición POST /api/v1/invoices/import-db - Dir: {request.target_directory}, Preview: {request.dry_run}")
    try:
        exporter = ExporterService()
        filters = {
            'start_date': request.start_date,
            'end_date': request.end_date,
            'provider': request.provider
        }
        actual_directory = request.target_directory or FACTURAS_PENDIENTES
        result = exporter.import_to_db(actual_directory, factura_repo, dry_run=request.dry_run, filters=filters, target_filenames=request.filenames)
        return result
    except Exception as e:
        logger.error(f"Error en import_invoices_to_db: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_invoices_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None)
):
    logger.info(f"Petición GET /api/v1/invoices/stats - Filtros: {start_date} a {end_date}")
    try:
        stats = factura_repo.get_stats(start_date, end_date)
        return {"stats": stats}
    except Exception as e:
        logger.error(f"Error en get_invoices_stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/providers")
async def get_providers(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None)
):
    try:
        providers = factura_repo.get_distinct_providers(start_date, end_date)
        return {"providers": providers}
    except Exception as e:
        logger.error(f"Error en get_providers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def get_invoices_list(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    provider: Optional[str] = Query(None)
):
    try:
        invoices = factura_repo.get_invoices(start_date, end_date, provider)
        return {"invoices": invoices, "count": len(invoices)}
    except Exception as e:
        logger.error(f"Error en get_invoices_list: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export-db")
async def export_invoices_db(request: ExportDBRequest):
    logger.info(f"Petición POST /api/v1/invoices/export-db - Formatos: {request.formats}")
    try:
        exporter = ExporterService()
        filters = {
            'start_date': request.start_date,
            'end_date': request.end_date,
            'provider': request.provider
        }
        output_dir = request.output_directory or EXPORT_DIRECTORY
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            
        result = exporter.export_from_db(factura_repo, filters, request.formats, output_dir)
        return result
    except Exception as e:
        logger.error(f"Error en export_invoices_db: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
