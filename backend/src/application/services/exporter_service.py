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

    def parse_xml_invoice(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Extrae metadatos de un archivo XML de factura."""
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

            # Extraer metadatos
            invoice_id = self._get_text(root, '//*[local-name()="ParentDocumentID"]') or \
                         self._get_text(root, '//*[local-name()="ID"]')
            
            issue_date = self._get_text(root, '//*[local-name()="IssueDate"]')
            
            supplier_name = self._get_text(root, '//*[local-name()="SenderParty"]//*[local-name()="RegistrationName"]') or \
                            self._get_text(root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="RegistrationName"]') or \
                            self._get_text(root, '//*[local-name()="PartyName"]//*[local-name()="Name"]')
            
            nit = self._get_text(root, '//*[local-name()="SenderParty"]//*[local-name()="CompanyID"]') or \
                  self._get_text(root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="CompanyID"]')

            total_amount = self._get_text(root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="PayableAmount"]')
            tax_amount = self._get_text(root, '//*[local-name()="TaxTotal"]/*[local-name()="TaxAmount"]')
            subtotal = self._get_text(root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="LineExtensionAmount"]')

            if invoice_id and supplier_name:
                return {
                    'fecha': issue_date,
                    'proveedor': supplier_name,
                    'nit': nit,
                    'factura': invoice_id,
                    'subtotal': float(subtotal or 0),
                    'iva': float(tax_amount or 0),
                    'total': float(total_amount or 0),
                    'nombre_xml': os.path.basename(file_path)
                }
        except Exception:
            pass
        return None

    def import_to_db(self, directory: str, repository: Any) -> Dict[str, Any]:
        """Procesa XMLs de un directorio y los guarda en la BD."""
        if not os.path.exists(directory):
            return {"status": "error", "message": f"Directorio no encontrado: {directory}"}

        files = [f for f in os.listdir(directory) if f.lower().endswith('.xml')]
        count_imported = 0
        count_duplicates = 0
        count_errors = 0
        
        for filename in files:
            file_path = os.path.join(directory, filename)
            data = self.parse_xml_invoice(file_path)
            if data:
                save_status = repository.save(data)
                if save_status == 'inserted':
                    count_imported += 1
                elif save_status == 'updated':
                    count_duplicates += 1
                else:
                    count_errors += 1
            else:
                count_errors += 1
        
        return {
            "status": "success",
            "message": "",
            "stats": {
                "total": len(files),
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
