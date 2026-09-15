import { env } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { processAccount } from './process-account.js';

let isRunning = false;
let pollerTimer: NodeJS.Timeout | null = null;

/**
 * Ejecuta un ciclo individual de sondeo y procesamiento de cuentas
 */
export async function runPollCycle(): Promise<void> {
  if (isRunning) {
    console.log('⏳ Ciclo de sondeo previo aún en ejecución. Omitiendo este turno.');
    return;
  }

  isRunning = true;
  const startedAt = new Date();
  console.log(`\n🔄 [${startedAt.toISOString()}] Iniciando ciclo de sondeo de correos...`);

  try {
    // 1. Obtener cuentas activas de usuarios activos
    const accounts = await prisma.emailAccount.findMany({
      where: {
        active: true,
        user: { active: true },
      },
      include: {
        user: true,
      },
    });

    console.log(`📬 Cuentas activas encontradas: ${accounts.length}`);

    for (const account of accounts) {
      try {
        await processAccount(account);
      } catch (err: any) {
        console.error(`❌ Error procesando cuenta ${account.email} (${account.provider}):`, err.message);
        await prisma.emailAccount.update({
          where: { id: account.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncError: err.message || 'Error desconocido durante la sincronización',
          },
        });
      }
    }
  } catch (error: any) {
    console.error('❌ Error crítico en el ciclo de sondeo:', error);
  } finally {
    isRunning = false;
    const durationMs = Date.now() - startedAt.getTime();
    console.log(`✅ Ciclo de sondeo finalizado en ${durationMs}ms.\n`);
  }
}

/**
 * Inicia el temporizador de sondeo periódico
 */
export function startPoller(): void {
  if (pollerTimer) return;

  const intervalMs = env.POLL_INTERVAL_MINUTES * 60 * 1000;
  console.log(`⏱️  Iniciando Poller con intervalo de ${env.POLL_INTERVAL_MINUTES} minutos.`);

  // Primer sondeo inicial
  runPollCycle().catch(console.error);

  // Intervalo recurrente
  pollerTimer = setInterval(() => {
    runPollCycle().catch(console.error);
  }, intervalMs);
}

/**
 * Detiene el temporizador del poller
 */
export function stopPoller(): void {
  if (pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
    console.log('⏹️  Poller detenido.');
  }
}

// Si este archivo es ejecutado directamente como script standalone (ej. npm run worker)
if (process.argv[1]?.endsWith('poll.js') || process.argv[1]?.endsWith('poll.ts')) {
  import('../database/prisma.js').then(async ({ initDatabase }) => {
    await initDatabase();
    startPoller();

    const shutdown = async () => {
      console.log('\nRecibida señal de apagado. Cerrando worker...');
      stopPoller();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
