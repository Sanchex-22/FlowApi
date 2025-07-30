import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Genera el próximo código de compañía secuencial (ej. CO001, CO002).
 * Busca el código numérico más alto entre las compañías existentes que comienzan con 'CO'
 * y lo incrementa.
 * @param prisma Instancia de PrismaClient.
 * @returns El próximo código de compañía disponible.
 */
export async function generateNextCompanyCode(prisma: PrismaClient): Promise<string> {
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
    orderBy: {
      code: 'desc', // Ordenar para encontrar el más alto más fácilmente
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

/**
 * Genera el próximo código de usuario secuencial (ej. USR001, USR002).
 * Busca el código numérico más alto entre los usuarios existentes que comienzan con 'USR'
 * y lo incrementa.
 * @param prisma Instancia de PrismaClient.
 * @returns El próximo código de usuario disponible.
 */
export async function generateNextUserCode(prisma: PrismaClient): Promise<string> {
  // Busca todas las personas con códigos de usuario que empiezan con 'USR'
  const persons = await prisma.person.findMany({
    where: {
      userCode: {
        startsWith: 'USR',
      },
    },
    select: {
      userCode: true,
    },
    orderBy: {
      userCode: 'desc', // Ordenar para encontrar el más alto más fácilmente
    },
  });

  let maxCodeNum = 0;
  // Itera sobre los códigos existentes para encontrar el número más alto
  for (const person of persons) {
    if (person.userCode) {
      // Extrae la parte numérica del código (ej. de 'USR001' obtiene '1')
      const numericPart = parseInt(person.userCode.replace('USR', ''), 10);
      // Si es un número válido y es mayor que el máximo actual, actualiza maxCodeNum
      if (!isNaN(numericPart) && numericPart > maxCodeNum) {
        maxCodeNum = numericPart;
      }
    }
  }

  // El próximo número de código es el máximo encontrado + 1
  const nextCodeNum = maxCodeNum + 1;
  // Formatea el número con ceros a la izquierda (ej. 1 -> '001', 12 -> '012')
  return `USR${String(nextCodeNum).padStart(3, '0')}`;
}


async function main() {
  let prisma: PrismaClient | null = null;

  try {
    prisma = new PrismaClient();

    const passwordHash = await bcrypt.hash('Lexus0110', 10); // Contraseña por defecto

    const superAdminEmail = 'david@intermaritime.org';
    const superAdminUsername = 'superadmin';
    const defaultPersonFullName = 'Carlos Sanchez'; // Usado para buscar la persona

    // --- 1. Manejo de la primera compañía ---
    const company1Name = 'Intermaritime Solutions S.A.';
    let company1ToAssign;

    // Buscar la compañía por su nombre (campo único)
    let existingCompany1 = await prisma.company.findUnique({
      where: { name: company1Name },
    });

    if (!existingCompany1) {
      // Si la compañía no existe, generamos un nuevo código y la creamos
      const nextCode = await generateNextCompanyCode(prisma);
      console.log(`Creando la primera compañía '${company1Name}' con código '${nextCode}'...`);
      company1ToAssign = await prisma.company.create({
        data: {
          name: company1Name,
          code: nextCode,
          address: 'Calle 50, Ciudad de Panamá, Panamá',
          phone: '+507 263-1234',
          email: 'info@intermaritime.org',
          isActive: true,
          // createdBy se conectará más tarde si el superAdminUser existe
        },
      });
      console.log(`Compañía '${company1ToAssign.name}' creada con éxito.`);
    } else {
      // Si la compañía ya existe, la usamos
      company1ToAssign = existingCompany1;
      console.log(`La compañía '${company1Name}' ya existe con código '${company1ToAssign.code}'.`);

      // Si el código de la compañía existente es nulo o diferente al siguiente generado (por si se borró o cambió)
      // Esto es opcional y depende de si quieres "arreglar" códigos nulos/incorrectos en existentes.
      if (!company1ToAssign.code) {
        const nextCode = await generateNextNextCompanyCode(prisma); // Genera el siguiente código disponible
        console.log(`Actualizando código para '${company1ToAssign.name}' a '${nextCode}'.`);
        company1ToAssign = await prisma.company.update({
          where: { id: company1ToAssign.id },
          data: { code: nextCode },
        });
      }
    }

    // --- 2. Crear o verificar el departamento por defecto para la primera compañía ---
    let defaultDepartment;
    if (company1ToAssign) {
      const defaultDepartmentName = 'IT';
      defaultDepartment = await prisma.department.findFirst({
        where: {
          name: defaultDepartmentName,
          companyId: company1ToAssign.id,
        },
      });

      if (!defaultDepartment) {
        console.log(`Creando el departamento '${defaultDepartmentName}' para la compañía '${company1ToAssign.name}'...`);
        defaultDepartment = await prisma.department.create({
          data: {
            name: defaultDepartmentName,
            description: 'Departamento de Tecnologías de la Información',
            companyId: company1ToAssign.id,
          },
        });
        console.log(`Departamento '${defaultDepartment.name}' creado con éxito.`);
      } else {
        console.log(`El departamento '${defaultDepartmentName}' ya existe para la compañía '${company1ToAssign.name}'.`);
      }
    }

    // --- 3. Crear o verificar SUPER_ADMIN y su Persona asociada ---
    let superAdminUser = await prisma.user.findUnique({
      where: { email: superAdminEmail }, // Buscar por email, que es único
      include: { person: true },
    });

    let personToConnectId: string | undefined = undefined; // Para almacenar el ID de la persona

    if (!superAdminUser) {
      console.log('Creando usuario SUPER_ADMIN y su información de Persona...');
      const nextUserCode = await generateNextUserCode(prisma); // Generar código solo si el usuario es nuevo

      superAdminUser = await prisma.user.create({
        data: {
          username: superAdminUsername,
          email: superAdminEmail,
          password: passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          company: company1ToAssign ? { connect: { id: company1ToAssign.id } } : undefined,
          person: {
            create: {
              firstName: 'Carlos',
              lastName: 'Sanchez',
              fullName: defaultPersonFullName,
              contactEmail: superAdminEmail,
              phoneNumber: '+1 234-567-8900',
              position: 'Super Administrador de Sistema',
              status: 'Activo',
              userCode: nextUserCode, // Usar el código generado para el nuevo usuario
              department: defaultDepartment ? { connect: { id: defaultDepartment.id } } : undefined,
            },
          },
        },
        include: {
          person: true,
        },
      });
      personToConnectId = superAdminUser.person?.id; // Captura el ID de la persona recién creada
      console.log('Usuario SUPER_ADMIN creado con éxito:', superAdminUser.username);
      console.log('Persona asociada al SUPER_ADMIN creada con éxito:', superAdminUser.person?.fullName);
      console.log('UserCode asignado:', superAdminUser.person?.userCode);
      console.log('Departamento de Persona asignado:', superAdminUser.person?.departmentId ? defaultDepartment?.name : 'Ninguno');

    } else {
      console.log('Ya existe un usuario SUPER_ADMIN con la siguiente información:');
      console.log('   Username:', superAdminUser.username);
      console.log('   Email:', superAdminUser.email);

      // Si el usuario existe, pero no tiene persona asociada, la creamos
      if (!superAdminUser.person) {
        console.log('   Creando información de Persona para el SUPER_ADMIN existente...');
        const nextUserCode = await generateNextUserCode(prisma); // Generar un código si la persona no existe
        try {
          const newPerson = await prisma.person.create({
            data: {
              userId: superAdminUser.id,
              firstName: 'Carlos',
              lastName: 'Sanchez',
              fullName: defaultPersonFullName,
              contactEmail: superAdminEmail,
              phoneNumber: '+1 234-567-8900',
              position: 'Super Administrador de Sistema',
              status: 'Activo',
              userCode: nextUserCode, // Usar el código generado
              departmentId: defaultDepartment?.id,
            },
          });
          personToConnectId = newPerson.id;
          console.log('   Persona por defecto creada para el SUPER_ADMIN existente:', newPerson.fullName);
          console.log('   UserCode asignado:', newPerson.userCode);
          console.log('   Departamento de Persona asignado:', newPerson.departmentId ? defaultDepartment?.name : 'Ninguno');
          superAdminUser.person = newPerson; // Actualiza el objeto en memoria
        } catch (personCreateError: any) {
          if (personCreateError.code === 'P2002' && personCreateError.meta?.target?.includes('userCode')) {
            console.warn('   Advertencia: El userCode generado ya existe al crear la persona. Esto no debería pasar si generateNextUserCode funciona correctamente. Intentando actualizar si es necesario.');
            // Si el userCode ya existe, intenta actualizar la persona existente con un nuevo userCode
            try {
              const updatedPerson = await prisma.person.update({
                where: { userId: superAdminUser.id },
                data: { userCode: await generateNextUserCode(prisma) }, // Generar un nuevo código si hay conflicto
              });
              console.log('   UserCode actualizado para el SUPER_ADMIN existente:', updatedPerson.userCode);
              superAdminUser.person = updatedPerson;
              personToConnectId = updatedPerson.id;
            } catch (updateError) {
              console.error('   Error al actualizar el userCode para el SUPER_ADMIN existente:', updateError);
            }
          } else {
            console.error('   Error al crear la Persona para el SUPER_ADMIN existente:', personCreateError);
          }
        }
      } else {
        personToConnectId = superAdminUser.person.id; // Captura el ID de la persona existente
        console.log('   Nombre de Persona:', superAdminUser.person.fullName);
        console.log('   Estado de Persona:', superAdminUser.person.status);
        console.log('   UserCode actual:', superAdminUser.person.userCode);
        console.log('   Departamento actual:', superAdminUser.person.departmentId ? defaultDepartment?.name : 'Ninguno');

        // Actualizar userCode si es nulo o diferente al esperado (solo si quieres forzar un formato específico)
        if (!superAdminUser.person.userCode) { // Si no tiene userCode asignado
            const newCode = await generateNextUserCode(prisma);
            console.log(`   Asignando userCode a la Persona del SUPER_ADMIN: '${newCode}'`);
            await prisma.person.update({
                where: { id: superAdminUser.person.id },
                data: { userCode: newCode },
            });
        }
        // Si el departamento de la persona no es el departamento por defecto, o no tiene uno, actualízalo
        if (defaultDepartment && superAdminUser.person.departmentId !== defaultDepartment.id) {
          console.log(`   Asignando el departamento '${defaultDepartment.name}' a la Persona del SUPER_ADMIN.`);
          try {
            const updatedPerson = await prisma.person.update({
              where: { userId: superAdminUser.id },
              data: { departmentId: defaultDepartment.id },
            });
            console.log('   Departamento de Persona actualizado con éxito.');
            superAdminUser.person = updatedPerson;
          } catch (updateError) {
            console.error('   Error al asignar el departamento a la Persona del SUPER_ADMIN:', updateError);
          }
        }
      }

      // Asegurar que el SUPER_ADMIN esté asignado a la primera compañía si no lo está
      if (company1ToAssign && superAdminUser.companyId !== company1ToAssign.id) {
        console.log(`Asignando la compañía '${company1ToAssign.name}' al usuario SUPER_ADMIN...`);
        superAdminUser = await prisma.user.update({
          where: { id: superAdminUser.id },
          data: { companyId: company1ToAssign.id },
          include: { person: true }, // Incluir persona para la siguiente lógica
        });
        console.log(`Compañía '${company1ToAssign.name}' asignada al usuario SUPER_ADMIN con éxito.`);
      } else if (company1ToAssign) {
        console.log(`El usuario SUPER_ADMIN ya está asignado a la compañía '${company1ToAssign.name}'.`);
      }
    }

    // --- 4. Manejo de la segunda compañía ---
    const company2Name = 'Global Logistics Corp.';
    let existingCompany2 = await prisma.company.findUnique({
      where: { name: company2Name },
    });

    if (!existingCompany2) {
      const nextCode = await generateNextCompanyCode(prisma);
      console.log(`Creando la segunda compañía '${company2Name}' con código '${nextCode}'...`);
      await prisma.company.create({
        data: {
          name: company2Name,
          code: nextCode,
          address: 'Avenida Balboa, Ciudad de Panamá, Panamá',
          phone: '+507 390-5678',
          email: 'info@globallogistics.com',
          isActive: true,
          createdBy: superAdminUser ? { connect: { id: superAdminUser.id } } : undefined,
        },
      });
      console.log(`Compañía '${company2Name}' creada con éxito.`);
    } else {
      console.log(`La compañía '${company2Name}' ya existe con código '${existingCompany2.code}'.`);
      // Si el código de la compañía existente es nulo o diferente al siguiente generado (opcional)
      if (!existingCompany2.code) {
        const nextCode = await generateNextCompanyCode(prisma);
        console.log(`Actualizando código para '${existingCompany2.name}' a '${nextCode}'.`);
        await prisma.company.update({
          where: { id: existingCompany2.id },
          data: { code: nextCode },
        });
      }
      if (superAdminUser && existingCompany2.createdByUserId !== superAdminUser.id) {
        console.log(`Actualizando la compañía '${company2Name}' para asociarla al SUPER_ADMIN como creador.`);
        await prisma.company.update({
          where: { id: existingCompany2.id },
          data: { createdByUserId: superAdminUser.id },
        });
      }
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

// Helper function to generate next code if needed for existing entities
// This is a simplified version of generateNextCompanyCode, just for clarity in update scenarios
async function generateNextNextCompanyCode(prisma: PrismaClient): Promise<string> {
    const lastCompany = await prisma.company.findFirst({
        orderBy: { code: 'desc' },
        where: { code: { startsWith: 'CO' } },
        select: { code: true }
    });
    let maxNum = 0;
    if (lastCompany?.code) {
        const num = parseInt(lastCompany.code.replace('CO', ''), 10);
        if (!isNaN(num)) maxNum = num;
    }
    return `CO${String(maxNum + 1).padStart(3, '0')}`;
}