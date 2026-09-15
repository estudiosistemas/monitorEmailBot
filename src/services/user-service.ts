import { prisma } from '../database/prisma.js';

export interface CreateUserData {
  name: string;
  email: string;
}

export interface UpdateUserData {
  name?: string;
  active?: boolean;
}

export class UserService {
  /**
   * Obtiene la lista de todos los usuarios
   */
  async listUsers(onlyActive = true) {
    return prisma.user.findMany({
      where: onlyActive ? { active: true } : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
        _count: {
          select: {
            emailAccounts: true,
            telegramDestinations: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Obtiene un usuario por su ID
   */
  async getUserById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        emailAccounts: {
          select: {
            id: true,
            provider: true,
            email: true,
            displayName: true,
            active: true,
            lastSyncAt: true,
            lastSyncError: true,
          },
        },
        telegramDestinations: {
          select: {
            id: true,
            chatId: true,
            username: true,
            active: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene un usuario por su Email
   */
  async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Registra un nuevo usuario en el sistema
   */
  async createUser(data: CreateUserData) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        active: true,
      },
    });
  }

  /**
   * Actualiza el estado o nombre de un usuario
   */
  async updateUser(id: number, data: UpdateUserData) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }
}

export const userService = new UserService();
