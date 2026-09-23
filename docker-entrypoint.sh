#!/bin/sh
set -e

# Asegurar que el directorio de almacenamiento persistente existe
mkdir -p /app/data

# Aplicar migraciones de base de datos SQLite antes de iniciar la aplicación
echo "📦 [Docker Entrypoint] Verificando y aplicando migraciones de base de datos..."
pnpm prisma migrate deploy

# Asegurar que los usuarios por defecto (Romina y Mauricio) estén creados (idempotente)
echo "👥 [Docker Entrypoint] Verificando usuarios iniciales..."
node prisma/seed.js

echo "🚀 [Docker Entrypoint] Iniciando servidor Mail Agent..."
exec "$@"
