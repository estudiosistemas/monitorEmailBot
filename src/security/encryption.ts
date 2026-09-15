import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Deriva una clave de 32 bytes de forma determinista usando SHA-256
function getKey(): Buffer {
  return crypto.createHash('sha256').update(env.ENCRYPTION_KEY).digest();
}

/**
 * Cifra un texto plano utilizando AES-256-GCM
 * Formato de retorno: ivHex:authTagHex:encryptedHex
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Descifra un texto cifrado en formato ivHex:authTagHex:encryptedHex
 */
export function decrypt(encryptedPayload: string): string {
  if (!encryptedPayload) return encryptedPayload;

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de carga cifrada inválido. Se esperaba iv:authTag:content');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
