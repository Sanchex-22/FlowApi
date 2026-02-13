import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { generateNextUserCode } from '../../prisma/seed.js';

// Define el orden jerárquico de roles
const ROLE_HIERARCHY: Record<string, number> = {
  USER: 1,
  ADMIN: 2,
  MODERATOR: 2,
  SUPER_ADMIN: 3,
};

export class UserController {
  // Función auxiliar para validar permisos basados en roles
  private async validateRolePermission(
    requestingUserId: string,
    targetUserId: string,
    action: 'edit' | 'delete'
  ): Promise<{ allowed: boolean; error?: string }> {
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
    });

    if (!requestingUser) {
      return { allowed: false, error: 'Usuario no autenticado.' };
    }

    if (requestingUser.role === 'SUPER_ADMIN') {
      return { allowed: true };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return { allowed: false, error: 'Usuario objetivo no encontrado.' };
    }

    if (requestingUserId === targetUserId && action === 'delete') {
      return { allowed: false, error: 'No puedes eliminar tu propia cuenta.' };
    }

    const requestingRoleLevel = ROLE_HIERARCHY[requestingUser.role] || 0;
    const targetRoleLevel = ROLE_HIERARCHY[targetUser.role] || 0;

    if (requestingRoleLevel <= targetRoleLevel) {
      return {
        allowed: false,
        error: `No tienes permisos para ${action} un usuario del mismo rango o superior.`,
      };
    }

    return { allowed: true };
  }

  // Función para validar que exista al menos un SUPER_ADMIN
  private async validateSuperAdminExists(
    excludeUserId?: string
  ): Promise<boolean> {
    const superAdminCount = await prisma.user.count({
      where: {
        role: 'SUPER_ADMIN',
        ...(excludeUserId && { id: { not: excludeUserId } }),
      },
    });
    return superAdminCount > 0;
  }

  async Create(req: Request, res: Response) {
    const {
      username,
      email,
      password,
      role,
      companyIds,
      firstName,
      lastName,
      contactEmail,
      phoneNumber,
      departmentId,
      position,
      userCode,
    } = req.body;

    const requestingUserId = (req as any).userId;

    try {
      // ✅ Validación de campos obligatorios
      if (!username || !email || !password) {
        return res.status(400).json({
          error: 'Username, email y password son obligatorios.',
        });
      }

      if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
        return res.status(400).json({
          error: 'Debe asignar al menos una compañía al usuario.',
        });
      }

      // ✅ Validación de permisos
      if (role && role !== 'USER' && requestingUserId) {
        const requestingUser = await prisma.user.findUnique({
          where: { id: requestingUserId },
        });

        if (!requestingUser) {
          return res.status(403).json({
            error: 'Usuario no autenticado.',
          });
        }

        const requestingUserRoleLevel = ROLE_HIERARCHY[requestingUser.role] || 0;
        const targetRoleLevel = ROLE_HIERARCHY[role] || 0;

        if (requestingUserRoleLevel <= targetRoleLevel && requestingUser.role !== 'SUPER_ADMIN') {
          return res.status(403).json({
            error: 'No tienes permisos para asignar el rol especificado.',
          });
        }
      }

      // ✅ Validar que las compañías existan
      const companiesExist = await prisma.company.findMany({
        where: {
          id: { in: companyIds },
        },
      });

      if (companiesExist.length !== companyIds.length) {
        return res.status(400).json({
          error: 'Una o más compañías no existen.',
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      let newUserCode = userCode;

      // ✅ Generar código de usuario si no se proporciona
      if (!newUserCode) {
        try {
          newUserCode = await generateNextUserCode();
        } catch (codeError) {
          console.error('Error generating user code:', codeError);
          // Usar un código alternativo si falla
          newUserCode = `USER_${Date.now()}`;
        }
      }

      // ✅ Crear usuario
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          role: role || 'USER',
          companies: {
            create: companyIds.map((companyId: string) => ({
              companyId: companyId,
            })),
          },
        },
      });

      // ✅ Crear Person si hay datos personales
      if (firstName || lastName || contactEmail || phoneNumber || departmentId || position) {
        await prisma.person.create({
          data: {
            userId: newUser.id,
            firstName: firstName || null,
            lastName: lastName || null,
            fullName: `${firstName || ''} ${lastName || ''}`.trim() || null,
            contactEmail: contactEmail || null,
            phoneNumber: phoneNumber || null,
            departmentId: departmentId || null,
            position: position || null,
            userCode: newUserCode,
          },
        });
      } else {
        // ✅ Crear Person mínimo con userCode
        await prisma.person.create({
          data: {
            userId: newUser.id,
            userCode: newUserCode,
          },
        });
      }

      // ✅ Retornar usuario completo
      const completeUser = await prisma.user.findUnique({
        where: { id: newUser.id },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
        },
      });

      return res.status(201).json(completeUser);
    } catch (error: any) {
      console.error('Error creating user:', error);

      if (error.code === 'P2002') {
        let errorMessage = 'Username, email o userCode ya existen.';
        if (error.meta?.target) {
          if (error.meta.target.includes('username'))
            errorMessage = 'El username ya existe.';
          if (error.meta.target.includes('email'))
            errorMessage = 'El email ya existe.';
          if (error.meta.target.includes('userCode'))
            errorMessage = 'El userCode ya existe.';
          if (error.meta.target.includes('contactEmail'))
            errorMessage = 'El email de contacto ya existe.';
        }
        return res.status(409).json({ error: errorMessage });
      }

      return res.status(500).json({
        error: 'Error al crear el usuario.',
        details: error.message,
      });
    }
  }

  async Delete(req: Request, res: Response) {
    const { id } = req.params;
    const requestingUserId = (req as any).userId;

    try {
      if (requestingUserId) {
        const permissionCheck = await this.validateRolePermission(
          requestingUserId,
          id,
          'delete'
        );
        if (!permissionCheck.allowed) {
          return res.status(403).json({ error: permissionCheck.error });
        }
      }

      const userToDelete = await prisma.user.findUnique({
        where: { id },
      });

      if (!userToDelete) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      if (userToDelete.role === 'SUPER_ADMIN') {
        const superAdminExists = await this.validateSuperAdminExists(id);
        if (!superAdminExists) {
          return res.status(400).json({
            error:
              'No se puede eliminar al último Super Administrador. Debe existir al menos uno.',
          });
        }
      }

      const deletedUser = await prisma.user.delete({
        where: { id },
      });

      res.status(200).json({
        message: 'Usuario eliminado exitosamente.',
        user: deletedUser,
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);

      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      res.status(500).json({
        error: 'Error al eliminar el usuario.',
        details: error.message,
      });
    }
  }

  async Edit(req: Request, res: Response) {
    const { id } = req.params;
    const requestingUserId = (req as any).userId;
    const {
      username,
      email,
      password,
      role,
      isActive,
      companyIds,
      firstName,
      lastName,
      contactEmail,
      phoneNumber,
      departmentId,
      position,
      status,
      userCode,
    } = req.body;

    try {
      // ✅ Validar que el usuario a editar existe
      const userToEdit = await prisma.user.findUnique({
        where: { id },
        include: {
          person: true,
        },
      });

      if (!userToEdit) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      // ✅ Validar permisos
      if (requestingUserId && (role || isActive === false)) {
        const permissionCheck = await this.validateRolePermission(
          requestingUserId,
          id,
          'edit'
        );
        if (!permissionCheck.allowed) {
          return res.status(403).json({ error: permissionCheck.error });
        }
      }

      // ✅ Validar cambio de rol del último SUPER_ADMIN
      if (role && role !== 'SUPER_ADMIN' && userToEdit.role === 'SUPER_ADMIN') {
        const superAdminExists = await this.validateSuperAdminExists(id);
        if (!superAdminExists) {
          return res.status(400).json({
            error:
              'No se puede cambiar el rol del último Super Administrador. Debe existir al menos uno.',
          });
        }
      }

      // ✅ Validar compañías si se proporcionan
      if (companyIds && Array.isArray(companyIds) && companyIds.length > 0) {
        const companiesExist = await prisma.company.findMany({
          where: {
            id: { in: companyIds },
          },
        });

        if (companiesExist.length !== companyIds.length) {
          return res.status(400).json({
            error: 'Una o más compañías no existen.',
          });
        }
      }

      // ✅ Preparar datos a actualizar
      const userDataToUpdate: any = {};

      if (username !== undefined) userDataToUpdate.username = username;
      if (email !== undefined) userDataToUpdate.email = email;
      if (role !== undefined) userDataToUpdate.role = role;
      if (isActive !== undefined) userDataToUpdate.isActive = isActive;

      if (password && password.trim()) {
        userDataToUpdate.password = await bcrypt.hash(password, 10);
      }

      // ✅ Actualizar compañías
      if (companyIds !== undefined && Array.isArray(companyIds)) {
        await prisma.userCompany.deleteMany({
          where: { userId: id },
        });

        if (companyIds.length > 0) {
          userDataToUpdate.companies = {
            create: companyIds.map((companyId: string) => ({
              companyId: companyId,
            })),
          };
        }
      }

      // ✅ Actualizar usuario
      const updatedUser = await prisma.user.update({
        where: { id },
        data: userDataToUpdate,
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
        },
      });

      // ✅ Actualizar Person si hay datos
      if (
        firstName !== undefined ||
        lastName !== undefined ||
        contactEmail !== undefined ||
        phoneNumber !== undefined ||
        departmentId !== undefined ||
        position !== undefined ||
        status !== undefined ||
        userCode !== undefined
      ) {
        const personDataToUpdate: any = {};

        if (firstName !== undefined) personDataToUpdate.firstName = firstName;
        if (lastName !== undefined) personDataToUpdate.lastName = lastName;
        if (contactEmail !== undefined) personDataToUpdate.contactEmail = contactEmail;
        if (phoneNumber !== undefined) personDataToUpdate.phoneNumber = phoneNumber;
        if (position !== undefined) personDataToUpdate.position = position;
        if (status !== undefined) personDataToUpdate.status = status;
        if (departmentId !== undefined) {
          personDataToUpdate.departmentId = departmentId === null || departmentId === '' ? null : departmentId;
        }

        // ✅ Calcular fullName
        const newFirstName = personDataToUpdate.firstName ?? userToEdit.person?.firstName ?? '';
        const newLastName = personDataToUpdate.lastName ?? userToEdit.person?.lastName ?? '';
        personDataToUpdate.fullName = `${newFirstName} ${newLastName}`.trim() || null;

        // ✅ Upsert Person
        await prisma.person.upsert({
          where: { userId: id },
          update: personDataToUpdate,
          create: {
            userId: id,
            ...personDataToUpdate,
            userCode: userCode || `USER_${Date.now()}`,
          },
        });
      }

      // ✅ Retornar usuario actualizado
      const finalUser = await prisma.user.findUnique({
        where: { id },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
        },
      });

      return res.status(200).json(finalUser);
    } catch (error: any) {
      console.error('Error updating user:', error);

      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      if (error.code === 'P2002') {
        let errorMessage = 'Username, email o userCode ya existen.';
        if (error.meta?.target) {
          if (error.meta.target.includes('username'))
            errorMessage = 'El username ya existe.';
          if (error.meta.target.includes('email'))
            errorMessage = 'El email ya existe.';
          if (error.meta.target.includes('userCode'))
            errorMessage = 'El userCode ya existe.';
          if (error.meta.target.includes('contactEmail'))
            errorMessage = 'El email de contacto ya existe.';
        }
        return res.status(409).json({ error: errorMessage });
      }

      res.status(500).json({
        error: 'Error al actualizar el usuario.',
        details: error.message,
      });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
          assignedEquipments: true,
          assignedMaintenances: true,
          createdCompanies: true,
          assignedNetworks: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      res.status(200).json(user);
    } catch (error: any) {
      console.error('Error fetching user:', error);
      res.status(500).json({
        error: 'Error al obtener el usuario.',
        details: error.message,
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
        },
      });

      res.status(200).json(users);
    } catch (error: any) {
      console.error('Error fetching all users:', error);
      res.status(500).json({
        error: 'Error al obtener los usuarios.',
        details: error.message,
      });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
          assignedEquipments: {
            select: {
              id: true,
              type: true,
              model: true,
              serialNumber: true,
              status: true,
            },
          },
          assignedMaintenances: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              scheduledDate: true,
            },
          },
          assignedNetworks: {
            select: {
              id: true,
              name: true,
              ip: true,
              status: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      res.status(200).json(user);
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({
        error: 'Error al obtener el perfil del usuario.',
        details: error.message,
      });
    }
  }

  async getAllWithPerson(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
        },
      });

      res.status(200).json(users);
    } catch (error: any) {
      console.error('Error fetching users with person data:', error);
      res.status(500).json({
        error: 'Error al obtener los usuarios.',
        details: error.message,
      });
    }
  }

  async getAllUserByCompanyId(req: Request, res: Response) {
    try {
      const { companyCode } = req.params;

      // ✅ Buscar compañía por ID
      const company = await prisma.company.findUnique({
        where: { id: companyCode },
      });

      if (!company) {
        return res.status(404).json({ error: 'Compañía no encontrada.' });
      }

      // ✅ Obtener usuarios de la compañía
      const users = await prisma.user.findMany({
        where: {
          companies: {
            some: {
              companyId: company.id,
            },
          },
        },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
        },
      });

      res.status(200).json(users);
    } catch (error: any) {
      console.error('Error fetching users by company:', error);
      res.status(500).json({
        error: 'Error al obtener los usuarios.',
        details: error.message,
      });
    }
  }
}