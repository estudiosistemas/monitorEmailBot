import { env } from '../config/env.js';
import { SYSTEM_PROMPT, PROMPT_VERSION, type Category, VALID_CATEGORIES } from './prompts.js';
import type { IncomingEmail } from '../providers/email-provider.js';

export interface AnalysisResult {
  category: Category;
  priority: number;
  requiresResponse: boolean;
  summary: string;
  sentiment: string;
  model: string;
  promptVersion: string;
}

export class AiAnalyzer {
  /**
   * Analiza un correo entrante y devuelve la clasificación estructurada
   */
  async analyzeEmail(email: IncomingEmail): Promise<AnalysisResult> {
    const model = env.OPENAI_MODEL || 'gpt-4o-mini';

    // Si no hay API key configurada (ej. entornos de test inicial), usar analizador heurístico
    if (!env.OPENAI_API_KEY) {
      return this.heuristicFallback(email, model);
    }

    try {
      const userContent = JSON.stringify({
        remitente: `${email.senderName || ''} <${email.senderEmail}>`,
        destinatarios: email.recipients,
        asunto: email.subject,
        fecha: email.receivedAt.toISOString(),
        cuerpo: email.bodyText.slice(0, 4000), // Limitar para evitar desbordamiento de contexto
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Por favor analiza el siguiente correo no confiable:\n\n${userContent}`,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error: ${errText}`);
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Respuesta vacía de OpenAI');
      }

      const parsed = JSON.parse(content);
      const category = this.validateCategory(parsed.category);
      const priority = Math.min(Math.max(Number(parsed.priority) || 3, 1), 5);
      const requiresResponse = Boolean(parsed.requires_response);
      const summary = String(parsed.summary || email.subject).slice(0, 300);
      const sentiment = String(parsed.sentiment || 'neutral');

      return {
        category,
        priority,
        requiresResponse,
        summary,
        sentiment,
        model,
        promptVersion: PROMPT_VERSION,
      };
    } catch (err: any) {
      console.error('⚠️ Error en análisis con OpenAI. Aplicando fallback heurístico:', err.message);
      return this.heuristicFallback(email, model);
    }
  }

  private validateCategory(cat: any): Category {
    if (typeof cat === 'string' && VALID_CATEGORIES.includes(cat as any)) {
      return cat as Category;
    }
    return 'Otro';
  }

  /**
   * Analizador heurístico de respaldo cuando la API de OpenAI no está disponible
   */
  private heuristicFallback(email: IncomingEmail, model: string): AnalysisResult {
    const text = `${email.subject} ${email.bodyText}`.toLowerCase();

    let category: Category = 'Trabajo';
    let priority = 3;
    let requiresResponse = false;

    if (text.includes('urgente') || text.includes('emergencia') || text.includes('inmediato')) {
      category = 'Urgente';
      priority = 5;
      requiresResponse = true;
    } else if (text.includes('factura') || text.includes('pago') || text.includes('recibo')) {
      category = 'Facturación';
      priority = 4;
      requiresResponse = true;
    } else if (text.includes('unsubscribe') || text.includes('newsletter') || text.includes('promoción')) {
      category = 'Publicidad';
      priority = 1;
      requiresResponse = false;
    } else if (text.includes('?') || text.includes('podrías') || text.includes('favor confirmar')) {
      category = 'Requiere respuesta';
      priority = 3;
      requiresResponse = true;
    }

    const summary = email.bodyText
      ? email.bodyText.slice(0, 200).replace(/\s+/g, ' ').trim()
      : email.subject;

    return {
      category,
      priority,
      requiresResponse,
      summary,
      sentiment: priority >= 4 ? 'urgente' : 'neutral',
      model: `${model} (fallback)`,
      promptVersion: PROMPT_VERSION,
    };
  }
}

export const aiAnalyzer = new AiAnalyzer();
