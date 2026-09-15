import crypto from 'node:crypto';
import type { EmailAccount } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { providerFactory } from '../providers/provider-factory.js';
import { aiAnalyzer } from '../ai/analyzer.js';
import { notificationRouter } from '../notifications/router.js';

/**
 * Procesa íntegramente una cuenta de correo: consulta correos nuevos,
 * elimina duplicados, analiza con IA y enruta notificaciones por Telegram.
 */
export async function processAccount(account: EmailAccount): Promise<{ processedCount: number; duplicateCount: number }> {
  console.log(`\n📬 [Cuenta ${account.id}] Procesando ${account.email} (${account.provider})...`);

  // 1. Obtener adaptador correspondiente
  const provider = providerFactory.get(account.provider);

  // 2. Conectar y obtener correos nuevos
  await provider.connect(account);
  const incomingEmails = await provider.getNewEmails(account);
  console.log(`  -> Correos detectados por el proveedor: ${incomingEmails.length}`);

  let processedCount = 0;
  let duplicateCount = 0;

  for (const incoming of incomingEmails) {
    try {
      // 3. Verificación de duplicados (Sección 20: accountId + providerMessageId)
      const existing = await prisma.email.findUnique({
        where: {
          accountId_providerMessageId: {
            accountId: account.id,
            providerMessageId: incoming.providerMessageId,
          },
        },
      });

      if (existing) {
        duplicateCount++;
        continue;
      }

      // 4. Calcular hash de integridad del cuerpo
      const bodyHash = crypto.createHash('sha256').update(incoming.bodyText).digest('hex');

      // 5. Persistir nuevo correo en SQLite
      const savedEmail = await prisma.email.create({
        data: {
          accountId: account.id,
          providerMessageId: incoming.providerMessageId,
          threadId: incoming.threadId,
          senderEmail: incoming.senderEmail,
          senderName: incoming.senderName,
          subject: incoming.subject,
          receivedAt: incoming.receivedAt,
          bodyText: incoming.bodyText,
          bodyHash,
          hasAttachments: incoming.hasAttachments,
          processed: false,
        },
      });

      console.log(`  -> Correo guardado [ID: ${savedEmail.id}]: "${savedEmail.subject.slice(0, 40)}"`);

      // 6. Análisis con IA (OpenAI)
      const analysisResult = await aiAnalyzer.analyzeEmail(incoming);

      // 7. Guardar resultado de análisis
      const savedAnalysis = await prisma.emailAnalysis.create({
        data: {
          emailId: savedEmail.id,
          category: analysisResult.category,
          priority: analysisResult.priority,
          requiresResponse: analysisResult.requiresResponse,
          summary: analysisResult.summary,
          sentiment: analysisResult.sentiment,
          model: analysisResult.model,
          promptVersion: analysisResult.promptVersion,
        },
      });

      console.log(`  -> IA Análisis: Categoría [${savedAnalysis.category}], Prioridad [${savedAnalysis.priority}], Responde [${savedAnalysis.requiresResponse}]`);

      // 8. Enrutar notificación a Telegram del propietario
      await notificationRouter.routeAndNotify(savedEmail, account, savedAnalysis);

      // 9. Marcar correo como procesado
      await prisma.email.update({
        where: { id: savedEmail.id },
        data: { processed: true },
      });

      processedCount++;
    } catch (emailErr: any) {
      console.error(`❌ Error procesando email ${incoming.providerMessageId}:`, emailErr.message);
    }
  }

  // 10. Actualizar sincronización exitosa de la cuenta
  await prisma.emailAccount.update({
    where: { id: account.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncError: null,
    },
  });

  console.log(`  -> Resultado cuenta ${account.email}: ${processedCount} nuevos, ${duplicateCount} duplicados ignorados.`);
  return { processedCount, duplicateCount };
}
