import { Request, Response } from 'express'
import { hash } from 'bcryptjs'
import prisma from '../../lib/prisma.js'
import { LicensePlan, UserRole } from '../../generated/prisma/index.js'
import { generateNextCompanyCode } from '../utils/companyCodeGenerator.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Genera un userCode único para nuevos SUPER_ADMIN (prefijo SA) */
async function generateSuperAdminCode(): Promise<string> {
  const last = await prisma.person.findFirst({
    where:   { userCode: { startsWith: 'SA' } },
    orderBy: { userCode: 'desc' },
  })
  const max = last?.userCode?.startsWith('SA')
    ? parseInt(last.userCode.replace('SA', ''), 10)
    : 0
  return `SA${String(max + 1).padStart(3, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

export const adminGetStats = async (_req: Request, res: Response) => {
  try {
    const [totalCompanies, totalUsers, totalEmployees] = await Promise.all([
      prisma.company.count(),
      prisma.user.count({ where: { role: { in: [UserRole.SUPER_ADMIN, UserRole.GLOBAL_ADMIN] } } }),
      prisma.person.count(),
    ])
    return res.json({ totalCompanies, totalUsers, totalEmployees, totalPayrolls: 0 })
  } catch (error) {
    console.error('adminGetStats error:', error)
    return res.status(500).json({ error: 'Error al obtener estadísticas.' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Companies
// ─────────────────────────────────────────────────────────────────────────────

export const adminGetCompanies = async (_req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                role: true,
                userLicense: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = await Promise.all(
      companies.map(async (c) => {
        const employeeCount = await prisma.person.count({ where: { companyId: c.id } })
        const superAdmin = c.users.find((uc) => uc.user.role === UserRole.SUPER_ADMIN)
        const lic = superAdmin?.user.userLicense

        return {
          id:        c.id,
          code:      c.code,
          name:      c.name,
          ruc:       c.ruc,
          email:     c.email,
          phone:     c.phone,
          address:   c.address,
          isActive:  c.isActive,
          createdAt: c.createdAt,
          _count: {
            users:     c.users.length,
            employees: employeeCount,
          },
          license: lic
            ? {
                plan:         lic.plan,
                maxUsers:     lic.maxUsers,
                maxEmployees: lic.maxEmployees,
                expiresAt:    lic.expiresAt,
                isActive:     lic.isActive,
              }
            : null,
        }
      })
    )

    return res.json(result)
  } catch (error) {
    console.error('adminGetCompanies error:', error)
    return res.status(500).json({ error: 'Error al obtener empresas.' })
  }
}

export const adminCreateCompany = async (req: Request, res: Response) => {
  const { name, ruc, email, phone, address, superAdmin } = req.body

  if (!name?.trim()) {
    return res.status(400).json({ error: 'El nombre de la empresa es obligatorio.' })
  }

  try {
    const code = await generateNextCompanyCode(prisma)

    const company = await prisma.company.create({
      data: {
        name:            name.trim(),
        ruc:             ruc || null,
        email:           email || null,
        phone:           phone || null,
        address:         address || null,
        code,
        createdByUserId: req.userId ?? null,
      },
    })

    // Crear SUPER_ADMIN opcional al mismo tiempo
    if (superAdmin?.email && superAdmin?.username && superAdmin?.password) {
      const passwordHash = await hash(superAdmin.password, 10)
      const userCode     = await generateSuperAdminCode()

      await prisma.user.create({
        data: {
          username: superAdmin.username,
          email:    superAdmin.email.toLowerCase(),
          password: passwordHash,
          role:     UserRole.SUPER_ADMIN,
          companies: { create: { companyId: company.id } },
          userLicense: { create: { plan: LicensePlan.TRIAL } },
          person: superAdmin.firstName
            ? {
                create: {
                  firstName:    superAdmin.firstName,
                  lastName:     superAdmin.lastName ?? '',
                  fullName:     `${superAdmin.firstName} ${superAdmin.lastName ?? ''}`.trim(),
                  contactEmail: superAdmin.email.toLowerCase(),
                  userCode,
                  status: 'Activo',
                  companyId: company.id,
                },
              }
            : undefined,
        },
      })
    }

    return res.status(201).json(company)
  } catch (error: any) {
    console.error('adminCreateCompany error:', error)
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('name'))  return res.status(409).json({ error: 'Ya existe una empresa con ese nombre.' })
      if (error.meta?.target?.includes('email')) return res.status(409).json({ error: 'Ya existe una empresa con ese email.' })
      if (error.meta?.target?.includes('ruc'))   return res.status(409).json({ error: 'Ya existe una empresa con ese RUC.' })
    }
    return res.status(500).json({ error: error.message || 'Error al crear empresa.' })
  }
}

export const adminToggleCompany = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const company = await prisma.company.findUnique({ where: { id } })
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' })

    const updated = await prisma.company.update({
      where: { id },
      data:  { isActive: !company.isActive },
    })
    return res.json(updated)
  } catch (error) {
    console.error('adminToggleCompany error:', error)
    return res.status(500).json({ error: 'Error al actualizar empresa.' })
  }
}

export const adminDeleteCompany = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await prisma.company.delete({ where: { id } })
    return res.status(204).send()
  } catch (error: any) {
    console.error('adminDeleteCompany error:', error)
    if (error.code === 'P2025') return res.status(404).json({ error: 'Empresa no encontrada.' })
    return res.status(500).json({ error: 'Error al eliminar empresa.' })
  }
}

/** Crea un SUPER_ADMIN nuevo y lo asigna a la empresa */
export const adminCreateSuperAdmin = async (req: Request, res: Response) => {
  const { id: companyId } = req.params
  const { email, username, password, firstName, lastName } = req.body

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, usuario y contraseña son obligatorios.' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' })
  }

  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' })

    const passwordHash = await hash(password, 10)
    const userCode     = await generateSuperAdminCode()

    const user = await prisma.user.create({
      data: {
        username,
        email:    email.toLowerCase(),
        password: passwordHash,
        role:     UserRole.SUPER_ADMIN,
        companies:   { create: { companyId } },
        userLicense: { create: { plan: LicensePlan.TRIAL } },
        person: firstName
          ? {
              create: {
                firstName,
                lastName:     lastName ?? '',
                fullName:     `${firstName} ${lastName ?? ''}`.trim(),
                contactEmail: email.toLowerCase(),
                userCode,
                status:    'Activo',
                companyId,
              },
            }
          : undefined,
      },
      select: { id: true, username: true, email: true, role: true },
    })

    return res.status(201).json(user)
  } catch (error: any) {
    console.error('adminCreateSuperAdmin error:', error)
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('email'))    return res.status(409).json({ error: 'El email ya está registrado.' })
      if (error.meta?.target?.includes('username')) return res.status(409).json({ error: 'El nombre de usuario ya está en uso.' })
    }
    return res.status(500).json({ error: error.message || 'Error al crear super admin.' })
  }
}

/** Asigna un usuario existente como SUPER_ADMIN a la empresa */
export const adminAssignSuperAdmin = async (req: Request, res: Response) => {
  const { id: companyId } = req.params
  const { userId } = req.body

  if (!userId) return res.status(400).json({ error: 'userId es requerido.' })

  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' })

    // Crear UserCompany si no existe
    const existing = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
    })
    if (!existing) {
      await prisma.userCompany.create({ data: { userId, companyId } })
    }

    // Asegurarse de que el usuario tiene rol SUPER_ADMIN
    if (user.role !== UserRole.SUPER_ADMIN) {
      await prisma.user.update({
        where: { id: userId },
        data:  { role: UserRole.SUPER_ADMIN },
      })
    }

    // Crear licencia TRIAL si no tiene una
    const existingLicense = await prisma.userLicense.findUnique({ where: { userId } })
    if (!existingLicense) {
      await prisma.userLicense.create({ data: { userId, plan: LicensePlan.TRIAL } })
    }

    return res.json({ success: true })
  } catch (error) {
    console.error('adminAssignSuperAdmin error:', error)
    return res.status(500).json({ error: 'Error al asignar super admin.' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

export const adminGetUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: [UserRole.SUPER_ADMIN, UserRole.GLOBAL_ADMIN] } },
      select: {
        id:       true,
        username: true,
        email:    true,
        role:     true,
        isActive: true,
        companies: {
          include: {
            company: { select: { id: true, name: true, code: true } },
          },
        },
        userLicense: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return res.json(users)
  } catch (error) {
    console.error('adminGetUsers error:', error)
    return res.status(500).json({ error: 'Error al obtener usuarios.' })
  }
}

export const adminGetUser = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id:       true,
        username: true,
        email:    true,
        role:     true,
        isActive: true,
        companies: {
          include: {
            company: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' })
    return res.json(user)
  } catch (error) {
    console.error('adminGetUser error:', error)
    return res.status(500).json({ error: 'Error al obtener usuario.' })
  }
}

export const adminSearchUser = async (req: Request, res: Response) => {
  const email = req.query.email as string
  if (!email) return res.status(400).json({ error: 'El parámetro email es requerido.' })

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id:       true,
        username: true,
        email:    true,
        role:     true,
        isActive: true,
        companies: {
          include: {
            company: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })
    if (!user) return res.status(404).json({ error: 'No se encontró ningún usuario con ese email.' })
    return res.json(user)
  } catch (error) {
    console.error('adminSearchUser error:', error)
    return res.status(500).json({ error: 'Error al buscar usuario.' })
  }
}

export const adminCreateUser = async (req: Request, res: Response) => {
  const { username, email, password, role, isActive, companyIds } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Usuario, email y contraseña son obligatorios.' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' })
  }
  const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.GLOBAL_ADMIN]
  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol no permitido desde el panel de administración.' })
  }

  try {
    const passwordHash = await hash(password, 10)
    const userCode     = await generateSuperAdminCode()
    const assignedRole: UserRole = role ?? UserRole.SUPER_ADMIN

    const user = await prisma.user.create({
      data: {
        username,
        email:    email.toLowerCase(),
        password: passwordHash,
        role:     assignedRole,
        isActive: isActive ?? true,
        ...(companyIds?.length && {
          companies: {
            create: (companyIds as string[]).map((cid: string) => ({ companyId: cid })),
          },
        }),
        ...(assignedRole === UserRole.SUPER_ADMIN && {
          userLicense: { create: { plan: LicensePlan.TRIAL } },
          person: {
            create: {
              userCode,
              contactEmail: email.toLowerCase(),
              status: 'Activo',
            },
          },
        }),
      },
      select: { id: true, username: true, email: true, role: true, isActive: true },
    })

    return res.status(201).json(user)
  } catch (error: any) {
    console.error('adminCreateUser error:', error)
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('email'))    return res.status(409).json({ error: 'El email ya está registrado.' })
      if (error.meta?.target?.includes('username')) return res.status(409).json({ error: 'El nombre de usuario ya está en uso.' })
    }
    return res.status(500).json({ error: error.message || 'Error al crear usuario.' })
  }
}

export const adminUpdateUser = async (req: Request, res: Response) => {
  const { id } = req.params
  const { username, email, password, role, isActive, companyIds } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' })

    const dataToUpdate: any = {}
    if (username !== undefined) dataToUpdate.username = username
    if (email    !== undefined) dataToUpdate.email    = email.toLowerCase()
    if (isActive !== undefined) dataToUpdate.isActive = isActive
    if (role     !== undefined) dataToUpdate.role     = role
    if (password)               dataToUpdate.password = await hash(password, 10)

    await prisma.user.update({ where: { id }, data: dataToUpdate })

    // Actualizar empresas asignadas (solo si se envía la lista)
    if (companyIds !== undefined) {
      // Borrar todas las asignaciones actuales
      await prisma.userCompany.deleteMany({ where: { userId: id } })
      // Crear las nuevas
      if (companyIds.length > 0) {
        await prisma.userCompany.createMany({
          data: (companyIds as string[]).map((cid: string) => ({ userId: id, companyId: cid })),
          skipDuplicates: true,
        })
      }
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      select: {
        id:       true,
        username: true,
        email:    true,
        role:     true,
        isActive: true,
        companies: { include: { company: { select: { id: true, name: true, code: true } } } },
      },
    })

    return res.json(updated)
  } catch (error: any) {
    console.error('adminUpdateUser error:', error)
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('email'))    return res.status(409).json({ error: 'El email ya está registrado.' })
      if (error.meta?.target?.includes('username')) return res.status(409).json({ error: 'El nombre de usuario ya está en uso.' })
    }
    return res.status(500).json({ error: 'Error al actualizar usuario.' })
  }
}

export const adminDeleteUser = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    // No permitir eliminar al propio GLOBAL_ADMIN que hace la petición
    if (req.userId === id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' })
    }
    await prisma.user.delete({ where: { id } })
    return res.status(204).send()
  } catch (error: any) {
    console.error('adminDeleteUser error:', error)
    if (error.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado.' })
    return res.status(500).json({ error: 'Error al eliminar usuario.' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Licenses (UserLicense — plan de suscripción del SUPER_ADMIN)
// ─────────────────────────────────────────────────────────────────────────────

export const adminGetLicenses = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN },
      select: {
        id:          true,
        username:    true,
        email:       true,
        isActive:    true,
        createdAt:   true,
        userLicense: true,
        person:      { select: { fullName: true } },
        companies: {
          include: {
            company: { select: { id: true, name: true, code: true, isActive: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = await Promise.all(
      users.map(async (u) => {
        const companyIds = u.companies.map((uc) => uc.company.id)
        const [totalEmployees, totalUsers] = await Promise.all([
          prisma.person.count({ where: { companyId: { in: companyIds } } }),
          prisma.userCompany.count({ where: { companyId: { in: companyIds } } }),
        ])

        return {
          userId:         u.id,
          username:       u.username,
          email:          u.email,
          fullName:       u.person?.fullName ?? u.username,
          isActive:       u.isActive,
          createdAt:      u.createdAt,
          companyCount:   u.companies.length,
          totalEmployees,
          totalUsers,
          companies:      u.companies.map((uc) => uc.company),
          license:        u.userLicense ?? null,
        }
      })
    )

    return res.json(result)
  } catch (error) {
    console.error('adminGetLicenses error:', error)
    return res.status(500).json({ error: 'Error al obtener licencias.' })
  }
}

export const adminUpdateLicense = async (req: Request, res: Response) => {
  const { userId } = req.params
  const { plan, maxCompanies, maxUsers, maxEmployees, startsAt, expiresAt, isActive, notes } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' })

    const license = await prisma.userLicense.upsert({
      where:  { userId },
      update: {
        plan:         plan,
        maxCompanies: maxCompanies !== undefined ? Number(maxCompanies) : undefined,
        maxUsers:     maxUsers     !== undefined ? Number(maxUsers)     : undefined,
        maxEmployees: maxEmployees !== undefined ? Number(maxEmployees) : undefined,
        startsAt:     startsAt  ? new Date(startsAt)  : undefined,
        expiresAt:    expiresAt ? new Date(expiresAt) : null,
        isActive:     isActive  !== undefined ? Boolean(isActive) : undefined,
        notes:        notes     !== undefined ? notes             : undefined,
      },
      create: {
        userId,
        plan:         plan         ?? LicensePlan.TRIAL,
        maxCompanies: maxCompanies !== undefined ? Number(maxCompanies) : 1,
        maxUsers:     maxUsers     !== undefined ? Number(maxUsers)     : 5,
        maxEmployees: maxEmployees !== undefined ? Number(maxEmployees) : 20,
        startsAt:     startsAt  ? new Date(startsAt)  : new Date(),
        expiresAt:    expiresAt ? new Date(expiresAt) : null,
        isActive:     isActive  !== undefined ? Boolean(isActive) : true,
        notes:        notes ?? null,
      },
    })

    return res.json(license)
  } catch (error: any) {
    console.error('adminUpdateLicense error:', error)
    return res.status(500).json({ error: 'Error al actualizar licencia.' })
  }
}
