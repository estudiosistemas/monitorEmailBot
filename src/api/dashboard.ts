import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../database/prisma.js';
import { env } from '../config/env.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    return reply.redirect('/dashboard');
  });

  app.get('/dashboard', async (_request, reply) => {
    // Obtener usuarios con sus cuentas y últimos emails
    const users = await prisma.user.findMany({
      where: { active: true },
      include: {
        emailAccounts: {
          include: {
            emails: {
              take: 5,
              orderBy: { receivedAt: 'desc' },
              include: { analysis: true },
            },
          },
        },
        telegramDestinations: {
          where: { active: true },
        },
      },
      orderBy: { id: 'asc' },
    });

    const totalAccounts = users.reduce((acc, u) => acc + u.emailAccounts.length, 0);
    const totalEmails = await prisma.email.count();
    const totalNotifications = await prisma.notification.count({ where: { status: 'sent' } });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mail Agent — Monitor Inteligente de Correos</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(23, 32, 54, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 2rem; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; }
    
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
    h1 { font-size: 1.75rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
    .status-badge { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 500; background: rgba(16, 185, 129, 0.15); color: var(--success); }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success); }

    .btn-poll { background: var(--primary); color: #fff; border: none; padding: 0.6rem 1.25rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 0.5rem; }
    .btn-poll:hover { background: var(--primary-hover); transform: translateY(-1px); }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; backdrop-filter: blur(10px); }
    .stat-val { font-size: 2rem; font-weight: 700; margin-top: 0.25rem; }
    .stat-label { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    .users-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 1.5rem; }
    .user-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    .user-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
    .user-name { font-size: 1.25rem; font-weight: 600; }
    .telegram-info { font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; }

    .accounts-list { margin-bottom: 1.25rem; }
    .section-title { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em; }
    
    .account-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid rgba(255,255,255,0.04); }
    .account-email { font-weight: 500; display: flex; align-items: center; gap: 0.5rem; }
    .sync-ok { color: var(--success); font-size: 0.8rem; display: flex; align-items: center; gap: 0.3rem; }
    .sync-err { color: var(--danger); font-size: 0.8rem; display: flex; align-items: center; gap: 0.3rem; }

    .emails-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .email-item { padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 10px; border-left: 3px solid var(--primary); }
    .email-item.priority-5 { border-left-color: var(--danger); }
    .email-item.priority-4 { border-left-color: #f97316; }
    .email-item.priority-3 { border-left-color: var(--warning); }
    
    .email-top { display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.85rem; }
    .email-subject { font-weight: 600; margin-bottom: 0.35rem; font-size: 0.95rem; }
    .email-summary { font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; }
    .badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; background: rgba(255,255,255,0.1); }
    
    .btn-test-telegram {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #60a5fa;
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-test-telegram:hover {
      background: rgba(59, 130, 246, 0.3);
      color: #fff;
      border-color: #3b82f6;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>📬 Mail Agent <span class="status-badge"><span class="pulse"></span> Activo</span></h1>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">Monitoreo de Correos con IA y Notificaciones Telegram</p>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="text-align: right; font-size: 0.8rem; color: var(--text-muted);">
          <div>Sondeo automático: <span style="font-weight: 600; color: ${env.ENABLE_EMBEDDED_POLLER ? 'var(--success)' : 'var(--warning)'};">${env.ENABLE_EMBEDDED_POLLER ? `🟢 Activo (${env.POLL_INTERVAL_MINUTES} min)` : '⚠️ Inactivo'}</span></div>
        </div>
        <button class="btn-poll" onclick="triggerPoll()">⚡ Forzar Sondeo</button>
      </div>
    </header>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Usuarios</div>
        <div class="stat-val">${users.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cuentas Conectadas</div>
        <div class="stat-val">${totalAccounts}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Correos Analizados</div>
        <div class="stat-val">${totalEmails}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Notificaciones Enviadas</div>
        <div class="stat-val">${totalNotifications}</div>
      </div>
    </div>

    <div class="users-grid">
      ${users
        .map(
          (user) => `
        <div class="user-card">
          <div class="user-header">
            <div>
              <div class="user-name">${user.name}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">${user.email}</div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem;">
              <div class="telegram-info">
                ✈️ ${
                  user.telegramDestinations[0]
                    ? `Chat ID: <code>${user.telegramDestinations[0].chatId}</code>`
                    : '<span style="color: var(--warning)">Sin Telegram</span>'
                }
              </div>
              ${
                user.telegramDestinations[0]
                  ? `<button class="btn-test-telegram" onclick="testTelegram(${user.id}, '${user.name}', this)">📲 Probar Telegram</button>`
                  : ''
              }
            </div>
          </div>

          <div class="accounts-list">
            <div class="section-title">Cuentas de Correo (${user.emailAccounts.length})</div>
            ${
              user.emailAccounts.length === 0
                ? '<div style="color: var(--text-muted); font-size: 0.85rem;">No hay cuentas conectadas</div>'
                : user.emailAccounts
                    .map(
                      (acc) => `
              <div class="account-item">
                <div class="account-email">
                  <span>${acc.provider === 'gmail' ? '🔴' : acc.provider === 'outlook' ? '🔵' : '⚪'}</span>
                  <div>
                    <div>${acc.email}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${acc.provider.toUpperCase()}</div>
                  </div>
                </div>
                <div>
                  ${
                    acc.lastSyncError
                      ? `<div class="sync-err">⚠️ Error: ${acc.lastSyncError.slice(0, 25)}</div>`
                      : `<div class="sync-ok">🟢 ${acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleTimeString() : 'Pendiente'}</div>`
                  }
                </div>
              </div>
            `
                    )
                    .join('')
            }
          </div>

          <div>
            <div class="section-title">Correos Recientes</div>
            <div class="emails-list">
              ${
                user.emailAccounts.flatMap((a) => a.emails).length === 0
                  ? '<div style="color: var(--text-muted); font-size: 0.85rem;">Aún no se han recibido correos</div>'
                  : user.emailAccounts
                      .flatMap((a) => a.emails)
                      .slice(0, 4)
                      .map(
                        (em) => `
                <div class="email-item priority-${em.analysis?.priority || 3}">
                  <div class="email-top">
                    <span>${em.senderName || em.senderEmail}</span>
                    <span class="badge">${em.analysis?.category || 'General'} (P${em.analysis?.priority || 3})</span>
                  </div>
                  <div class="email-subject">${em.subject}</div>
                  <div class="email-summary">${em.analysis?.summary || em.bodyText.slice(0, 100)}</div>
                </div>
              `
                      )
                      .join('')
              }
            </div>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>

  <script>
    async function triggerPoll() {
      const btn = document.querySelector('.btn-poll');
      btn.innerText = '⏳ Sondeando...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/poll', { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        alert('Error forzando sondeo: ' + err.message);
      } finally {
        btn.innerText = '⚡ Forzar Sondeo';
        btn.disabled = false;
      }
    }

    async function testTelegram(userId, userName, btn) {
      const originalText = btn.innerText;
      btn.innerText = '⏳ Enviando...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/telegram/test?userId=' + userId, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          alert('✅ ' + data.message);
        } else {
          alert('❌ ' + (data.error || 'No se pudo enviar el mensaje'));
        }
      } catch (err) {
        alert('❌ Error de conexión: ' + err.message);
      } finally {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;

    return reply.type('text/html').send(html);
  });
};
