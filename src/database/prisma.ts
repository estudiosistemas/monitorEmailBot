import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

/**
 * Inicializa y configura optimizaciones para SQLite (modo WAL y timeout)
 */
export async function initDatabase(): Promise<void> {
  await prisma.$connect();
  if (env.DATABASE_URL.startsWith('file:')) {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
  }
}
