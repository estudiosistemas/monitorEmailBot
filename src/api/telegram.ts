import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { telegramService } from '../notifications/telegram.js';

const connectTelegramSchema = z.object({
  chatId: z.string().min(1, 'chatId de Telegram requerido'),
  username: z.string().optional(),
});

function extractUserId(request: any): number {
  const headerUserId = request.headers['x-user-id'];
  const queryUserId = request.query?.userId;
  const rawId = headerUserId || queryUserId;

  const id = Number(rawId);
  if (!rawId || isNaN(id)) {
    throw new Error('Cabecera "x-user-id" o parámetro "?userId" obligatorio');
  }
  return id;
}

export const telegramRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Obtener destino de Telegram del usuario
   * GET /api/telegram?userId=1
   */
  app.get('/api/telegram', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const destination = await prisma.telegramDestination.findFirst({
        where: { userId, active: true },
      });

      return { data: destination };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Vincular o actualizar destino de Telegram para el usuario
   * POST /api/telegram/connect?userId=1
   */
  app.post('/api/telegram/connect', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const parseResult = connectTelegramSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validación fallida',
          details: parseResult.error.flatten(),
        });
      }

      const { chatId, username } = parseResult.data;

      // Buscar si ya existe un destino para este usuario
      const existing = await prisma.telegramDestination.findFirst({
        where: { userId },
      });

      let destination;
      if (existing) {
        destination = await prisma.telegramDestination.update({
          where: { id: existing.id },
          data: { chatId, username, active: true },
        });
      } else {
        destination = await prisma.telegramDestination.create({
          data: { userId, chatId, username, active: true },
        });
      }

      return reply.send({
        message: 'Destino de Telegram configurado exitosamente',
        data: destination,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Enviar mensaje de prueba al Telegram del usuario
   * POST /api/telegram/test?userId=1
   */
  app.post('/api/telegram/test', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          telegramDestinations: { where: { active: true } },
        },
      });

      if (!user) {
        return reply.status(404).send({ error: `Usuario ${userId} no encontrado` });
      }

      const destination = user.telegramDestinations[0];
      if (!destination) {
        return reply.status(400).send({
          error: `El usuario ${user.name} aún no tiene un Chat ID de Telegram vinculado.`,
        });
      }

      const nowStr = new Date().toLocaleString('es-ES', { timeZone: 'America/Argentina/Buenos_Aires' });
      const testMessage = [
        '🔔 <b>PRUEBA DE CONEXIÓN TELEGRAM</b>',
        '',
        `👤 <b>Destinatario:</b> ${user.name}`,
        `💬 <b>Chat ID:</b> <code>${destination.chatId}</code>`,
        `⏱️ <b>Fecha:</b> ${nowStr}`,
        '',
        '🤖 <b>Estado:</b> ¡Conexión establecida con éxito! El bot de monitoreo de correos está listo para enviarte alertas.',
      ].join('\n');

      await telegramService.sendMessageWithRetry(destination.chatId, testMessage);

      return reply.send({
        message: `Mensaje de prueba enviado exitosamente a ${user.name} (Chat ID: ${destination.chatId}).`,
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: `Error enviando mensaje de prueba: ${err.message}`,
      });
    }
  });
};
