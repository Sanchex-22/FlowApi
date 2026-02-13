import 'dotenv/config'
import { hash } from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { UserRole } from '../generated/prisma/index.js'

/* ============================
   HELPERS
============================ */

export async function generateNextCompanyCode(): Promise<string> {
  const companies = await prisma.company.findMany({
    select: { code: true },
    orderBy: { code: 'desc' },
  })

  let max = 0
  for (const c of companies) {
    if (c.code?.startsWith('CO')) {
      const n = parseInt(c.code.replace('CO', ''), 10)
      if (!isNaN(n)) max = Math.max(max, n)
    }
  }

  return `CO${String(max + 1).padStart(3, '0')}`
}

export async function generateNextUserCode(): Promise<string> {
  const persons = await prisma.person.findMany({
    select: { userCode: true },
    orderBy: { userCode: 'desc' },
  })

  let max = 0
  for (const p of persons) {
    if (p.userCode?.startsWith('USR')) {
      const n = parseInt(p.userCode.replace('USR', ''), 10)
      if (!isNaN(n)) max = Math.max(max, n)
    }
  }

  return `USR${String(max + 1).padStart(3, '0')}`
}

/* ============================
   SEED
============================ */

async function main() {

  const passwordHash = await hash('Lexus0110', 10)

  const companies: Record<string, any> = {}

  for (const name of ['Intermaritime', 'PMTS']) {
    let company = await prisma.company.findUnique({ where: { name } })

    if (!company) {
      company = await prisma.company.create({
        data: {
          name,
          code: await generateNextCompanyCode(),
          isActive: true,
        },
      })
      console.log(`✅ Compañía creada: ${name}`)
    } else {
      console.log(`ℹ️ Compañía existente: ${name}`)
    }

    companies[name] = company
  }

  /* ============================
     DEPARTMENTS
  ============================ */

  const departments: Record<string, any> = {}

  const departmentData = [
    { name: 'IT', company: 'Intermaritime' },
    { name: 'Administración', company: 'PMTS' },
  ]

  for (const d of departmentData) {
    let dept = await prisma.department.findFirst({
      where: {
        name: d.name,
        companyId: companies[d.company].id,
      },
    })

    if (!dept) {
      dept = await prisma.department.create({
        data: {
          name: d.name,
          companyId: companies[d.company].id,
        },
      })
      console.log(`✅ Departamento creado: ${d.name} (${d.company})`)
    } else {
      console.log(`ℹ️ Departamento existente: ${d.name} (${d.company})`)
    }

    departments[`${d.name}_${d.company}`] = dept
  }

  /* ============================
     SUPER ADMIN
  ============================ */

  const superAdminEmail = 'david@intermaritime.org'

  let superAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: superAdminEmail },
        { username: 'Carlos Sanchez' }
      ]
    },
    include: { person: true },
  })

  if (!superAdmin) {
    const userCode = await generateNextUserCode()

    const newSuperAdmin = await prisma.user.create({
      data: {
        username: 'Carlos Sanchez',
        email: superAdminEmail,
        password: passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,

        person: {
          create: {
            firstName: 'Carlos',
            lastName: 'Sanchez',
            fullName: 'Carlos Sanchez',
            contactEmail: superAdminEmail,
            status: 'Activo',
            userCode,
            departmentId: departments['IT_Intermaritime'].id,
          },
        },
      },
      include: { person: true },
    })

    // Asignar TODAS las compañías al SUPER_ADMIN
    const allCompanies = await prisma.company.findMany({
      select: { id: true },
    })

    await prisma.userCompany.createMany({
      data: allCompanies.map(company => ({
        userId: newSuperAdmin.id,
        companyId: company.id,
      })),
    })

    console.log('✅ SUPER_ADMIN creado y asignado a todas las compañías')
  } else {
    console.log('ℹ️ SUPER_ADMIN existente')
  }

  /* ============================
     OTHER USERS
  ============================ */

  const users = [
    {
      username: 'alex',
      email: 'alex@intermaritime.org',
      role: UserRole.ADMIN,
      company: 'Intermaritime',
      department: 'IT',
    },
    {
      username: 'contador',
      email: 'contador@pmts.com',
      role: UserRole.MODERATOR,
      company: 'PMTS',
      department: 'Administración',
    },
  ]

  for (const u of users) {
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: u.email },
          { username: u.username }
        ]
      },
      include: { person: true },
    })

    if (!user) {
      const userCode = await generateNextUserCode()

      const newUser = await prisma.user.create({
        data: {
          username: u.username,
          email: u.email,
          password: passwordHash,
          role: u.role,
          isActive: true,

          person: {
            create: {
              fullName: u.username,
              contactEmail: u.email,
              status: 'Activo',
              userCode,
              departmentId: departments[`${u.department}_${u.company}`]?.id,
            },
          },
        },
        include: { person: true },
      })

      // Asignar usuario a su compañía
      await prisma.userCompany.create({
        data: {
          userId: newUser.id,
          companyId: companies[u.company].id,
        },
      })

      console.log(`✅ Usuario creado: ${u.email} y asignado a ${u.company}`)
    } else {
      console.log(`ℹ️ Usuario existente: ${u.email} (o username: ${u.username})`)
    }
  }

  console.log('\n🎉 Seed completado correctamente')
}

/* ============================
   RUN
============================ */

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })