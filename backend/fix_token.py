import sys
import os

# Asegurar que el directorio actual (backend) esté en el path
sys.path.append(os.getcwd())

from src.infrastructure.external.google_gmail_service import GoogleGmailService

# Definir rutas
CREDENTIALS_PATH = os.path.abspath("credentials.json")
TOKEN_PATH = os.path.abspath("token.json")

print(f"--- Renovación de Token Gmail ---")
print(f"Credenciales: {CREDENTIALS_PATH}")
print(f"Token destino: {TOKEN_PATH}")

# Eliminar token corrupto/expirado si existe
if os.path.exists(TOKEN_PATH):
    print("Eliminando token.json expirado o inválido...")
    os.remove(TOKEN_PATH)
else:
    print("No se encontró token.json previo.")

print("Iniciando servicio para disparar la autenticación OAuth2...")
print(">> SE ABRIRÁ UNA VENTANA EN TU NAVEGADOR. POR FAVOR AUTORIZA LA APP <<")

try:
    # Al instanciar, el servicio intenta cargar credentiales. 
    # Como borramos el token, disparará el flujo flow.run_local_server()
    service = GoogleGmailService(CREDENTIALS_PATH, TOKEN_PATH)
    print("\n[EXITO] Nuevo token.json generado y guardado correctamente.")
    print("Ahora puedes reiniciar tu contenedor o servicio backend.")
except Exception as e:
    print(f"\n[ERROR] Falló la autenticación: {e}")
    # Imprimir traza completa si es necesario
    import traceback
    traceback.print_exc()
