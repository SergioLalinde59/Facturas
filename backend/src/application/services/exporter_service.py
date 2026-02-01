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
            from src.application.services.invoice_processor_service import InvoiceProcessorService
            # Para evitar duplicar lógica compleja, usamos el parseador base si es posible
            # o replicamos la lógica robusta aquí.
            
            tree = etree.parse(file_path)
            root = tree.getroot()
            
            # Manejar AttachedDocument con Invoice embebido
            tag_name = etree.QName(root).localname
            inner_root = root
            is_credit_note = tag_name == 'CreditNote'

            if tag_name == 'AttachedDocument':
                description = self._get_text(root, '//*[local-name()="Attachment"]//*[local-name()="Description"]')
                if description and ('<Invoice' in description or '<CreditNote' in description):
                    start_tag = '<Invoice' if '<Invoice' in description else '<CreditNote'
                    end_tag = '</Invoice>' if '<Invoice' in description else '</CreditNote>'
                    xml_start = description.find(start_tag)
                    xml_end = description.rfind(end_tag) + len(end_tag)
                    inner_xml = description[xml_start:xml_end]
                    inner_root = etree.fromstring(inner_xml.encode('utf-8'))
                    is_credit_note = etree.QName(inner_root).localname == 'CreditNote'

            # Extraer Metadatos Básicos (ID, Fecha, Proveedor, NIT)
            invoice_id = None
            issue_date = None
            for child in inner_root:
                ln = etree.QName(child).localname
                if ln == 'ID' and not invoice_id: invoice_id = child.text
                if ln == 'IssueDate' and not issue_date: issue_date = child.text

            if not invoice_id:
                invoice_id = self._get_text(inner_root, '//*[local-name()="ID"]')

            supplier_name = self._get_text(inner_root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="RegistrationName"]') or \
                            self._get_text(inner_root, '//*[local-name()="PartyName"]//*[local-name()="Name"]')
            
            nit = self._get_text(inner_root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="CompanyID"]') or \
                  self._get_text(inner_root, '//*[local-name()="SenderParty"]//*[local-name()="CompanyID"]')

            if not invoice_id or not supplier_name:
                return None, "No se pudo identificar Proveedor o Número de Factura"

            # Valores Financieros
            subtotal = self._get_float(inner_root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="LineExtensionAmount"]')
            total = self._get_float(inner_root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="PayableAmount"]')
            descuentos = self._get_float(inner_root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="AllowanceTotalAmount"]')

            # Extracción robusta de impuestos por tarifa
            taxes = self._extract_detailed_taxes_internal(inner_root)
            
            iva_19 = taxes.get(('01', 19.0), 0.0)
            iva_5 = taxes.get(('01', 5.0), 0.0)
            iva_0 = taxes.get(('01', 0.0), 0.0)
            
            # Sumar otras tarifas de IVA al 19%
            iva_otros = sum(val for (code, pct), val in taxes.items() if code == '01' and pct not in [19.0, 5.0, 0.0])
            iva_19 += iva_otros

            inc = sum(val for (code, pct), val in taxes.items() if code == '04')
            inc_bolsas = sum(val for (code, pct), val in taxes.items() if code == '22')
            retefuente = sum(val for (code, pct), val in taxes.items() if code == '06')
            reteica = sum(val for (code, pct), val in taxes.items() if code == '07')
            
            known_codes = {'01', '04', '22', '06', '07'}
            otros_imp_sum = sum(val for (code, pct), val in taxes.items() if code not in known_codes)

            # Ajuste de Nota Crédito
            if is_credit_note:
                subtotal = -abs(subtotal)
                descuentos = abs(descuentos)
                iva_19 = -abs(iva_19)
                iva_5 = -abs(iva_5)
                iva_0 = -abs(iva_0)
                inc = -abs(inc)
                inc_bolsas = -abs(inc_bolsas)
                retefuente = -abs(retefuente)
                reteica = -abs(reteica)
                otros_imp_sum = -abs(otros_imp_sum)
                total = -abs(total)

            # Cálculo de Totales (Bruto vs Neto)
            # Bruto: Subtotal + Impuestos - Descuentos
            gross_total = subtotal - abs(descuentos) + iva_19 + iva_5 + iva_0 + inc + inc_bolsas + otros_imp_sum
            
            # Neto: Bruto - Retenciones
            net_total = gross_total - abs(retefuente) - abs(reteica)
            
            # Si el total del XML (PayableAmount) coincide con el bruto, significa que no restaron retenciones en ese campo
            # En ese caso, forzamos el uso del net_total para que coincida con el "Real de la Factura" esperado por el usuario.
            if abs(total - gross_total) < 5.0 and abs(retefuente) + abs(reteica) > 0:
                total = net_total

            # Validación de Integridad
            validation_error = None
            diff = abs(net_total - total)
            if diff > 5.0:
                # Si no coincide con el neto, probamos con el bruto para dar un error más específico
                if abs(gross_total - total) < 5.0:
                    validation_error = f"Aviso: El total del XML es Bruto. Se ajustó a Neto ({net_total:,.0f})"
                else:
                    validation_error = f"Inconsistencia: Calc({net_total:,.0f}) != Real({total:,.0f})"

            return {
                'fecha': issue_date,
                'proveedor': supplier_name,
                'nit': nit,
                'factura': invoice_id,
                'subtotal': subtotal,
                'descuentos': descuentos,
                'iva_19': iva_19,
                'iva_5': iva_5,
                'iva_0': iva_0,
                'inc': inc,
                'inc_bolsas': inc_bolsas,
                'retefuente': retefuente,
                'reteica': reteica,
                'otros_impuestos': otros_imp_sum,
                'total': total,
                'nombre_xml': os.path.basename(file_path),
                'nombre_pdf': os.path.basename(file_path).replace('.xml', '.pdf'),
                'validation_error': validation_error,
                'otros_conceptos': {'detalles_impuestos': {f"{c}_{p}": v for (c, p), v in taxes.items()}}
            }, None
        except Exception as e:
            return None, str(e)

    def _get_float(self, element, xpath) -> float:
        val = self._get_text(element, xpath)
        try:
            import math
            f_val = float(val) if val else 0.0
            return f_val if not math.isnan(f_val) else 0.0
        except:
            return 0.0

    def _extract_detailed_taxes_internal(self, element) -> Dict[tuple[str, float], float]:
        taxes = {}
        
        # 1. Extraer de TaxTotal (IVA, INC, Bolsas)
        tax_totals = element.xpath('/*[local-name()="Invoice" or local-name()="CreditNote"]/*[local-name()="TaxTotal"]')
        if not tax_totals:
            tax_totals = element.xpath('//*[local-name()="TaxTotal"]')

        for tt in tax_totals:
            subtotals = tt.xpath('./*[local-name()="TaxSubtotal"]')
            if subtotals:
                for sub in subtotals:
                    scheme_id = self._get_text(sub, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                    # Fix: Search for percent inside TaxCategory
                    percent = self._get_float(sub, './/*[local-name()="TaxCategory"]/*[local-name()="Percent"]')
                    if percent == 0.0:
                         percent = self._get_float(sub, './*[local-name()="Percent"]')

                    amount = self._get_float(sub, './*[local-name()="TaxAmount"]')
                    if scheme_id:
                        key = (scheme_id, percent)
                        taxes[key] = taxes.get(key, 0.0) + amount
            else:
                scheme_id = self._get_text(tt, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                amount = self._get_float(tt, './*[local-name()="TaxAmount"]')
                if scheme_id:
                    key = (scheme_id, 0.0)
                    taxes[key] = taxes.get(key, 0.0) + amount

        # 2. Extraer de WithholdingTaxTotal (ReteFuente, ReteICA, ReteIVA)
        wht_totals = element.xpath('/*[local-name()="Invoice" or local-name()="CreditNote"]/*[local-name()="WithholdingTaxTotal"]')
        if not wht_totals:
            wht_totals = element.xpath('//*[local-name()="WithholdingTaxTotal"]')

        for wht in wht_totals:
            subtotals = wht.xpath('./*[local-name()="TaxSubtotal"]')
            if subtotals:
                for sub in subtotals:
                    scheme_id = self._get_text(sub, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                    # Fix: Search for percent inside TaxCategory
                    percent = self._get_float(sub, './/*[local-name()="TaxCategory"]/*[local-name()="Percent"]')
                    if percent == 0.0:
                         percent = self._get_float(sub, './*[local-name()="Percent"]')
                         
                    amount = self._get_float(sub, './*[local-name()="TaxAmount"]')
                    if scheme_id:
                        key = (scheme_id, percent)
                        taxes[key] = taxes.get(key, 0.0) + amount
            else:
                scheme_id = self._get_text(wht, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                amount = self._get_float(wht, './*[local-name()="TaxAmount"]')
                if scheme_id:
                    key = (scheme_id, 0.0)
                    taxes[key] = taxes.get(key, 0.0) + amount
        
        return taxes

    def import_to_db(self, directory: str, repository: Any, dry_run: bool = False, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Procesa XMLs de un directorio y los guarda en la BD (o solo previsualiza)."""
        if not os.path.exists(directory):
            return {"status": "error", "message": f"Directorio no encontrado: {directory}"}

        files = [f for f in os.listdir(directory) if f.lower().endswith('.xml')]
        count_imported = 0
        count_duplicates = 0
        count_errors = 0
        count_filtered = 0
        count_inconsistent = 0
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
                "iva_19": data.get('iva_19', 0) if data else 0,
                "iva_5": data.get('iva_5', 0) if data else 0,
                "iva_0": data.get('iva_0', 0) if data else 0,
                "inc": data.get('inc', 0) if data else 0,
                "inc_bolsas": data.get('inc_bolsas', 0) if data else 0,
                "retefuente": data.get('retefuente', 0) if data else 0,
                "otros_impuestos": data.get('otros_impuestos', 0) if data else 0,
                "total": data.get('total', 0) if data else 0,
                "nombre_xml": filename,
                "nombre_pdf": data.get('nombre_pdf') if data else None,
                "attachments": [filename],
                "status": "pending",
                "message": None
            }

            if data:
                if data.get('validation_error'):
                    count_inconsistent += 1
                    res["status"] = "inconsistent"
                    res["message"] = data['validation_error']
                elif dry_run:
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
                        
                        # Move to Procesadas/yyyy
                        try:
                            invoice_year = str(data.get('fecha', '')).split('-')[0]
                            if not invoice_year or len(invoice_year) != 4:
                                invoice_year = datetime.now().strftime('%Y')
                                
                            # Determine processed directory from env or fallback
                            processed_root = os.getenv('FACTURAS_PROCESADAS')
                            if not processed_root:
                                # Fallback to sibling "Procesadas" folder
                                parent_dir = os.path.dirname(directory)
                                processed_root = os.path.join(parent_dir, "Procesadas")
                            
                            processed_dir = os.path.join(processed_root, invoice_year)
                            
                            if not os.path.exists(processed_dir):
                                os.makedirs(processed_dir, exist_ok=True)
                                
                            # Move XML
                            src_xml = file_path
                            dst_xml = os.path.join(processed_dir, filename)
                            shutil.move(src_xml, dst_xml)
                            
                            # Move PDF if exists
                            pdf_name = filename.rsplit('.', 1)[0] + '.pdf'
                            src_pdf = os.path.join(directory, pdf_name)
                            if os.path.exists(src_pdf):
                                dst_pdf = os.path.join(processed_dir, pdf_name)
                                shutil.move(src_pdf, dst_pdf)
                                
                        except Exception as move_err:
                            # Log error but don't fail the import status since it is saved
                            print(f"Error moving file {filename}: {move_err}")
                            res["message"] = "Guardado, pero error al mover archivo."
                            
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
                "inconsistent": count_inconsistent,
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
                'factura': 'Factura', 'subtotal': 'Subtotal', 'descuentos': 'Descuentos',
                'iva_19': 'IVA 19%', 'iva_5': 'IVA 5%', 'iva_0': 'IVA 0%', 
                'inc': 'INC', 'inc_bolsas': 'INC Bolsas', 
                'retefuente': 'Retefuente', 'total': 'Total', 'nombre_xml': 'Archivo XML'
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
                    ("Fecha", 20), ("Proveedor", 50), ("Factura", 25), 
                    ("Subtotal", 22), ("IVA 19%", 20), ("IVA 5%", 20), ("INC", 18), ("Total", 22)
                ]
                
                for col_name, width in cols:
                    pdf.cell(width, 10, col_name, border=1, align='C', fill=True)
                pdf.ln()

                # Datos de la tabla
                pdf.set_font("Arial", '', 7.5)
                for item in data_list:
                    pdf.cell(20, 8, str(item['fecha']), border=1)
                    prov = str(item['proveedor'])[:25]
                    pdf.cell(50, 8, prov, border=1)
                    pdf.cell(25, 8, str(item['factura']), border=1)
                    pdf.cell(22, 8, f"{item['subtotal']:,.0f}", border=1, align='R')
                    pdf.cell(20, 8, f"{item['iva_19']:,.0f}", border=1, align='R')
                    pdf.cell(20, 8, f"{item['iva_5']:,.0f}", border=1, align='R')
                    pdf.cell(18, 8, f"{(item.get('inc') or 0):,.0f}", border=1, align='R')
                    pdf.cell(22, 8, f"{item['total']:,.0f}", border=1, align='R')
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
