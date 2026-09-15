import { env } from '../config/env.js';

export interface EmailNotificationPayload {
  accountEmail: string;
  senderName?: string;
  senderEmail: string;
  subject: string;
  priority: number;
  category: string;
  requiresResponse: boolean;
  summary: string;
}

export class TelegramService {
  /**
   * Envía un mensaje de texto a un chatId de Telegram aplicando reintentos exponenciales
   */
  async sendMessageWithRetry(
    chatId: string,
    text: string,
    replyMarkup?: any,
    maxRetries = 3
  ): Promise<void> {
    if (!env.TELEGRAM_BOT_TOKEN) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN no configurado. Simulando envío a Telegram:');
      console.log(`[Telegram a ${chatId}]:\n${text}`);
      return;
    }

    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    let attempt = 0;
    let delayMs = 1000;

    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    while (attempt < maxRetries) {
      attempt++;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return;
        }

        const errText = await response.text();
        console.warn(`⚠️ Intento ${attempt} fallido al enviar Telegram a ${chatId}: ${errText}`);

        if (errText.includes('chat not found')) {
          throw new Error(
            'Telegram respondió "Chat not found". Debes abrir tu bot en Telegram y pulsar "Iniciar" (o enviarle el mensaje /start) antes de que el bot pueda enviarte alertas.'
          );
        }

        if (errText.includes('bot was blocked by the user')) {
          throw new Error('El bot fue bloqueado en Telegram por el usuario. Debes desbloquearlo para recibir alertas.');
        }
      } catch (err: any) {
        if (err.message.includes('Chat not found') || err.message.includes('bloqueado')) {
          throw err;
        }
        console.warn(`⚠️ Intento ${attempt} con error de red en Telegram: ${err.message}`);
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // 1s -> 2s -> 4s
      }
    }

    throw new Error(`Fallaron todos los ${maxRetries} intentos al enviar mensaje de Telegram a ${chatId}`);
  }

  /**
   * Formatea el correo según la plantilla oficial del plan (sección 33)
   */
  formatEmailMessage(data: EmailNotificationPayload): string {
    const priorityLabels: Record<number, string> = {
      5: '🔴 CRÍTICA',
      4: '🔴 ALTA',
      3: '🟠 MEDIA',
      2: '🟡 BAJA',
      1: '⚪ MUY BAJA',
    };

    const priorityText = priorityLabels[data.priority] || `Nivel ${data.priority}`;
    const sender = data.senderName
      ? `${this.escapeHtml(data.senderName)} &lt;${this.escapeHtml(data.senderEmail)}&gt;`
      : this.escapeHtml(data.senderEmail);

    return [
      '🔔 <b>NUEVO EMAIL</b>',
      '',
      `📧 <b>Cuenta:</b>\n${this.escapeHtml(data.accountEmail)}`,
      '',
      `👤 <b>De:</b>\n${sender}`,
      '',
      `📌 <b>Asunto:</b>\n${this.escapeHtml(data.subject)}`,
      '',
      `<b>Prioridad:</b>\n${priorityText}`,
      '',
      `🏷️ <b>Categoría:</b>\n${this.escapeHtml(data.category)}`,
      '',
      `⚠️ <b>Requiere respuesta:</b>\n${data.requiresResponse ? 'Sí' : 'No'}`,
      '',
      `📝 <b>Resumen:</b>\n${this.escapeHtml(data.summary)}`,
    ].join('\n');
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const telegramService = new TelegramService();
