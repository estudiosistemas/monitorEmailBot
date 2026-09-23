#!/bin/sh
set -e

# Asegurar que el directorio de almacenamiento persistente existe
mkdir -p /app/data

# Aplicar migraciones de base de datos SQLite antes de iniciar la aplicación
echo "📦 [Docker Entrypoint] Verificando y aplicando migraciones de base de datos..."
pnpm prisma migrate deploy

echo "🚀 [Docker Entrypoint] Iniciando servidor Mail Agent..."
exec "$@"
