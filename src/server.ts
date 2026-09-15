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

import { pollEvents } from './events/event-bus.js';
import { startTelegramBotListener, stopTelegramBotListener } from './notifications/telegram-bot-listener.js';

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
 * Server-Sent Events (SSE) para actualización en tiempo real del Dashboard
 */
app.get('/api/events', async (request, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders();

  reply.raw.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const onStarted = (payload: any) => {
    reply.raw.write(`event: poll_started\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const onCompleted = (payload: any) => {
    reply.raw.write(`event: poll_completed\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  pollEvents.onStarted(onStarted);
  pollEvents.onCompleted(onCompleted);

  const heartbeat = setInterval(() => {
    reply.raw.write(': heartbeat\n\n');
  }, 20000);

  request.raw.on('close', () => {
    clearInterval(heartbeat);
    pollEvents.offStarted(onStarted);
    pollEvents.offCompleted(onCompleted);
  });
});

/**
 * Endpoint para forzar manualmente un ciclo de sondeo
 */
app.post('/api/poll', async (_request, reply) => {
  try {
    const result = await runPollCycle('manual');
    return reply.send({
      success: result.success,
      alreadyRunning: result.alreadyRunning || false,
      message: result.message,
      durationMs: result.durationMs,
      accountsProcessed: result.accountsProcessed,
      errorCount: result.errorCount,
    });
  } catch (err: any) {
    app.log.error(err, 'Error en sondeo forzado');
    return reply.status(500).send({
      success: false,
      error: err.message || 'Error inesperado al ejecutar el sondeo',
    });
  }
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

    // 4. Iniciar el listener interactivo de comandos de Telegram
    startTelegramBotListener();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Apagado elegante (Graceful Shutdown)
const shutdown = async (signal: string) => {
  console.log(`\nRecibida señal ${signal}. Iniciando apagado elegante...`);
  stopTelegramBotListener();
  stopPoller();
  await app.close();
  await prisma.$disconnect();
  console.log('Servidor apagado correctamente.');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main();
