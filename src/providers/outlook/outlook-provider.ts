import type { EmailAccount } from '@prisma/client';
import type { EmailProvider, IncomingEmail } from '../email-provider.js';
import { refreshMicrosoftToken } from '../../auth/microsoft.js';
import { accountService } from '../../services/account-service.js';

export class OutlookProvider implements EmailProvider {
  /**
   * Obtiene un access token válido para Microsoft Graph, refrescándolo si ha expirado
   */
  private async getValidToken(account: EmailAccount & { accessToken?: string | null; refreshToken?: string | null }): Promise<string> {
    if (!account.accessToken) {
      throw new Error(`La cuenta ${account.email} no tiene access token configurado`);
    }

    const isExpired = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() <= Date.now() : false;

    if (isExpired && account.refreshToken) {
      const refreshed = await refreshMicrosoftToken(account.refreshToken);
      await accountService.upsertOAuthAccount(account.userId, {
        provider: 'outlook',
        email: account.email,
        accessToken: refreshed.accessToken,
        refreshToken: account.refreshToken,
        tokenExpiresAt: refreshed.expiresAt,
      });
      return refreshed.accessToken;
    }

    return account.accessToken;
  }

  async connect(account: EmailAccount): Promise<void> {
    const creds = await accountService.getAccountWithCredentials(account.id);
    await this.getValidToken(creds);
  }

  async getNewEmails(account: EmailAccount): Promise<IncomingEmail[]> {
    const creds = await accountService.getAccountWithCredentials(account.id);
    const accessToken = await this.getValidToken(creds);

    // Consulta mensajes recientes ordenados por fecha de recepción
    let filter = 'isRead eq false';
    if (account.lastSyncAt) {
      filter += ` and receivedDateTime ge ${account.lastSyncAt.toISOString()}`;
    }

    const url = `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(
      filter
    )}&$top=20&$orderby=receivedDateTime desc&$select=id,conversationId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,hasAttachments`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="text"',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Microsoft Graph error: ${err}`);
    }

    const data = (await res.json()) as any;
    const messages = data.value || [];

    return messages.map((msg: any) => this.normalizeMessage(msg));
  }

  async getEmail(account: EmailAccount, messageId: string): Promise<IncomingEmail> {
    const creds = await accountService.getAccountWithCredentials(account.id);
    const accessToken = await this.getValidToken(creds);

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Error obteniendo correo ${messageId} de Outlook`);
    }

    const data = (await res.json()) as any;
    return this.normalizeMessage(data);
  }

  async markAsRead(account: EmailAccount, messageId: string): Promise<void> {
    const creds = await accountService.getAccountWithCredentials(account.id);
    const accessToken = await this.getValidToken(creds);

    await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isRead: true }),
    });
  }

  private normalizeMessage(msg: any): IncomingEmail {
    const senderEmail = msg.from?.emailAddress?.address || 'desconocido@remitente.com';
    const senderName = msg.from?.emailAddress?.name || undefined;
    const recipients = (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean);

    let bodyText = msg.body?.content || msg.bodyPreview || '';
    if (msg.body?.contentType === 'html') {
      bodyText = bodyText.replace(/<[^>]*>?/gm, '').trim();
    }

    return {
      providerMessageId: msg.id,
      threadId: msg.conversationId,
      senderEmail,
      senderName,
      recipients,
      subject: msg.subject || '(Sin Asunto)',
      bodyText: bodyText.trim(),
      bodyHtml: msg.body?.contentType === 'html' ? msg.body.content : undefined,
      receivedAt: new Date(msg.receivedDateTime || Date.now()),
      hasAttachments: Boolean(msg.hasAttachments),
    };
  }
}

export const outlookProvider = new OutlookProvider();
