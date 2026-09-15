import { prisma } from '../database/prisma.js';
import { encrypt, decrypt } from '../security/encryption.js';
import { assertAccountOwnership } from '../security/isolation.js';

export interface CreateImapAccountData {
  email: string;
  displayName?: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string;
  imapTls?: boolean;
}

export interface CreateOAuthAccountData {
  provider: 'gmail' | 'outlook';
  email: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export class AccountService {
  /**
   * Lista las cuentas de un usuario enmascarando información sensible
   */
  async listAccountsByUser(userId: number) {
    const accounts = await prisma.emailAccount.findMany({
      where: {
        userId,
        active: true,
      },
      select: {
        id: true,
        provider: true,
        email: true,
        displayName: true,
        imapHost: true,
        imapPort: true,
        imapUser: true,
        imapTls: true,
        lastSyncAt: true,
        lastSyncError: true,
        active: true,
        createdAt: true,
        _count: {
          select: {
            emails: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return accounts;
  }

  /**
   * Obtiene una cuenta validando el aislamiento del usuario
   */
  async getAccountById(accountId: number, userId: number) {
    return assertAccountOwnership(accountId, userId);
  }

  /**
   * Obtiene una cuenta con sus credenciales descifradas para uso exclusivo del Worker/Poller
   */
  async getAccountWithCredentials(accountId: number) {
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
      include: { user: true },
    });

    if (!account) {
      throw new Error(`Cuenta ${accountId} no encontrada`);
    }

    return {
      ...account,
      accessToken: account.accessToken ? decrypt(account.accessToken) : null,
      refreshToken: account.refreshToken ? decrypt(account.refreshToken) : null,
      imapPassword: account.imapPassword ? decrypt(account.imapPassword) : null,
    };
  }

  /**
   * Registra o actualiza una cuenta IMAP con contraseña cifrada (Upsert)
   */
  async createImapAccount(userId: number, data: CreateImapAccountData) {
    const encryptedPassword = encrypt(data.imapPassword);
    const emailNormalized = data.email.toLowerCase().trim();

    const existing = await prisma.emailAccount.findFirst({
      where: {
        userId,
        email: emailNormalized,
      },
    });

    if (existing) {
      return prisma.emailAccount.update({
        where: { id: existing.id },
        data: {
          provider: 'imap',
          displayName: data.displayName || existing.displayName,
          imapHost: data.imapHost,
          imapPort: data.imapPort,
          imapUser: data.imapUser,
          imapPassword: encryptedPassword,
          imapTls: data.imapTls ?? true,
          active: true,
          lastSyncError: null,
        },
        select: {
          id: true,
          userId: true,
          provider: true,
          email: true,
          displayName: true,
          imapHost: true,
          imapPort: true,
          imapUser: true,
          imapTls: true,
          active: true,
          createdAt: true,
        },
      });
    }

    return prisma.emailAccount.create({
      data: {
        userId,
        provider: 'imap',
        email: emailNormalized,
        displayName: data.displayName || data.email,
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        imapUser: data.imapUser,
        imapPassword: encryptedPassword,
        imapTls: data.imapTls ?? true,
        active: true,
      },
      select: {
        id: true,
        userId: true,
        provider: true,
        email: true,
        displayName: true,
        imapHost: true,
        imapPort: true,
        imapUser: true,
        imapTls: true,
        active: true,
        createdAt: true,
      },
    });
  }

  /**
   * Crea o actualiza una cuenta OAuth (Gmail o Outlook) con tokens cifrados
   */
  async upsertOAuthAccount(userId: number, data: CreateOAuthAccountData) {
    const encryptedAccessToken = encrypt(data.accessToken);
    const encryptedRefreshToken = data.refreshToken ? encrypt(data.refreshToken) : null;

    const existing = await prisma.emailAccount.findFirst({
      where: {
        userId,
        provider: data.provider,
        email: data.email.toLowerCase().trim(),
      },
    });

    if (existing) {
      return prisma.emailAccount.update({
        where: { id: existing.id },
        data: {
          displayName: data.displayName || existing.displayName,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? existing.refreshToken,
          tokenExpiresAt: data.tokenExpiresAt ?? existing.tokenExpiresAt,
          active: true,
          lastSyncError: null,
        },
      });
    }

    return prisma.emailAccount.create({
      data: {
        userId,
        provider: data.provider,
        email: data.email.toLowerCase().trim(),
        displayName: data.displayName || data.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        active: true,
      },
    });
  }

  /**
   * Actualiza el estado de sincronización de una cuenta
   */
  async updateSyncStatus(accountId: number, error: string | null = null) {
    return prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: error,
      },
    });
  }

  /**
   * Da de baja lógica o elimina una cuenta garantizando aislamiento
   */
  async deleteAccount(accountId: number, userId: number) {
    await assertAccountOwnership(accountId, userId);

    return prisma.emailAccount.delete({
      where: { id: accountId },
    });
  }
}

export const accountService = new AccountService();
