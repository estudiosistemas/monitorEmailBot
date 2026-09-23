# ========================================================
# Etapa 1: Imagen base con dependencias del sistema y pnpm
# Compatible con arquitecturas arm64 (Raspberry Pi 3/4/5), armv7 y amd64
# ========================================================
FROM node:22-bookworm-slim AS base

# openssl es requerido por el motor binario de Prisma
# ca-certificates para llamadas HTTPS seguras (Gmail, Outlook, OpenRouter, Telegram)
# curl para verificaciones de salud (Healthchecks en Docker)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Habilitar pnpm mediante Corepack oficial de Node.js fijando la versión 10
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

WORKDIR /app

# ========================================================
# Etapa 2: Builder - Instalación y compilación TypeScript
# ========================================================
FROM base AS builder

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

# Generar cliente de Prisma para la arquitectura actual
RUN pnpm prisma generate

COPY tsconfig.json ./
COPY src ./src/

# Compilar código TypeScript a JavaScript en dist/
RUN pnpm build

# Limpiar dependencias de desarrollo conservando dependencias de producción (incluye prisma para migraciones)
RUN pnpm prune --prod

# ========================================================
# Etapa 3: Runner - Imagen final de producción optimizada
# ========================================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3005 \
    HOST=0.0.0.0

# Copiar artefactos compilados y dependencias necesarias
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Normalizar saltos de línea (CRLF a LF) y asignar permisos de ejecución
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

# Crear directorio para la base de datos SQLite persistente
RUN mkdir -p /app/data

EXPOSE 3005

VOLUME ["/app/data"]

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
