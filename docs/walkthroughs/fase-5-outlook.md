# Documentación de Avance - Fase 5: Proveedor Microsoft Outlook / Microsoft 365

**Fecha:** Septiembre 2026  
**Estado:** Completado  
**Objetivo:** Implementar la integración con Microsoft Outlook / Hotmail / Microsoft 365 mediante Microsoft Graph API y OAuth 2.0.

---

## 📁 Componentes Implementados

### 1. Autenticación Microsoft OAuth 2.0
* [`src/auth/microsoft.ts`](file:///e:/SistemasWeb/bot-email/src/auth/microsoft.ts):
  * `getMicrosoftAuthUrl(userId)`: Genera la URL de consentimiento de Microsoft con scopes `Mail.Read`, `Mail.ReadWrite`, `offline_access`.
  * `handleMicrosoftCallback(code, state)`: Intercambia el código de autorización por tokens, consulta el endpoint `/v1.0/me` de Microsoft Graph y guarda la cuenta con tokens cifrados.
  * `refreshMicrosoftToken(refreshToken)`: Renueva tokens expirados automáticamente.

### 2. Adaptador Outlook (`EmailProvider`)
* [`src/providers/outlook/outlook-provider.ts`](file:///e:/SistemasWeb/bot-email/src/providers/outlook/outlook-provider.ts):
  * Implementa `EmailProvider` conectándose a Microsoft Graph.
  * Filtra correos no leídos y posteriores al último ciclo de sincronización (`isRead eq false and receivedDateTime ge ...`).
  * Normaliza la estructura a `IncomingEmail`.
  * Permite marcar mensajes como leídos (`markAsRead`).

### 3. Registro y Rutas
* [`src/providers/provider-factory.ts`](file:///e:/SistemasWeb/bot-email/src/providers/provider-factory.ts): Registrado el adaptador `'outlook'`.
* [`src/api/auth-routes.ts`](file:///e:/SistemasWeb/bot-email/src/api/auth-routes.ts):
  * `GET /auth/microsoft?userId=X`: Redirige al login de Microsoft.
  * `GET /auth/microsoft/callback`: Vincula la cuenta de correo a Romina o Mauricio.
