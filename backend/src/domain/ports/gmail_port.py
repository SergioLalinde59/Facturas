from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any

class GmailPort(ABC):
    @abstractmethod
    def search_unprocessed_emails(self, label_name: str) -> List[Dict[str, Any]]:
        """Busca correos que no tengan la etiqueta de procesado."""
        pass

    @abstractmethod
    def get_attachments(self, message_id: str) -> List[Dict[str, Any]]:
        """Obtiene la lista de adjuntos de un correo."""
        pass

    @abstractmethod
    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """Descarga el contenido de un adjunto."""
        pass

    @abstractmethod
    def mark_as_processed(self, message_id: str, label_name: str):
        """Aplica la etiqueta de procesado al correo."""
        pass

    @abstractmethod
    def ensure_label_exists(self, label_name: str):
        """Asegura que la etiqueta exista en Gmail."""
        pass

    @abstractmethod
    def get_message_metadata(self, message_id: str) -> Dict[str, str]:
        """Obtiene metadatos básicos del correo (Remitente, Fecha)."""
        pass

    @abstractmethod
    def extract_metadata(self, message: Dict[str, Any]) -> Dict[str, str]:
        """Extrae metadatos de un objeto de mensaje ya cargado."""
        pass

    @abstractmethod
    def extract_attachments(self, message: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extrae adjuntos de un objeto de mensaje ya cargado."""
        pass

    @abstractmethod
    def get_thread_messages(self, thread_id: str) -> List[Dict[str, Any]]:
        """Obtiene todos los mensajes de un hilo."""
        pass

    @abstractmethod
    def trash_message(self, message_id: str):
        """Mueve el correo a la papelera."""
        pass
