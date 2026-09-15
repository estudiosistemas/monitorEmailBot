import fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { prisma, initDatabase } from './database/prisma.js';
import { startPoller, stopPoller, runPollCycle } from './poller/poll.js';
import { usersRoutes } from './api/users.js';
import { accountsRoutes } from './api/accounts.js';
import { authRoutes } from './api/auth-routes.js';
import { emailsRoutes } from './api/emails.js';
import { notificationsRoutes } from './api/notifications.js';
import { telegramRoutes } from './api/telegram.js';
import { dashboardRoutes } from './api/dashboard.js';

const app = fastify({
  logger: env.NODE_ENV === 'development',
});

// Registrar CORS
await app.register(cors, {
  origin: true,
});

// Registrar rutas de la API y Dashboard
await app.register(dashboardRoutes);
await app.register(usersRoutes);
await app.register(accountsRoutes);
await app.register(authRoutes);
await app.register(emailsRoutes);
await app.register(notificationsRoutes);
await app.register(telegramRoutes);

/**
 * Health Check según sección 53 del plan de ejecución
 */
app.get('/health', async (_request, reply) => {
  let dbStatus = 'ok';
  try {
    await prisma.$queryRawUnsafe('SELECT 1;');
  } catch (error: any) {
    dbStatus = `error: ${error.message}`;
  }

  const isHealthy = dbStatus === 'ok';

  return reply.status(isHealthy ? 200 : 503).send({
    status: isHealthy ? 'ok' : 'degraded',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

/**
 * Endpoint para forzar manualmente un ciclo de sondeo
 */
app.post('/api/poll', async (_request, reply) => {
  // Ejecuta el sondeo de forma asíncrona sin bloquear la respuesta
  runPollCycle().catch((err) => app.log.error(err, 'Error en sondeo forzado'));
  return reply.send({ message: 'Ciclo de sondeo iniciado correctamente.' });
});

async function main() {
  try {
    // 1. Inicializar la base de datos y optimizaciones SQLite
    await initDatabase();
    app.log.info('Base de datos conectada con éxito.');

    // 2. Levantar el servidor HTTP
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    console.log(`🚀 Servidor escuchando en http://${env.HOST}:${env.PORT}`);

    // 3. Iniciar el poller embebido si está habilitado
    if (env.ENABLE_EMBEDDED_POLLER) {
      startPoller();
    } else {
      console.log('⚠️  Poller embebido deshabilitado (ENABLE_EMBEDDED_POLLER=false). Solo responderá a sondeos manuales.');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Apagado elegante (Graceful Shutdown)
const shutdown = async (signal: string) => {
  console.log(`\nRecibida señal ${signal}. Iniciando apagado elegante...`);
  stopPoller();
  await app.close();
  await prisma.$disconnect();
  console.log('Servidor apagado correctamente.');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main();
