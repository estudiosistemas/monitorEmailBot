# Agente Inteligente de Monitoreo de Correos

## Plan de ejecución para Render

**Versión:** 1.0  
**Fecha:** Septiembre 2026  
**Stack:** Node.js + TypeScript + Prisma + SQLite + Render + OpenAI + Telegram

---

# 1. Objetivo

Desarrollar un agente de monitoreo de correos electrónicos capaz de conectarse a múltiples cuentas de correo pertenecientes a diferentes usuarios, detectar nuevos emails, analizarlos mediante inteligencia artificial y enviar una notificación por Telegram al propietario correspondiente.

El sistema deberá permitir que:

- Romina tenga una o varias cuentas de correo.
- Mauricio tenga una o varias cuentas de correo.
- Cada cuenta pueda utilizar un proveedor diferente.
- Los emails recibidos sean analizados automáticamente.
- La IA determine prioridad, categoría y necesidad de respuesta.
- Las notificaciones se envíen exclusivamente por Telegram.
- Cada usuario reciba únicamente las notificaciones correspondientes a sus propias cuentas.
- El sistema funcione automáticamente en Render.
- Se pueda agregar soporte para nuevos proveedores sin modificar el núcleo del sistema.

---

# 2. Principio fundamental del sistema

La relación de propiedad debe ser siempre:

