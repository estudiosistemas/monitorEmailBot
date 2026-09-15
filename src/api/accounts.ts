import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { accountService } from '../services/account-service.js';
import { IsolationError } from '../security/isolation.js';

const createImapSchema = z.object({
  email: z.string().email('Formato de correo inválido'),
  displayName: z.string().optional(),
  imapHost: z.string().min(1, 'Host IMAP requerido'),
  imapPort: z.coerce.number().default(993),
  imapUser: z.string().min(1, 'Usuario IMAP requerido'),
  imapPassword: z.string().min(1, 'Contraseña IMAP requerida'),
  imapTls: z.boolean().default(true),
});

function extractUserId(request: any): number {
  const headerUserId = request.headers['x-user-id'];
  const queryUserId = request.query?.userId;
  const rawId = headerUserId || queryUserId;

  const id = Number(rawId);
  if (!rawId || isNaN(id)) {
    throw new Error('Cabecera "x-user-id" o parámetro "?userId" obligatorio para esta operación');
  }
  return id;
}

export const accountsRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Listar cuentas del usuario
   * GET /api/accounts
   */
  app.get('/api/accounts', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const accounts = await accountService.listAccountsByUser(userId);
      return { data: accounts };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Obtener detalle de una cuenta
   * GET /api/accounts/:id
   */
  app.get('/api/accounts/:id', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const params = request.params as { id: string };
      const accountId = Number(params.id);

      if (isNaN(accountId)) {
        return reply.status(400).send({ error: 'ID de cuenta inválido' });
      }

      const account = await accountService.getAccountById(accountId, userId);
      return { data: account };
    } catch (err: any) {
      if (err instanceof IsolationError) {
        return reply.status(403).send({ error: err.message });
      }
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Conectar nueva cuenta IMAP
   * POST /api/accounts/imap
   */
  app.post('/api/accounts/imap', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const parseResult = createImapSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Datos inválidos',
          details: parseResult.error.flatten(),
        });
      }

      const account = await accountService.createImapAccount(userId, parseResult.data);
      return reply.status(201).send({
        message: 'Cuenta IMAP conectada exitosamente',
        data: account,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Eliminar una cuenta de correo
   * DELETE /api/accounts/:id
   */
  app.delete('/api/accounts/:id', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const params = request.params as { id: string };
      const accountId = Number(params.id);

      if (isNaN(accountId)) {
        return reply.status(400).send({ error: 'ID de cuenta inválido' });
      }

      await accountService.deleteAccount(accountId, userId);
      return reply.send({ message: 'Cuenta eliminada exitosamente' });
    } catch (err: any) {
      if (err instanceof IsolationError) {
        return reply.status(403).send({ error: err.message });
      }
      return reply.status(400).send({ error: err.message });
    }
  });
};
