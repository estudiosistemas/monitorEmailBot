import { telegramService } from '../src/notifications/telegram.js';
import { TELEGRAM_MAIN_KEYBOARD } from '../src/notifications/telegram-bot-listener.js';

async function main() {
  const msg = [
    '🤖 <b>PANEL DE CONTROL - BOT DE CORREOS</b>',
    '',
    '✨ ¡Se ha integrado la <b>Inteligencia Artificial de OpenRouter</b> con modelos gratuitos!',
    '🎮 Ahora puedes interactuar directamente conmigo utilizando el teclado de opciones de abajo o escribiendo comandos:',
    '',
    '• 🔄 <b>/sondeo</b> - Ejecuta un sondeo de tus cuentas ahora',
    '• 📬 <b>/ultimos</b> - Lee tus últimos correos analizados',
    '• 📧 <b>/cuentas</b> - Consulta tus cuentas vinculadas',
    '• 📊 <b>/resumen</b> - Estadísticas de correos de hoy',
    '',
    '<i>Prueba presionar cualquiera de los botones o escribe "lee los mails".</i>',
  ].join('\n');

  console.log('Enviando mensaje de prueba con teclado interactivo...');
  await telegramService.sendMessageWithRetry('1000785580', msg, TELEGRAM_MAIN_KEYBOARD);
  console.log('✅ Mensaje y teclado interactivo enviados con éxito.');
}

main().catch(console.error);
