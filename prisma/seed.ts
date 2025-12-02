// prisma/seed.ts
import 'dotenv/config'
import { hash } from 'bcryptjs'
import prisma from '../lib/prisma'

/**
 * Genera el próximo código de compañía secuencial (ej. CO001, CO002).
 */
async function generateNextCompanyCode(): Promise<string> {
  const companies = await prisma.company.findMany({
    where: { code: { startsWith: 'CO' } },
    select: { code: true },
    orderBy: { code: 'desc' },
  })

  let maxCodeNum = 0
  for (const company of companies) {
    if (company.code) {
      const numericPart = parseInt(company.code.replace('CO', ''), 10)
      if (!isNaN(numericPart) && numericPart > maxCodeNum) {
        maxCodeNum = numericPart
      }
    }
  }

  const nextCodeNum = maxCodeNum + 1
  return `CO${String(nextCodeNum).padStart(3, '0')}`
}

/**
 * Genera el próximo código de usuario secuencial (ej. USR001, USR002).
 */
export async function generateNextUserCode(): Promise<string> {
  const persons = await prisma.person.findMany({
    where: { userCode: { startsWith: 'USR' } },
    select: { userCode: true },
    orderBy: { userCode: 'desc' },
  })

  let maxCodeNum = 0
  for (const person of persons) {
    if (person.userCode) {
      const numericPart = parseInt(person.userCode.replace('USR', ''), 10)
      if (!isNaN(numericPart) && numericPart > maxCodeNum) {
        maxCodeNum = numericPart
      }
    }
  }

  const nextCodeNum = maxCodeNum + 1
  return `USR${String(nextCodeNum).padStart(3, '0')}`
}

