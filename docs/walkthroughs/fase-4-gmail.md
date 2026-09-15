# Documentación de Avance - Fase 4: Proveedor Gmail

**Fecha:** Septiembre 2026  
**Estado:** Completado  
**Objetivo:** Implementar la integración con Gmail mediante Google OAuth 2.0 y Gmail API REST, permitiendo la lectura, refresco de tokens y normalización de correos a la interfaz `IncomingEmail`.

---

## 📁 Componentes Implementados

### 1. Autenticación Google OAuth 2.0
* [`src/auth/google.ts`](file:///e:/SistemasWeb/bot-email/src/auth/google.ts):
  * `getGoogleAuthUrl(userId)`: Construye la URL de consentimiento con scope offline (`gmail.readonly`) y asocia el `userId` en el parámetro `state`.
  * `handleGoogleCallback(code, state)`: Intercambia el código por tokens, consulta el perfil de Google y persiste la cuenta en SQLite con tokens cifrados.
  * `refreshGoogleToken(refreshToken)`: Renueva access tokens expirados de forma transparente.

### 2. Adaptador Gmail
* [`src/providers/gmail/gmail-provider.ts`](file:///e:/SistemasWeb/bot-email/src/providers/gmail/gmail-provider.ts):
  * Implementa `EmailProvider` (`connect`, `getNewEmails`, `getEmail`, `markAsRead`).
  * Consulta la API REST `https://gmail.googleapis.com/gmail/v1/users/me/messages`.
  * Decodifica payloads en base64url, extrae remitentes, destinatarios, asunto, cuerpo HTML/texto y adjuntos.
  * Normaliza la estructura a `IncomingEmail`.

### 3. Registro en Factory y Endpoints
* [`src/providers/provider-factory.ts`](file:///e:/SistemasWeb/bot-email/src/providers/provider-factory.ts): Registrado el provider `'gmail'`.
* [`src/api/auth-routes.ts`](file:///e:/SistemasWeb/bot-email/src/api/auth-routes.ts) y [`src/server.ts`](file:///e:/SistemasWeb/bot-email/src/server.ts):
  * `GET /auth/google`: Inicia el flujo de conexión.
  * `GET /auth/google/callback`: Recibe el callback de Google y asocia la cuenta al usuario.
