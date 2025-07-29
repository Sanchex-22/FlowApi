import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Genera el próximo código de compañía secuencial (ej. CO001, CO002).
 * Busca el código numérico más alto entre las compañías existentes que comienzan con 'CO'
 * y lo incrementa.
 * @param prisma Instancia de PrismaClient.
 * @returns El próximo código de compañía disponible.
 */
async function generateNextCompanyCode(prisma: PrismaClient): Promise<string> {
  // Busca todas las compañías con códigos que empiezan con 'CO'
  const companies = await prisma.company.findMany({
    where: {
      code: {
        startsWith: 'CO',
      },
    },
    select: {
      code: true,
    },
  });

  let maxCodeNum = 0;
  // Itera sobre los códigos existentes para encontrar el número más alto
  for (const company of companies) {
    if (company.code) {
      // Extrae la parte numérica del código (ej. de 'CO001' obtiene '1')
      const numericPart = parseInt(company.code.replace('CO', ''), 10);
      // Si es un número válido y es mayor que el máximo actual, actualiza maxCodeNum
      if (!isNaN(numericPart) && numericPart > maxCodeNum) {
        maxCodeNum = numericPart;
      }
    }
  }

  // El próximo número de código es el máximo encontrado + 1
  const nextCodeNum = maxCodeNum + 1;
  // Formatea el número con ceros a la izquierda (ej. 1 -> '001', 12 -> '012')
  return `CO${String(nextCodeNum).padStart(3, '0')}`;
}

