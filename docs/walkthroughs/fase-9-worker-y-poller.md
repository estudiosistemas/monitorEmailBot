# Documentación de Avance - Fase 9: Background Worker y Poller Continuo

**Fecha:** Septiembre 2026  
**Estado:** Completado  
**Objetivo:** Implementar el orquestador central de procesamiento periódico que conecta proveedores de correo, deduplicación en SQLite, análisis con IA y despacho a Telegram con tolerancia a fallos por cuenta.

---

## 📁 Componentes Implementados

### 1. Pipeline de Procesamiento por Cuenta
* [`src/poller/process-account.ts`](file:///e:/SistemasWeb/bot-email/src/poller/process-account.ts):
  1. Resuelve el adaptador correspondiente (`providerFactory.get`).
  2. Obtiene correos nuevos mediante la interfaz normalizada.
  3. **Deduplicación:** Comprueba la clave compuesta `accountId_providerMessageId` en la base de datos. Si ya existe, omite el correo sin costo de IA.
  4. Calcula el hash criptográfico SHA-256 del cuerpo del mensaje (`bodyHash`).
  5. Inserta el correo en SQLite.
  6. Dispara el análisis con OpenAI (`aiAnalyzer.analyzeEmail`).
  7. Persiste la clasificación, prioridad y resumen en `EmailAnalysis`.
  8. Enruta la notificación a Telegram al dueño de la cuenta si cumple los criterios de prioridad o respuesta.
  9. Marca el correo como `processed: true`.
  10. Actualiza `lastSyncAt` y limpia `lastSyncError`.

### 2. Loop de Sondeo y Tolerancia a Fallos
* [`src/poller/poll.ts`](file:///e:/SistemasWeb/bot-email/src/poller/poll.ts):
  * Consulta periódica cada `POLL_INTERVAL_MINUTES` (por defecto 5 minutos).
  * **Aislamiento de fallos por cuenta (Sección 37):** Si una cuenta particular (ej. Outlook de Romina) falla por credenciales inválidas o caída de red, el error se captura y se persiste en `lastSyncError`, permitiendo que el resto de cuentas (ej. Gmail de Mauricio e IMAP de Romina) se procesen normalmente sin interrupción.
  * Soporte dual: Puede correr embebido en el servidor Fastify o como proceso Worker independiente (`npm run worker`).
