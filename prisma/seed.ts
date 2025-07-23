import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Lexus0110', 10); // Contraseña por defecto

  // Verificar si ya existe un SUPER_ADMIN
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (!existingSuperAdmin) {
    await prisma.user.create({
      data: {
        username: 'superadmin',
        email: 'david@intermaritime.org',
        password: passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    console.log('Usuario SUPER_ADMIN creado con éxito.');
  } else {
    console.log('Ya existe un usuario SUPER_ADMIN.');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
