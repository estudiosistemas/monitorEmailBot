import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function runSeed() {
  console.log('🌱 Inicializando usuarios por defecto en la base de datos...');

  const romina = await prisma.user.upsert({
    where: { email: 'romina@local.test' },
    update: {},
    create: {
      email: 'romina@local.test',
      name: 'Romina',
      active: true,
    },
  });
  console.log(`✅ Usuario configurado: ${romina.name} (ID: ${romina.id}, Email: ${romina.email})`);

  const mauricio = await prisma.user.upsert({
    where: { email: 'mauricio@local.test' },
    update: {},
    create: {
      email: 'mauricio@local.test',
      name: 'Mauricio',
      active: true,
    },
  });
  console.log(`✅ Usuario configurado: ${mauricio.name} (ID: ${mauricio.id}, Email: ${mauricio.email})`);

  console.log('🎉 Inicialización de usuarios finalizada con éxito.');
}

// Ejecución directa si se invoca con `node prisma/seed.js`
if (process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .catch((e) => {
      console.error('❌ Error en seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
