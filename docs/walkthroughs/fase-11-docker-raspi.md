# Documentación de Avance - Fase 11: Despliegue con Docker y Docker Compose en Raspberry Pi

**Fecha:** Septiembre 2026  
**Estado:** Completado  
**Objetivo:** Proporcionar la infraestructura y configuración lista para ejecutar Mail Agent 24/7 en una Raspberry Pi (modelos 3, 4 y 5) utilizando Docker y Docker Compose, con persistencia segura de datos y optimización de recursos.

---

## 📁 Componentes Implementados

### 1. Dockerfile Multi-Etapa Optimizado para ARM
* [`Dockerfile`](file:///e:/SistemasWeb/bot-email/Dockerfile):
  * **Imagen base:** `node:22-bookworm-slim` (soporte nativo para arquitecturas ARM64 `aarch64`, ARMv7 y x86_64).
  * **Dependencias de sistema:** Incluye `openssl` (requerido por el motor binario de Prisma), `ca-certificates` (para llamadas HTTPS a Gmail/Outlook/Telegram/OpenRouter) y `curl` (para verificaciones de salud).
  * **Corepack Oficial:** Utiliza `pnpm` administrado por Corepack para instalaciones reproducibles.
  * **Etapa Builder:** Compila TypeScript a JavaScript nativo y genera el cliente Prisma para la arquitectura local.
  * **Etapa Runner:** Imagen final mínima sin dependencias de compilación ni TypeScript, manteniendo Prisma CLI para migraciones.

### 2. Script de Entrada y Migraciones Automáticas
* [`docker-entrypoint.sh`](file:///e:/SistemasWeb/bot-email/docker-entrypoint.sh):
  * Garantiza la existencia del directorio persistente `/app/data`.
  * Ejecuta `pnpm prisma migrate deploy` al encender el contenedor antes de iniciar la API y el poller, garantizando que el esquema SQLite esté siempre al día de forma automática sin intervención manual.

### 3. Orquestación con Docker Compose
* [`docker-compose.yml`](file:///e:/SistemasWeb/bot-email/docker-compose.yml):
  * **Servicio `mail-agent`:** Contenedor unificado (API Fastify + Dashboard + Poller + Bot de Telegram).
  * **Persistencia:** Volumen bind mount `./data:/app/data` para preservar la base de datos SQLite `mail-agent.db` y sus índices WAL entre reinicios y actualizaciones.
  * **Reinicio automático:** Política `restart: unless-stopped` que garantiza que el bot se inicie automáticamente al arrancar la Raspberry Pi o tras un corte de energía.
  * **Optimización de Memoria:** Variable `NODE_OPTIONS="--max-old-space-size=512"` configurada para evitar sobrecargar la memoria RAM de la Raspberry Pi.
  * **Protección de Tarjeta microSD:** Configuración de rotación de logs con `json-file` limitada a 10MB y un máximo de 3 archivos para prevenir el desgaste y llenado de la tarjeta SD.
  * **Healthcheck:** Verificación continua cada 30 segundos contra el endpoint `GET /health`.

### 4. Reglas de Exclusión Docker
* [`.dockerignore`](file:///e:/SistemasWeb/bot-email/.dockerignore):
  * Excluye `node_modules`, archivos locales de Windows/desarrollo, `data/` y `.git` para asegurar una compilación limpia y ligera en la Raspberry Pi.

---

## 🚀 Guía de Puesta en Marcha en la Raspberry Pi

1. **Copiar o clonar el proyecto** en la Raspberry Pi.
2. **Crear o copiar el archivo `.env`** en la raíz del proyecto con los tokens y claves:
   ```bash
   cp .env.example .env
   nano .env
   ```
3. **Construir y levantar el contenedor en segundo plano:**
   ```bash
   docker compose up -d --build
   ```
4. **Verificar estado y logs:**
   ```bash
   docker compose ps
   docker compose logs -f
   ```
5. **Acceder al Dashboard Web:**
   Abrir en cualquier navegador de la red local:
   ```text
   http://<IP-DE-TU-RASPI>:3005/dashboard
   ```
