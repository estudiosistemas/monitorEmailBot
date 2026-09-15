import { env } from '../config/env.js';
import { accountService } from '../services/account-service.js';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ');

/**
 * Genera la URL de autorización para Google OAuth
 */
export function getGoogleAuthUrl(userId: number): string {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    throw new Error('GOOGLE_CLIENT_ID y GOOGLE_REDIRECT_URI deben estar configurados');
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline', // Necesario para recibir refresh_token
    prompt: 'consent',
    state: JSON.stringify({ userId }),
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Intercambia el código de autorización por tokens y asocia la cuenta al usuario
 */
export async function handleGoogleCallback(code: string, stateStr: string) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error('Configuración de Google OAuth incompleta');
  }

  let state: { userId: number };
  try {
    state = JSON.parse(stateStr);
  } catch {
    throw new Error('Parámetro state inválido en Google OAuth callback');
  }

  // 1. Intercambiar code por tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Error obteniendo token de Google: ${errText}`);
  }

  const tokens = (await tokenResponse.json()) as any;

  // 2. Obtener el perfil del usuario de Google (email y nombre)
  const profileResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileResponse.ok) {
    throw new Error('Error al obtener perfil de Google');
  }

  const profile = (await profileResponse.json()) as any;
  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : undefined;

  // 3. Crear o actualizar la cuenta asociada al usuario autenticado
  const account = await accountService.upsertOAuthAccount(state.userId, {
    provider: 'gmail',
    email: profile.email,
    displayName: profile.name || profile.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt,
  });

  return account;
}

/**
 * Refresca un access token expirado usando el refresh token
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Configuración de Google OAuth incompleta');
  }

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al refrescar token de Google: ${errText}`);
  }

  const data = (await response.json()) as any;
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}
