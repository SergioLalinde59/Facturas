import os
import csv
import pandas as pd
import shutil
from fpdf import FPDF
from lxml import etree
from datetime import datetime
from typing import List, Dict, Any, Set, Optional

# Tolerancia configurable para validación de totales (en COP)
INVOICE_VALIDATION_TOLERANCE = float(os.getenv('INVOICE_VALIDATION_TOLERANCE', '1.0'))

class ExporterService:
    def __init__(self):
        self.ns = {
            'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
            'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        }
        self.tolerance = INVOICE_VALIDATION_TOLERANCE

    def _get_text(self, element, xpath):
        result = element.xpath(xpath, namespaces=self.ns)
        return result[0].text.strip() if result else ""

    def parse_xml_invoice(self, file_path: str) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Extrae metadatos de un archivo XML de factura. Retorna (data, error_msg)"""
        try:
            from src.application.services.tax_service import TaxService
            from src.infrastructure.database.postgres_tax_repository import PostgresTaxRepository
            
            repo = PostgresTaxRepository()
            tax_service = TaxService(repo)
            
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

            # Valores Financieros - Buscar LegalMonetaryTotal hijo directo del Invoice/CreditNote
            # para evitar leer secciones de extensión con ceros (ej: ForeignCurrencyExtension)
            lmt_xpath = '/*[local-name()="Invoice" or local-name()="CreditNote"]/*[local-name()="LegalMonetaryTotal"]'
            subtotal = self._get_float(inner_root, f'{lmt_xpath}/*[local-name()="LineExtensionAmount"]')
            total = self._get_float(inner_root, f'{lmt_xpath}/*[local-name()="PayableAmount"]')
            descuentos = self._get_float(inner_root, f'{lmt_xpath}/*[local-name()="AllowanceTotalAmount"]')
            
            # Fallback si no encuentra con xpath específico (compatibilidad con otros formatos)
            if subtotal == 0.0 and total == 0.0:
                subtotal = self._get_float(inner_root, '//*[local-name()="LegalMonetaryTotal"][not(ancestor::*[local-name()="ExtensionContent"])]/*[local-name()="LineExtensionAmount"]')
                total = self._get_float(inner_root, '//*[local-name()="LegalMonetaryTotal"][not(ancestor::*[local-name()="ExtensionContent"])]/*[local-name()="PayableAmount"]')
                descuentos = self._get_float(inner_root, '//*[local-name()="LegalMonetaryTotal"][not(ancestor::*[local-name()="ExtensionContent"])]/*[local-name()="AllowanceTotalAmount"]')

            # Extracción robusta de impuestos usando Tax Engine
            # raw_taxes: {(code, percent): amount}
            # unknown_codes: list of codes found but not in config
            raw_taxes, unknown_codes_map = self._extract_detailed_taxes_internal(inner_root)
            
            missing_definitions = []
            
            tax_details = []
            impuestos_sum = 0.0
            retenciones_sum = 0.0
            otros_imp_sum = 0.0
            
            for (code, percent), amount in raw_taxes.items():
                key = (code, percent)
                xml_context = unknown_codes_map.get(key, 'unknown')
                
                tax_obj = tax_service.get_tax(code)
                rule = {
                    "name": tax_obj.name,
                    "operation": tax_obj.operation
                } if tax_obj else None
                
                if not rule:
                    # Código no definido en BD - usar contexto XML
                    inferred_op = 'subtract' if xml_context == 'withholding' else 'add'
                    
                    missing_definitions.append({
                        "code": code,
                        "description": f"Código {code} detectado en contexto {xml_context}",
                        "context": xml_context,
                        "percent": percent,
                        "amount": amount
                    })
                    
                    if inferred_op == 'subtract':
                         retenciones_sum += amount
                    else:
                         impuestos_sum += amount
                         otros_imp_sum += amount
                    
                    tax_details.append({
                        'tax_code': code,
                        'tax_name': f"Desconocido ({code})",
                        'percentage': percent,
                        'amount': -abs(amount) if inferred_op == 'subtract' and not is_credit_note else abs(amount),
                        'operation': inferred_op
                    })
                    continue

                # Código ZZ es especial: la operación se determina por ubicación XML (UBL 2.1)
                # TaxTotal -> 'tax' -> add (contribución)
                # WithholdingTaxTotal -> 'withholding' -> subtract (retención)
                if code == 'ZZ':
                    op = 'subtract' if xml_context == 'withholding' else 'add'
                    name = rule.get('name', 'Otro Impuesto')
                    # Log para debugging
                    import logging
                    logger = logging.getLogger("exporter")
                    logger.info(f"ZZ detectado en {xml_context.upper()} -> operación: {op}")
                else:
                    op = rule.get('operation', 'add')
                    name = rule.get('name', 'Impuesto')
                
                if op == 'subtract':
                    retenciones_sum += amount
                elif op == 'ignore':
                    pass
                else:
                    impuestos_sum += amount
                    # Buckets for "otros_impuestos" in header
                    if code not in ['01', '04', '22', '11']:
                        otros_imp_sum += amount

                tax_details.append({
                    'tax_code': code,
                    'tax_name': name,
                    'percentage': percent,
                    'amount': -abs(amount) if op == 'subtract' and not is_credit_note else amount,
                    'operation': op
                })

            # Ajuste de Nota Crédito
            # Ajuste de Nota Crédito
            if is_credit_note:
                subtotal = -abs(subtotal)
                descuentos = abs(descuentos)
                impuestos_sum = -abs(impuestos_sum)
                retenciones_sum = -abs(retenciones_sum)
                otros_imp_sum = -abs(otros_imp_sum)
                total = -abs(total)
                for d in tax_details:
                    d['amount'] = -abs(d['amount'])

            # Cálculo de Totales (Bruto vs Neto)
            # Bruto: Subtotal + Impuestos - Descuentos
            gross_total = subtotal - abs(descuentos) + impuestos_sum
            
            # Neto: Bruto - Retenciones
            net_total = gross_total - abs(retenciones_sum)
            
            # Ajuste de Totales
            net_total_adjusted = net_total


            # Capture original extracted total (after Credit Note adjustment) for reference
            xml_total_reference = total

            # Lógica de Validación de Totales

            validation_error = None
            
            # 1. Si hay definiciones faltantes, NO validamos estricto, sino que pedimos clasificación
            if missing_definitions:
                validation_error = "MISSING_TAX_DEFINITION"
            else:
                # 2. Validación estándar con tolerancia configurable
                diff = abs(net_total - total)
                if diff > self.tolerance:
                     if abs(gross_total - total) <= self.tolerance:
                         # Coincide con bruto -> Retenciones no restadas, ajustamos silenciosamente
                         # No marcamos como error, solo ajustamos el valor
                         pass  # El total se ajustará abajo
                     else:
                         validation_error = f"Inconsistencia: Calc({net_total:,.0f}) != Real({total:,.0f})"

            # Si el total del XML coincide con el bruto, y tenemos retenciones, ajustamos el total guardado al neto
            if abs(total - gross_total) <= self.tolerance and abs(retenciones_sum) > 0:
                total = net_total_adjusted  # Preferimos el valor neto real

            return {
                'fecha': issue_date,
                'proveedor': supplier_name,
                'nit': nit,
                'factura': invoice_id,
                'subtotal': subtotal,
                'descuentos': descuentos,
                'impuestos': impuestos_sum,
                'retenciones': retenciones_sum,
                'otros_impuestos': otros_imp_sum,
                'total': total,
                'xml_total': xml_total_reference,
                'tax_details': tax_details,
                'nombre_xml': os.path.basename(file_path),
                'nombre_pdf': os.path.basename(file_path).replace('.xml', '.pdf'),
                'validation_error': validation_error,
                'otros_conceptos': {
                    'missing_tax_definitions': [
                        {
                            "code": d['tax_code'],
                            "description": d['tax_name'],
                            "percent": d['percentage'],
                            "amount": d['amount']
                        } for d in tax_details if d.get('tax_name', '').startswith('Desconocido')
                    ],
                    'detalles_estructurados': [
                        {'name': d['tax_name'], 'amount': d['amount'], 'operation': 'add'} # Just for display if needed
                        for d in tax_details
                    ]
                }
            }, None
        except Exception as e:
            import traceback
            traceback.print_exc()
            return None, str(e)

    def _get_float(self, element, xpath) -> float:
        val = self._get_text(element, xpath)
        try:
            import math
            f_val = float(val) if val else 0.0
            return f_val if not math.isnan(f_val) else 0.0
        except:
            return 0.0

    def _extract_detailed_taxes_internal(self, element) -> tuple[Dict[tuple[str, float], float], Dict[tuple[str, float], str]]:
        """
        Extrae impuestos del XML y determina el contexto de cada uno.
        
        Según UBL 2.1 (estándar DIAN Colombia):
        - TaxTotal: Impuestos/contribuciones que SE SUMAN al total
        - WithholdingTaxTotal: Retenciones que SE RESTAN del total
        
        Returns:
            taxes: Dict[(code, percent), amount] - Montos agrupados
            tax_context: Dict[(code, percent), 'tax'|'withholding'] - Contexto XML para cada impuesto
        """
        taxes = {}
        tax_context = {}  # map (code, percent) -> context ('tax' or 'withholding')
        
        # 1. Extraer de TaxTotal (Impuestos/contribuciones que SE SUMAN)
        tax_totals = element.xpath('/*[local-name()="Invoice" or local-name()="CreditNote"]/*[local-name()="TaxTotal"]')
        if not tax_totals:
            tax_totals = element.xpath('//*[local-name()="TaxTotal"]')

        for tt in tax_totals:
            subtotals = tt.xpath('./*[local-name()="TaxSubtotal"]')
            if subtotals:
                for sub in subtotals:
                    scheme_id = self._get_text(sub, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                    percent = self._get_float(sub, './/*[local-name()="TaxCategory"]/*[local-name()="Percent"]')
                    if percent == 0.0: percent = self._get_float(sub, './*[local-name()="Percent"]')

                    amount = self._get_float(sub, './*[local-name()="TaxAmount"]')
                    if scheme_id:
                        key = (scheme_id, percent)
                        taxes[key] = taxes.get(key, 0.0) + amount
                        # Marcar contexto como 'tax' (TaxTotal = sumar)
                        tax_context[key] = 'tax'
            # Fallback para TaxTotal sin subtotals
            else:
                scheme_id = self._get_text(tt, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                amount = self._get_float(tt, './*[local-name()="TaxAmount"]')
                if scheme_id:
                    key = (scheme_id, 0.0)
                    taxes[key] = taxes.get(key, 0.0) + amount
                    tax_context[key] = 'tax'

        # 2. Extraer de WithholdingTaxTotal (Retenciones que SE RESTAN)
        wht_totals = element.xpath('/*[local-name()="Invoice" or local-name()="CreditNote"]/*[local-name()="WithholdingTaxTotal"]')
        if not wht_totals:
             wht_totals = element.xpath('//*[local-name()="WithholdingTaxTotal"]')

        for wht in wht_totals:
            subtotals = wht.xpath('./*[local-name()="TaxSubtotal"]')
            if subtotals:
                for sub in subtotals:
                    scheme_id = self._get_text(sub, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                    percent = self._get_float(sub, './/*[local-name()="TaxCategory"]/*[local-name()="Percent"]')
                    if percent == 0.0: percent = self._get_float(sub, './*[local-name()="Percent"]')
                         
                    amount = self._get_float(sub, './*[local-name()="TaxAmount"]')
                    if scheme_id:
                        key = (scheme_id, percent)
                        taxes[key] = taxes.get(key, 0.0) + amount
                        # Marcar contexto como 'withholding' (WithholdingTaxTotal = restar)
                        tax_context[key] = 'withholding'
            # Fallback para WithholdingTaxTotal sin subtotals
            else:
                scheme_id = self._get_text(wht, './/*[local-name()="TaxScheme"]/*[local-name()="ID"]')
                amount = self._get_float(wht, './*[local-name()="TaxAmount"]')
                if scheme_id:
                    key = (scheme_id, 0.0)
                    taxes[key] = taxes.get(key, 0.0) + amount
                    tax_context[key] = 'withholding'
        
        return taxes, tax_context

    def import_to_db(self, directory: str, repository: Any, dry_run: bool = False, filters: Optional[Dict[str, Any]] = None, target_filenames: Optional[List[str]] = None) -> Dict[str, Any]:
        """Procesa XMLs de un directorio y los guarda en la BD (o solo previsualiza)."""
        if not os.path.exists(directory):
            return {"status": "error", "message": f"Directorio no encontrado: {directory}"}

        files = [f for f in os.listdir(directory) if f.lower().endswith('.xml')]
        
        if target_filenames:
            import logging
            logger = logging.getLogger("exporter")
            logger.info(f"Filtrando archivos. Buscados: {target_filenames}")
            
            # Normalize for case-insensitive matching
            available_files = {f: f.lower() for f in files}
            matched_files = set()
            
            for target in target_filenames:
                target_clean = target.strip()
                target_lower = target_clean.lower()
                
                found = False
                # 1. Try exact filename match
                for real_name, lower_name in available_files.items():
                    if lower_name == target_lower:
                        matched_files.add(real_name)
                        found = True
                        break
                
                # 2. If not found, try searching as Invoice Number (identifiers usually in brackets like [FE123])
                if not found:
                    for real_name, lower_name in available_files.items():
                         # Check if target is in filename (e.g. "[FE123]" or just "FE123")
                         if target_lower in lower_name:
                             matched_files.add(real_name)
            
            files = list(matched_files)
            logger.info(f"Archivos finales a procesar: {files}")
        
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
                "impuestos": data.get('impuestos', 0) if data else 0,
                "retenciones": data.get('retenciones', 0) if data else 0,
                "otros_impuestos": data.get('otros_impuestos', 0) if data else 0,
                "total": data.get('total', 0) if data else 0,
                "nombre_xml": filename,
                "nombre_pdf": data.get('nombre_pdf') if data else None,
                "attachments": [filename],
                "status": "pending",
                "message": None,
                "otros_conceptos": data.get('otros_conceptos') if data else None,
                "tax_details": data.get('tax_details') if data else None
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
        
        # Debug Log
        import logging
        logger = logging.getLogger("exporter")
        if count_inconsistent > 0:
             logger.info(f"Inconsistentes encontradas: {[r.get('status') for r in results if r.get('status') == 'inconsistent']}")
             # Log detail of the first inconsistent one to check for missing taxes
             inconsistents = [r for r in results if r.get('status') == 'inconsistent']
             if inconsistents:
                 logger.info(f"Detalle Inconsistente Full: {inconsistents[0]}")
        
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
        """Genera archivos a partir de datos en la BD, incluyendo detalles de impuestos."""
        # Obtener facturas con detalles
        data = repository.get_invoices_with_details(
            start_date=filters.get('start_date'),
            end_date=filters.get('end_date'),
            provider=filters.get('provider')
        )
        
        data_list = data.get('invoices', [])
        details_list = data.get('details', [])

        if not data_list:
            return {"status": "warning", "message": "No hay datos para exportar con estos filtros."}

        today_str = datetime.now().strftime('%Y-%m-%d')
        base_output_name = f"{today_str} facturas_export"
        generated_files = []
        
        # Exportar a Excel con múltiples hojas
        if 'excel' in formats:
            output_xlsx = os.path.join(output_dir, f"{base_output_name}.xlsx")
            
            # Hoja 1: Resumen de Facturas
            df_facturas = pd.DataFrame(data_list)
            df_facturas = df_facturas.rename(columns={
                'fecha': 'Fecha', 'proveedor': 'Proveedor', 'nit': 'NIT', 
                'factura': 'Factura', 'subtotal': 'Subtotal', 'descuentos': 'Descuentos',
                'impuestos': 'Impuestos', 'retenciones': 'Retenciones',
                'otros_impuestos': 'Otros Impuestos', 'total': 'Total', 
                'nombre_xml': 'Archivo XML', 'nombre_pdf': 'Archivo PDF'
            })
            # Seleccionar columnas relevantes para el resumen
            cols_resumen = ['Fecha', 'Proveedor', 'NIT', 'Factura', 'Subtotal', 
                           'Descuentos', 'Impuestos', 'Retenciones', 'Total', 'Archivo XML']
            cols_disponibles = [c for c in cols_resumen if c in df_facturas.columns]
            df_facturas_resumen = df_facturas[cols_disponibles]
            
            # Hoja 2: Detalles de Impuestos
            df_detalles = pd.DataFrame(details_list) if details_list else pd.DataFrame()
            if not df_detalles.empty:
                df_detalles = df_detalles.rename(columns={
                    'fecha': 'Fecha', 'proveedor': 'Proveedor', 'nit': 'NIT',
                    'factura': 'Factura', 'tax_code': 'Código', 'tax_name': 'Impuesto',
                    'agrupacion': 'Agrupación', 'percentage': 'Porcentaje', 
                    'valor': 'Valor', 'operation': 'Operación'
                })
                cols_detalle = ['Fecha', 'Proveedor', 'NIT', 'Factura', 'Código', 
                               'Impuesto', 'Agrupación', 'Porcentaje', 'Valor']
                cols_disponibles_det = [c for c in cols_detalle if c in df_detalles.columns]
                df_detalles = df_detalles[cols_disponibles_det]
            
            # Escribir Excel con múltiples hojas
            with pd.ExcelWriter(output_xlsx, engine='openpyxl') as writer:
                df_facturas_resumen.to_excel(writer, sheet_name='Facturas', index=False)
                if not df_detalles.empty:
                    df_detalles.to_excel(writer, sheet_name='Detalle Impuestos', index=False)
            
            generated_files.append({"type": "excel", "path": output_xlsx})

        # Exportar a CSV - Dos archivos: resumen y detalles
        if 'csv' in formats:
            # CSV 1: Resumen de Facturas
            output_csv = os.path.join(output_dir, f"{base_output_name}.csv")
            csv_data = []
            for item in data_list:
                csv_data.append({
                    'fecha': item['fecha'],
                    'nit': item['nit'],
                    'proveedor': item['proveedor'],
                    'factura': item['factura'],
                    'subtotal': item['subtotal'],
                    'descuentos': item['descuentos'],
                    'impuestos': item['impuestos'],
                    'retenciones': item['retenciones'],
                    'total': item['total'],
                    'nombre_xml': item.get('nombre_xml', '')
                })
            
            if csv_data:
                keys = csv_data[0].keys()
                with open(output_csv, 'w', newline='', encoding='utf-8') as f:
                    dict_writer = csv.DictWriter(f, fieldnames=keys)
                    dict_writer.writeheader()
                    dict_writer.writerows(csv_data)
                generated_files.append({"type": "csv", "path": output_csv})
            
            # CSV 2: Detalle de Impuestos
            if details_list:
                output_csv_detail = os.path.join(output_dir, f"{base_output_name}_detalle.csv")
                detail_keys = ['fecha', 'nit', 'proveedor', 'factura', 'tax_code', 
                              'tax_name', 'agrupacion', 'percentage', 'valor']
                with open(output_csv_detail, 'w', newline='', encoding='utf-8') as f:
                    dict_writer = csv.DictWriter(f, fieldnames=detail_keys)
                    dict_writer.writeheader()
                    for detail in details_list:
                        dict_writer.writerow({k: detail.get(k, '') for k in detail_keys})
                generated_files.append({"type": "csv", "path": output_csv_detail})

        # PDF
        if 'pdf' in formats:
            output_pdf = os.path.join(output_dir, f"{base_output_name}.pdf")
            try:
                pdf = FPDF(orientation='L', unit='mm', format='A4')
                pdf.add_page()
                pdf.set_font("Arial", 'B', 16)
                pdf.cell(0, 10, "Reporte de Facturas Recibidas", ln=True, align='C')
                pdf.set_font("Arial", '', 10)
                pdf.cell(0, 10, f"Fecha de generacion: {today_str}", ln=True, align='R')
                pdf.ln(5)

                # Encabezados de tabla - Resumen
                pdf.set_font("Arial", 'B', 10)
                pdf.set_fill_color(240, 240, 240)
                cols = [
                    ("Fecha", 20), ("Proveedor", 55), ("Factura", 25), 
                    ("Subtotal", 25), ("Impuestos", 25), ("Retenc.", 25), ("Total", 25)
                ]
                
                for col_name, width in cols:
                    pdf.cell(width, 10, col_name, border=1, align='C', fill=True)
                pdf.ln()

                # Datos de la tabla
                pdf.set_font("Arial", '', 7.5)
                for item in data_list:
                    pdf.cell(20, 8, str(item['fecha']), border=1)
                    prov = str(item['proveedor'])[:30]
                    pdf.cell(55, 8, prov, border=1)
                    pdf.cell(25, 8, str(item['factura'])[:15], border=1)
                    pdf.cell(25, 8, f"{item['subtotal']:,.0f}", border=1, align='R')
                    pdf.cell(25, 8, f"{item['impuestos']:,.0f}", border=1, align='R')
                    pdf.cell(25, 8, f"{item['retenciones']:,.0f}", border=1, align='R')
                    pdf.cell(25, 8, f"{item['total']:,.0f}", border=1, align='R')
                    pdf.ln()
                
                # Página de Detalles de Impuestos
                if details_list:
                    pdf.add_page()
                    pdf.set_font("Arial", 'B', 14)
                    pdf.cell(0, 10, "Detalle de Impuestos y Retenciones", ln=True, align='C')
                    pdf.ln(5)
                    
                    pdf.set_font("Arial", 'B', 9)
                    pdf.set_fill_color(240, 240, 240)
                    detail_cols = [
                        ("Fecha", 20), ("Proveedor", 50), ("Factura", 25),
                        ("Impuesto", 40), ("Agrupacion", 30), ("%", 15), ("Valor", 25)
                    ]
                    for col_name, width in detail_cols:
                        pdf.cell(width, 8, col_name, border=1, align='C', fill=True)
                    pdf.ln()
                    
                    pdf.set_font("Arial", '', 7)
                    for detail in details_list:
                        pdf.cell(20, 7, str(detail['fecha']), border=1)
                        pdf.cell(50, 7, str(detail['proveedor'])[:28], border=1)
                        pdf.cell(25, 7, str(detail['factura'])[:15], border=1)
                        pdf.cell(40, 7, str(detail['tax_name'])[:22], border=1)
                        pdf.cell(30, 7, str(detail['agrupacion'])[:18], border=1)
                        pdf.cell(15, 7, f"{detail['percentage']:.2f}", border=1, align='R')
                        pdf.cell(25, 7, f"{detail['valor']:,.0f}", border=1, align='R')
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
