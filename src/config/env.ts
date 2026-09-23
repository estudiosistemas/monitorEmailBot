import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3005),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('file:./data/mail-agent.db'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY debe tener al menos 32 caracteres (o 64 caracteres en formato hex)'),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Microsoft OAuth
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // OpenRouter (Modelo Free por defecto)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('openrouter/free'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // Sesión y poller
  SESSION_SECRET: z.string().default('default_session_secret_for_development_purposes'),
  POLL_INTERVAL_MINUTES: z.coerce.number().default(5),
  ENABLE_EMBEDDED_POLLER: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      return val.toLowerCase() === 'true' || val === '1';
    })
    .default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Error de validación de variables de entorno:');
  console.error(parsed.error.format());
  throw new Error('Configuración inválida en variables de entorno');
}

export const env = parsed.data;
