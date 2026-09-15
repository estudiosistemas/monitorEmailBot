import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../database/prisma.js';
import { assertEmailOwnership, IsolationError } from '../security/isolation.js';

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

export const emailsRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Listar correos con aislamiento estricto por usuario
   * GET /api/emails?userId=1&limit=20
   */
  app.get('/api/emails', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const query = request.query as { limit?: string; category?: string; priority?: string };
      const limit = Math.min(Number(query.limit) || 20, 100);

      const emails = await prisma.email.findMany({
        where: {
          account: {
            userId,
          },
          ...(query.category ? { analysis: { category: query.category } } : {}),
          ...(query.priority ? { analysis: { priority: Number(query.priority) } } : {}),
        },
        include: {
          account: {
            select: {
              id: true,
              email: true,
              provider: true,
            },
          },
          analysis: true,
          notifications: {
            select: {
              id: true,
              status: true,
              sentAt: true,
            },
          },
        },
        orderBy: { receivedAt: 'desc' },
        take: limit,
      });

      return { data: emails };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Obtener detalle completo de un correo
   * GET /api/emails/:id?userId=1
   */
  app.get('/api/emails/:id', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const params = request.params as { id: string };
      const emailId = Number(params.id);

      if (isNaN(emailId)) {
        return reply.status(400).send({ error: 'ID de email inválido' });
      }

      const email = await assertEmailOwnership(emailId, userId);
      return { data: email };
    } catch (err: any) {
      if (err instanceof IsolationError) {
        return reply.status(403).send({ error: err.message });
      }
      return reply.status(400).send({ error: err.message });
    }
  });
};
