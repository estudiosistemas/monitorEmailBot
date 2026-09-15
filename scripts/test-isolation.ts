import { PrismaClient } from '@prisma/client';
import { assertAccountOwnership, assertEmailOwnership, IsolationError } from '../src/security/isolation.js';

const prisma = new PrismaClient();

async function runIsolationTests() {
  console.log('🧪 === INICIANDO PRUEBAS DE AISLAMIENTO (SECCIÓN 56 DEL PLAN) ===\n');

  try {
    // 1. Asegurar usuarios de prueba
    const romina = await prisma.user.upsert({
      where: { email: 'romina.test@isolation.local' },
      update: {},
      create: { name: 'Romina Test', email: 'romina.test@isolation.local' },
    });

    const mauricio = await prisma.user.upsert({
      where: { email: 'mauricio.test@isolation.local' },
      update: {},
      create: { name: 'Mauricio Test', email: 'mauricio.test@isolation.local' },
    });

    // 2. Crear una cuenta para Romina y una para Mauricio
    const cuentaRomina = await prisma.emailAccount.create({
      data: {
        userId: romina.id,
        provider: 'gmail',
        email: 'romina@empresa.com',
      },
    });

    const cuentaMauricio = await prisma.emailAccount.create({
      data: {
        userId: mauricio.id,
        provider: 'outlook',
        email: 'mauricio@empresa.com',
      },
    });

    // 3. Crear un email para la cuenta de Romina
    const emailRomina = await prisma.email.create({
      data: {
        accountId: cuentaRomina.id,
        providerMessageId: `msg_${Date.now()}_romina`,
        senderEmail: 'proveedor@externo.com',
        subject: 'Factura para Romina',
        bodyText: 'Contenido privado de Romina',
        receivedAt: new Date(),
      },
    });

    console.log('✅ Entorno de prueba preparado exitosamente.');

    // PRUEBA 1: Romina accede a su propia cuenta -> OK
    console.log('Test 1: Romina accede a su propia cuenta...');
    const acc1 = await assertAccountOwnership(cuentaRomina.id, romina.id);
    if (acc1.id === cuentaRomina.id) {
      console.log('  -> PASS: Romina accedió correctamente a su cuenta.');
    }

    // PRUEBA 2: Mauricio intenta acceder a la cuenta de Romina -> DEBE FALLAR
    console.log('Test 2: Mauricio intenta acceder a la cuenta de Romina...');
    try {
      await assertAccountOwnership(cuentaRomina.id, mauricio.id);
      console.error('  -> FAIL: Mauricio no debió tener acceso a la cuenta de Romina!');
      process.exit(1);
    } catch (err) {
      if (err instanceof IsolationError) {
        console.log('  -> PASS: Acceso denegado correctamente (IsolationError).');
      } else {
        throw err;
      }
    }

    // PRUEBA 3: Romina accede a su propio email -> OK
    console.log('Test 3: Romina accede a su propio email...');
    const mail1 = await assertEmailOwnership(emailRomina.id, romina.id);
    if (mail1.id === emailRomina.id) {
      console.log('  -> PASS: Romina accedió correctamente a su email.');
    }

    // PRUEBA 4: Mauricio intenta acceder al email de Romina -> DEBE FALLAR
    console.log('Test 4: Mauricio intenta acceder al email de Romina...');
    try {
      await assertEmailOwnership(emailRomina.id, mauricio.id);
      console.error('  -> FAIL: Mauricio no debió tener acceso al email de Romina!');
      process.exit(1);
    } catch (err) {
      if (err instanceof IsolationError) {
        console.log('  -> PASS: Acceso denegado correctamente (IsolationError).');
      } else {
        throw err;
      }
    }

    // Limpieza de datos de prueba
    await prisma.email.delete({ where: { id: emailRomina.id } });
    await prisma.emailAccount.delete({ where: { id: cuentaRomina.id } });
    await prisma.emailAccount.delete({ where: { id: cuentaMauricio.id } });
    await prisma.user.delete({ where: { id: romina.id } });
    await prisma.user.delete({ where: { id: mauricio.id } });

    console.log('\n🎉 TODAS LAS PRUEBAS DE AISLAMIENTO PASARON SATISFACTORIAMENTE.');
  } catch (error) {
    console.error('❌ Error ejecutando pruebas de aislamiento:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runIsolationTests();
