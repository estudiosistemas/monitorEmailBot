import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../database/prisma.js';

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

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Listar historial de notificaciones del usuario
   * GET /api/notifications?userId=1
   */
  app.get('/api/notifications', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const query = request.query as { limit?: string; status?: string };
      const limit = Math.min(Number(query.limit) || 30, 100);

      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          ...(query.status ? { status: query.status } : {}),
        },
        include: {
          email: {
            select: {
              id: true,
              subject: true,
              senderEmail: true,
              senderName: true,
              receivedAt: true,
              analysis: {
                select: {
                  category: true,
                  priority: true,
                  summary: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return { data: notifications };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};
