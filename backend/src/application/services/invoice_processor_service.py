import zipfile
import io
import os
import logging
from lxml import etree
from datetime import datetime
from src.domain.ports.gmail_port import GmailPort
from src.domain.models.invoice import InvoiceMetadata
from typing import List, Dict, Any, Tuple, Optional

UBL_NAMESPACES = {
    'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'invoice': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
}

logger = logging.getLogger("invoice_processor")

class InvoiceProcessorService:
    def __init__(self, gmail_service: GmailPort):
        self.gmail_service = gmail_service
        self.processed_label = "Factura_Procesada"

    def process_all_new_invoices(self, target_directory: str, max_emails: int = None):
        logger.info(f"Iniciando procesamiento de facturas en: {target_directory}")
        if not os.path.exists(target_directory):
            logger.info(f"Creando directorio de destino: {target_directory}")
            os.makedirs(target_directory, exist_ok=True)

        self.gmail_service.ensure_label_exists(self.processed_label)
        messages = self.gmail_service.search_unprocessed_emails(self.processed_label)
        
        logger.info(f"Se encontraron {len(messages)} correos sin procesar.")
        
        # Procesar de más antiguo a más nuevo
        messages.reverse()
        
        # Aplicar límite si se especifica
        if max_emails and max_emails > 0:
            messages = messages[:max_emails]
            logger.info(f"Límite aplicado: procesando solo los {len(messages)} correos más antiguos.")
        else:
            logger.info(f"Procesando {len(messages)} correos (sin límite).")
        
        results = []
        stats = {
            "total_scanned": len(messages),
            "successful": 0,
            "trashed": 0,
            "errors": 0,
            "files_saved": 0
        }

        for msg in messages:
            msg_id = msg['id']
            # Metadatos del mensaje detectado para logging inicial
            initial_metadata = self.gmail_service.get_message_metadata(msg_id)
            
            logger.info(f"Procesando correo de: {initial_metadata.get('from')} (ID: {msg_id})")
            try:
                success, saved_files, deep_metadata = self._process_email(msg_id, target_directory)
                
                # Usar metadatos del correo más profundo que contiene el ZIP, o el inicial como fallback
                final_metadata = deep_metadata if deep_metadata else initial_metadata
                
                res = {
                    "msg_id": msg_id, 
                    "sender": final_metadata.get("from"),
                    "subject": final_metadata.get("subject"),
                    "date": final_metadata.get("date"),
                    "attachments": saved_files,
                    "count": len(saved_files)
                }
                
                if success:
                    logger.info(f"Correo {msg_id} procesado exitosamente usando metadatos de {final_metadata.get('from')}. Archivos: {len(saved_files)}")
                    self.gmail_service.mark_as_processed(msg_id, self.processed_label)
                    res["status"] = "success"
                    stats["successful"] += 1
                    stats["files_saved"] += len(saved_files)
                else:
                    logger.warning(f"No se encontraron facturas válidas en el hilo del correo {msg_id}. Moviendo a la papelera.")
                    self.gmail_service.trash_message(msg_id)
                    res["status"] = "no_valid_invoices"
                    stats["trashed"] += 1
                
                results.append(res)
            except Exception as e:
                logger.error(f"Error procesando el correo {msg_id}: {str(e)}", exc_info=True)
                stats["errors"] += 1
                results.append({
                    "msg_id": msg_id, 
                    "sender": initial_metadata.get("from"),
                    "subject": initial_metadata.get("subject"),
                    "date": initial_metadata.get("date"),
                    "status": "error", 
                    "error": str(e),
                    "attachments": [],
                    "count": 0
                })
        
        return {"results": results, "stats": stats}

    def _process_email(self, msg_id: str, target_dir: str) -> Tuple[bool, List[str], Optional[Dict[str, Any]]]:
        # Obtener metadatos básicos para conseguir el threadId
        meta = self.gmail_service.get_message_metadata(msg_id)
        thread_id = meta.get("threadId")
        
        if not thread_id:
            logger.debug(f"Correo {msg_id} no tiene threadId, procesando individualmente.")
            attachments = self.gmail_service.get_attachments(msg_id)
            success, saved_files = self._extract_zips_from_attachments(msg_id, attachments, target_dir)
            return success, saved_files, meta

        # Buscar en todo el hilo el correo más profundo (primero en orden cronológico) con el ZIP
        logger.info(f"Escaneando hilo {thread_id} para buscar el correo original con el ZIP...")
        thread_messages = self.gmail_service.get_thread_messages(thread_id)
        
        logger.debug(f"El hilo contiene {len(thread_messages)} mensajes.")
        
        for i, msg_obj in enumerate(thread_messages):
            attachments = self.gmail_service.extract_attachments(msg_obj)
            zip_attachments = [a for a in attachments if a['filename'].lower().endswith('.zip')]
            
            # Extraer metadatos de este mensaje para logging
            current_meta = self.gmail_service.extract_metadata(msg_obj)
            
            if zip_attachments:
                logger.info(f"Encontrado ZIP en mensaje index {i} (ID: {msg_obj.get('id')}) de: {current_meta.get('from')} el {current_meta.get('date')}")
                
                success, saved_files = self._extract_zips_from_attachments(msg_obj['id'], zip_attachments, target_dir)
                if success:
                    logger.debug(f"Procesado exitosamente usando metadatos profundos de: {current_meta.get('from')}")
                    return True, saved_files, current_meta
            else:
                logger.debug(f"Mensaje index {i} no contiene ZIP. (De: {current_meta.get('from')})")
        
        logger.warning(f"No se encontró ningún mensaje con ZIP en el hilo {thread_id}")
        return False, [], None

    def _extract_zips_from_attachments(self, msg_id: str, attachments: List[Dict[str, Any]], target_dir: str) -> Tuple[bool, List[str]]:
        saved_files = []
        for att in attachments:
            if att['filename'].lower().endswith('.zip'):
                logger.debug(f"Descargando adjunto ZIP: {att['filename']}")
                content = self.gmail_service.download_attachment(msg_id, att['attachmentId'])
                saved_filename = self._handle_zip(content, target_dir)
                if saved_filename:
                    saved_files.append(saved_filename)
        return len(saved_files) > 0, saved_files

    def _handle_zip(self, zip_content: bytes, target_dir: str) -> Optional[str]:
        try:
            with zipfile.ZipFile(io.BytesIO(zip_content)) as zf:
                filenames = zf.namelist()
                xml_files = [f for f in filenames if f.lower().endswith('.xml')]
                pdf_files = [f for f in filenames if f.lower().endswith('.pdf')]
                
                logger.debug(f"ZIP contiene {len(xml_files)} XMLs y {len(pdf_files)} PDFs.")
                
                if not xml_files:
                    return None

                # Buscar XML de factura (puede ser el XML directo o un AttachedDocument)
                invoice_data = None
                xml_data_bytes = None
                for xml_file in xml_files:
                    xml_content = zf.read(xml_file)
                    data = self._parse_xml(xml_content)
                    if data:
                        invoice_data = data
                        xml_data_bytes = xml_content
                        break
                
                if not invoice_data:
                    logger.warning("No se encontró un XML de factura válido (ni Invoice ni AttachedDocument) dentro del ZIP.")
                    return None

                # Limpiar caracteres prohibidos en nombres de archivo de Windows
                safe_supplier = "".join(c for c in invoice_data.supplier_name if c.isalnum() or c in (' ', '-', '_')).strip()
                base_name = f"{invoice_data.issue_date} {safe_supplier}"
                logger.info(f"Factura identificada: {base_name}")
                
                # Guardar XML
                xml_path = os.path.join(target_dir, f"{base_name}.xml")
                if os.path.exists(xml_path):
                    logger.info(f"La factura {base_name} ya existe en el directorio. Saltando.")
                    return f"{base_name}.xml" # Lo marcamos como éxito devolviendo el nombre
                
                with open(xml_path, 'wb') as f:
                    f.write(xml_data_bytes)

                # Guardar PDF correspondiente
                if pdf_files:
                    # Intentar encontrar el PDF que más se parezca al nombre del XML o simplemente el primero
                    pdf_content = zf.read(pdf_files[0])
                    pdf_path = os.path.join(target_dir, f"{base_name}.pdf")
                    with open(pdf_path, 'wb') as f:
                        f.write(pdf_content)
                    logger.debug(f"PDF guardado: {pdf_path}")

                return f"{base_name}.xml"
        except Exception as e:
            logger.error(f"Error procesando ZIP: {str(e)}")
            return None

    def _parse_xml(self, xml_content: bytes) -> Optional[InvoiceMetadata]:
        try:
            root = etree.fromstring(xml_content)
            tag_name = etree.QName(root).localname
            
            # Caso 1: Es un Invoice directo
            if tag_name == 'Invoice':
                return self._extract_invoice_metadata(root)
            
            # Caso 2: Es un AttachedDocument (Contenedor común en Colombia)
            if tag_name == 'AttachedDocument':
                # Intentar extraer ID de la factura original
                invoice_id = self._xpath_text(root, '//*[local-name()="ParentDocumentID"]')
                
                # Intentar extraer fecha
                issue_date = self._xpath_text(root, '//*[local-name()="ParentDocumentLineReference"]//*[local-name()="IssueDate"]')
                if not issue_date:
                    issue_date = self._xpath_text(root, '//*[local-name()="IssueDate"]')
                
                # Intentar extraer el nombre del emisor (SenderParty suele ser el emisor en el AttachedDocument)
                supplier_name = self._xpath_text(root, '//*[local-name()="SenderParty"]//*[local-name()="RegistrationName"]')
                if not supplier_name:
                    supplier_name = self._xpath_text(root, '//*[local-name()="SenderParty"]//*[local-name()="Name"]')
                
                if invoice_id and supplier_name:
                    return InvoiceMetadata(
                        invoice_number=invoice_id,
                        issue_date=issue_date or datetime.now().strftime('%Y-%m-%d'),
                        supplier_name=supplier_name,
                        nit=""
                    )
                
            return None
        except Exception as e:
            logger.debug(f"Error parseando XML: {str(e)}")
            return None

    def _extract_invoice_metadata(self, element) -> Optional[InvoiceMetadata]:
        try:
            # Usamos local-name() para ignorar prefijos de namespace que varían entre versiones de UBL
            invoice_id = self._xpath_text(element, '//*[local-name()="ID"]')
            issue_date = self._xpath_text(element, '//*[local-name()="IssueDate"]')
            supplier_name = self._xpath_text(element, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="RegistrationName"]')
            nit = self._xpath_text(element, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="CompanyID"]')

            if not invoice_id or not supplier_name:
                return None

            return InvoiceMetadata(
                invoice_number=invoice_id,
                issue_date=issue_date or datetime.now().strftime('%Y-%m-%d'),
                supplier_name=supplier_name,
                nit=nit or ""
            )
        except Exception:
            return None

    def _xpath_text(self, element, xpath_query: str) -> Optional[str]:
        try:
            # Búsqueda flexible usando local-name() si es necesario
            result = element.xpath(xpath_query)
            if result:
                if isinstance(result[0], etree._Element):
                    return result[0].text.strip() if result[0].text else None
                return str(result[0]).strip()
        except Exception:
            pass
        return None
