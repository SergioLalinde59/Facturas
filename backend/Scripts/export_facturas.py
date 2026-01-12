#!/usr/bin/env python3
import os
import csv
import pandas as pd
from lxml import etree
from datetime import datetime

# Directorios
FACTURAS_DIR = r"F:\1. Cloud\4. AI\1. Antigravity\Gmail - Lectura\Facturas\2026"
OUTPUT_XLSX = os.path.join(FACTURAS_DIR, "Facturas_Consolidado_2026.xlsx")
OUTPUT_CSV = os.path.join(FACTURAS_DIR, "Movimientos_Contabilidad_2026.csv")

# Namespaces UBL
NS = {
    'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
}

def get_text(element, xpath):
    result = element.xpath(xpath, namespaces=NS)
    return result[0].text.strip() if result else ""

def process_invoices():
    data_list = []
    seen_invoices = set() # Para prevención de duplicados (NIT + Numero)

    print(f"Buscando archivos XML en {FACTURAS_DIR}...")
    
    files = [f for f in os.listdir(FACTURAS_DIR) if f.lower().endswith('.xml')]
    print(f"Encontrados {len(files)} archivos XML.")

    for filename in files:
        file_path = os.path.join(FACTURAS_DIR, filename)
        try:
            tree = etree.parse(file_path)
            root = tree.getroot()
            
            # Determinar si es un AttachedDocument con Invoice embebido
            if etree.QName(root).localname == 'AttachedDocument':
                # Buscar el Invoice dentro del CDATA
                description = get_text(root, '//*[local-name()="Attachment"]//*[local-name()="Description"]')
                if description and '<Invoice' in description:
                    # Extraer solo la parte XML del CDATA si tiene basura (a veces ocurre)
                    xml_start = description.find('<Invoice')
                    xml_end = description.rfind('</Invoice>') + len('</Invoice>')
                    inner_xml = description[xml_start:xml_end]
                    root = etree.fromstring(inner_xml.encode('utf-8'))

            # Extraer Invoice ID
            invoice_id = get_text(root, '//*[local-name()="ParentDocumentID"]') or get_text(root, '//*[local-name()="ID"]')
            
            # Extraer Fecha
            issue_date = get_text(root, '//*[local-name()="IssueDate"]')
            
            # Extraer Proveedor y NIT
            supplier_name = get_text(root, '//*[local-name()="SenderParty"]//*[local-name()="RegistrationName"]') or \
                            get_text(root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="RegistrationName"]') or \
                            get_text(root, '//*[local-name()="PartyName"]//*[local-name()="Name"]')
            
            nit = get_text(root, '//*[local-name()="SenderParty"]//*[local-name()="CompanyID"]') or \
                  get_text(root, '//*[local-name()="AccountingSupplierParty"]//*[local-name()="CompanyID"]')

            # Clave única para evitar duplicados
            unique_key = f"{nit}_{invoice_id}"
            if unique_key in seen_invoices:
                print(f"  [!] Saltando duplicado: {invoice_id} ({supplier_name})")
                continue
            
            # Extraer Totales
            total_amount = get_text(root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="PayableAmount"]')
            tax_amount = get_text(root, '//*[local-name()="TaxTotal"]/*[local-name()="TaxAmount"]')
            subtotal = get_text(root, '//*[local-name()="LegalMonetaryTotal"]//*[local-name()="LineExtensionAmount"]')

            if invoice_id and supplier_name:
                data_list.append({
                    'Fecha': issue_date,
                    'Proveedor': supplier_name,
                    'NIT': nit,
                    'Factura': invoice_id,
                    'Subtotal': float(subtotal or 0),
                    'IVA': float(tax_amount or 0),
                    'Total': float(total_amount or 0),
                    'Archivo': filename
                })
                seen_invoices.add(unique_key)
                print(f"  [+] Procesada: {invoice_id} - {supplier_name}")

        except Exception as e:
            print(f"  [ERROR] Error procesando {filename}: {e}")

    if not data_list:
        print("No se extrajeron datos.")
        return

    # Exportar a Excel
    df = pd.DataFrame(data_list)
    df.to_excel(OUTPUT_XLSX, index=False)
    print(f"\nExcel generado: {OUTPUT_XLSX}")

    # Exportar a CSV de Contabilidad
    # fecha,descripcion,referencia,valor,moneda_id,cuenta_id,terceroid,grupoid,conceptoid
    csv_data = []
    for item in data_list:
        csv_data.append({
            'fecha': item['Fecha'],
            'descripcion': f"Compra {item['Proveedor']} Fact {item['Factura']}",
            'referencia': item['Factura'],
            'valor': -abs(item['Total']), # Egreso
            'moneda_id': 1, # Asumiendo COP
            'cuenta_id': '', 
            'terceroid': '',
            'grupoid': '',
            'conceptoid': ''
        })
    
    keys = csv_data[0].keys()
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        dict_writer = csv.DictWriter(f, fieldnames=keys)
        dict_writer.writeheader()
        dict_writer.writerows(csv_data)
    print(f"CSV generado: {OUTPUT_CSV}")

if __name__ == "__main__":
    process_invoices()
