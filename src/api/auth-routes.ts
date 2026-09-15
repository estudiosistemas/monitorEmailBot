import type { FastifyPluginAsync } from 'fastify';
import { getGoogleAuthUrl, handleGoogleCallback } from '../auth/google.js';
import { getMicrosoftAuthUrl, handleMicrosoftCallback } from '../auth/microsoft.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Inicia el flujo OAuth con Google
   * GET /auth/google?userId=1
   */
  app.get('/auth/google', async (request, reply) => {
    const query = request.query as { userId?: string };
    const userId = Number(query.userId);

    if (!query.userId || isNaN(userId)) {
      return reply.status(400).send({ error: 'Parámetro ?userId numérico requerido' });
    }

    try {
      const url = getGoogleAuthUrl(userId);
      return reply.redirect(url);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * Callback de Google OAuth
   * GET /auth/google/callback
   */
  app.get('/auth/google/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      return reply.status(400).send({ error: `Google OAuth error: ${query.error}` });
    }

    if (!query.code || !query.state) {
      return reply.status(400).send({ error: 'Parámetros code y state requeridos en callback' });
    }

    try {
      const account = await handleGoogleCallback(query.code, query.state);
      return reply.send({
        message: 'Cuenta de Gmail vinculada exitosamente',
        account: {
          id: account.id,
          email: account.email,
          displayName: account.displayName,
          provider: account.provider,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * Inicia el flujo OAuth con Microsoft
   * GET /auth/microsoft?userId=1
   */
  app.get('/auth/microsoft', async (request, reply) => {
    const query = request.query as { userId?: string };
    const userId = Number(query.userId);

    if (!query.userId || isNaN(userId)) {
      return reply.status(400).send({ error: 'Parámetro ?userId numérico requerido' });
    }

    try {
      const url = getMicrosoftAuthUrl(userId);
      return reply.redirect(url);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * Callback de Microsoft OAuth
   * GET /auth/microsoft/callback
   */
  app.get('/auth/microsoft/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      return reply.status(400).send({ error: `Microsoft OAuth error: ${query.error}` });
    }

    if (!query.code || !query.state) {
      return reply.status(400).send({ error: 'Parámetros code y state requeridos en callback' });
    }

    try {
      const account = await handleMicrosoftCallback(query.code, query.state);
      return reply.send({
        message: 'Cuenta de Microsoft Outlook vinculada exitosamente',
        account: {
          id: account.id,
          email: account.email,
          displayName: account.displayName,
          provider: account.provider,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
};
