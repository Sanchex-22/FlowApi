import 'dotenv/config'
import { hash } from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { UserRole } from '../generated/prisma/index.js'
import { AdminConfig, SeedConfig } from '../src/config/adminConfig.js'

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

  console.log('🌱 Iniciando actualización de base de datos (Modo Idempotente)...')

  // AdminConfig.requireEnv already throws if ADMIN_EMAIL or ADMIN_PASSWORD are missing
  const superAdminEmail = AdminConfig.Email.toLowerCase()
  const superAdminName  = `${AdminConfig.Name} ${AdminConfig.LastName}`.toLowerCase()
  const passwordHash    = await hash(AdminConfig.Password, 12)

  /* ============================
     COMPANY (opcional)
  ============================ */

  let company: { id: string } | null = null
  let dept: { id: string } | null = null

  if (SeedConfig.CompanyName) {
    company = await prisma.company.findUnique({ where: { name: SeedConfig.CompanyName } })

    if (!company) {
      const code = SeedConfig.CompanyCode || await generateNextCompanyCode()
      company = await prisma.company.create({
        data: { name: SeedConfig.CompanyName, code, isActive: true },
      })
      console.log(`✅ Compañía creada: ${SeedConfig.CompanyName} (${code})`)
    } else {
      console.log(`ℹ️ Compañía existente: ${SeedConfig.CompanyName}`)
    }

    /* ============================
       DEPARTMENT (solo si hay compañía)
    ============================ */

    dept = await prisma.department.findFirst({
      where: { name: SeedConfig.DepartmentName, companyId: company.id },
    })

    if (!dept) {
      dept = await prisma.department.create({
        data: { name: SeedConfig.DepartmentName, companyId: company.id },
      })
      console.log(`✅ Departamento creado: ${SeedConfig.DepartmentName}`)
    } else {
      console.log(`ℹ️ Departamento existente: ${SeedConfig.DepartmentName}`)
    }
  } else {
    console.log('ℹ️ SEED_COMPANY_NAME no definido — se omite creación de compañía y departamento')
  }

  /* ============================
     SUPER ADMIN (siempre requerido)
  ============================ */

  let superAdmin = await prisma.user.findFirst({
    where: { OR: [{ email: superAdminEmail }, { username: superAdminName }] },
    include: { person: true },
  })

  if (!superAdmin) {
    const userCode = await generateNextUserCode()

    const newSuperAdmin = await prisma.user.create({
      data: {
        username: superAdminName,
        email: superAdminEmail,
        password: passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,

        person: {
          create: {
            firstName: AdminConfig.Name,
            lastName: AdminConfig.LastName,
            fullName: superAdminName,
            contactEmail: superAdminEmail,
            status: 'Activo',
            userCode,
            // departmentId solo si se creó/encontró un departamento
            ...(dept ? { departmentId: dept.id } : {}),
          },
        },
      },
      include: { person: true },
    })

    // Asignar TODAS las compañías existentes al SUPER_ADMIN
    const allCompanies = await prisma.company.findMany({ select: { id: true } })

    if (allCompanies.length > 0) {
      await prisma.userCompany.createMany({
        data: allCompanies.map(c => ({
          userId: newSuperAdmin.id,
          companyId: c.id,
        })),
        skipDuplicates: true,
      })
      console.log(`✅ SUPER_ADMIN creado y asignado a ${allCompanies.length} compañía(s)`)
    } else {
      console.log('✅ SUPER_ADMIN creado (sin compañías aún — asígnale una desde el panel)')
    }
  } else {
    console.log('ℹ️ SUPER_ADMIN existente')
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