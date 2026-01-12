import os
import sys

# Añadir el directorio src al path
sys.path.append(os.path.join(os.getcwd(), 'src'))

from application.services.exporter_service import ExporterService

class MockRepository:
    def get_invoices(self, **kwargs):
        return [
            {
                'fecha': '2026-01-10',
                'proveedor': 'Proveedor de Prueba S.A.S.',
                'nit': '123456789-0',
                'factura': 'FE-123',
                'subtotal': 100000.0,
                'iva': 19000.0,
                'total': 119000.0
            },
            {
                'fecha': '2026-01-11',
                'proveedor': 'Tecnología Avanzada',
                'nit': '987654321-1',
                'factura': 'FE-456',
                'subtotal': 200000.0,
                'iva': 38000.0,
                'total': 238000.0
            }
        ]

def test_pdf():
    service = ExporterService()
    repo = MockRepository()
    output_dir = os.getcwd()
    formats = ['pdf']
    filters = {}
    
    print("Probando generación de PDF...")
    result = service.export_from_db(repo, filters, formats, output_dir)
    
    if result['status'] == 'success':
        print(f"Éxito: {result['message']}")
        for file_info in result['files']:
            if file_info['type'] == 'pdf':
                path = file_info['path']
                if os.path.exists(path):
                    print(f"Archivo PDF verificado en: {path}")
                    # Opcional: eliminar el archivo de prueba
                    # os.remove(path)
                else:
                    print(f"ERROR: El archivo {path} no fue creado.")
    else:
        print(f"ERROR: {result.get('message', 'Desconocido')}")

if __name__ == "__main__":
    test_pdf()
