import { env } from '../config/env.js';
import { accountService } from '../services/account-service.js';

const MS_AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_GRAPH_ME = 'https://graph.microsoft.com/v1.0/me';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Mail.Read',
  'Mail.ReadWrite',
].join(' ');

/**
 * Genera la URL de autorización para Microsoft OAuth 2.0
 */
export function getMicrosoftAuthUrl(userId: number): string {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_REDIRECT_URI) {
    throw new Error('MICROSOFT_CLIENT_ID y MICROSOFT_REDIRECT_URI deben estar configurados');
  }

  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: SCOPES,
    state: JSON.stringify({ userId }),
  });

  return `${MS_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Procesa el callback de Microsoft OAuth 2.0 y vincula la cuenta
 */
export async function handleMicrosoftCallback(code: string, stateStr: string) {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET || !env.MICROSOFT_REDIRECT_URI) {
    throw new Error('Configuración de Microsoft OAuth incompleta');
  }

  let state: { userId: number };
  try {
    state = JSON.parse(stateStr);
  } catch {
    throw new Error('Parámetro state inválido en Microsoft OAuth callback');
  }

  // 1. Intercambiar código por tokens
  const tokenResponse = await fetch(MS_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: env.MICROSOFT_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Error en token de Microsoft: ${errText}`);
  }

  const tokens = (await tokenResponse.json()) as any;

  // 2. Obtener datos del perfil con Microsoft Graph
  const meResponse = await fetch(MS_GRAPH_ME, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!meResponse.ok) {
    throw new Error('Error al consultar perfil en Microsoft Graph');
  }

  const profile = (await meResponse.json()) as any;
  const email = profile.mail || profile.userPrincipalName;
  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : undefined;

  // 3. Persistir cuenta
  const account = await accountService.upsertOAuthAccount(state.userId, {
    provider: 'outlook',
    email,
    displayName: profile.displayName || email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt,
  });

  return account;
}

/**
 * Refresca un token expirado de Microsoft
 */
export async function refreshMicrosoftToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new Error('Configuración de Microsoft OAuth incompleta');
  }

  const response = await fetch(MS_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al renovar token de Microsoft: ${errText}`);
  }

  const data = (await response.json()) as any;
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}
