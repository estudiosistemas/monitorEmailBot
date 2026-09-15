import type { EmailAccount } from '@prisma/client';

export interface EmailAttachment {
  filename: string;
  contentType: string;
  sizeBytes?: number;
}

export interface IncomingEmail {
  providerMessageId: string;
  threadId?: string;
  senderEmail: string;
  senderName?: string;
  recipients: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  receivedAt: Date;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  /**
   * Verifica la conexión o credenciales de la cuenta
   */
  connect(account: EmailAccount): Promise<void>;

  /**
   * Obtiene correos nuevos o no procesados para la cuenta
   */
  getNewEmails(account: EmailAccount): Promise<IncomingEmail[]>;

  /**
   * Obtiene un correo específico por su ID del proveedor
   */
  getEmail(account: EmailAccount, messageId: string): Promise<IncomingEmail>;

  /**
   * Marca un correo como leído en el proveedor (opcional)
   */
  markAsRead?(account: EmailAccount, messageId: string): Promise<void>;

  /**
   * Libera recursos o cierra la conexión con el servidor (opcional)
   */
  disconnect?(account: EmailAccount): Promise<void>;
}
