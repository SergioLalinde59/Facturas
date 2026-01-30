#!/usr/bin/env python3
import os
import csv
import pandas as pd
from lxml import etree
from datetime import datetime

# Try to import rich for better UI
try:
    from rich.console import Console
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Módulo 'rich' no encontrado. Se recomienda instalarlo: pip install rich")

# Directorios
FACTURAS_DIR = r"F:\1. Cloud\4. AI\1. Antigravity\Facturas\Facturas\2026"
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

def format_currency(value):
    return f"${value:,.2f}"

def process_invoices():
    data_list = []
    seen_invoices = set() # Para prevención de duplicados (NIT + Numero)
    
    console = Console() if RICH_AVAILABLE else None

    if RICH_AVAILABLE:
        console.print(f"[bold cyan]Buscando archivos XML en:[/bold cyan] {FACTURAS_DIR}...")
    else:
        print(f"Buscando archivos XML en {FACTURAS_DIR}...")
    
    if not os.path.exists(FACTURAS_DIR):
        msg = f"El directorio {FACTURAS_DIR} no existe."
        if RICH_AVAILABLE:
            console.print(f"[bold red]{msg}[/bold red]")
        else:
            print(msg)
        return

    files = [f for f in os.listdir(FACTURAS_DIR) if f.lower().endswith('.xml')]
    
    if RICH_AVAILABLE:
        console.print(f"[green]Encontrados {len(files)} archivos XML.[/green]")
    else:
        print(f"Encontrados {len(files)} archivos XML.")

    # Context manager for progress bar if rich is available
    if RICH_AVAILABLE:
        progress_context = Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console
        )
    else:
        progress_context = None

    # Processing loop
    try:
        if RICH_AVAILABLE:
            progress_context.start()
            task = progress_context.add_task("[cyan]Procesando facturas...", total=len(files))
        
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
                    # duplicate handling (silent in progress bar usually, or log)
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

            except Exception as e:
                pass # Silenciar errores individuales no fatales para no romper la UI
            
            if RICH_AVAILABLE:
                progress_context.advance(task)

    finally:
        if RICH_AVAILABLE:
            progress_context.stop()

    if not data_list:
        msg = "No se extrajeron datos."
        if RICH_AVAILABLE:
            console.print(f"[bold red]{msg}[/bold red]")
        else:
            print(msg)
        return

    # Visualizar Data Table
    if RICH_AVAILABLE:
        table = Table(title="Previsualización de Facturas", show_lines=True, header_style="bold magenta", box=box.DOUBLE_EDGE)
        
        table.add_column("Fecha", style="cyan", no_wrap=True)
        table.add_column("Proveedor", style="white")
        table.add_column("NIT", style="green")
        table.add_column("Factura", style="yellow")
        table.add_column("Subtotal", justify="right", style="blue")
        table.add_column("IVA", justify="right", style="magenta")
        table.add_column("Total", justify="right", style="bold green")
        
        for item in data_list:
            table.add_row(
                item['Fecha'],
                item['Proveedor'][:30] + ('...' if len(item['Proveedor']) > 30 else ''), # Contuncar nombres largos
                item['NIT'],
                item['Factura'],
                format_currency(item['Subtotal']),
                format_currency(item['IVA']),
                format_currency(item['Total'])
            )
            
        console.print(table)
        console.print(f"\n[bold]Total Facturas:[/bold] {len(data_list)}")
        
        # Pausa opcional si se desea confirmar visualmente antes de escribir archivos, 
        # pero para mantener el flujo del script original, procedemos.
        # input("Presione Enter para continuar...") 

    # Exportar a Excel
    df = pd.DataFrame(data_list)
    df.to_excel(OUTPUT_XLSX, index=False)
    
    if RICH_AVAILABLE:
         console.print(f"\n[bold green]Excel generado:[/bold green] {OUTPUT_XLSX}")
    else:
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
        
    if RICH_AVAILABLE:
         console.print(f"[bold green]CSV generado:[/bold green] {OUTPUT_CSV}")
    else:
         print(f"CSV generado: {OUTPUT_CSV}")

if __name__ == "__main__":
    process_invoices()
