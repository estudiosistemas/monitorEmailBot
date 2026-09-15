# Documentación de Avance - Fase 6: Proveedor IMAP Genérico

**Fecha:** Septiembre 2026  
**Estado:** Completado  
**Objetivo:** Implementar la conexión con cualquier proveedor de correo electrónico compatible con el protocolo estándar IMAP (RFC 3501) con cifrado TLS/SSL.

---

## 📁 Componentes Implementados

### 1. Cliente IMAP Nativo y Adaptador
* [`src/providers/imap/imap-provider.ts`](file:///e:/SistemasWeb/bot-email/src/providers/imap/imap-provider.ts):
  * `ImapProvider`: Implementa la interfaz común `EmailProvider`.
  * `SimpleImapClient`: Cliente IMAP ligero sobre sockets nativos de Node.js (`tls` / `net`), que evita dependencias externas pesadas o problemas de compatibilidad en entornos ARM/Render.
  * Flujo de comandos RFC 3501: `LOGIN` -> `SELECT INBOX` -> `SEARCH UNSEEN` -> `FETCH` -> `LOGOUT`.
  * Parseo de encabezados RFC 822 (`From`, `To`, `Subject`, `Date`, `Message-ID`).
  * Normalización a `IncomingEmail`.

### 2. Integración en Factory
* [`src/providers/provider-factory.ts`](file:///e:/SistemasWeb/bot-email/src/providers/provider-factory.ts):
  * Registrado el proveedor `'imap'`. Con esto, la fábrica ya soporta los tres proveedores base del MVP:
    * `gmail`
    * `outlook`
    * `imap`
