# Documentación de Avance - Fase 3: Gestión de Cuentas de Correo

**Fecha:** Septiembre 2026  
**Estado:** Completado  
**Objetivo:** Implementar la gestión de cuentas de correo (`EmailAccount`), alta de cuentas IMAP y OAuth, cifrado en reposo de contraseñas y tokens, y control del estado de sincronización.

---

## 📁 Componentes Implementados

### 1. Capa de Servicio
* [`src/services/account-service.ts`](file:///e:/SistemasWeb/bot-email/src/services/account-service.ts):
  * `listAccountsByUser(userId)`: Consulta cuentas asignadas a un usuario enmascarando contraseñas y tokens.
  * `createImapAccount(userId, data)`: Cifra la contraseña con AES-256-GCM antes de guardarla en SQLite.
  * `upsertOAuthAccount(userId, data)`: Cifra `accessToken` y `refreshToken` para cuentas Gmail o Microsoft.
  * `getAccountWithCredentials(accountId)`: Método seguro para que el Worker obtenga credenciales descifradas al momento del polling.
  * `updateSyncStatus(accountId, error)`: Actualiza `lastSyncAt` y `lastSyncError`.
  * `deleteAccount(accountId, userId)`: Elimina la cuenta verificando que pertenezca al usuario.

### 2. Endpoints de la API
* [`src/api/accounts.ts`](file:///e:/SistemasWeb/bot-email/src/api/accounts.ts) y [`src/server.ts`](file:///e:/SistemasWeb/bot-email/src/server.ts):
  * `GET /api/accounts`: Listado de cuentas del usuario autenticado.
  * `GET /api/accounts/:id`: Detalle y métricas de una cuenta.
  * `POST /api/accounts/imap`: Conexión de cuentas IMAP con validación Zod.
  * `DELETE /api/accounts/:id`: Desconexión de cuentas.
