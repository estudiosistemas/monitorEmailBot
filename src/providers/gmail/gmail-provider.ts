import type { EmailAccount } from '@prisma/client';
import type { EmailProvider, IncomingEmail } from '../email-provider.js';
import { refreshGoogleToken } from '../../auth/google.js';
import { accountService } from '../../services/account-service.js';

export class GmailProvider implements EmailProvider {
  /**
   * Obtiene un access token válido, refrescándolo si ha expirado
   */
  private async getValidToken(account: EmailAccount & { accessToken?: string | null; refreshToken?: string | null }): Promise<string> {
    if (!account.accessToken) {
      throw new Error(`La cuenta ${account.email} no tiene access token configurado`);
    }

    const isExpired = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() <= Date.now() : false;

    if (isExpired && account.refreshToken) {
      const refreshed = await refreshGoogleToken(account.refreshToken);
      await accountService.upsertOAuthAccount(account.userId, {
        provider: 'gmail',
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

    // Consulta los mensajes recientes no leídos o últimos mensajes
    const query = account.lastSyncAt ? `after:${Math.floor(account.lastSyncAt.getTime() / 1000)}` : 'is:unread';
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail API error listando correos: ${err}`);
    }

    const data = (await res.json()) as any;
    const messages = data.messages || [];

    const emails: IncomingEmail[] = [];
    for (const msg of messages) {
      try {
        const email = await this.fetchMessageDetail(accessToken, msg.id);
        emails.push(email);
      } catch (err) {
        console.error(`Error obteniendo detalle de correo ${msg.id}:`, err);
      }
    }

    return emails;
  }

  async getEmail(account: EmailAccount, messageId: string): Promise<IncomingEmail> {
    const creds = await accountService.getAccountWithCredentials(account.id);
    const accessToken = await this.getValidToken(creds);
    return this.fetchMessageDetail(accessToken, messageId);
  }

  async markAsRead(account: EmailAccount, messageId: string): Promise<void> {
    const creds = await accountService.getAccountWithCredentials(account.id);
    const accessToken = await this.getValidToken(creds);

    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    });
  }

  private async fetchMessageDetail(accessToken: string, messageId: string): Promise<IncomingEmail> {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      throw new Error(`Error obteniendo mensaje ${messageId} de Gmail`);
    }

    const data = (await res.json()) as any;
    const headers = data.payload?.headers || [];

    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject') || '(Sin Asunto)';
    const fromRaw = getHeader('From');
    const toRaw = getHeader('To');
    const dateRaw = getHeader('Date');

    // Parsear remitente
    let senderEmail = fromRaw;
    let senderName: string | undefined;
    const match = fromRaw.match(/(.*)<(.+)>/);
    if (match) {
      senderName = match[1].trim().replace(/^["']|["']$/g, '');
      senderEmail = match[2].trim();
    }

    // Extraer texto del cuerpo (soporta base64 url safe)
    let bodyText = '';
    let bodyHtml: string | undefined;

    const extractParts = (part: any) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText += Buffer.from(part.body.data, 'base64url').toString('utf8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64url').toString('utf8');
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          extractParts(subPart);
        }
      }
    };

    extractParts(data.payload);

    if (!bodyText && bodyHtml) {
      // Limpieza básica de tags si solo vino HTML
      bodyText = bodyHtml.replace(/<[^>]*>?/gm, '').trim();
    }

    const receivedAt = dateRaw ? new Date(dateRaw) : new Date(Number(data.internalDate) || Date.now());

    return {
      providerMessageId: data.id,
      threadId: data.threadId,
      senderEmail,
      senderName,
      recipients: toRaw ? toRaw.split(',').map((s: string) => s.trim()) : [],
      subject,
      bodyText: bodyText.trim(),
      bodyHtml,
      receivedAt,
      hasAttachments: Boolean(data.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)),
    };
  }
}

export const gmailProvider = new GmailProvider();
