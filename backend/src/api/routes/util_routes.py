from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
import os
import logging

router = APIRouter(prefix="/api/v1/utils", tags=["Utilities"])
logger = logging.getLogger("api.utils")

@router.get("/list-directory")
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

@router.get("/view-file")
async def view_file(path: str):
    """Sirve un archivo local (como un PDF) para ser visualizado en el navegador."""
    logger.info(f"Petición GET /api/v1/utils/view-file - Archivo: {path}")
    try:
        if not os.path.exists(path):
             logger.warning(f"Archivo no encontrado: {path}")
             raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {path}")
        
        if not os.path.isfile(path):
             raise HTTPException(status_code=400, detail="La ruta no es un archivo")

        # Determinar el media type basado en la extensión
        media_type = "application/octet-stream"
        if path.lower().endswith('.pdf'):
            media_type = "application/pdf"
        elif path.lower().endswith('.xml'):
            media_type = "application/xml"
        elif path.lower().endswith('.png'):
            media_type = "image/png"
        elif path.lower().endswith('.jpg') or path.lower().endswith('.jpeg'):
            media_type = "image/jpeg"

        return FileResponse(path, media_type=media_type)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sirviendo archivo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
