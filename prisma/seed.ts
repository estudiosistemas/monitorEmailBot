import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de usuarios...');

  const romina = await prisma.user.upsert({
    where: { email: 'romina@local.test' },
    update: { name: 'Romina', active: true },
    create: {
      email: 'romina@local.test',
      name: 'Romina',
      active: true,
    },
  });
  console.log(`✅ Usuario configurado: ${romina.name} (ID: ${romina.id}, Email: ${romina.email})`);

  const mauricio = await prisma.user.upsert({
    where: { email: 'mauricio@local.test' },
    update: { name: 'Mauricio', active: true },
    create: {
      email: 'mauricio@local.test',
      name: 'Mauricio',
      active: true,
    },
  });
  console.log(`✅ Usuario configurado: ${mauricio.name} (ID: ${mauricio.id}, Email: ${mauricio.email})`);

  console.log('🎉 Seed finalizado correctamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