async function main() {
  console.log('🚀 Iniciando seed...')

  try {
    const passwordHash = await hash('Lexus0110', 10)
    const superAdminEmail = 'david@intermaritime.org'
    const superAdminUsername = 'superadmin'
    const defaultPersonFullName = 'Carlos Sanchez'

    // --- 1. CREAR/ACTUALIZAR PRIMERA COMPAÑÍA (Intermaritime) ---
    console.log('\n📊 Creando/actualizando compañías...')
    const company1Name = 'Intermaritime'
    let company1ToAssign = await prisma.company.findUnique({
      where: { name: company1Name },
    })

    if (!company1ToAssign) {
      const nextCode = await generateNextCompanyCode()
      console.log(`Creando '${company1Name}' con código '${nextCode}'...`)
      company1ToAssign = await prisma.company.create({
        data: {
          name: company1Name,
          code: nextCode,
          address: 'Calle 50, Ciudad de Panamá, Panamá',
          phone: '+507 263-1234',
          email: 'info@intermaritime.org',
          isActive: true,
        },
      })
      console.log(`✅ Compañía creada: ${company1ToAssign.name} (${company1ToAssign.code})`)
    } else {
      console.log(`✅ Compañía encontrada: ${company1Name} (${company1ToAssign.code})`)
      
      // Actualizar código si no tiene
      if (!company1ToAssign.code) {
        const nextCode = await generateNextCompanyCode()
        company1ToAssign = await prisma.company.update({
          where: { id: company1ToAssign.id },
          data: { code: nextCode },
        })
        console.log(`   Código asignado: ${nextCode}`)
      }
    }

    // --- 2. CREAR DEPARTAMENTO IT ---
    console.log('\n🏢 Configurando departamentos...')
    let defaultDepartment = await prisma.department.findFirst({
      where: {
        name: 'IT',
        companyId: company1ToAssign.id,
      },
    })

    if (!defaultDepartment) {
      defaultDepartment = await prisma.department.create({
        data: {
          name: 'IT',
          description: 'Departamento de Tecnologías de la Información',
          companyId: company1ToAssign.id,
        },
      })
      console.log(`✅ Departamento creado: ${defaultDepartment.name}`)
    } else {
      console.log(`✅ Departamento encontrado: ${defaultDepartment.name}`)
    }

    // --- 3. CREAR/ACTUALIZAR SUPER_ADMIN Y SU PERSONA ---
    console.log('\n👥 Configurando usuario SUPER_ADMIN...')
    let superAdminUser = await prisma.user.findUnique({
      where: { email: superAdminEmail },
      include: { person: true },
    })

    if (!superAdminUser) {
      const nextUserCode = await generateNextUserCode()
      
      superAdminUser = await prisma.user.create({
        data: {
          username: superAdminUsername,
          email: superAdminEmail,
          password: passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          companyId: company1ToAssign.id,
          person: {
            create: {
              firstName: 'Carlos',
              lastName: 'Sanchez',
              fullName: defaultPersonFullName,
              contactEmail: superAdminEmail,
              phoneNumber: '+507 234-567-8900',
              position: 'Super Administrador de Sistema',
              status: 'Activo',
              userCode: nextUserCode,
              departmentId: defaultDepartment.id,
            },
          },
        },
        include: { person: true },
      })
      
      console.log(`✅ Usuario creado: ${superAdminUser.email} (${superAdminUser.role})`)
      console.log(`✅ Persona creada: ${superAdminUser.person?.fullName} (${superAdminUser.person?.userCode})`)
    } else {
      console.log(`✅ Usuario encontrado: ${superAdminUser.email}`)
      
      // Crear Person si no existe
      if (!superAdminUser.person) {
        const nextUserCode = await generateNextUserCode()
        const newPerson = await prisma.person.create({
          data: {
            userId: superAdminUser.id,
            firstName: 'Carlos',
            lastName: 'Sanchez',
            fullName: defaultPersonFullName,
            contactEmail: superAdminEmail,
            phoneNumber: '+507 234-567-8900',
            position: 'Super Administrador de Sistema',
            status: 'Activo',
            userCode: nextUserCode,
            departmentId: defaultDepartment.id,
          },
        })
        superAdminUser.person = newPerson
        console.log(`✅ Persona creada: ${newPerson.fullName} (${newPerson.userCode})`)
      } else {
        console.log(`✅ Persona encontrada: ${superAdminUser.person.fullName}`)
        
        // Actualizar userCode si no tiene
        if (!superAdminUser.person.userCode) {
          const newCode = await generateNextUserCode()
          await prisma.person.update({
            where: { id: superAdminUser.person.id },
            data: { userCode: newCode },
          })
          console.log(`   UserCode asignado: ${newCode}`)
        }
        
        // Actualizar departamento si es necesario
        if (superAdminUser.person.departmentId !== defaultDepartment.id) {
          await prisma.person.update({
            where: { id: superAdminUser.person.id },
            data: { departmentId: defaultDepartment.id },
          })
          console.log(`   Departamento actualizado: ${defaultDepartment.name}`)
        }
      }
      
      // Asignar compañía si no la tiene
      if (superAdminUser.companyId !== company1ToAssign.id) {
        await prisma.user.update({
          where: { id: superAdminUser.id },
          data: { companyId: company1ToAssign.id },
        })
        console.log(`   Compañía asignada: ${company1ToAssign.name}`)
      }
    }

    // --- 4. CREAR/ACTUALIZAR SEGUNDA COMPAÑÍA (PMTS) ---
    console.log('\n📊 Configurando segunda compañía...')
    const company2Name = 'PMTS'
    let company2ToAssign = await prisma.company.findUnique({
      where: { name: company2Name },
    })

    if (!company2ToAssign) {
      const nextCode = await generateNextCompanyCode()
      company2ToAssign = await prisma.company.create({
        data: {
          name: company2Name,
          code: nextCode,
          address: 'Avenida Balboa, Ciudad de Panamá, Panamá',
          phone: '+507 390-5678',
          email: 'contact@pmts.com',
          isActive: true,
          createdByUserId: superAdminUser.id,
        },
      })
      console.log(`✅ Compañía creada: ${company2Name} (${nextCode})`)
    } else {
      console.log(`✅ Compañía encontrada: ${company2Name} (${company2ToAssign.code})`)
      
      // Actualizar código si no tiene
      if (!company2ToAssign.code) {
        const nextCode = await generateNextCompanyCode()
        await prisma.company.update({
          where: { id: company2ToAssign.id },
          data: { code: nextCode },
        })
        console.log(`   Código asignado: ${nextCode}`)
      }
      
      // Asignar creador si no lo tiene
      if (company2ToAssign.createdByUserId !== superAdminUser.id) {
        await prisma.company.update({
          where: { id: company2ToAssign.id },
          data: { createdByUserId: superAdminUser.id },
        })
        console.log(`   Creador asignado: ${superAdminUser.email}`)
      }
    }

    // --- 5. CREAR DEPARTAMENTOS ADICIONALES ---
    console.log('\n🏢 Configurando departamentos adicionales...')
    const departments = [
      { name: 'Recursos Humanos', description: 'Gestión de personal', companyId: company1ToAssign.id },
      { name: 'Operaciones', description: 'Operaciones diarias', companyId: company1ToAssign.id },
      { name: 'Finanzas', description: 'Gestión financiera', companyId: company1ToAssign.id },
      { name: 'Administración', description: 'Administración general', companyId: company2ToAssign.id },
      { name: 'Logística', description: 'Gestión de logística', companyId: company2ToAssign.id },
      { name: 'Ventas', description: 'Departamento comercial', companyId: company2ToAssign.id },
    ]

    const createdDepts: Record<string, any> = { 'IT': defaultDepartment }
    
    for (const dept of departments) {
      const existing = await prisma.department.findFirst({
        where: {
          name: dept.name,
          companyId: dept.companyId,
        },
      })

      if (!existing) {
        const newDept = await prisma.department.create({
          data: dept,
        })
        createdDepts[dept.name] = newDept
        console.log(`✅ Departamento creado: ${dept.name}`)
      } else {
        createdDepts[dept.name] = existing
        console.log(`✅ Departamento encontrado: ${dept.name}`)
      }
    }

    // --- 6. CREAR USUARIOS ADICIONALES ---
    console.log('\n👥 Creando usuarios adicionales...')
    
    const additionalUsers = [
      {
        username: 'contador',
        email: 'contador@intermaritime.org',
        role: 'MODERATOR' as const,
        companyId: company2ToAssign.id,
        person: {
          firstName: 'María',
          lastName: 'González',
          fullName: 'María González',
          position: 'Contador',
          department: 'Administración',
        }
      },
      {
        username: 'alex',
        email: 'alex@intermaritime.org',
        role: 'ADMIN' as const,
        companyId: company1ToAssign.id,
        person: {
          firstName: 'Alexander',
          lastName: 'Prosper',
          fullName: 'Alexander Prosper',
          position: 'Administrador',
          department: 'IT',
        }
      },
    ]

    for (const userData of additionalUsers) {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
        include: { person: true },
      })

      if (!existingUser) {
        const userCode = await generateNextUserCode()
        const dept = createdDepts[userData.person.department]
        
        await prisma.user.create({
          data: {
            username: userData.username,
            email: userData.email,
            password: passwordHash,
            role: userData.role,
            isActive: true,
            companyId: userData.companyId,
            person: {
              create: {
                firstName: userData.person.firstName,
                lastName: userData.person.lastName,
                fullName: userData.person.fullName,
                contactEmail: userData.email,
                phoneNumber: '+507 200-0000',
                position: userData.person.position,
                status: 'Activo',
                userCode: userCode,
                departmentId: dept?.id,
              },
            },
          },
        })
        console.log(`✅ Usuario creado: ${userData.email} (${userData.role})`)
      } else {
        console.log(`✅ Usuario encontrado: ${userData.email}`)
        
        // Crear Person si no existe
        if (!existingUser.person) {
          const userCode = await generateNextUserCode()
          const dept = createdDepts[userData.person.department]
          
          await prisma.person.create({
            data: {
              userId: existingUser.id,
              firstName: userData.person.firstName,
              lastName: userData.person.lastName,
              fullName: userData.person.fullName,
              contactEmail: userData.email,
              phoneNumber: '+507 200-0000',
              position: userData.person.position,
              status: 'Activo',
              userCode: userCode,
              departmentId: dept?.id,
            },
          })
          console.log(`   Persona creada para: ${userData.email}`)
        } else {
          // Actualizar departamento si no lo tiene
          const dept = createdDepts[userData.person.department]
          if (!existingUser.person.departmentId && dept) {
            await prisma.person.update({
              where: { id: existingUser.person.id },
              data: { departmentId: dept.id },
            })
            console.log(`   Departamento asignado: ${userData.person.department}`)
          }
        }
      }
    }

    console.log('\n🎉 Seed completado exitosamente!')
    console.log('\n📋 Resumen:')
    console.log(`   - Compañías: ${company1ToAssign.name}, ${company2ToAssign.name}`)
    console.log(`   - Usuarios: 3 (superadmin, admin, moderator)`)
    console.log(`   - Departamentos: ${Object.keys(createdDepts).length}`)
    console.log(`   - Todos los usuarios tienen Person y Departamento asignado`)
  } catch (error) {
    console.error('❌ Error durante el seed:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('💥 Error fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log('👋 Desconectado de la base de datos')
  })

