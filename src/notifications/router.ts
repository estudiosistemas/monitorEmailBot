import { prisma } from '../database/prisma.js';
import { telegramService } from './telegram.js';
import { getTelegramDestinationForUser } from '../security/isolation.js';
import type { Email, EmailAccount, EmailAnalysis } from '@prisma/client';

export class NotificationRouter {
  /**
   * Determina si un correo debe generar notificación según las reglas del plan (Sección 28)
   */
  shouldNotify(analysis: EmailAnalysis): boolean {
    return analysis.priority >= 3 || analysis.requiresResponse;
  }

  /**
   * Rutea y envía la notificación al propietario de la cuenta exclusivamente
   */
  async routeAndNotify(email: Email, account: EmailAccount, analysis: EmailAnalysis): Promise<void> {
    if (!this.shouldNotify(analysis)) {
      console.log(`ℹ️ Correo ${email.id} (prioridad ${analysis.priority}) no cumple criterios de notificación.`);
      return;
    }

    // 1. Obtener el destino de Telegram del propietario de la cuenta
    const destination = await getTelegramDestinationForUser(account.userId);
    if (!destination) {
      console.warn(`⚠️ El usuario ${account.userId} (${account.email}) no tiene un TelegramDestination configurado.`);
      return;
    }

    // 2. Crear registro de notificación en estado 'pending'
    const notification = await prisma.notification.create({
      data: {
        emailId: email.id,
        userId: account.userId,
        telegramDestinationId: destination.id,
        telegramChatId: destination.chatId,
        status: 'pending',
      },
    });

    // 3. Formatear y enviar mensaje
    const message = telegramService.formatEmailMessage({
      accountEmail: account.email,
      senderName: email.senderName || undefined,
      senderEmail: email.senderEmail,
      subject: email.subject,
      priority: analysis.priority,
      category: analysis.category,
      requiresResponse: analysis.requiresResponse,
      summary: analysis.summary,
    });

    try {
      await telegramService.sendMessageWithRetry(destination.chatId, message);

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      console.log(`✅ Notificación enviada con éxito al Telegram de usuario ${account.userId} (chatId: ${destination.chatId})`);
    } catch (err: any) {
      console.error(`❌ Falló el envío de notificación para correo ${email.id}:`, err.message);

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'failed',
          error: err.message,
        },
      });
    }
  }
}

export const notificationRouter = new NotificationRouter();
