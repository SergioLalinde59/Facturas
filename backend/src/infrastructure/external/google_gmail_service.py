import os
import base64
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import logging
import email.utils
from datetime import datetime
from src.domain.ports.gmail_port import GmailPort
from typing import List, Dict, Any, Optional

SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
logger = logging.getLogger("gmail_service")

class GoogleGmailService(GmailPort):
    def __init__(self, credentials_path: str, token_path: str):
        self.credentials_path = credentials_path
        self.token_path = token_path
        logger.info("Inicializando servicio de Gmail...")
        self.service = self._authenticate()

    def _authenticate(self):
        creds = None
        if os.path.exists(self.token_path):
            logger.info(f"Cargando token desde {self.token_path}")
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
        
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logger.info("Token expirado, intentando refrescar...")
                creds.refresh(Request())
            else:
                logger.info("Iniciando nuevo flujo de autenticación OAuth2...")
                if not os.path.exists(self.credentials_path):
                    logger.error(f"Falta archivo de credenciales: {self.credentials_path}")
                    raise FileNotFoundError(f"Archivo de credenciales no encontrado en {self.credentials_path}")
                
                # Para clientes de tipo 'web' en local server, es mejor fijar el puerto
                flow = InstalledAppFlow.from_client_secrets_file(self.credentials_path, SCOPES)
                # Forzamos un puerto fijo para que sea más fácil de configurar en el Google Cloud Console
                port = 8080
                logger.info(f"Usando puerto fijo {port} para el callback de OAuth2")
                creds = flow.run_local_server(port=port)
            
            with open(self.token_path, 'w') as token:
                token.write(creds.to_json())
                logger.info(f"Nuevo token guardado en {self.token_path}")

        return build('gmail', 'v1', credentials=creds)

    def ensure_label_exists(self, label_name: str):
        results = self.service.users().labels().list(userId='me').execute()
        labels = results.get('labels', [])
        
        for label in labels:
            if label['name'] == label_name:
                return label['id']
        
        # Crear si no existe
        label_body = {
            'name': label_name,
            'labelListVisibility': 'labelShow',
            'messageListVisibility': 'show'
        }
        new_label = self.service.users().labels().create(userId='me', body=label_body).execute()
        return new_label['id']

    def search_unprocessed_emails(self, label_name: str) -> List[Dict[str, Any]]:
        # Modo agresivo: Buscamos TODO en el INBOX que no haya sido procesado ya.
        # Esto incluye Principal, Promociones, Social, etc.
        query = f"label:INBOX -label:{label_name}"
        messages = []
        next_page_token = None
        
        while True:
            results = self.service.users().messages().list(
                userId='me', q=query, pageToken=next_page_token
            ).execute()
            
            messages.extend(results.get('messages', []))
            next_page_token = results.get('nextPageToken')
            
            if not next_page_token or len(messages) >= 2000:
                break
        
        logger.info(f"Búsqueda finalizada. Query: '{query}'. Encontrados: {len(messages)}")
        return messages

    def get_attachments(self, message_id: str) -> List[Dict[str, Any]]:
        message = self.service.users().messages().get(userId='me', id=message_id).execute()
        return self.extract_attachments(message)

    def extract_attachments(self, message: Dict[str, Any]) -> List[Dict[str, Any]]:
        payload = message.get('payload', {})
        attachments = []
        self._find_attachments_recursive(payload, attachments)
        return attachments

    def _find_attachments_recursive(self, part: Dict[str, Any], attachments: List[Dict[str, Any]]):
        if part.get('filename') and part.get('body', {}).get('attachmentId'):
            attachments.append({
                'filename': part['filename'],
                'attachmentId': part['body']['attachmentId']
            })
        
        if 'parts' in part:
            for subpart in part['parts']:
                self._find_attachments_recursive(subpart, attachments)

    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        attachment = self.service.users().messages().attachments().get(
            userId='me', messageId=message_id, id=attachment_id
        ).execute()
        data = attachment.get('data')
        if data:
            return base64.urlsafe_b64decode(data)
        return b''

    def mark_as_processed(self, message_id: str, label_name: str):
        # Primero obtenemos el ID de la etiqueta por nombre
        results = self.service.users().labels().list(userId='me').execute()
        label_id = next((l['id'] for l in results.get('labels', []) if l['name'] == label_name), None)
        
        if label_id:
            body = {
                'addLabelIds': [label_id],
                'removeLabelIds': ['INBOX'] # Opcionalmente quitar de INBOX
            }
            self.service.users().messages().modify(userId='me', id=message_id, body=body).execute()

    def get_message_metadata(self, message_id: str) -> Dict[str, str]:
        message = self.service.users().messages().get(userId='me', id=message_id, format='metadata').execute()
        return self.extract_metadata(message)

    def extract_metadata(self, message: Dict[str, Any]) -> Dict[str, str]:
        headers = message.get('payload', {}).get('headers', [])
        
        def get_header(name: str) -> Optional[str]:
            for h in headers:
                if h.get('name', '').lower() == name.lower():
                    return h.get('value')
            return None

        raw_from = get_header('From') or "Desconocido"
        raw_date = get_header('Date') or "Fecha desconocida"
        subject = get_header('Subject') or "(Sin asunto)"
        
        # Formatear fecha a yyyy-mm-dd
        formatted_date = raw_date
        try:
            parsed_date = email.utils.parsedate_to_datetime(raw_date)
            formatted_date = parsed_date.strftime('%Y-%m-%d')
        except Exception as e:
            logger.debug(f"Error parseando fecha {raw_date}: {str(e)}")
            
        metadata = {
            "from": raw_from,
            "date": formatted_date,
            "subject": subject,
            "threadId": message.get('threadId'),
            "id": message.get('id'),
            "internalDate": message.get('internalDate')
        }
        return metadata

    def get_thread_messages(self, thread_id: str) -> List[Dict[str, Any]]:
        thread = self.service.users().threads().get(userId='me', id=thread_id).execute()
        messages = thread.get('messages', [])
        # Asegurar orden cronológico (el más antiguo primero)
        messages.sort(key=lambda x: int(x.get('internalDate', 0)))
        return messages

    def trash_message(self, message_id: str):
        logger.info(f"Moviendo correo {message_id} a la papelera.")
        self.service.users().messages().trash(userId='me', id=message_id).execute()
