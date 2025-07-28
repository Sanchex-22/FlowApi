import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";


async function main() {
  // Ensure the PrismaClient instance is fresh each time main is called
  let prisma: PrismaClient | null = null; // Declare it outside try to ensure finally can access it

  try {
    prisma = new PrismaClient(); // Initialize here
    // Optional: Add a small delay if the above doesn't work, though it's usually not necessary
    // await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    const passwordHash = await bcrypt.hash('Lexus0110', 10); // Contraseña por defecto

    // --- Crear o verificar SUPER_ADMIN y su Persona asociada ---
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      include: { person: true }, // Incluir la relación con Person para verificar si existe
    });

    if (!existingSuperAdmin) {
      console.log('Creando usuario SUPER_ADMIN y su información de Persona...');

      const superAdminUser = await prisma.user.create({
        data: {
          username: 'superadmin',
          email: 'david@intermaritime.org',
          password: passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          person: {
            create: {
              firstName: 'David',
              lastName: 'Superadmin',
              fullName: 'David Superadmin',
              contactEmail: 'david@intermaritime.org',
              phoneNumber: '+1 234-567-8900',
              department: 'IT',
              position: 'Super Administrador de Sistema',
              status: 'Activo',
              userCode: 'USR000',
            },
          },
        },
        include: {
          person: true,
        },
      });

      console.log('Usuario SUPER_ADMIN creado con éxito:', superAdminUser.username);
      console.log('Persona asociada al SUPER_ADMIN creada con éxito:', superAdminUser.person?.fullName);
    } else {
      console.log('Ya existe un usuario SUPER_ADMIN con la siguiente información:');
      console.log('  Username:', existingSuperAdmin.username);
      console.log('  Email:', existingSuperAdmin.email);

      if (!existingSuperAdmin.person) {
        console.log('  Creando información de Persona para el SUPER_ADMIN existente...');
        try {
          const newPerson = await prisma.person.create({
            data: {
              userId: existingSuperAdmin.id,
              firstName: 'David',
              lastName: 'Superadmin',
              fullName: 'David Superadmin',
              contactEmail: 'david@intermaritime.org',
              phoneNumber: '+1 234-567-8900',
              department: 'IT',
              position: 'Super Administrador de Sistema',
              status: 'Activo',
              userCode: 'USR000',
            },
          });
          console.log('  Persona por defecto creada para el SUPER_ADMIN existente:', newPerson.fullName);
        } catch (personCreateError) {
          console.error('  Error al crear la Persona para el SUPER_ADMIN existente:', personCreateError);
        }
      } else {
        console.log('  Nombre de Persona:', existingSuperAdmin.person.fullName);
        console.log('  Estado de Persona:', existingSuperAdmin.person.status);
      }
    }

    // ... (rest of your seed logic)

  } finally {
    // Ensure disconnect is called, even if an error occurs
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  });