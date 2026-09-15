# Guía Completa de Uso y Configuración — Mail Agent

Este documento detalla paso a paso cómo iniciar el sistema, configurar el bot de Telegram, conectar cuentas de correo (IMAP, Gmail y Outlook) y monitorear el funcionamiento general.

---

## ⚡ 0. Requisito Indispensable: Iniciar el Servidor

Para que cualquier comando de conexión o el dashboard funcione, el servidor debe estar en ejecución.

Abre una terminal en la carpeta del proyecto (`e:\SistemasWeb\bot-email`) y ejecuta:

```bash
pnpm dev
```

Verás un mensaje como este:
```text
🚀 Servidor escuchando en http://127.0.0.1:3000
```
> **Nota:** Mantén esa ventana de terminal abierta mientras utilices el sistema o configures cuentas.

---

## 👥 1. Identificadores de Usuarios del Sistema

El sistema trabaja con usuarios y aislamiento estricto:

| Usuario | ID | Correo de Identificación |
| :--- | :---: | :--- |
| **Romina** | `1` | `romina@local.test` |
| **Mauricio** | `2` | `mauricio@local.test` |

---

## ✈️ 2. Configuración de Telegram

### Paso A: El Token del Bot
Ya tienes tu token configurado en tu archivo [`.env`](file:///e:/SistemasWeb/bot-email/.env):
```env
TELEGRAM_BOT_TOKEN="8595660715:AAEt-8cgkvVh46H5BZkhS9cQn7Ku3tGiXg4"
```

### Paso B: Iniciar conversación con el Bot
1. Romina y Mauricio deben abrir Telegram y buscar al bot creado (o buscar a **[@userinfobot](https://t.me/userinfobot)** para ver su número de Chat ID).
2. Es obligatorio enviarle al menos un mensaje `/start` al bot para que Telegram le permita enviarles mensajes.

### Paso C: Vincular el Chat ID al Usuario

Con el servidor encendido (`pnpm dev`), ejecuta en **PowerShell**:

#### Para Mauricio (User ID 2):
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/telegram/connect?userId=2" -Method Post -ContentType "application/json" -Body '{"chatId": "1000785580", "username": "mauricio"}'
```

#### Para Romina (User ID 1):
*(Reemplaza `CHAT_ID_DE_ROMINA` por su número real)*:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/telegram/connect?userId=1" -Method Post -ContentType "application/json" -Body '{"chatId": "8744759343", "username": "romina"}'
```

### Paso D: Enviar Mensaje de Prueba
Tienes dos formas sencillas de probar la conexión de Telegram:
1. **Desde el Dashboard Web:** Entra a **[http://localhost:3000/dashboard](http://localhost:3000/dashboard)** y haz clic en el botón azul **📲 Probar Telegram** ubicado en la tarjeta de cada usuario.
2. **Desde PowerShell:**
   * Para Mauricio:
     ```powershell
     Invoke-RestMethod -Uri "http://localhost:3000/api/telegram/test?userId=2" -Method Post
     ```
   * Para Romina:
     ```powershell
     Invoke-RestMethod -Uri "http://localhost:3000/api/telegram/test?userId=1" -Method Post
     ```

---

## 📧 3. Conexión de Cuentas de Correo

### Opción 1: Cuentas IMAP (Empresariales, Dominios Propios, cPanel, Webmail)
Es la alternativa más rápida para correos corporativos o cuentas que no requieren OAuth. La contraseña se almacena **cifrada con AES-256 en reposo**.

#### Conectar correo para Mauricio (User ID 2):
Abre PowerShell y ejecuta:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/accounts/imap?userId=2" -Method Post -ContentType "application/json" -Body '{
  "email": "mauriciocosta@psicotest.ar",
  "displayName": "Mauricio Psicotest.ar",
  "imapHost": "imappro.zoho.com",
  "imapPort": 993,
  "imapUser": "estudiosistemas@gmail.com",
  "imapPassword": "Ro190180!",
  "imapTls": true
}'

Invoke-RestMethod -Uri "http://localhost:3000/api/accounts/imap?userId=2" -Method Post -ContentType "application/json" -Body '{
  "email": "info@psicotest.ar",
  "displayName": "Info Psicotest.ar",
  "imapHost": "imappro.zoho.com",
  "imapPort": 993,
  "imapUser": "info@psicotest.ar",
  "imapPassword": "2fby%Rfo",
  "imapTls": true
}'

Invoke-RestMethod -Uri "http://localhost:3000/api/accounts/imap?userId=2" -Method Post -ContentType "application/json" -Body '{
  "email": "contacto@estudiosistemas.com.ar",
  "displayName": "Contacto Estudio Sistemas",
  "imapHost": "c2622311.ferozo.com",
  "imapPort": 993,
  "imapUser": "contacto@estudiosistemas.com.ar",
  "imapPassword": "KJHE@5i9",
  "imapTls": true
}'

```

#### Conectar correo para Romina (User ID 1):
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/accounts/imap?userId=2" -Method Post -ContentType "application/json" -Body '{
  "email": "marketing@psicotest.ar",
  "displayName": "Marketing Psicotest.ar",
  "imapHost": "imappro.zoho.com",
  "imapPort": 993,
  "imapUser": "marketing@psicotest.ar",
  "imapPassword": "gs?smzB2",
  "imapTls": true
}'
```

---

### Opción 2: Cuentas Gmail (Google OAuth 2.0)

Para cuentas `@gmail.com`:

1. En [Google Cloud Console](https://console.cloud.google.com/):
   * Crea un proyecto y habilita **Gmail API**.
   * En *Pantalla de consentimiento OAuth*, agrega tu email como usuario de prueba.
   * Crea credenciales de tipo **ID de cliente de OAuth 2.0 (Aplicación web)**.
   * En *URIs de redireccionamiento autorizados*, agrega:
     ```text
     http://localhost:3000/auth/google/callback
     ```
2. Agrega las claves en tu [`.env`](file:///e:/SistemasWeb/bot-email/.env):
   ```env
   GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="xxxx"
   GOOGLE_REDIRECT_URI="http://localhost:3000/auth/google/callback"
   ```
3. **Para vincular a Romina:** Abre en tu navegador:
   ```text
   http://localhost:3000/auth/google?userId=1
   ```
4. **Para vincular a Mauricio:** Abre en tu navegador:
   ```text
   http://localhost:3000/auth/google?userId=2
   ```
   *Inicias sesión, aceptas los permisos y la cuenta quedará asociada automáticamente.*

---

### Opción 3: Cuentas Microsoft Outlook / 365

1. En [Azure Portal (Microsoft Entra ID)](https://portal.azure.com/):
   * Registra una aplicación con redirección Web:
     ```text
     http://localhost:3000/auth/microsoft/callback
     ```
2. Agrega las claves en tu [`.env`](file:///e:/SistemasWeb/bot-email/.env):
   ```env
   MICROSOFT_CLIENT_ID="xxxx"
   MICROSOFT_CLIENT_SECRET="xxxx"
   MICROSOFT_REDIRECT_URI="http://localhost:3000/auth/microsoft/callback"
   ```
3. **Para vincular a Romina:** Abre en el navegador `http://localhost:3000/auth/microsoft?userId=1`.
4. **Para vincular a Mauricio:** Abre en el navegador `http://localhost:3000/auth/microsoft?userId=2`.

---

## 🧠 4. Configurar Inteligencia Artificial (OpenAI)

Para que el modelo analice y resuma los correos:
1. Agrega tu clave en el archivo [`.env`](file:///e:/SistemasWeb/bot-email/.env):
   ```env
   OPENAI_API_KEY="sk-proj-tu-api-key-de-openai"
   OPENAI_MODEL="gpt-4o-mini"
   ```
> Si no tienes una clave aún, no te preocupes: el sistema tiene un **analizador heurístico de respaldo** que clasifica por palabras clave sin coste alguno.

---

## 🔄 5. Operación y Sondeo Automático

### Activar el sondeo en segundo plano:
En tu archivo [`.env`](file:///e:/SistemasWeb/bot-email/.env), cambia:
```env
ENABLE_EMBEDDED_POLLER=true
POLL_INTERVAL_MINUTES=5
```
Con esto, cada 5 minutos el bot consultará todas las cuentas y enviará alertas por Telegram de forma autónoma.

### Forzar sondeo manual inmediato:
Tienes dos formas:
1. **Desde el Dashboard:** Entra a **[http://localhost:3000/dashboard](http://localhost:3000/dashboard)** y haz clic en el botón **⚡ Forzar Sondeo**.
2. **Desde la consola:**
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/api/poll" -Method Post
   ```

---

## 📊 6. Visualizar Datos con Prisma Studio

Si quieres ver las tablas en una interfaz gráfica para consultar cuentas, correos y notificaciones:
```bash
pnpm prisma:studio
```
Abrirá automáticamente un panel en `http://localhost:5555`.

---

## ❓ 7. Preguntas Frecuentes y Solución de Problemas

* **Error: `No es posible conectar con el servidor remoto`:**
  * **Causa:** El servidor no está corriendo.
  * **Solución:** Ejecuta `pnpm dev` en tu terminal antes de lanzar las peticiones.
* **Telegram no envía el mensaje:**
  * Asegúrate de haber iniciado la conversación con tu bot en Telegram pulsando **Iniciar** (`/start`). Los bots de Telegram no pueden hablarle a usuarios que no hayan iniciado el chat primero.
