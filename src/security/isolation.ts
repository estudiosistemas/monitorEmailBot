import { prisma } from '../database/prisma.js';

export class IsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IsolationError';
  }
}

/**
 * Valida estrictamente que una cuenta de correo pertenezca al usuario indicado.
 * Lanza IsolationError si no pertenece o no existe.
 */
export async function assertAccountOwnership(accountId: number, userId: number) {
  const account = await prisma.emailAccount.findFirst({
    where: {
      id: accountId,
      userId: userId,
    },
    include: {
      user: true,
    },
  });

  if (!account) {
    throw new IsolationError(
      `Acceso no autorizado o la cuenta ${accountId} no pertenece al usuario ${userId}`
    );
  }

  return account;
}

/**
 * Valida estrictamente que un correo electrónico pertenezca a una cuenta del usuario indicado.
 * Lanza IsolationError si no pertenece o no existe.
 */
export async function assertEmailOwnership(emailId: number, userId: number) {
  const email = await prisma.email.findFirst({
    where: {
      id: emailId,
      account: {
        userId: userId,
      },
    },
    include: {
      account: {
        include: {
          user: true,
        },
      },
      analysis: true,
    },
  });

  if (!email) {
    throw new IsolationError(
      `Acceso no autorizado o el email ${emailId} no pertenece al usuario ${userId}`
    );
  }

  return email;
}

/**
 * Obtiene el destino de Telegram configurado y activo para un usuario
 */
export async function getTelegramDestinationForUser(userId: number) {
  const destination = await prisma.telegramDestination.findFirst({
    where: {
      userId,
      active: true,
    },
  });

  return destination;
}
