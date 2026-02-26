# Actualizar Token de Gmail - Guía

## Contexto

La aplicación Facturas usa **OAuth2** para conectarse a Gmail y extraer facturas de proveedores automáticamente. El token de acceso expira periódicamente (~1 hora), y aunque el sistema intenta renovarlo automáticamente usando el `refresh_token`, hay situaciones donde es necesario regenerar el token manualmente.

---

## Cuándo se necesita actualizar el token

| Situación | Síntoma |
|-----------|---------|
| Token expirado y refresh falló | Error `invalid_grant` en logs |
| Credenciales de Google revocadas | Error `Token has been revoked` |
| Cambio de contraseña de Gmail | El token anterior deja de funcionar |
| Primera configuración | No existe `token.json` |
| Token corrupto | Errores de deserialización al iniciar |

---

## Archivos involucrados

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| `credentials.json` | `backend/credentials.json` | Credenciales OAuth2 del proyecto Google Cloud (client_id, client_secret) |
| `token.json` | `backend/Scripts/token.json` | Token de acceso + refresh token generado tras autorizar |
| `fix_token.py` | `backend/Scripts/fix_token.py` | Script para regenerar el token manualmente |
| `google_gmail_service.py` | `backend/src/infrastructure/external/google_gmail_service.py` | Servicio que gestiona la autenticación automática |

---

## Método 1: Usar el script `fix_token.py` (Recomendado)

### Prerrequisitos
- Python 3.x instalado
- Dependencias del proyecto instaladas (`pip install -r requirements.txt`)
- Archivo `credentials.json` presente en `backend/`
- Puerto **8080** disponible en tu máquina local

### Pasos

1. **Abrir terminal** en la carpeta del proyecto:
   ```bash
   cd "F:\1. Cloud\4. AI\1. Antigravity\Facturas"
   ```

2. **Ejecutar el script**:
   ```bash
   cd backend/Scripts
   python fix_token.py
   ```

3. **Autorizar en el navegador**: Se abrirá automáticamente una ventana del navegador con la pantalla de consentimiento de Google:
   - Seleccionar la cuenta de Gmail configurada (`sergio.lalinde.facturas@gmail.com`)
   - Si aparece advertencia "App no verificada", hacer clic en **Configuración avanzada** > **Ir a api-gmai-facturas (no seguro)**
   - Conceder los permisos solicitados (lectura y modificación de Gmail)

4. **Verificar éxito**: El script mostrará:
   ```
   [EXITO] Nuevo token.json generado y guardado correctamente.
   Ahora puedes reiniciar tu contenedor o servicio backend.
   ```

5. **Reiniciar el servicio backend**:
   ```bash
   docker-compose restart backend
   ```

---

## Método 2: Eliminar token.json y reiniciar

Si el script no funciona o prefieres hacerlo manualmente:

1. **Eliminar el token expirado**:
   ```bash
   del "backend\Scripts\token.json"
   ```

2. **Ejecutar la aplicación localmente** (NO en Docker, ya que necesita abrir el navegador):
   ```bash
   cd backend
   python -m src.main
   ```
   El servicio de Gmail intentará autenticarse, abrirá el navegador para OAuth2, y guardará el nuevo `token.json`.

3. **Copiar el token al contenedor** (si usas Docker):
   ```bash
   docker cp backend/Scripts/token.json facturas_backend:/app/Scripts/token.json
   docker-compose restart backend
   ```

---

## Cómo funciona la renovación automática

El servicio `GoogleGmailService` implementa esta lógica al inicializarse:

```
¿Existe token.json?
  ├─ SÍ → Cargar token
  │   ├─ ¿Token válido? → Usar directamente
  │   ├─ ¿Expirado + tiene refresh_token? → Renovar automáticamente
  │   └─ ¿Inválido/sin refresh? → Iniciar flujo OAuth2 (navegador)
  └─ NO → Iniciar flujo OAuth2 (navegador)

→ Guardar token actualizado en token.json
→ Servicio Gmail listo
```

La renovación automática usa el `refresh_token` almacenado en `token.json`. Este refresh token **no expira** a menos que:
- El usuario revoque el acceso desde [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
- Se cambie la contraseña de la cuenta de Gmail
- El proyecto Google Cloud sea eliminado o suspendido
- El refresh token no se use por **6 meses** (política de Google)

---

## Configuración en Google Cloud Console

Si necesitas crear nuevas credenciales OAuth2 desde cero:

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Seleccionar el proyecto **api-gmai-facturas**
3. Navegar a **APIs & Services** > **Credentials**
4. Verificar que **Gmail API** esté habilitada en **APIs & Services** > **Library**
5. En **OAuth 2.0 Client IDs**, crear o editar las credenciales:
   - **Tipo**: Web application
   - **Authorized redirect URIs**: `http://localhost:8080/` (para flujo local)
6. Descargar el JSON y guardarlo como `backend/credentials.json`

### Estructura esperada de `credentials.json`:
```json
{
  "web": {
    "client_id": "XXXXXX.apps.googleusercontent.com",
    "project_id": "api-gmai-facturas",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "GOCSPX-XXXXXXXXXXXXXX"
  }
}
```

---

## Scopes (permisos) requeridos

El servicio solicita el scope:
```
https://www.googleapis.com/auth/gmail.modify
```

Este permiso permite:
- Leer correos electrónicos
- Descargar adjuntos (XMLs de facturas)
- Crear y aplicar etiquetas (`Factura_Procesada`)
- Mover correos procesados fuera del inbox

---

## Solución de problemas comunes

### Error: `invalid_grant`
El refresh token fue revocado o expiró. **Solución**: Ejecutar `fix_token.py`.

### Error: `Access blocked: This app's request is invalid`
La URI de redirección no coincide con la configurada en Google Cloud Console.
**Solución**: Verificar que `http://localhost:8080/` esté en las Authorized redirect URIs.

### Error: `Port 8080 already in use`
Otro proceso está usando el puerto 8080.
**Solución**: Cerrar el proceso que usa el puerto o detener Docker temporalmente:
```bash
# Ver qué usa el puerto 8080
netstat -ano | findstr :8080
# Detener Docker si es necesario
docker-compose stop
# Ejecutar fix_token.py
python fix_token.py
# Volver a levantar Docker
docker-compose up -d
```

### Error: `credentials.json not found`
El archivo de credenciales no existe en la ruta esperada.
**Solución**: Verificar que `backend/credentials.json` existe. Si no, descargarlo desde Google Cloud Console.

### El navegador no se abre (entorno sin GUI)
El script necesita un navegador para el flujo OAuth2.
**Solución**: Ejecutar el script desde una máquina con interfaz gráfica, NO desde un servidor remoto o contenedor Docker.

---

## Notas de seguridad

- **No subir `token.json` al repositorio** - Contiene tokens de acceso en texto plano
- **No compartir `credentials.json`** - Contiene el client_secret del proyecto
- La variable de entorno `GMAIL_PASSWORD` en `.env` está **deprecada** (Google eliminó app passwords en 2024). No se usa actualmente.
- Para producción (PH360), los tokens se almacenan **encriptados con AES-256** en base de datos, no en archivos