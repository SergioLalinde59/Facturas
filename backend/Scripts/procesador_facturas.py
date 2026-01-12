#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sistema de Procesamiento Automático de Facturas Electrónicas Colombianas
Versión: 1.0
Autor: Sistema Automatizado
Fecha: 2025-12-02

Descripción:
    Procesa facturas electrónicas en formato UBL desde Gmail, extrae metadatos
    del XML, renombra archivos y los almacena organizadamente.
"""

import os
import re
import sys
import logging
import zipfile
from io import BytesIO
from datetime import datetime
from typing import Optional, Tuple, List, Dict

try:
    from imapclient import IMAPClient
    from lxml import etree
    from dateutil.parser import parse as parse_date
except ImportError as e:
    print(f"[ERROR] Falta instalar dependencias: {e}")
    print("Ejecuta: pip install imapclient lxml python-dateutil")
    sys.exit(1)

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

# Credenciales Gmail (usar Contraseña de Aplicación, no contraseña normal)
GMAIL_USER = "sergio.lalinde.facturas@gmail.com"
GMAIL_PASSWORD = "idlr udpv xtjp oton"  # IMPORTANTE: Debe ser "Contraseña de Aplicación"
IMAP_SERVER = "imap.gmail.com"

# Directorios
BASE_DIR = r"F:\1.Facturas"
SCRIPTS_DIR = os.path.join(BASE_DIR, "Scripts")

# Archivos de log
LOG_FILE = os.path.join(BASE_DIR, "procesamiento_log.txt")
ERROR_LOG_FILE = os.path.join(BASE_DIR, "error_log.txt")

# Etiqueta Gmail
PROCESSED_LABEL = "Factura_Procesada"

# Namespaces UBL comunes para facturas electrónicas colombianas
UBL_NAMESPACES = {
    'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
    'sts': 'http://www.dian.gov.co/contratos/facturaelectronica/v1/Structures',
    'invoice': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
}

# ============================================================================
# CONFIGURACIÓN DE LOGGING
# ============================================================================

def setup_logging():
    """Configura el sistema de logging dual (procesamiento y errores)"""
    # Crear directorio si no existe
    os.makedirs(BASE_DIR, exist_ok=True)
    
    # Logger principal
    logger = logging.getLogger('FacturaProcessor')
    logger.setLevel(logging.DEBUG)
    
    # Handler para log de procesamiento
    process_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
    process_handler.setLevel(logging.INFO)
    process_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    process_handler.setFormatter(process_formatter)
    
    # Handler para log de errores
    error_handler = logging.FileHandler(ERROR_LOG_FILE, encoding='utf-8')
    error_handler.setLevel(logging.ERROR)
    error_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s\n%(exc_info)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    error_handler.setFormatter(error_formatter)
    
    # Handler para consola
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(process_formatter)
    
    logger.addHandler(process_handler)
    logger.addHandler(error_handler)
    logger.addHandler(console_handler)
    
    return logger

logger = setup_logging()

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def sanitize_filename(filename: str) -> str:
    """
    Limpia un nombre de archivo eliminando caracteres inválidos para Windows
    
    Args:
        filename: Nombre original del archivo
        
    Returns:
        Nombre de archivo sanitizado
    """
    # Caracteres inválidos en Windows: < > : " / \ | ? *
    invalid_chars = r'[<>:"/\\|?*]'
    sanitized = re.sub(invalid_chars, '_', filename)
    
    # Eliminar espacios múltiples y reemplazar por guión bajo
    sanitized = re.sub(r'\s+', '_', sanitized)
    
    # Eliminar puntos al inicio o final
    sanitized = sanitized.strip('.')
    
    return sanitized

def extract_text_from_xml(element, xpath: str, namespaces: dict) -> Optional[str]:
    """
    Extrae texto de un elemento XML usando XPath
    
    Args:
        element: Elemento XML raíz
        xpath: Expresión XPath
        namespaces: Diccionario de namespaces
        
    Returns:
        Texto extraído o None si no se encuentra
    """
    try:
        result = element.xpath(xpath, namespaces=namespaces)
        if result and len(result) > 0:
            return result[0].text.strip() if hasattr(result[0], 'text') else str(result[0]).strip()
    except Exception as e:
        logger.debug(f"No se pudo extraer {xpath}: {e}")
    return None

# ============================================================================
# PROCESAMIENTO DE XML UBL
# ============================================================================

def parse_invoice_xml(xml_content: bytes) -> Optional[Dict[str, str]]:
    """
    Parsea un XML de factura electrónica UBL y extrae los campos requeridos
    
    Args:
        xml_content: Contenido del archivo XML en bytes
        
    Returns:
        Diccionario con los datos extraídos o None si falla
    """
    try:
        root = etree.fromstring(xml_content)
        
        # Verificar que sea un documento Invoice UBL
        if 'Invoice' not in root.tag:
            logger.debug("XML no es una factura UBL válida (no contiene tag Invoice)")
            return None
        
        # Extraer datos requeridos usando XPath con namespace-awareness
        data = {}
        
        # Número de factura (ID)
        invoice_id = extract_text_from_xml(root, '//cbc:ID', UBL_NAMESPACES)
        if not invoice_id:
            # Intentar sin namespace
            invoice_id = extract_text_from_xml(root, '//*[local-name()="ID"]', {})
        data['invoice_number'] = invoice_id
        
        # Fecha de emisión (IssueDate)
        issue_date = extract_text_from_xml(root, '//cbc:IssueDate', UBL_NAMESPACES)
        if not issue_date:
            issue_date = extract_text_from_xml(root, '//*[local-name()="IssueDate"]', {})
        data['issue_date'] = issue_date
        
        # Proveedor (RegistrationName dentro de AccountingSupplierParty)
        supplier_name = extract_text_from_xml(
            root, 
            '//cac:AccountingSupplierParty//cac:Party//cac:PartyLegalEntity//cbc:RegistrationName',
            UBL_NAMESPACES
        )
        if not supplier_name:
            supplier_name = extract_text_from_xml(
                root,
                '//*[local-name()="AccountingSupplierParty"]//*[local-name()="RegistrationName"]',
                {}
            )
        data['supplier_name'] = supplier_name
        
        # NIT (CompanyID)
        company_id = extract_text_from_xml(
            root,
            '//cac:AccountingSupplierParty//cac:Party//cac:PartyTaxScheme//cbc:CompanyID',
            UBL_NAMESPACES
        )
        if not company_id:
            company_id = extract_text_from_xml(
                root,
                '//*[local-name()="AccountingSupplierParty"]//*[local-name()="CompanyID"]',
                {}
            )
        data['nit'] = company_id
        
        # Validar que se extrajeron los datos mínimos
        if not data.get('invoice_number'):
            logger.warning("No se pudo extraer el número de factura del XML")
            return None
            
        logger.debug(f"Datos extraídos del XML: {data}")
        return data
        
    except etree.XMLSyntaxError as e:
        logger.debug(f"Error de sintaxis XML: {e}")
        return None
    except Exception as e:
        logger.error(f"Error inesperado al parsear XML: {e}", exc_info=True)
        return None

# ============================================================================
# PROCESAMIENTO DE ARCHIVOS ZIP
# ============================================================================

def process_zip_attachment(zip_content: bytes) -> Optional[Tuple[bytes, bytes, Dict[str, str]]]:
    """
    Procesa un archivo ZIP en memoria y extrae el XML UBL y su PDF par
    
    Args:
        zip_content: Contenido del ZIP en bytes
        
    Returns:
        Tupla (xml_bytes, pdf_bytes, metadata) o None si falla
    """
    try:
        with zipfile.ZipFile(BytesIO(zip_content)) as zf:
            filenames = zf.namelist()
            logger.debug(f"Archivos en ZIP: {filenames}")
            
            # Separar XMLs y PDFs
            xml_files = [f for f in filenames if f.lower().endswith('.xml')]
            pdf_files = [f for f in filenames if f.lower().endswith('.pdf')]
            
            if not xml_files:
                logger.warning("No se encontraron archivos XML en el ZIP")
                return None
            
            # Buscar el XML que contenga el tag Invoice (UBL)
            invoice_xml_file = None
            invoice_data = None
            
            for xml_file in xml_files:
                try:
                    xml_content = zf.read(xml_file)
                    data = parse_invoice_xml(xml_content)
                    
                    if data:
                        invoice_xml_file = xml_file
                        invoice_data = data
                        logger.info(f"XML UBL encontrado: {xml_file}")
                        break
                        
                except Exception as e:
                    logger.debug(f"Error al procesar {xml_file}: {e}")
                    continue
            
            if not invoice_xml_file or not invoice_data:
                logger.warning("No se encontró XML UBL válido con tag Invoice")
                return None
            
            # Buscar PDF correspondiente
            pdf_content = None
            
            if pdf_files:
                # Estrategia 1: Buscar PDF con nombre similar al XML
                xml_basename = os.path.splitext(invoice_xml_file)[0]
                matching_pdf = None
                
                for pdf_file in pdf_files:
                    pdf_basename = os.path.splitext(pdf_file)[0]
                    if xml_basename in pdf_basename or pdf_basename in xml_basename:
                        matching_pdf = pdf_file
                        break
                
                # Estrategia 2: Usar el primer PDF disponible
                if not matching_pdf:
                    matching_pdf = pdf_files[0]
                    logger.debug(f"No se encontró PDF con nombre similar, usando: {matching_pdf}")
                
                pdf_content = zf.read(matching_pdf)
                logger.info(f"PDF encontrado: {matching_pdf}")
            else:
                logger.warning("No se encontraron archivos PDF en el ZIP")
            
            # Leer el XML final
            xml_content = zf.read(invoice_xml_file)
            
            return (xml_content, pdf_content, invoice_data)
            
    except zipfile.BadZipFile:
        logger.error("Archivo ZIP corrupto o inválido")
        return None
    except Exception as e:
        logger.error(f"Error al procesar ZIP: {e}", exc_info=True)
        return None

# ============================================================================
# GESTIÓN DE GMAIL
# ============================================================================

def connect_gmail() -> Optional[IMAPClient]:
    """
    Establece conexión con Gmail vía IMAP
    
    Returns:
        Cliente IMAP conectado o None si falla
    """
    try:
        logger.info(f"Conectando a {IMAP_SERVER}...")
        client = IMAPClient(IMAP_SERVER, ssl=True)
        client.login(GMAIL_USER, GMAIL_PASSWORD)
        logger.info("Conexión exitosa a Gmail")
        return client
    except Exception as e:
        logger.error(f"Error al conectar a Gmail: {e}", exc_info=True)
        return None

def ensure_label_exists(client: IMAPClient, label_name: str):
    """
    Asegura que la etiqueta de Gmail exista, la crea si no existe
    
    Args:
        client: Cliente IMAP conectado
        label_name: Nombre de la etiqueta
    """
    try:
        # Listar todas las carpetas/etiquetas
        folders = client.list_folders()
        label_exists = any(label_name in str(folder) for folder in folders)
        
        if not label_exists:
            logger.info(f"Creando etiqueta '{label_name}'...")
            client.create_folder(label_name)
    except Exception as e:
        logger.warning(f"No se pudo verificar/crear etiqueta '{label_name}': {e}")

def get_unprocessed_emails(client: IMAPClient) -> List[int]:
    """
    Obtiene IDs de correos sin la etiqueta de procesado
    
    Args:
        client: Cliente IMAP conectado
        
    Returns:
        Lista de UIDs de correos sin procesar
    """
    try:
        client.select_folder('INBOX', readonly=False)
        
        # Buscar correos SIN la etiqueta de procesado
        # Gmail usa X-GM-LABELS para buscar por etiquetas
        messages = client.search(['NOT', 'X-GM-LABELS', PROCESSED_LABEL])
        
        logger.info(f"Se encontraron {len(messages)} correos sin procesar")
        return messages
        
    except Exception as e:
        logger.error(f"Error al buscar correos: {e}", exc_info=True)
        return []

def apply_processed_label(client: IMAPClient, uid: int):
    """
    Aplica la etiqueta de procesado a un correo
    
    Args:
        client: Cliente IMAP conectado
        uid: UID del correo
    """
    try:
        client.add_gmail_labels([uid], [PROCESSED_LABEL])
        logger.debug(f"Etiqueta '{PROCESSED_LABEL}' aplicada al correo UID {uid}")
    except Exception as e:
        logger.error(f"Error al aplicar etiqueta al correo UID {uid}: {e}", exc_info=True)

# ============================================================================
# PROCESAMIENTO PRINCIPAL
# ============================================================================

def generate_filename(metadata: Dict[str, str], extension: str) -> str:
    """
    Genera el nombre de archivo según el patrón especificado
    
    Patrón: AAAA-MM-DD_[Proveedor]_[NIT]_[NoFactura].ext
    
    Args:
        metadata: Diccionario con los metadatos extraídos
        extension: Extensión del archivo (.xml o .pdf)
        
    Returns:
        Nombre de archivo formateado
    """
    # Parsear fecha
    issue_date = metadata.get('issue_date', '')
    try:
        if issue_date:
            date_obj = parse_date(issue_date)
            date_str = date_obj.strftime('%Y-%m-%d')
        else:
            date_str = datetime.now().strftime('%Y-%m-%d')
    except:
        date_str = datetime.now().strftime('%Y-%m-%d')
    
    # Sanitizar componentes
    supplier = sanitize_filename(metadata.get('supplier_name', 'Desconocido'))
    nit = sanitize_filename(metadata.get('nit', 'SIN_NIT'))
    invoice_num = sanitize_filename(metadata.get('invoice_number', 'SIN_NUM'))
    
    # Construir nombre
    filename = f"{date_str}_{supplier}_{nit}_{invoice_num}{extension}"
    
    return filename

def validate_invoice_in_subject(subject: str, invoice_number: str) -> bool:
    """
    Valida si el número de factura aparece en el asunto del correo
    
    Args:
        subject: Asunto del correo
        invoice_number: Número de factura extraído del XML
        
    Returns:
        True si el número aparece en el asunto, False en caso contrario
    """
    if not subject or not invoice_number:
        return False
    
    # Normalizar ambos para comparación
    subject_normalized = re.sub(r'\s+', '', subject.upper())
    invoice_normalized = re.sub(r'\s+', '', invoice_number.upper())
    
    return invoice_normalized in subject_normalized

def process_email(client: IMAPClient, uid: int) -> bool:
    """
    Procesa un correo individual: extrae, valida, renombra y almacena
    
    Args:
        client: Cliente IMAP conectado
        uid: UID del correo a procesar
        
    Returns:
        True si el procesamiento fue exitoso, False en caso contrario
    """
    try:
        logger.info(f"\n{'='*60}")
        logger.info(f"Procesando correo UID: {uid}")
        logger.info(f"{'='*60}")
        
        # Obtener datos del correo
        response = client.fetch([uid], ['ENVELOPE', 'RFC822'])
        
        if uid not in response:
            logger.error(f"No se pudo obtener el correo UID {uid}")
            return False
        
        envelope = response[uid][b'ENVELOPE']
        subject = envelope.subject.decode('utf-8', errors='ignore') if envelope.subject else ''
        logger.info(f"Asunto: {subject}")
        
        # Obtener el mensaje completo
        import email
        msg_data = response[uid][b'RFC822']
        msg = email.message_from_bytes(msg_data)
        
        # Buscar adjuntos ZIP
        zip_found = False
        
        for part in msg.walk():
            content_type = part.get_content_type()
            filename = part.get_filename()
            
            if filename and filename.lower().endswith('.zip'):
                logger.info(f"Adjunto ZIP encontrado: {filename}")
                
                # Obtener contenido del ZIP
                zip_content = part.get_payload(decode=True)
                
                # Procesar ZIP
                result = process_zip_attachment(zip_content)
                
                if not result:
                    logger.warning(f"No se pudo procesar el ZIP: {filename}")
                    continue
                
                xml_content, pdf_content, metadata = result
                zip_found = True
                
                # Validar número de factura en asunto
                invoice_number = metadata.get('invoice_number', '')
                if not validate_invoice_in_subject(subject, invoice_number):
                    logger.warning(
                        f"[WARNING] El número de factura '{invoice_number}' "
                        f"NO aparece en el asunto del correo: '{subject}'"
                    )
                else:
                    logger.info(f"✓ Número de factura validado en asunto")
                
                # Generar nombres de archivo
                xml_filename = generate_filename(metadata, '.xml')
                xml_path = os.path.join(BASE_DIR, xml_filename)
                
                # Guardar XML
                with open(xml_path, 'wb') as f:
                    f.write(xml_content)
                logger.info(f"✓ XML guardado: {xml_filename}")
                
                # Guardar PDF si existe
                if pdf_content:
                    pdf_filename = generate_filename(metadata, '.pdf')
                    pdf_path = os.path.join(BASE_DIR, pdf_filename)
                    
                    with open(pdf_path, 'wb') as f:
                        f.write(pdf_content)
                    logger.info(f"✓ PDF guardado: {pdf_filename}")
                
                # Log de metadatos
                logger.info(f"Metadatos extraídos:")
                logger.info(f"  - Fecha: {metadata.get('issue_date', 'N/A')}")
                logger.info(f"  - Proveedor: {metadata.get('supplier_name', 'N/A')}")
                logger.info(f"  - NIT: {metadata.get('nit', 'N/A')}")
                logger.info(f"  - No. Factura: {metadata.get('invoice_number', 'N/A')}")
                
                # Aplicar etiqueta de procesado
                apply_processed_label(client, uid)
                logger.info(f"✓ Correo etiquetado como procesado")
                
                return True
        
        if not zip_found:
            logger.warning(f"No se encontraron adjuntos ZIP en el correo UID {uid}")
            return False
            
    except Exception as e:
        logger.error(f"Error al procesar correo UID {uid}: {e}", exc_info=True)
        return False

# ============================================================================
# FUNCIÓN PRINCIPAL
# ============================================================================

def main():
    """Función principal del procesador de facturas"""
    logger.info("\n" + "="*70)
    logger.info("SISTEMA DE PROCESAMIENTO AUTOMÁTICO DE FACTURAS ELECTRÓNICAS")
    logger.info("="*70)
    logger.info(f"Inicio de ejecución: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Usuario Gmail: {GMAIL_USER}")
    logger.info(f"Directorio de almacenamiento: {BASE_DIR}")
    logger.info("="*70 + "\n")
    
    # Conectar a Gmail
    client = connect_gmail()
    if not client:
        logger.error("No se pudo establecer conexión con Gmail. Abortando.")
        return 1
    
    try:
        # Asegurar que existe la etiqueta
        ensure_label_exists(client, PROCESSED_LABEL)
        
        # Obtener correos sin procesar
        unprocessed_emails = get_unprocessed_emails(client)
        
        if not unprocessed_emails:
            logger.info("No hay correos nuevos para procesar.")
            return 0
        
        # Procesamiento individual de cada correo
        success_count = 0
        error_count = 0
        
        for uid in unprocessed_emails:
            try:
                if process_email(client, uid):
                    success_count += 1
                else:
                    error_count += 1
            except Exception as e:
                logger.error(f"Error crítico al procesar correo UID {uid}: {e}", exc_info=True)
                error_count += 1
                # Continuar con el siguiente correo
                continue
        
        # Resumen final
        logger.info("\n" + "="*70)
        logger.info("RESUMEN DE EJECUCIÓN")
        logger.info("="*70)
        logger.info(f"Total de correos procesados: {len(unprocessed_emails)}")
        logger.info(f"  ✓ Exitosos: {success_count}")
        logger.info(f"  ✗ Errores: {error_count}")
        logger.info(f"Fin de ejecución: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("="*70 + "\n")
        
        return 0 if error_count == 0 else 1
        
    except Exception as e:
        logger.error(f"Error crítico en el proceso principal: {e}", exc_info=True)
        return 1
        
    finally:
        # Cerrar conexión
        try:
            client.logout()
            logger.info("Conexión a Gmail cerrada correctamente")
        except:
            pass

if __name__ == "__main__":
    sys.exit(main())
