import { env } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { runPollCycle } from '../poller/poll.js';
import { telegramService } from './telegram.js';

let isPollingTelegram = false;
let shouldStop = false;
let pollingOffset = 0;

/**
 * Teclado principal con botones de acceso rápido para Telegram
 */
export const TELEGRAM_MAIN_KEYBOARD = {
  keyboard: [
    [{ text: '🔄 Sondear Correos' }, { text: '📬 Últimos Correos' }],
    [{ text: '📧 Mis Cuentas' }, { text: '📊 Resumen de Hoy' }],
    [{ text: 'ℹ️ Ayuda' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

/**
 * Inicia el proceso de Long Polling para escuchar mensajes entrantes en Telegram
 */
export function startTelegramBotListener(): void {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN no configurado. El listener de comandos de Telegram no se iniciará.');
    return;
  }

  if (isPollingTelegram) {
    return;
  }

  isPollingTelegram = true;
  shouldStop = false;
  console.log('🤖 Iniciando listener interactivo de Telegram (Long Polling)...');

  // Ejecutar bucle asíncrono desacoplado
  (async () => {
    while (!shouldStop) {
      try {
        await pollTelegramUpdates();
      } catch (err: any) {
        if (!shouldStop) {
          console.error('⚠️ Error en bucle de polling de Telegram:', err.message);
          // Esperar 3 segundos antes de reintentar para no saturar en caso de fallo de red
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
    isPollingTelegram = false;
    console.log('⏹️  Listener de Telegram detenido.');
  })();
}

/**
 * Detiene el listener de Telegram
 */
export function stopTelegramBotListener(): void {
  shouldStop = true;
}

/**
 * Consulta y procesa las actualizaciones pendientes de Telegram
 */
async function pollTelegramUpdates(): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${pollingOffset}&timeout=20`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`⚠️ Telegram getUpdates devolvió status ${response.status}: ${errText}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return;
    }

    const data = (await response.json()) as any;
    if (!data.ok || !Array.isArray(data.result)) {
      return;
    }

    for (const update of data.result) {
      pollingOffset = update.update_id + 1;
      await handleTelegramUpdate(update);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name !== 'AbortError' && !shouldStop) {
      throw err;
    }
  }
}

/**
 * Procesa un update individual de Telegram
 */
async function handleTelegramUpdate(update: any): Promise<void> {
  const message = update.message;
  if (!message || !message.text) {
    return;
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();
  const from = message.from || {};
  const senderName = from.first_name || from.username || 'Usuario';

  try {
    // 1. Resolver usuario correspondiente al Chat ID
    let destination = await prisma.telegramDestination.findFirst({
      where: { chatId, active: true },
      include: { user: true },
    });

    // Auto-vinculación si solo hay 1 usuario activo en el sistema y no está vinculado
    if (!destination) {
      const users = await prisma.user.findMany({ where: { active: true } });
      if (users.length === 1) {
        const singleUser = users[0];
        destination = await prisma.telegramDestination.create({
          data: {
            userId: singleUser.id,
            chatId,
            username: from.username || null,
            active: true,
          },
          include: { user: true },
        });

        await telegramService.sendMessageWithRetry(
          chatId,
          `🎉 <b>¡Hola, ${singleUser.name}!</b>\nTu cuenta de Telegram ha sido vinculada automáticamente a tu perfil de usuario. Ahora puedes consultar tus correos y forzar sondeos directamente desde aquí.`,
          TELEGRAM_MAIN_KEYBOARD
        );
      } else if (text.startsWith('/vincular')) {
        const parts = text.split(' ');
        const email = parts[1]?.trim().toLowerCase();
        if (!email) {
          await telegramService.sendMessageWithRetry(
            chatId,
            '⚠️ <b>Uso:</b> <code>/vincular tu_email@ejemplo.com</code>',
            TELEGRAM_MAIN_KEYBOARD
          );
          return;
        }

        const user = await prisma.user.findFirst({ where: { email, active: true } });
        if (!user) {
          await telegramService.sendMessageWithRetry(
            chatId,
            `❌ No se encontró ningún usuario activo con el correo <code>${email}</code>.`,
            TELEGRAM_MAIN_KEYBOARD
          );
          return;
        }

        destination = await prisma.telegramDestination.create({
          data: {
            userId: user.id,
            chatId,
            username: from.username || null,
            active: true,
          },
          include: { user: true },
        });

        await telegramService.sendMessageWithRetry(
          chatId,
          `✅ <b>¡Excelente!</b> Este chat quedó vinculado al usuario <b>${user.name}</b> (${user.email}).`,
          TELEGRAM_MAIN_KEYBOARD
        );
      } else {
        await telegramService.sendMessageWithRetry(
          chatId,
          `👋 <b>Bienvenido al Bot de Monitoreo de Correo</b>\n\nTu Chat ID es: <code>${chatId}</code>\nPara asociarlo a tu usuario, escribe:\n<code>/vincular tu_email@ejemplo.com</code>`,
          TELEGRAM_MAIN_KEYBOARD
        );
        return;
      }
    }

    const user = destination.user;
    const normalized = text.toLowerCase().trim();

    // 2. Enrutamiento de Comandos e Intenciones
    if (normalized === '/start' || normalized === '/ayuda' || normalized === 'ℹ️ ayuda' || normalized === 'ayuda') {
      await sendHelpMessage(chatId, user);
    } else if (
      normalized === '/sondeo' ||
      normalized === '/poll' ||
      normalized === '🔄 sondear correos' ||
      normalized.includes('sondear') ||
      normalized.includes('sondeo') ||
      normalized.includes('escanear') ||
      normalized.includes('revisar mails')
    ) {
      await handlePollCommand(chatId);
    } else if (
      normalized === '/ultimos' ||
      normalized === '/mails' ||
      normalized === '/correos' ||
      normalized === '📬 últimos correos' ||
      normalized.includes('leer mails') ||
      normalized.includes('lee los mails') ||
      normalized.includes('ver mails') ||
      normalized.includes('últimos') ||
      normalized.includes('ultimos')
    ) {
      await handleRecentEmailsCommand(chatId, user);
    } else if (
      normalized === '/cuentas' ||
      normalized === '📧 mis cuentas' ||
      normalized.includes('mis cuentas') ||
      normalized.includes('cuentas')
    ) {
      await handleAccountsCommand(chatId, user);
    } else if (
      normalized === '/resumen' ||
      normalized === '📊 resumen de hoy' ||
      normalized.includes('resumen') ||
      normalized.includes('estadisticas') ||
      normalized.includes('stats')
    ) {
      await handleSummaryCommand(chatId, user);
    } else {
      // Intento inteligente con IA si no coincide con comando exacto
      await handleNaturalLanguageQuery(chatId, user, text);
    }
  } catch (error: any) {
    console.error(`❌ Error procesando mensaje de Telegram de ${chatId}:`, error);
    await telegramService.sendMessageWithRetry(
      chatId,
      `⚠️ <i>Ocurrió un error al procesar tu solicitud: ${error.message}</i>`,
      TELEGRAM_MAIN_KEYBOARD
    );
  }
}

/**
 * Enviar mensaje de bienvenida y ayuda
 */
async function sendHelpMessage(chatId: string, user: any): Promise<void> {
  const accountsCount = await prisma.emailAccount.count({
    where: { userId: user.id, active: true },
  });

  const aiModel = env.OPENROUTER_API_KEY
    ? `OpenRouter (${env.OPENROUTER_MODEL || 'openrouter/free'})`
    : env.OPENAI_API_KEY
    ? `OpenAI (${env.OPENAI_MODEL})`
    : 'Heurístico Local';

  const text = [
    `🤖 <b>PANEL DE CONTROL - MAIL AGENT BOT</b>`,
    '',
    `👤 <b>Usuario:</b> ${user.name}`,
    `📧 <b>Cuentas activas:</b> ${accountsCount}`,
    `🧠 <b>Motor IA:</b> <code>${aiModel}</code>`,
    '',
    `<b>Comandos rápidos:</b>`,
    `🔄 <b>/sondeo</b> - Forzar sondeo de correos inmediatamente`,
    `📬 <b>/ultimos</b> - Leer los últimos correos analizados por IA`,
    `📧 <b>/cuentas</b> - Ver el estado de tus cuentas conectadas`,
    `📊 <b>/resumen</b> - Estadísticas y métricas del día`,
    `ℹ️ <b>/ayuda</b> - Ver este menú`,
    '',
    `<i>También puedes escribirme en lenguaje natural, por ejemplo: "lee los mails" o "ejecuta un sondeo".</i>`,
  ].join('\n');

  await telegramService.sendMessageWithRetry(chatId, text, TELEGRAM_MAIN_KEYBOARD);
}

/**
 * Ejecuta el ciclo de sondeo manual y responde el resultado
 */
async function handlePollCommand(chatId: string): Promise<void> {
  await telegramService.sendMessageWithRetry(
    chatId,
    '🔄 <i>Iniciando ciclo de sondeo en todas las cuentas activas...</i>'
  );

  const started = Date.now();
  const result = await runPollCycle('manual');
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (result.alreadyRunning) {
    await telegramService.sendMessageWithRetry(
      chatId,
      '⏳ <i>Ya hay un ciclo de sondeo en ejecución. Espera unos segundos e intenta nuevamente.</i>',
      TELEGRAM_MAIN_KEYBOARD
    );
    return;
  }

  const statusEmoji = (result.errorCount || 0) > 0 ? '⚠️' : '✅';
  const response = [
    `${statusEmoji} <b>SONDEO FINALIZADO</b>`,
    '',
    `⏱️ <b>Tiempo:</b> ${elapsed}s`,
    `📬 <b>Cuentas revisadas:</b> ${result.accountsProcessed || 0}`,
    `⚠️ <b>Errores:</b> ${result.errorCount || 0}`,
    '',
    (result.errorCount || 0) === 0
      ? '✨ Sincronización exitosa. Si hubo correos importantes, las alertas ya fueron emitidas.'
      : '⚠️ Algunas cuentas tuvieron errores durante la sincronización. Revisa <code>/cuentas</code> para más detalles.',
  ].join('\n');

  await telegramService.sendMessageWithRetry(chatId, response, TELEGRAM_MAIN_KEYBOARD);
}

/**
 * Muestra los últimos correos recibidos y analizados por la IA
 */
async function handleRecentEmailsCommand(chatId: string, user: any): Promise<void> {
  const emails = await prisma.email.findMany({
    where: {
      account: { userId: user.id },
    },
    include: {
      analysis: true,
      account: true,
    },
    orderBy: { receivedAt: 'desc' },
    take: 5,
  });

  if (emails.length === 0) {
    await telegramService.sendMessageWithRetry(
      chatId,
      '📭 <b>Bandeja limpia:</b> No se han registrado correos recientes en tus cuentas.',
      TELEGRAM_MAIN_KEYBOARD
    );
    return;
  }

  const priorityEmojis: Record<number, string> = {
    5: '🔴 [CRÍTICA]',
    4: '🔴 [ALTA]',
    3: '🟠 [MEDIA]',
    2: '🟡 [BAJA]',
    1: '⚪ [MUY BAJA]',
  };

  const lines = [`📬 <b>ÚLTIMOS ${emails.length} CORREOS ANALIZADOS</b>\n`];

  for (let i = 0; i < emails.length; i++) {
    const em = emails[i];
    const an = em.analysis;
    const prio = an ? priorityEmojis[an.priority] || `[Prio ${an.priority}]` : '[Sin análisis]';
    const cat = an ? an.category : 'General';
    const summary = an?.summary ? an.summary : em.subject;
    const sender = em.senderName ? `${em.senderName} (${em.senderEmail})` : em.senderEmail;
    const timeStr = em.receivedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    lines.push(
      `<b>${i + 1}. ${escapeHtml(em.subject)}</b>`,
      `👤 <i>De:</i> ${escapeHtml(sender)}`,
      `📧 <i>Cuenta:</i> <code>${escapeHtml(em.account.email)}</code> [${timeStr}]`,
      `🏷️ <i>Categoría:</i> ${escapeHtml(cat)} | ${prio}`,
      `📝 <i>Resumen:</i> ${escapeHtml(summary)}`,
      ''
    );
  }

  await telegramService.sendMessageWithRetry(chatId, lines.join('\n'), TELEGRAM_MAIN_KEYBOARD);
}

/**
 * Lista las cuentas configuradas y su estado de sincronización
 */
async function handleAccountsCommand(chatId: string, user: any): Promise<void> {
  const accounts = await prisma.emailAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  if (accounts.length === 0) {
    await telegramService.sendMessageWithRetry(
      chatId,
      'ℹ️ Aún no tienes cuentas de correo conectadas. Conecta tus cuentas en el panel web.',
      TELEGRAM_MAIN_KEYBOARD
    );
    return;
  }

  const lines = ['📧 <b>TUS CUENTAS DE CORREO CONECTADAS</b>\n'];

  for (const acc of accounts) {
    const providerBadge =
      acc.provider === 'gmail'
        ? '🔴 Gmail'
        : acc.provider === 'outlook'
        ? '🔵 Outlook'
        : '🟣 IMAP';

    const statusBadge = acc.active ? '🟢 Activa' : '⚪ Inactiva';
    const lastSync = acc.lastSyncAt
      ? acc.lastSyncAt.toLocaleString('es-ES', { timeZone: 'America/Argentina/Buenos_Aires' })
      : 'Nunca';

    lines.push(
      `<b>${providerBadge} - ${escapeHtml(acc.email)}</b>`,
      `Estado: ${statusBadge}`,
      `Último sondeo: <i>${lastSync}</i>`
    );

    if (acc.lastSyncError) {
      lines.push(`⚠️ <i>Último error: ${escapeHtml(acc.lastSyncError)}</i>`);
    }
    lines.push('');
  }

  await telegramService.sendMessageWithRetry(chatId, lines.join('\n'), TELEGRAM_MAIN_KEYBOARD);
}

/**
 * Muestra el resumen del día y estadísticas
 */
async function handleSummaryCommand(chatId: string, user: any): Promise<void> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const totalToday = await prisma.email.count({
    where: {
      account: { userId: user.id },
      receivedAt: { gte: startOfDay },
    },
  });

  const urgentCount = await prisma.emailAnalysis.count({
    where: {
      email: {
        account: { userId: user.id },
        receivedAt: { gte: startOfDay },
      },
      priority: { gte: 4 },
    },
  });

  const responseRequiredCount = await prisma.emailAnalysis.count({
    where: {
      email: {
        account: { userId: user.id },
        receivedAt: { gte: startOfDay },
      },
      requiresResponse: true,
    },
  });

  const aiModel = env.OPENROUTER_API_KEY
    ? `OpenRouter Free (${env.OPENROUTER_MODEL || 'openrouter/free'})`
    : env.OPENAI_API_KEY
    ? `OpenAI (${env.OPENAI_MODEL})`
    : 'Heurístico Local';

  const text = [
    `📊 <b>RESUMEN DE ACTIVIDAD DE HOY</b>`,
    '',
    `📬 <b>Correos procesados hoy:</b> ${totalToday}`,
    `🔴 <b>Correos Urgentes/Alta prioridad:</b> ${urgentCount}`,
    `⚠️ <b>Requieren tu respuesta:</b> ${responseRequiredCount}`,
    '',
    `🧠 <b>Motor de IA activo:</b> <code>${aiModel}</code>`,
    `🕒 <b>Fecha:</b> ${new Date().toLocaleDateString('es-ES', { timeZone: 'America/Argentina/Buenos_Aires' })}`,
  ].join('\n');

  await telegramService.sendMessageWithRetry(chatId, text, TELEGRAM_MAIN_KEYBOARD);
}

/**
 * Consulta de lenguaje natural asistida por IA para solicitudes libres
 */
async function handleNaturalLanguageQuery(chatId: string, user: any, query: string): Promise<void> {
  // Si no hay OpenRouter ni OpenAI, responder con guía
  if (!env.OPENROUTER_API_KEY && !env.OPENAI_API_KEY) {
    await telegramService.sendMessageWithRetry(
      chatId,
      `No comprendí tu comando: "<i>${escapeHtml(query)}</i>".\nUsa los botones o escribe <code>/ayuda</code> para ver las opciones disponibles.`,
      TELEGRAM_MAIN_KEYBOARD
    );
    return;
  }

  // Clasificar intención del usuario con OpenRouter
  try {
    const prompt = `Un usuario envió el siguiente mensaje al bot de correo: "${query}".
Determina la acción a ejecutar respondiendo estrictamente en JSON con la clave "action":
- "poll" si pide sondear, sincronizar, chequear correos ahora, revisar emails, o actualizar.
- "read_emails" si pide leer correos, ver qué llegó, qué mensajes tiene, revisar novedades.
- "accounts" si pregunta por sus cuentas conectadas, correos vinculados o estado de proveedores.
- "summary" si pide resumen, reporte, estadísticas del día o métricas.
- "help" si pide ayuda, qué puede hacer, o saludo general.
- "other" si es una pregunta general o saludo no mapeable a una acción. En este caso incluye la clave "reply" con una respuesta breve y amigable en español.`;

    let action = 'help';
    let customReply = '';

    if (env.OPENROUTER_API_KEY) {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://github.com/estudiosistemas/monitorEmailBot',
          'X-Title': 'Mail Agent Bot',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.OPENROUTER_MODEL || 'openrouter/free',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      });

      if (resp.ok) {
        const d = (await resp.json()) as any;
        const rawContent = d.choices?.[0]?.message?.content || d.choices?.[0]?.text;
        if (rawContent) {
          const match = rawContent.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            action = parsed.action || 'help';
            customReply = parsed.reply || '';
          }
        }
      }
    }

    switch (action) {
      case 'poll':
        return await handlePollCommand(chatId);
      case 'read_emails':
        return await handleRecentEmailsCommand(chatId, user);
      case 'accounts':
        return await handleAccountsCommand(chatId, user);
      case 'summary':
        return await handleSummaryCommand(chatId, user);
      default:
        if (customReply) {
          await telegramService.sendMessageWithRetry(chatId, customReply, TELEGRAM_MAIN_KEYBOARD);
        } else {
          await sendHelpMessage(chatId, user);
        }
    }
  } catch {
    await sendHelpMessage(chatId, user);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
