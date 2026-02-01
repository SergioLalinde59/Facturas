import zipfile
import io
import os
import logging
import math
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

    def process_all_new_invoices_generator(self, target_directory: str, max_emails: int = None, search_query: str = None):
        logger.info(f"Iniciando procesamiento de facturas en: {target_directory}")
        if not os.path.exists(target_directory):
            logger.info(f"Creando directorio de destino: {target_directory}")
            os.makedirs(target_directory, exist_ok=True)

        self.gmail_service.ensure_label_exists(self.processed_label)
        messages = self.gmail_service.search_unprocessed_emails(self.processed_label, search_query=search_query)
        
        logger.info(f"Se encontraron {len(messages)} correos sin procesar.")
        
        # Procesar de más antiguo a más nuevo
        messages.reverse()
        
        if max_emails and max_emails > 0:
            logger.info(f"Aplicando límite de {max_emails} correos.")
            messages = messages[:max_emails]
        
        logger.info(f"Final: Se procesarán {len(messages)} correos en este lote.")
        
        stats = {
            "total_scanned": len(messages),
            "successful": 0,
            "trashed": 0,
            "errors": 0,
            "files_saved": 0
        }

        # Enviar evento inicial con el total a procesar
        yield {"type": "start", "total": len(messages)}

        for msg in messages:
            msg_id = msg['id']
            # Metadatos del mensaje detectado para logging inicial
            initial_metadata = self.gmail_service.get_message_metadata(msg_id)
            
            logger.info(f"Procesando correo de: {initial_metadata.get('from')} (ID: {msg_id})")
            try:
                success, saved_files, deep_metadata, invoice_data = self._process_email(msg_id, target_directory)
                
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
                    logger.info(f"Correo {msg_id} procesado exitosamente. Archivos: {len(saved_files)}")
                    self.gmail_service.mark_as_processed(msg_id, self.processed_label)
                    
                    res["status"] = "success"
                    stats["successful"] += 1
                    stats["files_saved"] += len(saved_files)
                else:
                    logger.warning(f"No se encontraron facturas válidas en el hilo del correo {msg_id}. Moviendo a la papelera.")
                    self.gmail_service.trash_message(msg_id)
                    res["status"] = "no_valid_invoices"
                    stats["trashed"] += 1
                
                yield {"type": "item", "data": res, "stats": stats}
            except Exception as e:
                logger.error(f"Error procesando el correo {msg_id}: {str(e)}", exc_info=True)
                stats["errors"] += 1
                res = {
                    "msg_id": msg_id, 
                    "sender": initial_metadata.get("from"),
                    "subject": initial_metadata.get("subject"),
                    "date": initial_metadata.get("date"),
                    "status": "error", 
                    "error": str(e),
                    "attachments": [],
                    "count": 0
                }
                yield {"type": "item", "data": res, "stats": stats}
        
        yield {"type": "complete", "stats": stats}

    def process_all_new_invoices(self, target_directory: str, max_emails: int = None):
        """Versión sincrónica para compatibilidad si es necesaria"""
        results = []
        final_stats = {}
        for event in self.process_all_new_invoices_generator(target_directory, max_emails):
            if event["type"] == "item":
                results.append(event["data"])
            elif event["type"] in ["complete", "item"]:
                final_stats = event["stats"]
        return {"results": results, "stats": final_stats}

    def _process_email(self, msg_id: str, target_dir: str) -> Tuple[bool, List[str], Optional[Dict[str, Any]], Optional[InvoiceMetadata]]:
        # Obtener metadatos básicos para conseguir el threadId
        meta = self.gmail_service.get_message_metadata(msg_id)
        thread_id = meta.get("threadId")
        
        if not thread_id:
            logger.debug(f"Correo {msg_id} no tiene threadId, procesando individualmente.")
            attachments = self.gmail_service.get_attachments(msg_id)
            success, saved_files, last_invoice_data = self._extract_zips_from_attachments(msg_id, attachments, target_dir)
            return success, saved_files, meta, last_invoice_data

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
                
                success, saved_files, last_invoice_data = self._extract_zips_from_attachments(msg_obj['id'], zip_attachments, target_dir)
                if success:
                    logger.debug(f"Procesado exitosamente usando metadatos profundos de: {current_meta.get('from')}")
                    return True, saved_files, current_meta, last_invoice_data
            else:
                logger.debug(f"Mensaje index {i} no contiene ZIP. (De: {current_meta.get('from')})")
        
        logger.warning(f"No se encontró ningún mensaje con ZIP en el hilo {thread_id}")
        return False, [], None, None

    def _extract_zips_from_attachments(self, msg_id: str, attachments: List[Dict[str, Any]], target_dir: str) -> Tuple[bool, List[str], Optional[InvoiceMetadata]]:
        saved_files = []
        last_invoice_data = None
        for att in attachments:
            if att['filename'].lower().endswith('.zip'):
                logger.debug(f"Descargando adjunto ZIP: {att['filename']}")
                content = self.gmail_service.download_attachment(msg_id, att['attachmentId'])
                saved_filename, invoice_data = self._handle_zip(content, target_dir)
                if saved_filename:
                    saved_files.append(saved_filename)
                    if invoice_data:
                        last_invoice_data = invoice_data
        return len(saved_files) > 0, saved_files, last_invoice_data

    def _handle_zip(self, zip_content: bytes, target_dir: str) -> Tuple[Optional[str], Optional[InvoiceMetadata]]:
        try:
            with zipfile.ZipFile(io.BytesIO(zip_content)) as zf:
                filenames = zf.namelist()
                xml_files = [f for f in filenames if f.lower().endswith('.xml')]
                pdf_files = [f for f in filenames if f.lower().endswith('.pdf')]
                
                logger.debug(f"ZIP contiene {len(xml_files)} XMLs y {len(pdf_files)} PDFs.")
                
                if not xml_files:
                    return None, None

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
                    logger.warning("No se encontró un XML de factura válido dentro del ZIP.")
                    return None, None

                # 1. Usar el directorio destino directamente (sin subcarpetas de años)
                # invoice_year = invoice_data.issue_date.split('-')[0] if invoice_data.issue_date else datetime.now().strftime('%Y')
                # year_dir = os.path.join(target_dir, invoice_year)
                
                # if not os.path.exists(target_dir):
                #     os.makedirs(target_dir, exist_ok=True)

                # 2. Renombrado Seguro
                safe_supplier = "".join(c for c in invoice_data.supplier_name if c.isalnum() or c in (' ', '-', '_')).strip()
                safe_invoice_number = "".join(c for c in invoice_data.invoice_number if c.isalnum() or c in ('-', '_')).strip()
                
                # Fallback si no hay número
                if not safe_invoice_number:
                    safe_invoice_number = "SN"
                    
                base_name = f"{invoice_data.issue_date} {safe_supplier} [{safe_invoice_number}]"
                logger.info(f"Factura identificada para guardar: {base_name}")
                
                # Guardar XML
                xml_filename = f"{base_name}.xml"
                xml_path = os.path.join(target_dir, xml_filename)
                
                if os.path.exists(xml_path):
                    logger.info(f"La factura {base_name} ya existe. Saltando.")
                    return xml_filename, invoice_data
                
                with open(xml_path, 'wb') as f:
                    f.write(xml_data_bytes)

                # Guardar PDF correspondiente
                if pdf_files:
                    pdf_filename = f"{base_name}.pdf"
                    pdf_path = os.path.join(target_dir, pdf_filename)
                    with open(pdf_path, 'wb') as f:
                        f.write(zf.read(pdf_files[0]))
                    logger.debug(f"PDF guardado: {pdf_path}")

                return xml_filename, invoice_data
        except Exception as e:
            logger.error(f"Error procesando ZIP: {str(e)}")
            return None, None

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
                supplier_name = self._xpath_text(root, '//*[local-name()="SenderParty"]//*[local-name()="RegistrationName"]')
                
                # Para facturas de la DIAN, el AttachedDocument suele contener el XML real embebido en CDATA
                description = self._xpath_text(root, '//*[local-name()="Attachment"]//*[local-name()="Description"]')
                if description and ('<Invoice' in description or '<CreditNote' in description):
                    try:
                        # Extraer el XML interno
                        start_tag = '<Invoice' if '<Invoice' in description else '<CreditNote'
                        end_tag = '</Invoice>' if '<Invoice' in description else '</CreditNote>'
                        xml_start = description.find(start_tag)
                        xml_end = description.rfind(end_tag) + len(end_tag)
                        inner_xml = description[xml_start:xml_end]
                        
                        inner_root = etree.fromstring(inner_xml.encode('utf-8'))
                        return self._extract_invoice_metadata(inner_root)
                    except Exception as e:
                        logger.debug(f"Error parseando XML interno de AttachedDocument: {e}")

                # Fallback: Si no hay XML interno o falla, intentar metadatos básicos del contenedor
                if invoice_id and supplier_name:
                    issue_date = self._xpath_text(root, '//*[local-name()="IssueDate"]')
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
            # 1. Identificar ID y Fecha
            invoice_id = None
            issue_date = None
            for child in element:
                ln = etree.QName(child).localname
                if ln == 'ID' and not invoice_id: invoice_id = child.text
                if ln == 'IssueDate' and not issue_date: issue_date = child.text

            if not invoice_id:
                invoice_id = self._xpath_text(element, '//*[local-name()="ID"]')

            # 2. Proveedor y NIT
            supplier_name = self._xpath_text(element, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="RegistrationName"]') or \
                            self._xpath_text(element, '//*[local-name()="PartyName"]//*[local-name()="Name"]')
            
            nit = self._xpath_text(element, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="CompanyID"]') or \
                  self._xpath_text(element, '//*[local-name()="SenderParty"]//*[local-name()="CompanyID"]')

            if not supplier_name:
                return None

            return InvoiceMetadata(
                invoice_number=invoice_id or "SIN_NUMERO",
                issue_date=issue_date or datetime.now().strftime('%Y-%m-%d'),
                supplier_name=supplier_name,
                nit=nit or ""
            )
        except Exception as e:
            logger.error(f"Error minimal en _extract_invoice_metadata: {e}")
            return None

    def _extract_detailed_taxes(self, element) -> Dict[tuple[str, float], float]:
        """
        Extrae y agrupa impuestos por (Código de Esquema, Tarifa %).
        """
        taxes = {}
        tax_totals = element.xpath('/*[local-name()="Invoice" or local-name()="CreditNote"]/*[local-name()="TaxTotal"]')
        if not tax_totals:
            tax_totals = element.xpath('//*[local-name()="TaxTotal"]')

        for tt in tax_totals:
            subtotals = tt.xpath('./*[local-name()="TaxSubtotal"]')
            if subtotals:
                for sub in subtotals:
                    # XPath ajustado para buscar dentro de TaxCategory
                    scheme_id = self._xpath_text(sub, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                    # Percent suele estar dentro de TaxCategory
                    percent = self._get_float(sub, './/*[local-name()="TaxCategory"]/*[local-name()="Percent"]')
                    if percent == 0.0:
                        # Intento fallback directo por si acaso (aunque el estándar es anidado)
                        percent = self._get_float(sub, './*[local-name()="Percent"]')
                        
                    amount = self._get_float(sub, './*[local-name()="TaxAmount"]')
                    if scheme_id:
                        key = (scheme_id, percent)
                        taxes[key] = taxes.get(key, 0.0) + amount
            else:
                # Si no hay subtotales, intentar sacar del TaxTotal (asumimos tarifa 0 o no especificada)
                scheme_id = self._xpath_text(tt, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                amount = self._get_float(tt, './*[local-name()="TaxAmount"]')
                if scheme_id:
                    key = (scheme_id, 0.0)
                    taxes[key] = taxes.get(key, 0.0) + amount
        
        # Procesar Retenciones (WithholdingTaxTotal)
        wht_totals = element.xpath('/*[local-name()="Invoice" or local-name()="CreditNote"]/*[local-name()="WithholdingTaxTotal"]')
        if not wht_totals:
             wht_totals = element.xpath('//*[local-name()="WithholdingTaxTotal"]')
             
        for wht in wht_totals:
            subtotals = wht.xpath('./*[local-name()="TaxSubtotal"]')
            if subtotals:
                for sub in subtotals:
                    scheme_id = self._xpath_text(sub, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                    percent = self._get_float(sub, './/*[local-name()="TaxCategory"]/*[local-name()="Percent"]')
                    amount = self._get_float(sub, './*[local-name()="TaxAmount"]')
                    if scheme_id:
                        key = (scheme_id, percent)
                        taxes[key] = taxes.get(key, 0.0) + amount
            else:
                scheme_id = self._xpath_text(wht, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                amount = self._get_float(wht, './*[local-name()="TaxAmount"]')
                if scheme_id:
                    key = (scheme_id, 0.0)
                    taxes[key] = taxes.get(key, 0.0) + amount

        return taxes

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

    def _get_float(self, element, xpath_query: str) -> float:
        val = self._xpath_text(element, xpath_query)
        try:
            if not val:
                return 0.0
            f_val = float(val)
            return f_val if not math.isnan(f_val) else 0.0
        except:
            return 0.0
