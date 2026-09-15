# Documentación de Avance - Fase 8: Notificaciones por Telegram y NotificationRouter

**Fecha:** Septiembre 2026  
**Estado:** Completado  
**Objetivo:** Implementar la entrega de notificaciones exclusivamente por Telegram mediante un Bot unificado, aplicando la regla de decisión (Prioridad >= 3 o Requiere respuesta) y el principio de propiedad estricta (cuenta -> usuario -> telegram personal).

---

## 📁 Componentes Implementados

### 1. Servicio Telegram
* [`src/notifications/telegram.ts`](file:///e:/SistemasWeb/bot-email/src/notifications/telegram.ts):
  * `sendMessageWithRetry(chatId, text)`: Envío HTTP a `https://api.telegram.org/bot<TOKEN>/sendMessage` con reintentos exponenciales (1s, 2s, 4s).
  * `formatEmailMessage(data)`: Construcción del mensaje en formato HTML con la plantilla visual requerida (emojis de severidad, cuenta, remitente, asunto, prioridad, categoría y resumen).
  * Simulación en logs si no se proporciona `TELEGRAM_BOT_TOKEN`, para no romper entornos locales o de desarrollo.

### 2. Router de Notificaciones
* [`src/notifications/router.ts`](file:///e:/SistemasWeb/bot-email/src/notifications/router.ts):
  * `shouldNotify(analysis)`: Aplica el filtro `priority >= 3 || requiresResponse == true`.
  * `routeAndNotify(email, account, analysis)`:
    1. Identifica al usuario dueño de la cuenta (`account.userId`).
    2. Obtiene su destino de Telegram (`getTelegramDestinationForUser`).
    3. Registra la notificación en SQLite con estado `pending`.
    4. Envía el mensaje y actualiza el registro a `sent` (con timestamp) o `failed` (con el motivo del error).
    5. **Aislamiento garantizado:** Bajo ninguna circunstancia Romina recibe notificaciones de cuentas de Mauricio o viceversa.

### 3. Bot Interactivo y Listener de Comandos
* [`src/notifications/telegram-bot-listener.ts`](file:///e:/SistemasWeb/bot-email/src/notifications/telegram-bot-listener.ts):
  * **Long Polling Nativo:** Consume `getUpdates` en bucle asíncrono con timeout de 20s y reconexión automática.
  * **Teclado persistente de opciones:** Provee botones táctiles para fácil acceso móvil (`🔄 Sondear Correos`, `📬 Últimos Correos`, `📧 Mis Cuentas`, `📊 Resumen de Hoy`, `ℹ️ Ayuda`).
  * **Comandos implementados:**
    * `/sondeo` o `/poll`: Dispara un ciclo de sondeo manual inmediato (`runPollCycle('manual')`) y reporta en segundos el resultado, cuentas revisadas y errores.
    * `/ultimos` o `/mails`: Recupera los últimos correos del usuario con insignias de prioridad, categoría y el resumen analizado por OpenRouter Free.
    * `/cuentas`: Informa qué cuentas de correo (Gmail, Outlook, IMAP) están vinculadas al usuario y su estado de sincronización.
    * `/resumen`: Métricas del día (total de correos, urgentes, pendientes de respuesta).
    * `/vincular`: Permite asociar una cuenta de Telegram a un usuario específico (`/vincular usuario@email.com`) si no se detectó automáticamente.
  * **Comprensión de Lenguaje Natural:** Interpreta frases cotidianas ("lee mis mails", "ejecuta un sondeo") delegando en OpenRouter para una experiencia conversacional fluida.

