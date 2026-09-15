import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { userService } from '../services/user-service.js';

const createUserSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Formato de correo electrónico inválido'),
});

export const usersRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Listado de usuarios
   * GET /api/users
   */
  app.get('/api/users', async () => {
    const users = await userService.listUsers();
    return { data: users };
  });

  /**
   * Detalle de un usuario específico
   * GET /api/users/:id
   */
  app.get('/api/users/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const id = Number(params.id);

    if (isNaN(id)) {
      return reply.status(400).send({ error: 'ID de usuario inválido' });
    }

    const user = await userService.getUserById(id);
    if (!user) {
      return reply.status(404).send({ error: 'Usuario no encontrado' });
    }

    return { data: user };
  });

  /**
   * Crear nuevo usuario
   * POST /api/users
   */
  app.post('/api/users', async (request, reply) => {
    const parseResult = createUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validación fallida',
        details: parseResult.error.flatten(),
      });
    }

    const { name, email } = parseResult.data;

    const existing = await userService.getUserByEmail(email);
    if (existing) {
      return reply.status(409).send({ error: 'Ya existe un usuario con ese correo electrónico' });
    }

    const created = await userService.createUser({ name, email });
    return reply.status(201).send({ data: created });
  });
};
