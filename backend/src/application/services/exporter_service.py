import os
import csv
import pandas as pd
import shutil
from fpdf import FPDF
from lxml import etree
from datetime import datetime
from typing import List, Dict, Any, Set, Optional

class ExporterService:
    def __init__(self):
        self.ns = {
            'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
            'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        }

    def _get_text(self, element, xpath):
        result = element.xpath(xpath, namespaces=self.ns)
        return result[0].text.strip() if result else ""

    def parse_xml_invoice(self, file_path: str) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Extrae metadatos de un archivo XML de factura. Retorna (data, error_msg)"""
        try:
            tree = etree.parse(file_path)
            root = tree.getroot()
            
            # Manejar AttachedDocument con Invoice embebido
            if etree.QName(root).localname == 'AttachedDocument':
                description = self._get_text(root, '//*[local-name()="Attachment"]//*[local-name()="Description"]')
                if description and '<Invoice' in description:
                    xml_start = description.find('<Invoice')
                    xml_end = description.rfind('</Invoice>') + len('</Invoice>')
                    inner_xml = description[xml_start:xml_end]
                    root = etree.fromstring(inner_xml.encode('utf-8'))

            # Extraer metadatos - IMPORTANTE: Iterar SOLO hijos directos para evitar UBLExtensions
            invoice_id = None
            issue_date = None
            
            # Intentar primero con ParentDocumentID (AttachedDocument)
            invoice_id = self._get_text(root, '//*[local-name()="ParentDocumentID"]')
            
            # Buscar ID e IssueDate en los hijos directos del root (evita UBLExtensions)
            for child in root:
                localname = etree.QName(child).localname
                if localname == 'IssueDate' and child.text and not issue_date:
                    issue_date = child.text
                elif localname == 'ID' and child.text and not invoice_id:
                    invoice_id = child.text
            
            supplier_name = self._get_text(root, '//*[local-name()="SenderParty"]//*[local-name()="RegistrationName"]') or \
                            self._get_text(root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="RegistrationName"]') or \
                            self._get_text(root, '//*[local-name()="PartyName"]//*[local-name()="Name"]')
            
            nit = self._get_text(root, '//*[local-name()="SenderParty"]//*[local-name()="CompanyID"]') or \
                  self._get_text(root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="CompanyID"]')

            # DEBUG INICIAL: Ver qué tipo de documento es y qué valores extrae
            # doc_type = etree.QName(root).localname
            # print(f"\n📄 DEBUG INICIO - Archivo: {os.path.basename(file_path)}")
            # print(f"  Tipo de documento: {doc_type}")
            # print(f"  Proveedor (inicial): {supplier_name}")
            # print(f"  NIT (inicial): {nit}")
            # print(f"  Invoice ID (inicial): {invoice_id}")
            # print(f"  Fecha (inicial): {issue_date}")

            # Intentar extraer valores financieros del documento principal
            total_amount = self._get_text(root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="PayableAmount"]')
            tax_amount = self._get_text(root, '//*[local-name()="TaxTotal"]/*[local-name()="TaxAmount"]')
            subtotal = self._get_text(root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="LineExtensionAmount"]')
            allowance = self._get_text(root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="AllowanceTotalAmount"]')

            # Si es un AttachedDocument, SIEMPRE buscar en el XML embebido (Invoice o CreditNote)
            # para obtener los datos reales del documento, no del contenedor
            is_credit_note = False
            if etree.QName(root).localname == 'AttachedDocument':
                # Buscar en el Description del Attachment
                description = self._get_text(root, '//*[local-name()="Attachment"]//*[local-name()="Description"]')
                if description:
                    # Buscar Invoice o CreditNote embebido
                    inner_xml_start = -1
                    inner_xml_end = -1
                    
                    for doc_type in ['<Invoice', '<CreditNote']:
                        if doc_type in description:
                            inner_xml_start = description.find(doc_type)
                            close_tag = '</Invoice>' if doc_type == '<Invoice' else '</CreditNote>'
                            inner_xml_end = description.rfind(close_tag) + len(close_tag)
                            is_credit_note = (doc_type == '<CreditNote')
                            break
                    
                    if inner_xml_start != -1 and inner_xml_end != -1:
                        try:
                            inner_xml = description[inner_xml_start:inner_xml_end]
                            inner_root = etree.fromstring(inner_xml.encode('utf-8'))
                            
                            # Extraer valores del documento embebido (PRIORITARIO)
                            inner_total = self._get_text(inner_root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="PayableAmount"]')
                            inner_tax = self._get_text(inner_root, '//*[local-name()="TaxTotal"]/*[local-name()="TaxAmount"]')
                            inner_subtotal = self._get_text(inner_root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="LineExtensionAmount"]')
                            inner_allowance = self._get_text(inner_root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="AllowanceTotalAmount"]')
                            
                            # Sobrescribir con valores del documento interno si existen
                            if inner_total:
                                total_amount = inner_total
                            if inner_tax:
                                tax_amount = inner_tax
                            if inner_subtotal:
                                subtotal = inner_subtotal
                            if inner_allowance:
                                allowance = inner_allowance
                            
                            # También extraer NIT, proveedor, fecha e ID del documento interno (PRIORITARIO)
                            inner_nit = self._get_text(inner_root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="CompanyID"]') or \
                                       self._get_text(inner_root, '//*[local-name()="SenderParty"]//*[local-name()="CompanyID"]')
                            if inner_nit:
                                nit = inner_nit
                            
                            inner_supplier = self._get_text(inner_root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="RegistrationName"]') or \
                                           self._get_text(inner_root, '//*[local-name()="PartyName"]//*[local-name()="Name"]')
                            if inner_supplier:
                                supplier_name = inner_supplier
                            
                            # DEBUG: Ver qué estamos extrayendo
                            # print(f"\n🔍 DEBUG - Procesando AttachedDocument:")
                            # print(f"  NIT: {nit}")
                            # print(f"  Proveedor: {supplier_name}")
                            # print(f"  Fecha (antes): {issue_date}")
                            # print(f"  Invoice ID (antes): {invoice_id}")
                            
                            # IMPORTANTE: Extraer fecha e ID excluyendo UBLExtensions
                            # Las extensiones pueden tener <ID> y <IssueDate> con valores diferentes
                            # Buscamos directamente como hijos del elemento raíz (Invoice/CreditNote)
                            for child in inner_root:
                                localname = etree.QName(child).localname
                                if localname == 'IssueDate' and child.text:
                                    # print(f"  ✅ Encontré IssueDate directo: {child.text}")
                                    issue_date = child.text
                                elif localname == 'ID' and child.text:
                                    # print(f"  ✅ Encontré ID directo: {child.text}")
                                    invoice_id = child.text
                            
                            # print(f"  Fecha (después): {issue_date}")
                            # print(f"  Invoice ID (después): {invoice_id}")
                        except Exception as e:
                            # Si falla el parseo del XML interno, continuamos con los valores que ya tenemos
                            # print(f"❌ ERROR en parsing embebido: {e}")
                            pass

            if not invoice_id:
                return None, "No se encontró ID de factura o ParentDocumentID en el XML"
            if not supplier_name:
                return None, "No se encontró el nombre del proveedor en el XML"

            # Convertir a float y aplicar valores negativos si es nota crédito
            subtotal_val = float(subtotal or 0)
            descuentos_val = float(allowance or 0)
            iva_val = float(tax_amount or 0)
            total_val = float(total_amount or 0)
            
            # Los descuentos SIEMPRE son negativos (reducen el total)
            if descuentos_val > 0:
                descuentos_val = -descuentos_val
            
            if is_credit_note:
                subtotal_val = -abs(subtotal_val)
                # descuentos_val ya es negativo, al invertir se vuelve positivo en nota crédito
                descuentos_val = abs(descuentos_val)
                iva_val = -abs(iva_val)
                total_val = -abs(total_val)

            return {
                'fecha': issue_date,
                'proveedor': supplier_name,
                'nit': nit,
                'factura': invoice_id,
                'subtotal': subtotal_val,
                'descuentos': descuentos_val,
                'iva': iva_val,
                'total': total_val,
                'nombre_xml': os.path.basename(file_path)
            }, None
        except Exception as e:
            return None, str(e)

    def import_to_db(self, directory: str, repository: Any, dry_run: bool = False, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Procesa XMLs de un directorio y los guarda en la BD (o solo previsualiza)."""
        if not os.path.exists(directory):
            return {"status": "error", "message": f"Directorio no encontrado: {directory}"}

        files = [f for f in os.listdir(directory) if f.lower().endswith('.xml')]
        count_imported = 0
        count_duplicates = 0
        count_errors = 0
        count_filtered = 0
        results = []
        
        # Extraer filtros si existen
        filter_start_date = filters.get('start_date') if filters else None
        filter_end_date = filters.get('end_date') if filters else None
        filter_provider = filters.get('provider') if filters else None
        
        for filename in files:
            file_path = os.path.join(directory, filename)
            data, parse_error = self.parse_xml_invoice(file_path)
            
            # Aplicar filtros si están definidos y hay datos válidos
            if data:
                skip_record = False
                
                # Filtrar por fecha de inicio
                if filter_start_date and data.get('fecha'):
                    if data['fecha'] < str(filter_start_date):
                        count_filtered += 1
                        skip_record = True
                
                # Filtrar por fecha de fin
                if filter_end_date and data.get('fecha') and not skip_record:
                    if data['fecha'] > str(filter_end_date):
                        count_filtered += 1
                        skip_record = True
                
                # Filtrar por proveedor
                if filter_provider and data.get('proveedor') and not skip_record:
                    if data['proveedor'] != filter_provider:
                        count_filtered += 1
                        skip_record = True
                
                # Si el registro fue filtrado, saltar al siguiente
                if skip_record:
                    continue
            
            res = {
                "date": data.get("fecha") if data else datetime.now().strftime('%Y-%m-%d'),
                "sender": data.get("proveedor") if data else "Sistema",
                "nit": data.get("nit", "") if data else "",
                "subject": data.get('factura') if data else filename,
                "subtotal": data.get('subtotal', 0) if data else 0,
                "descuentos": data.get('descuentos', 0) if data else 0,
                "iva": data.get('iva', 0) if data else 0,
                "total": data.get('total', 0) if data else 0,
                "nombre_xml": filename,
                "attachments": [filename],
                "status": "pending",
                "message": None
            }

            if data:
                if dry_run:
                    # En previsualización solo verificamos si ya existe
                    exists = repository.check_exists(data['nit'], data['factura'])
                    if exists:
                        count_duplicates += 1
                        res["status"] = "duplicate"
                        res["message"] = "Ya existe en la base de datos"
                    else:
                        count_imported += 1
                        res["status"] = "success"
                else:
                    # En modo normal, guardamos
                    save_status, save_msg = repository.save(data)
                    if save_status == 'inserted':
                        count_imported += 1
                        res["status"] = "success"
                    elif save_status == 'updated':
                        count_duplicates += 1
                        res["status"] = "duplicate"
                        res["message"] = "Ya existe (omitido por conflicto)"
                    else:
                        count_errors += 1
                        res["status"] = "error"
                        res["message"] = save_msg or "Error desconocido al guardar"
            else:
                count_errors += 1
                res["status"] = "error"
                res["message"] = parse_error or "Error al analizar el XML"
            
            results.append(res)
        
        total_processed = len(results)
        total_found = len(files)
        
        filter_msg = ""
        if count_filtered > 0:
            filter_msg = f" ({count_filtered} archivos excluidos por filtros)"
        
        return {
            "status": "success",
            "message": f"Se {'previsualizaron' if dry_run else 'procesaron'} {total_processed} de {total_found} archivos locales{filter_msg}.",
            "results": results,
            "dry_run": dry_run,
            "stats": {
                "total": total_processed,
                "successful": count_imported,
                "duplicates": count_duplicates,
                "errors": count_errors
            }
        }

    def export_from_db(self, repository: Any, filters: Dict[str, Any], formats: List[str], output_dir: str) -> Dict[str, Any]:
        """Genera archivos a partir de datos en la BD."""
        data_list = repository.get_invoices(
            start_date=filters.get('start_date'),
            end_date=filters.get('end_date'),
            provider=filters.get('provider')
        )

        if not data_list:
            return {"status": "warning", "message": "No hay datos para exportar con estos filtros."}

        today_str = datetime.now().strftime('%Y-%m-%d')
        base_output_name = f"{today_str} facturas_export"
        generated_files = []
        
        # Exportar a Excel
        if 'excel' in formats:
            output_xlsx = os.path.join(output_dir, f"{base_output_name}.xlsx")
            df = pd.DataFrame(data_list)
            # Renombrar columnas para el Excel humano
            df_display = df.rename(columns={
                'fecha': 'Fecha', 'proveedor': 'Proveedor', 'nit': 'NIT', 
                'factura': 'Factura', 'subtotal': 'Subtotal', 'iva': 'IVA', 
                'total': 'Total', 'nombre_xml': 'Archivo XML'
            })
            df_display.to_excel(output_xlsx, index=False)
            generated_files.append({"type": "excel", "path": output_xlsx})

        # Exportar a CSV (Formato Contable)
        if 'csv' in formats:
            output_csv = os.path.join(output_dir, f"{base_output_name}.csv")
            csv_data = []
            for item in data_list:
                csv_data.append({
                    'fecha': item['fecha'],
                    'descripcion': f"Compra {item['proveedor']} Fact {item['factura']}",
                    'referencia': item['factura'],
                    'valor': -abs(item['total']),
                    'moneda_id': 1,
                    'cuenta_id': '', 
                    'terceroid': '',
                    'grupoid': '',
                    'conceptoid': ''
                })
            
            if csv_data:
                keys = csv_data[0].keys()
                with open(output_csv, 'w', newline='', encoding='utf-8') as f:
                    dict_writer = csv.DictWriter(f, fieldnames=keys)
                    dict_writer.writeheader()
                    dict_writer.writerows(csv_data)
                generated_files.append({"type": "csv", "path": output_csv})

        # PDF
        if 'pdf' in formats:
            output_pdf = os.path.join(output_dir, f"{base_output_name}.pdf")
            try:
                pdf = FPDF(orientation='L', unit='mm', format='A4')
                pdf.add_page()
                pdf.set_font("Arial", 'B', 16)
                pdf.cell(0, 10, "Reporte de Facturas Recibidas", ln=True, align='C')
                pdf.set_font("Arial", '', 10)
                pdf.cell(0, 10, f"Fecha de generación: {today_str}", ln=True, align='R')
                pdf.ln(5)

                # Encabezados de tabla
                pdf.set_font("Arial", 'B', 10)
                pdf.set_fill_color(240, 240, 240)
                cols = [
                    ("Fecha", 25), ("Proveedor", 70), ("NIT", 30), 
                    ("Factura", 35), ("Subtotal", 30), ("IVA", 25), ("Total", 30)
                ]
                
                for col_name, width in cols:
                    pdf.cell(width, 10, col_name, border=1, align='C', fill=True)
                pdf.ln()

                # Datos de la tabla
                pdf.set_font("Arial", '', 9)
                for item in data_list:
                    pdf.cell(25, 8, str(item['fecha']), border=1)
                    # Truncar proveedor si es muy largo
                    prov = str(item['proveedor'])[:35]
                    pdf.cell(70, 8, prov, border=1)
                    pdf.cell(30, 8, str(item['nit']), border=1)
                    pdf.cell(35, 8, str(item['factura']), border=1)
                    pdf.cell(30, 8, f"{item['subtotal']:,.2f}", border=1, align='R')
                    pdf.cell(25, 8, f"{item['iva']:,.2f}", border=1, align='R')
                    pdf.cell(30, 8, f"{item['total']:,.2f}", border=1, align='R')
                    pdf.ln()

                pdf.output(output_pdf)
                generated_files.append({"type": "pdf", "path": output_pdf})
            except Exception as e:
                # Si falla PDF no bloqueamos el resto
                print(f"Error generando PDF: {e}")
        
        return {
            "status": "success",
            "message": f"Exportación completada. Se generaron {len(generated_files)} archivos.",
            "files": generated_files,
            "count": len(data_list)
        }

    # Mantener este método por compatibilidad si es necesario, pero redirigirlo a la nueva lógica si es posible
    def export_from_directory(self, directory: str, formats: List[str]) -> Dict[str, Any]:
        """Legacy: Procesa facturas XML y genera archivos directamente."""
        # Podríamos simplemente importar a una BD temporal y exportar, 
        # pero para no complicar, mantendremos la lógica mínima o avisaremos que use la nueva vía.
        # Por ahora lo dejo como estaba pero simplificado.
        ...
        return {"status": "info", "message": "Por favor use la nueva opción de Importar a BD y luego Exportar."}