async function main() {
  let prisma: PrismaClient | null = null;

  try {
    prisma = new PrismaClient();

    const passwordHash = await bcrypt.hash('Lexus0110', 10); // Contraseña por defecto

    // --- Crear o verificar SUPER_ADMIN y su Persona asociada ---
    let superAdminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      include: { person: true },
    });

    if (!superAdminUser) {
      console.log('Creando usuario SUPER_ADMIN y su información de Persona...');

      superAdminUser = await prisma.user.create({
        data: {
          username: 'superadmin',
          email: 'david@intermaritime.org',
          password: passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          person: {
            create: {
              firstName: 'Carlos',
              lastName: 'Sanchez',
              fullName: 'Carlos Sanchez',
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
      console.log('   Username:', superAdminUser.username);
      console.log('   Email:', superAdminUser.email);

      if (!superAdminUser.person) {
        console.log('   Creando información de Persona para el SUPER_ADMIN existente...');
        try {
          const newPerson = await prisma.person.create({
            data: {
              userId: superAdminUser.id,
              firstName: 'Carlos',
              lastName: 'Sanchez',
              fullName: 'Carlos Sanchez',
              contactEmail: 'david@intermaritime.org',
              phoneNumber: '+1 234-567-8900',
              department: 'IT',
              position: 'Super Administrador de Sistema',
              status: 'Activo',
              userCode: 'USR000',
            },
          });
          console.log('   Persona por defecto creada para el SUPER_ADMIN existente:', newPerson.fullName);
          // Actualiza el objeto superAdminUser para incluir la persona recién creada
          superAdminUser.person = newPerson;
        } catch (personCreateError) {
          console.error('   Error al crear la Persona para el SUPER_ADMIN existente:', personCreateError);
        }
      } else {
        console.log('   Nombre de Persona:', superAdminUser.person.fullName);
        console.log('   Estado de Persona:', superAdminUser.person.status);
      }
    }

    // --- Crear o verificar dos Compañías asociadas al SUPER_ADMIN ---
    if (superAdminUser) {
      const company1Name = 'Intermaritime Solutions S.A.';
      const company2Name = 'Global Logistics Corp.';
      let company1ToAssign;

      // --- Manejo de la primera compañía ---
      const nextCodeForCompany1 = await generateNextCompanyCode(prisma);
      let existingCompany1 = await prisma.company.findFirst({
        where: { OR: [{ name: company1Name }, { code: nextCodeForCompany1 }] },
      });

      if (!existingCompany1) {
        console.log(`Creando la primera compañía '${company1Name}' con código '${nextCodeForCompany1}'...`);
        const newCompany = await prisma.company.create({
          data: {
            name: company1Name,
            code: nextCodeForCompany1,
            address: 'Calle 50, Ciudad de Panamá, Panamá',
            phone: '+507 263-1234',
            email: 'info@intermaritime.org',
            isActive: true,
            createdBy: {
              connect: { id: superAdminUser.id },
            },
          },
        });
        console.log(`Compañía '${newCompany.name}' creada con éxito por el SUPER_ADMIN.`);
        company1ToAssign = newCompany;
      } else {
        console.log(`La compañía '${company1Name}' o el código '${existingCompany1.code}' ya existe.`);
        if (existingCompany1.createdByUserId !== superAdminUser.id) {
          console.log(`Actualizando la compañía '${company1Name}' para asociarla al SUPER_ADMIN como creador.`);
          await prisma.company.update({
            where: { id: existingCompany1.id },
            data: { createdByUserId: superAdminUser.id },
          });
        }
        if (!existingCompany1.code) {
          console.log(`Actualizando la compañía '${company1Name}' para asignarle el código '${nextCodeForCompany1}'.`);
          await prisma.company.update({
            where: { id: existingCompany1.id },
            data: { code: nextCodeForCompany1 },
          });
          company1ToAssign = { ...existingCompany1, code: nextCodeForCompany1 };
        } else {
          company1ToAssign = existingCompany1;
        }
      }

      // --- Asignar la PRIMERA compañía al usuario SUPER_ADMIN ---
      if (company1ToAssign && superAdminUser.companyId !== company1ToAssign.id) {
        console.log(`Asignando la compañía '${company1ToAssign.name}' al usuario SUPER_ADMIN...`);
        await prisma.user.update({
          where: { id: superAdminUser.id },
          data: { companyId: company1ToAssign.id },
        });
        console.log(`Compañía '${company1ToAssign.name}' asignada al usuario SUPER_ADMIN con éxito.`);
      } else if (company1ToAssign) {
        console.log(`El usuario SUPER_ADMIN ya está asignado a la compañía '${company1ToAssign.name}'.`);
      }

      // --- Manejo de la segunda compañía ---
      const nextCodeForCompany2 = await generateNextCompanyCode(prisma); // Genera el siguiente código disponible
      let existingCompany2 = await prisma.company.findFirst({
        where: { OR: [{ name: company2Name }, { code: nextCodeForCompany2 }] },
      });

      if (!existingCompany2) {
        console.log(`Creando la segunda compañía '${company2Name}' con código '${nextCodeForCompany2}'...`);
        const newCompany = await prisma.company.create({
          data: {
            name: company2Name,
            code: nextCodeForCompany2,
            address: 'Avenida Balboa, Ciudad de Panamá, Panamá',
            phone: '+507 390-5678',
            email: 'info@globallogistics.com',
            isActive: true,
            createdBy: {
              connect: { id: superAdminUser.id },
            },
          },
        });
        console.log(`Compañía '${newCompany.name}' creada con éxito por el SUPER_ADMIN.`);
      } else {
        console.log(`La compañía '${company2Name}' o el código '${existingCompany2.code}' ya existe.`);
        if (existingCompany2.createdByUserId !== superAdminUser.id) {
          console.log(`Actualizando la compañía '${company2Name}' para asociarla al SUPER_ADMIN como creador.`);
          await prisma.company.update({
            where: { id: existingCompany2.id },
            data: { createdByUserId: superAdminUser.id },
          });
        }
        if (!existingCompany2.code) {
          console.log(`Actualizando la compañía '${company2Name}' para asignarle el código '${nextCodeForCompany2}'.`);
          await prisma.company.update({
            where: { id: existingCompany2.id },
            data: { code: nextCodeForCompany2 },
          });
        }
      }

    } else {
      console.warn('No se encontró ni se creó un usuario SUPER_ADMIN, no se pudieron crear ni asignar las compañías.');
    }

  } finally {
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
