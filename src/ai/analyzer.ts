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
   * Prioriza OpenRouter (modelo free sin costo), luego OpenAI, y finalmente fallback heurístico.
   */
  async analyzeEmail(email: IncomingEmail): Promise<AnalysisResult> {
    const userContent = JSON.stringify({
      remitente: `${email.senderName || ''} <${email.senderEmail}>`,
      destinatarios: email.recipients,
      asunto: email.subject,
      fecha: email.receivedAt.toISOString(),
      cuerpo: email.bodyText.slice(0, 4000), // Limitar para evitar desbordamiento de contexto
    });

    // 1. Intentar con OpenRouter (modelo free)
    if (env.OPENROUTER_API_KEY) {
      try {
        const result = await this.callOpenRouter(userContent, email);
        if (result) return result;
      } catch (err: any) {
        console.error('⚠️ Error en análisis con OpenRouter:', err.message);
      }
    }

    // 2. Intentar con OpenAI si está configurado
    if (env.OPENAI_API_KEY) {
      try {
        const result = await this.callOpenAI(userContent, email);
        if (result) return result;
      } catch (err: any) {
        console.error('⚠️ Error en análisis con OpenAI:', err.message);
      }
    }

    // 3. Fallback heurístico inteligente
    const fallbackModel = env.OPENROUTER_API_KEY
      ? env.OPENROUTER_MODEL || 'openrouter/free'
      : env.OPENAI_MODEL || 'gpt-4o-mini';
    return this.heuristicFallback(email, fallbackModel);
  }

  /**
   * Ejecuta la llamada al endpoint de OpenRouter
   */
  private async callOpenRouter(userContent: string, email: IncomingEmail): Promise<AnalysisResult | null> {
    const model = env.OPENROUTER_MODEL || 'openrouter/free';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/estudiosistemas/monitorEmailBot',
        'X-Title': 'Mail Agent Bot',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Por favor analiza el siguiente correo no confiable y responde en JSON según las instrucciones:\n\n${userContent}`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    const choice = data.choices?.[0];
    const content = choice?.message?.content || choice?.text || choice?.message?.reasoning;
    if (!content || typeof content !== 'string') {
      throw new Error(`Respuesta vacía de OpenRouter: ${JSON.stringify(choice || data)}`);
    }

    const resolvedModel = data.model || model;
    return this.parseAndSanitize(content, email, resolvedModel);
  }

  /**
   * Ejecuta la llamada al endpoint de OpenAI
   */
  private async callOpenAI(userContent: string, email: IncomingEmail): Promise<AnalysisResult | null> {
    const model = env.OPENAI_MODEL || 'gpt-4o-mini';

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
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Respuesta vacía de OpenAI');
    }

    return this.parseAndSanitize(content, email, model);
  }

  /**
   * Extrae, parsea y valida el JSON devuelto por los modelos de IA
   */
  private parseAndSanitize(content: string, email: IncomingEmail, model: string): AnalysisResult {
    let rawJson = content.trim();

    // Si el modelo incluye delimitadores markdown tipo ```json ... ``` o razonamiento previo
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      rawJson = jsonMatch[0];
    }

    const parsed = JSON.parse(rawJson);
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
  }

  private validateCategory(cat: any): Category {
    if (typeof cat === 'string') {
      const trimmed = cat.trim();
      if (VALID_CATEGORIES.includes(trimmed as any)) {
        return trimmed as Category;
      }
      const lower = trimmed.toLowerCase();
      if (lower.includes('urgente') || lower.includes('critica') || lower.includes('crítica')) return 'Urgente';
      if (lower.includes('respuesta') || lower.includes('requiere')) return 'Requiere respuesta';
      if (lower.includes('factur') || lower.includes('finanza') || lower.includes('pago') || lower.includes('cobro')) return 'Facturación';
      if (lower.includes('publicidad') || lower.includes('promo') || lower.includes('newsletter') || lower.includes('marketing')) return 'Publicidad';
      if (lower.includes('spam') || lower.includes('junk')) return 'Spam';
      if (lower.includes('informativ') || lower.includes('notificac') || lower.includes('aviso')) return 'Informativo';
      if (lower.includes('personal')) return 'Personal';
      if (lower.includes('trabajo') || lower.includes('laboral') || lower.includes('proyecto')) return 'Trabajo';
    }
    return 'Otro';
  }

  /**
   * Analizador heurístico de respaldo cuando las APIs de IA no están disponibles
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