```text
EMAIL
   ↓
CUENTA DE CORREO
   ↓
USUARIO PROPIETARIO
   ↓
TELEGRAM DEL USUARIO

Ejemplo:

Romina
 ├── romina@gmail.com
 ├── romina@empresa.com
 └── romina@otrodominio.com

Mauricio
 ├── mauricio@gmail.com
 ├── mauricio@empresa.com
 └── info@midominio.com

Si llega un email a:

romina@empresa.com

la notificación debe enviarse exclusivamente al Telegram de Romina.

Si llega un email a:

mauricio@empresa.com

la notificación debe enviarse exclusivamente al Telegram de Mauricio.

No debe existir ningún cruce de notificaciones salvo que en el futuro se implemente explícitamente una funcionalidad de supervisión.

3. Objetivos del MVP

La primera versión deberá incluir:

Gestión de usuarios.
Gestión de múltiples cuentas de correo.
Soporte para diferentes proveedores.
Conexión mediante OAuth cuando el proveedor lo permita.
Soporte IMAP para proveedores genéricos.
Detección automática de nuevos emails.
Persistencia de emails.
Detección de emails duplicados.
Análisis mediante IA.
Clasificación del email.
Determinación de prioridad.
Determinación de si requiere respuesta.
Generación de resumen.
Notificación por Telegram.
Historial de emails.
Historial de notificaciones.
Registro de errores.
Reintentos ante errores temporales.
Separación estricta entre usuarios.
Funcionamiento automático en Render.

No se implementarán respuestas automáticas en el MVP.

4. Proveedores de correo

El sistema no debe estar diseñado exclusivamente para Gmail.

Se implementará una arquitectura basada en adaptadores.

Proveedores iniciales:

Gmail.
Microsoft Outlook / Hotmail / Microsoft 365.
IMAP genérico.

Posteriormente se podrán agregar:

Yahoo.
Zoho.
Otros proveedores compatibles con IMAP.
APIs específicas de otros proveedores.
5. Arquitectura de proveedores

Todos los proveedores deberán implementar una interfaz común.

interface EmailProvider {

  connect(account: EmailAccount): Promise<void>;

  getNewEmails(
    account: EmailAccount
  ): Promise<IncomingEmail[]>;

  getEmail(
    account: EmailAccount,
    messageId: string
  ): Promise<IncomingEmail>;

  markAsRead?(
    account: EmailAccount,
    messageId: string
  ): Promise<void>;

  disconnect?(
    account: EmailAccount
  ): Promise<void>;
}

El resto de la aplicación no debe conocer los detalles de Gmail, Outlook o IMAP.

El poller trabajará contra la interfaz:

const provider = providerFactory.get(account.provider);

const emails = await provider.getNewEmails(account);
6. Estructura de proveedores
src/
└── providers/
    ├── email-provider.ts
    ├── provider-factory.ts
    │
    ├── gmail/
    │   └── gmail-provider.ts
    │
    ├── outlook/
    │   └── outlook-provider.ts
    │
    └── imap/
        └── imap-provider.ts

Esto permitirá incorporar nuevos proveedores sin modificar el funcionamiento general del agente.

7. Base de datos

La base de datos será:

SQLite

Se utilizará Prisma como ORM.

Configuración:

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

En Render:

DATABASE_URL="file:/data/mail-agent.db"

El archivo de SQLite deberá almacenarse en un Persistent Disk de Render.

No se deberá utilizar el filesystem efímero de Render para almacenar la base de datos.

8. Persistencia en Render

El servicio que utilice SQLite deberá disponer de un Persistent Disk.

Ejemplo:

/data
    └── mail-agent.db

El Persistent Disk deberá montarse en:

/data

La base quedará:

/data/mail-agent.db

Esto permitirá conservar los datos después de:

Deploy.
Restart.
Crash.
Actualizaciones de la aplicación.
9. Arquitectura de Render

La arquitectura recomendada es:

                    RENDER
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   ┌──────────────┐       ┌──────────────┐
   │ Web Service  │       │   Worker     │
   │              │       │              │
   │ OAuth        │       │ Poll emails  │
   │ Dashboard    │       │ IA           │
   │ API          │       │ Telegram     │
   └──────┬───────┘       └──────┬───────┘
          │                       │
          └──────────┬────────────┘
                     │
                     ▼
              ┌─────────────┐
              │   SQLite    │
              │             │
              │ /data/*.db  │
              └─────────────┘
Web Service

Responsabilidades:

OAuth.
Gestión de usuarios.
Gestión de cuentas.
Dashboard.
API.
Configuración.
Health check.
Background Worker

Responsabilidades:

Consultar cuentas de correo.
Detectar emails nuevos.
Guardar emails.
Ejecutar análisis IA.
Generar notificaciones.
Enviar mensajes a Telegram.
Registrar errores.

El Worker deberá ejecutarse continuamente.

10. Por qué usar Worker y no solamente Cron

El sistema necesita procesar correos de forma permanente.

Un Background Worker permite mantener un proceso ejecutándose continuamente.

El Worker podrá ejecutar un ciclo cada determinado intervalo:

while (true) {

    procesarCuentas();

    esperar(5 minutos);
}

Esto evita depender exclusivamente de Cron Jobs y simplifica el manejo de SQLite.

El intervalo inicial recomendado es:

5 minutos

Posteriormente podrá configurarse:

1 minuto
5 minutos
10 minutos
15 minutos
11. Flujo general
                NUEVO EMAIL
                     │
                     ▼
             ¿Qué cuenta recibió?
                     │
                     ▼
              EmailAccount
                     │
                     ▼
             ¿Qué proveedor?
             /       |       \
           Gmail   Outlook   IMAP
             \       |       /
              └──────┬──────┘
                     ▼
              Guardar email
                     │
                     ▼
                Analizar IA
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Categoría  Prioridad  Respuesta
                     │
                     ▼
             ¿Debe notificar?
                     │
                    SÍ
                     │
                     ▼
             Obtener propietario
                     │
                     ▼
             Obtener Telegram
                     │
                     ▼
              Enviar mensaje
                     │
                     ▼
          Registrar notificación
12. Modelo de usuarios

Tabla:

users

Campos principales:

id
email
name
active
created_at
updated_at

Ejemplo:

1 | Romina  | romina@...
2 | Mauricio | mauricio@...
13. Modelo de cuentas de correo

Tabla:

email_accounts

Campos:

id
user_id
provider
email
display_name

access_token
refresh_token
token_expires_at

imap_host
imap_port
imap_user
imap_password

last_sync_at
last_sync_error

active

created_at
updated_at

Relación:

User
  │
  └── EmailAccount

Un usuario puede tener muchas cuentas.

14. Proveedores OAuth

Para Gmail:

Google OAuth 2.0

Para Microsoft:

Microsoft OAuth 2.0

Para IMAP:

Usuario
Contraseña
Servidor IMAP
Puerto
SSL/TLS

Las credenciales sensibles deberán almacenarse cifradas.

15. Gmail

El sistema deberá utilizar Gmail API.

Configuración necesaria en Google Cloud:

Crear proyecto.
Habilitar Gmail API.
Configurar OAuth Consent Screen.
Crear OAuth Client ID.
Configurar Redirect URI.

Ejemplo:

https://mail-agent-api.onrender.com/auth/google/callback

Scopes mínimos:

openid
email
profile
https://www.googleapis.com/auth/gmail.readonly

El sistema deberá guardar la relación:

Usuario
   ↓
Cuenta Gmail
16. Outlook / Microsoft 365

Se utilizará Microsoft Graph.

Flujo:

Usuario
   ↓
Microsoft OAuth
   ↓
Microsoft Graph
   ↓
Cuenta de correo

La cuenta quedará asociada al usuario que inició la conexión.

Ejemplo:

Romina
   ↓
romina@empresa.com
   ↓
provider = outlook
17. IMAP

El proveedor IMAP permitirá conectar cuentas que no dispongan de una API específica.

Configuración:

Servidor IMAP
Puerto
SSL
Usuario
Contraseña

Ejemplo:

imap.midominio.com
993
SSL
usuario@midominio.com
********

La contraseña deberá almacenarse cifrada.

18. Normalización de emails

Todos los proveedores deberán convertir sus emails a un formato común:

interface IncomingEmail {

  providerMessageId: string;

  threadId?: string;

  senderEmail: string;

  senderName?: string;

  recipients: string[];

  cc?: string[];

  subject: string;

  bodyText: string;

  bodyHtml?: string;

  receivedAt: Date;

  hasAttachments: boolean;

  attachments?: EmailAttachment[];
}

De esta manera la IA y el resto del sistema no necesitan conocer el proveedor original.

19. Tabla de emails
emails

Campos:

id
account_id

provider_message_id
thread_id

sender_email
sender_name

subject

received_at

body_text
body_hash

has_attachments

processed
created_at

Índice/constraint importante:

UNIQUE(account_id, provider_message_id)

Esto evitará procesar dos veces el mismo email.

20. Detección de duplicados

Antes de insertar un email:

account_id
+
provider_message_id

deberá verificarse.

Si ya existe:

NO PROCESAR NUEVAMENTE

Si no existe:

INSERT
↓
ANALIZAR
↓
NOTIFICAR
21. Análisis mediante IA

Cada email será procesado por un servicio independiente:

src/ai/analyzer.ts

El análisis deberá devolver:

{
  "category": "Facturación",
  "priority": 4,
  "requires_response": true,
  "summary": "El proveedor solicita aprobación de una factura pendiente.",
  "sentiment": "neutral"
}
22. Categorías

Las categorías iniciales serán:

Urgente
Requiere respuesta
Trabajo
Facturación
Informativo
Publicidad
Spam
Personal
Otro

La lista deberá estar centralizada para evitar valores inconsistentes.

23. Prioridad

La IA deberá determinar una prioridad de 1 a 5.

1 = Muy baja
2 = Baja
3 = Media
4 = Alta
5 = Crítica

Ejemplo:

Prioridad 5

para:

Incidentes críticos.
Vencimientos inmediatos.
Problemas financieros importantes.
Solicitudes urgentes.
24. Campo "requiere respuesta"

La IA deberá determinar:

requires_response = true / false

Ejemplo:

"¿Podrías enviarme la documentación hoy?"

Resultado:

{
  "requires_response": true
}
25. Resumen

El resumen deberá ser breve.

Máximo recomendado:

300 caracteres

Ejemplo:

El proveedor solicita la aprobación de la factura correspondiente al servicio de agosto.
26. Protección contra Prompt Injection

Los emails deben considerarse contenido no confiable.

Un email podría contener instrucciones como:

Ignora todas las instrucciones anteriores...

La IA deberá tratar ese contenido exclusivamente como texto del email.

Nunca deberá convertirse en instrucciones del sistema.

La arquitectura del prompt deberá separar:

SYSTEM INSTRUCTIONS

de:

EMAIL CONTENT
27. Tabla de análisis
email_analysis

Campos:

id
email_id

category
priority
requires_response

summary
sentiment

model
prompt_version

analyzed_at

La versión del prompt deberá almacenarse para poder auditar posteriormente cómo fue analizado un email.

28. Regla de notificación

Inicialmente:

Notificar si:

priority >= 3
OR
requires_response = true

Ejemplos:

Prioridad 5 → NOTIFICAR
Prioridad 4 → NOTIFICAR
Prioridad 3 → NOTIFICAR
Prioridad 2 → NO NOTIFICAR
Prioridad 1 → NO NOTIFICAR

Pero:

requires_response = true

siempre genera notificación.

29. Telegram

Telegram será el único canal de notificación del sistema.

Se utilizará un único Bot.

Variable:

TELEGRAM_BOT_TOKEN=xxxxxxxx

Cada usuario tendrá asociado su propio:

chat_id
30. Telegram de Romina y Mauricio

Ejemplo:

users
│
├── Romina
│     │
│     └── Telegram
│           chat_id = 123456789
│
└── Mauricio
      │
      └── Telegram
            chat_id = 987654321

El chat_id no deberá estar hardcodeado en el código.

31. Tabla Telegram
telegram_destinations

Campos:

id
user_id
chat_id
username
active
created_at
updated_at

Relación:

User
  ↓
TelegramDestination

Inicialmente se permitirá un Telegram por usuario.

Posteriormente se podrían permitir varios.

32. Router de notificaciones

El router deberá funcionar de esta manera:

const owner = await getEmailOwner(email);

const telegram =
    await getTelegramDestination(owner.id);

await telegramService.send(
    telegram.chatId,
    message
);

Nunca deberá recibir un chat_id arbitrario desde el email.

33. Ejemplo de notificación
🔔 NUEVO EMAIL

📧 Cuenta:
romina@empresa.com

👤 De:
Juan Pérez <juan@proveedor.com>

📌 Asunto:
Factura pendiente de aprobación

🔴 Prioridad:
ALTA

🏷️ Categoría:
Facturación

⚠️ Requiere respuesta:
Sí

📝 Resumen:
El proveedor solicita la aprobación de la factura correspondiente al servicio del mes de agosto.
34. Notificación para Mauricio

Ejemplo:

🔔 NUEVO EMAIL

📧 Cuenta:
mauricio@empresa.com

👤 De:
cliente@empresa.com

📌 Asunto:
Consulta sobre presupuesto

🟠 Prioridad:
MEDIA

🏷️ Categoría:
Trabajo

⚠️ Requiere respuesta:
Sí

📝 Resumen:
El cliente solicita información adicional sobre el presupuesto enviado.
35. Tabla de notificaciones
notifications

Campos:

id
email_id
user_id

telegram_chat_id

status
sent_at
error

created_at

Estados:

pending
sent
failed

Esto permitirá saber qué emails fueron notificados correctamente.

36. Reintentos

Los errores temporales deberán tener reintentos.

Estrategia:

Intento 1
   ↓
esperar 1 segundo
   ↓
Intento 2
   ↓
esperar 2 segundos
   ↓
Intento 3
   ↓
esperar 4 segundos

Si continúa fallando:

status = failed

y se registra el error.

37. Error de una cuenta

Un error en una cuenta no debe detener el procesamiento de las demás.

Ejemplo:

Romina Gmail
   ↓
OK

Romina Outlook
   ↓
ERROR

Mauricio Gmail
   ↓
OK

Mauricio IMAP
   ↓
OK

El error de Outlook de Romina no deberá impedir que continúen las demás cuentas.

38. Poller

El Worker ejecutará:

1. Obtener usuarios activos.

2. Obtener cuentas activas.

3. Para cada cuenta:

   3.1 Obtener proveedor.

   3.2 Autenticar.

   3.3 Obtener emails nuevos.

   3.4 Eliminar duplicados.

   3.5 Guardar emails.

   3.6 Analizar mediante IA.

   3.7 Guardar análisis.

   3.8 Determinar si debe notificar.

   3.9 Obtener propietario.

   3.10 Obtener Telegram.

   3.11 Enviar notificación.

   3.12 Registrar resultado.

4. Actualizar estado de sincronización.
39. Estado de sincronización

Cada cuenta deberá guardar:

last_sync_at
last_sync_error

Esto permitirá visualizar:

Última sincronización:
14/09/2026 18:10

Estado:
OK

o:

Última sincronización:
14/09/2026 18:10

Estado:
ERROR

Detalle:
Authentication failed
40. Historial

El sistema deberá permitir consultar:

Emails recibidos.
Cuenta que recibió el email.
Proveedor.
Remitente.
Asunto.
Fecha.
Categoría.
Prioridad.
Resumen.
Si requiere respuesta.
Si fue notificado.
Estado de la notificación.
41. API

Endpoints iniciales:

GET /health

GET /auth/google
GET /auth/google/callback

GET /auth/microsoft
GET /auth/microsoft/callback

GET /api/users/me

GET /api/accounts
POST /api/accounts
GET /api/accounts/:id
DELETE /api/accounts/:id

GET /api/emails
GET /api/emails/:id

GET /api/notifications

GET /api/telegram
POST /api/telegram/connect

POST /api/poll
42. Seguridad de API

Todas las consultas deberán filtrar por el usuario autenticado.

Ejemplo:

WHERE user_id = currentUser.id

Nunca se deberá permitir:

GET /api/emails

y devolver emails de otros usuarios.

43. Cifrado

Los siguientes datos deberán almacenarse cifrados:

OAuth access tokens
OAuth refresh tokens
IMAP passwords
Credenciales sensibles

Variable:

ENCRYPTION_KEY=...

Nunca deberán aparecer en logs.

44. Información que nunca debe aparecer en logs

No registrar:

Access Tokens
Refresh Tokens
Passwords
API Keys
Telegram Bot Token
Encryption Key

También se recomienda no registrar el contenido completo de los emails.

45. Variables de entorno
NODE_ENV=production

DATABASE_URL=file:/data/mail-agent.db

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=

OPENAI_API_KEY=
OPENAI_MODEL=

TELEGRAM_BOT_TOKEN=

SESSION_SECRET=

ENCRYPTION_KEY=
46. Estructura del proyecto
mail-agent/
│
├── src/
│   ├── server.ts
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── database/
│   │   └── prisma.ts
│   │
│   ├── auth/
│   │   ├── google.ts
│   │   └── microsoft.ts
│   │
│   ├── providers/
│   │   ├── email-provider.ts
│   │   ├── provider-factory.ts
│   │   │
│   │   ├── gmail/
│   │   │   └── gmail-provider.ts
│   │   │
│   │   ├── outlook/
│   │   │   └── outlook-provider.ts
│   │   │
│   │   └── imap/
│   │       └── imap-provider.ts
│   │
│   ├── ai/
│   │   ├── analyzer.ts
│   │   └── prompts.ts
│   │
│   ├── notifications/
│   │   ├── telegram.ts
│   │   └── router.ts
│   │
│   ├── poller/
│   │   ├── poll.ts
│   │   └── process-account.ts
│   │
│   ├── security/
│   │   └── encryption.ts
│   │
│   └── api/
│       ├── accounts.ts
│       ├── emails.ts
│       ├── users.ts
│       └── notifications.ts
│
├── prisma/
│   └── schema.prisma
│
├── scripts/
│   └── worker.ts
│
├── data/
│   └── .gitkeep
│
├── render.yaml
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
47. Prisma

El proyecto utilizará:

Prisma ORM
+
SQLite

Comandos:

npx prisma generate

Crear migración:

npx prisma migrate dev

En producción:

npx prisma migrate deploy
48. Modelos principales

Los modelos mínimos serán:

User
EmailAccount
Email
EmailAnalysis
TelegramDestination
Notification

Relación:

User
 │
 ├── EmailAccount
 │       │
 │       └── Email
 │             │
 │             └── EmailAnalysis
 │
 └── TelegramDestination
              │
              └── Notification
49. package.json

Scripts esperados:

{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "worker": "node dist/poller/poll.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy"
  }
}
50. Web Service

Nombre sugerido:

mail-agent-api

Responsabilidades:

OAuth
API
Dashboard
Configuración
Health Check
Gestión de usuarios
Gestión de cuentas

Debe escuchar en:

0.0.0.0

y utilizar el puerto proporcionado por Render.

51. Background Worker

Nombre:

mail-agent-worker

Responsabilidades:

Consultar emails
Procesar emails
Analizar IA
Enviar Telegram
Registrar resultados

El Worker deberá disponer del Persistent Disk donde se encuentra SQLite.

52. Render Blueprint

El archivo render.yaml deberá definir la infraestructura necesaria.

Conceptualmente:

services:

  - type: web
    name: mail-agent-api
    runtime: node

    buildCommand: npm ci && npx prisma generate && npm run build

    startCommand: npm run start

    healthCheckPath: /health

  - type: worker
    name: mail-agent-worker
    runtime: node

    buildCommand: npm ci && npx prisma generate && npm run build

    startCommand: npm run worker

El Worker deberá tener asociado el Persistent Disk:

/data
53. Health Check

Endpoint:

GET /health

Respuesta:

{
  "status": "ok",
  "database": "ok",
  "timestamp": "2026-09-14T18:00:00Z"
}

Posteriormente podrá comprobarse también:

OpenAI
Telegram
Estado del Worker
54. Dashboard

El dashboard deberá permitir visualizar:

Usuarios
Cuentas conectadas
Última sincronización
Estado de cada cuenta
Emails recientes
Prioridades
Categorías
Notificaciones
Errores

Ejemplo:

========================================
       MONITOR DE CORREOS
========================================

ROMINA

🟢 romina@gmail.com
   Gmail
   Última sincronización: hace 2 min

🟢 romina@empresa.com
   IMAP
   Última sincronización: hace 3 min


MAURICIO

🟢 mauricio@gmail.com
   Gmail
   Última sincronización: hace 1 min

🔴 info@empresa.com
   IMAP
   Error de autenticación
55. Seguridad de aislamiento

Este punto es crítico.

Todas las operaciones deberán verificar:

currentUser.id

Por ejemplo:

Mauricio
   ↓
GET /api/emails
   ↓
solo emails de cuentas pertenecientes a Mauricio

Nunca:

todos los emails
56. Pruebas obligatorias

Se deberán realizar pruebas específicas de aislamiento.

Caso 1
Cuenta:
romina@gmail.com

Email nuevo:
Juan → Romina

Resultado esperado:
Telegram de Romina
Caso 2
Cuenta:
mauricio@gmail.com

Email nuevo:
Cliente → Mauricio

Resultado esperado:
Telegram de Mauricio
Caso 3
Romina recibe email

Resultado:

Romina → NOTIFICADA
Mauricio → NO NOTIFICADO
Caso 4
Mauricio recibe email

Resultado:

Mauricio → NOTIFICADO
Romina → NO NOTIFICADA
Caso 5

Un email duplicado:

Mismo account_id
+
Mismo provider_message_id

Resultado:

No volver a procesar.
57. Manejo de errores

Los errores deberán clasificarse.

AUTH_ERROR
CONNECTION_ERROR
PROVIDER_ERROR
AI_ERROR
TELEGRAM_ERROR
DATABASE_ERROR
UNKNOWN_ERROR

Ejemplo:

ACCOUNT: romina@empresa.com
PROVIDER: IMAP
ERROR: AUTH_ERROR
MESSAGE: Invalid credentials
58. Registro de errores

Cada cuenta deberá conservar:

last_sync_error

El sistema también deberá registrar logs estructurados.

Ejemplo:

2026-09-14T18:00:00
INFO
Processing account
account=romina@empresa.com
provider=imap
59. Configuración por usuario

En una segunda etapa se podrán agregar reglas individuales.

Ejemplo:

Romina

Remitente:
jefe@empresa.com

Prioridad:
5

Otro ejemplo:

Mauricio

Dominio:
proveedor.com

Prioridad mínima:
4

Estas reglas deberán estar asociadas al usuario y nunca afectar a otro usuario.

60. Exclusiones

Se podrán crear reglas:

No notificar newsletters
No notificar publicidad
No notificar determinados remitentes
No notificar determinados dominios

Ejemplo:

newsletter@empresa.com

Puede almacenarse pero no generar Telegram.

61. Futuras funcionalidades
Fase futura 1

Dashboard completo.

Fase futura 2

Reglas personalizadas por usuario.

Fase futura 3

Microsoft Graph.

Fase futura 4

Más proveedores.

Fase futura 5

Acciones sobre emails:

Marcar como leído
Archivar
Mover
Eliminar
Etiquetar
Responder
Reenviar

Las acciones críticas deberán requerir confirmación.

Fase futura 6

Interacción mediante Telegram.

Ejemplo:

Mauricio:
"Mostrame los emails urgentes de hoy"

El agente podría responder:

Encontré 3 emails urgentes:

1. Cliente X
2. Proveedor Y
3. Banco Z
Fase futura 7

Respuestas asistidas:

"Redactá una respuesta para Juan diciendo que
podemos enviarle la documentación mañana."

El sistema generaría el borrador pero no lo enviaría automáticamente.

62. Seguridad futura para acciones

Cuando se implementen acciones sobre correos:

Responder
Eliminar
Archivar
Reenviar

se deberá solicitar confirmación.

Ejemplo:

¿Querés enviar esta respuesta?

"Hola Juan,
te confirmo que podemos enviar la documentación mañana."

[ENVIAR] [CANCELAR]
63. Inteligencia artificial

El módulo de IA deberá ser independiente del proveedor de correo.

Arquitectura:

Gmail ───┐
         │
Outlook ─┤
         │
IMAP ────┤
         ▼
      Email
         │
         ▼
     AI Analyzer
         │
         ├── Categoría
         ├── Prioridad
         ├── Resumen
         ├── Requiere respuesta
         └── Sentimiento

Esto permite cambiar el proveedor de IA sin modificar los proveedores de correo.

64. Proveedor de IA

Inicialmente:

OpenAI API

Variable:

OPENAI_API_KEY=
OPENAI_MODEL=

La implementación deberá estar abstraída para permitir posteriormente:

OpenAI
Ollama
OpenRouter
Otros modelos
65. Costos

Los principales costos serán:

Render
OpenAI

Los proveedores de correo dependerán de las cuentas utilizadas.

Telegram no requiere un costo por mensaje del bot.

SQLite evita el costo de una base de datos PostgreSQL administrada.

66. Fases de desarrollo
Fase 1 — Infraestructura
Crear repositorio.
Crear proyecto Node.js.
Configurar TypeScript.
Configurar Prisma.
Configurar SQLite.
Configurar Render.
Configurar Persistent Disk.
Crear Web Service.
Crear Worker.
Fase 2 — Usuarios
Crear modelo User.
Crear usuarios Romina y Mauricio.
Implementar autenticación.
Implementar aislamiento.
Fase 3 — Cuentas
Crear EmailAccount.
Asociar cuentas a usuarios.
Crear alta/baja de cuentas.
Mostrar estado de sincronización.
Fase 4 — Gmail
Google Cloud.
OAuth.
Gmail API.
Lectura de emails.
Persistencia.
Dedupe.
Fase 5 — Outlook
Azure/Microsoft Entra.
OAuth.
Microsoft Graph.
Lectura de emails.
Persistencia.
Fase 6 — IMAP
Conexión IMAP.
Autenticación.
Lectura.
Detección de nuevos emails.
Manejo de errores.
Fase 7 — IA
Integración OpenAI.
Prompt.
Clasificación.
Prioridad.
Resumen.
Requiere respuesta.
Fase 8 — Telegram
Crear Bot.
Asociar Telegram a usuario.
Enviar mensajes.
Registrar notificaciones.
Reintentos.
Fase 9 — Worker
Procesamiento continuo.
Manejo de errores.
Reintentos.
Logs.
Estado de sincronización.
Fase 10 — Dashboard
Cuentas.
Emails.
Análisis.
Notificaciones.
Errores.
67. Pruebas finales

Antes de pasar a producción:

✓ Gmail Romina
✓ Gmail Mauricio
✓ Outlook Romina
✓ Outlook Mauricio
✓ IMAP Romina
✓ IMAP Mauricio

✓ Email normal
✓ Email urgente
✓ Email que requiere respuesta
✓ Email publicidad
✓ Email spam
✓ Email duplicado

✓ Telegram Romina
✓ Telegram Mauricio

✓ Error de autenticación
✓ Error de proveedor
✓ Error OpenAI
✓ Error Telegram
✓ Error SQLite

✓ Aislamiento Romina/Mauricio
68. Arquitectura definitiva
                         INTERNET
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
           GMAIL          OUTLOOK          IMAP
              │              │              │
              └──────────────┼──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Email Providers │
                    │    Adapters     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │     Worker      │
                    │                 │
                    │ Polling         │
                    │ Dedupe          │
                    │ Processing      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │     SQLite      │
                    │                 │
                    │ Users           │
                    │ Accounts        │
                    │ Emails          │
                    │ Analysis        │
                    │ Notifications   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   AI Analyzer   │
                    │     OpenAI      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Notification    │
                    │     Router      │
                    └────────┬────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
                 ▼                       ▼
          ┌─────────────┐         ┌─────────────┐
          │   TELEGRAM  │         │   TELEGRAM  │
          │   ROMINA    │         │   MAURICIO  │
          └─────────────┘         └─────────────┘
69. Principio de diseño

El sistema deberá respetar siempre este principio:

Cada email pertenece a una cuenta, cada cuenta pertenece a un usuario y cada usuario tiene su propio destino de Telegram.

Por lo tanto:

Email
 ↓
Account
 ↓
User
 ↓
Telegram

Nunca:

Email
 ↓
Telegram hardcodeado

Esto garantiza que el sistema pueda crecer a:

Romina
 ├── 3 cuentas

Mauricio
 ├── 4 cuentas

Otro usuario
 ├── 5 cuentas

Otro usuario
 ├── 2 cuentas

sin modificar la lógica central.

70. Resultado esperado

Al finalizar el MVP se deberá disponer de un agente ejecutándose en Render que:

Permita conectar múltiples cuentas.
Soporte Gmail.
Soporte Outlook.
Soporte IMAP.
Detecte nuevos emails automáticamente.
Guarde los emails en SQLite.
Evite duplicados.
Analice cada email con IA.
Determine prioridad.
Determine categoría.
Determine si requiere respuesta.
Genere un resumen.
Envíe notificaciones por Telegram.
Envíe cada notificación únicamente al propietario de la cuenta.
Registre todas las notificaciones.
Registre errores.
Realice reintentos.
Funcione continuamente en Render.
Mantenga los datos mediante Persistent Disk.
Permita agregar nuevos proveedores sin modificar el núcleo del sistema.
71. Próximo paso de implementación

La implementación deberá realizarse en este orden:

1. Crear proyecto Node.js + TypeScript

2. Configurar Prisma + SQLite

3. Crear schema de base de datos

4. Crear User

5. Crear EmailAccount

6. Crear Email

7. Crear EmailAnalysis

8. Crear TelegramDestination

9. Crear Notification

10. Implementar cifrado

11. Implementar arquitectura EmailProvider

12. Implementar GmailProvider

13. Implementar OutlookProvider

14. Implementar ImapProvider

15. Implementar Worker

16. Implementar análisis OpenAI

17. Implementar Telegram

18. Implementar NotificationRouter

19. Implementar Web API

20. Configurar Render

21. Configurar Persistent Disk

22. Crear pruebas

23. Conectar cuentas de Romina

24. Conectar cuentas de Mauricio

25. Realizar pruebas de aislamiento

26. Pasar a producción
72. Criterio de aceptación del MVP

El MVP se considerará terminado cuando:

Romina conecta sus cuentas
        ↓
El sistema detecta sus emails
        ↓
Los analiza
        ↓
Envía las notificaciones al Telegram de Romina

y simultáneamente:

Mauricio conecta sus cuentas
        ↓
El sistema detecta sus emails
        ↓
Los analiza
        ↓
Envía las notificaciones al Telegram de Mauricio

sin que exista ningún cruce entre ambos usuarios.

Además:

Gmail       ──┐
Outlook     ──┼──> mismo sistema
IMAP        ──┘

y todos los proveedores deberán producir el mismo modelo interno de email.

73. Resumen de tecnologías
Componente	Tecnología
Backend	Node.js
Lenguaje	TypeScript
API	Fastify
ORM	Prisma
Base de datos	SQLite
Persistencia	Render Persistent Disk
Ejecución	Render Web Service
Procesamiento	Render Background Worker
Gmail	Gmail API
Outlook	Microsoft Graph
Otros correos	IMAP
IA	OpenAI API
Notificaciones	Telegram Bot API
OAuth	Google / Microsoft
Validación	Zod
Logs	Pino
Seguridad	AES / cifrado de credenciales
Control de versiones	Git
Deploy	Render
74. Conclusión

La solución se diseñará desde el inicio como un sistema multiusuario y multiproveedor.

La arquitectura no dependerá de Gmail ni de un único usuario.

El núcleo será:

                    EMAIL PROVIDERS
             ┌─────────┼─────────┐
             │         │         │
           Gmail    Outlook     IMAP
             │         │         │
             └─────────┼─────────┘
                       │
                       ▼
                  EMAIL ENGINE
                       │
                       ▼
                    SQLite
                       │
                       ▼
                      IA
                       │
                       ▼
                OWNER ROUTER
                       │
              ┌────────┴────────┐
              ▼                 ▼
           ROMINA             MAURICIO
              │                 │
              ▼                 ▼
          TELEGRAM           TELEGRAM

La regla principal será:

El propietario de la cuenta determina quién recibe la notificación.

Esto permitirá que el sistema pueda crecer posteriormente a más usuarios, más cuentas y más proveedores sin tener que rediseñar la arquitectura.