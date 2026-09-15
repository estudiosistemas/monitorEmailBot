import tls from 'node:tls';
import net from 'node:net';
import type { EmailAccount } from '@prisma/client';
import type { EmailProvider, IncomingEmail } from '../email-provider.js';
import { accountService } from '../../services/account-service.js';

interface RawImapMessage {
  uid: string;
  headerText: string;
  bodyText: string;
}

export class ImapProvider implements EmailProvider {
  /**
   * Conecta y verifica las credenciales de la cuenta IMAP
   */
  async connect(account: EmailAccount): Promise<void> {
    const creds = await accountService.getAccountWithCredentials(account.id);
    if (!creds.imapHost || !creds.imapUser || !creds.imapPassword) {
      throw new Error(`Cuenta ${account.email} no tiene configurados todos los datos IMAP`);
    }

    // Intenta abrir sesión y cerrar inmediatamente
    const client = new SimpleImapClient(
      creds.imapHost,
      creds.imapPort || 993,
      creds.imapTls ?? true
    );
    await client.connect();
    await client.login(creds.imapUser, creds.imapPassword);
    await client.logout();
  }

  /**
   * Obtiene correos nuevos no leídos desde el servidor IMAP
   */
  async getNewEmails(account: EmailAccount): Promise<IncomingEmail[]> {
    const creds = await accountService.getAccountWithCredentials(account.id);
    if (!creds.imapHost || !creds.imapUser || !creds.imapPassword) {
      throw new Error(`Cuenta ${account.email} incompleta para conexión IMAP`);
    }

    const client = new SimpleImapClient(
      creds.imapHost,
      creds.imapPort || 993,
      creds.imapTls ?? true
    );

    try {
      await client.connect();
      await client.login(creds.imapUser, creds.imapPassword);
      await client.selectInbox();

      const uids = await client.searchUnseen();
      const emails: IncomingEmail[] = [];

      for (const uid of uids.slice(0, 15)) {
        try {
          const raw = await client.fetchMessage(uid);
          const email = this.parseEmail(raw);
          emails.push(email);
        } catch (err) {
          console.error(`Error procesando mensaje IMAP UID ${uid}:`, err);
        }
      }

      await client.logout();
      return emails;
    } catch (err: any) {
      client.destroy();
      throw new Error(`Error de conexión IMAP (${account.email}): ${err.message}`);
    }
  }

  async getEmail(account: EmailAccount, messageId: string): Promise<IncomingEmail> {
    const creds = await accountService.getAccountWithCredentials(account.id);
    const client = new SimpleImapClient(
      creds.imapHost!,
      creds.imapPort || 993,
      creds.imapTls ?? true
    );

    await client.connect();
    await client.login(creds.imapUser!, creds.imapPassword!);
    await client.selectInbox();

    const raw = await client.fetchMessage(messageId);
    await client.logout();

    return this.parseEmail(raw);
  }

  private parseEmail(raw: RawImapMessage): IncomingEmail {
    const headers = this.parseHeaders(raw.headerText);

    const fromRaw = headers['from'] || 'desconocido@remitente.com';
    let senderEmail = fromRaw;
    let senderName: string | undefined;
    const match = fromRaw.match(/(.*)<(.+)>/);
    if (match) {
      senderName = match[1].trim().replace(/^["']|["']$/g, '');
      senderEmail = match[2].trim();
    }

    const toRaw = headers['to'] || '';
    const recipients = toRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const subject = headers['subject'] || '(Sin Asunto)';
    const dateRaw = headers['date'];
    const receivedAt = dateRaw ? new Date(dateRaw) : new Date();

    return {
      providerMessageId: headers['message-id'] || `imap_${raw.uid}`,
      senderEmail,
      senderName,
      recipients,
      subject,
      bodyText: raw.bodyText.trim(),
      receivedAt,
      hasAttachments: false,
    };
  }

  private parseHeaders(rawHeaders: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = rawHeaders.split(/\r?\n/);
    let currentKey = '';

    for (const line of lines) {
      if (/^\s/.test(line) && currentKey) {
        result[currentKey] += ' ' + line.trim();
      } else {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          currentKey = line.slice(0, colonIdx).trim().toLowerCase();
          result[currentKey] = line.slice(colonIdx + 1).trim();
        }
      }
    }
    return result;
  }
}

/**
 * Cliente IMAP simple basado en sockets nativos TLS/TCP según RFC 3501
 */
class SimpleImapClient {
  private socket: tls.TLSSocket | net.Socket | null = null;
  private tagCounter = 0;

  constructor(
    private host: string,
    private port: number,
    private isTls: boolean
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = {
        host: this.host,
        port: this.port,
        servername: this.host,
        rejectUnauthorized: false,
      };

      const handleInitialData = (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (text.includes('* OK') || text.includes('* PREAUTH')) {
          this.socket?.off('data', handleInitialData);
          resolve();
        }
      };

      const onConnect = () => {
        this.socket?.on('data', handleInitialData);
      };

      if (this.isTls) {
        this.socket = tls.connect(options, onConnect);
      } else {
        this.socket = net.connect(options, onConnect);
      }

      this.socket.once('error', reject);
      this.socket.setTimeout(15000, () => {
        reject(new Error('Timeout conectando al servidor IMAP'));
      });
    });
  }

  async sendCommand(command: string): Promise<string> {
    this.tagCounter++;
    const tag = `A${this.tagCounter}`;
    const fullCmd = `${tag} ${command}\r\n`;

    return new Promise((resolve, reject) => {
      let buffer = '';

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        if (buffer.includes(`${tag} OK`) || buffer.includes(`${tag} NO`) || buffer.includes(`${tag} BAD`)) {
          this.socket?.off('data', onData);
          if (buffer.includes(`${tag} OK`)) {
            resolve(buffer);
          } else {
            reject(new Error(`Comando IMAP fallido: ${buffer.trim()}`));
          }
        }
      };

      this.socket?.on('data', onData);
      this.socket?.write(fullCmd);
    });
  }

  async login(user: string, pass: string): Promise<void> {
    await this.sendCommand(`LOGIN "${user}" "${pass}"`);
  }

  async selectInbox(): Promise<void> {
    await this.sendCommand('SELECT "INBOX"');
  }

  async searchUnseen(): Promise<string[]> {
    const res = await this.sendCommand('SEARCH UNSEEN');
    const match = res.match(/\* SEARCH (.*)/);
    if (!match || !match[1].trim()) return [];
    return match[1].trim().split(/\s+/);
  }

  async fetchMessage(seq: string): Promise<RawImapMessage> {
    const raw = await this.sendCommand(`FETCH ${seq} (BODY[HEADER] BODY[TEXT])`);

    let headerText = '';
    let bodyText = '';

    const headerMatch = raw.match(/BODY\[HEADER\]\s*\{(\d+)\}\r?\n([\s\S]*?)\r?\n\s*\)/i);
    if (headerMatch) {
      headerText = headerMatch[2];
    }

    const bodyMatch = raw.match(/BODY\[TEXT\]\s*\{(\d+)\}\r?\n([\s\S]*?)\r?\n\s*\)/i);
    if (bodyMatch) {
      bodyText = bodyMatch[2];
    } else {
      bodyText = raw;
    }

    return {
      uid: seq,
      headerText,
      bodyText,
    };
  }

  async logout(): Promise<void> {
    try {
      await this.sendCommand('LOGOUT');
    } catch {
      // Ignorar errores en logout
    } finally {
      this.destroy();
    }
  }

  destroy(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}

export const imapProvider = new ImapProvider();
