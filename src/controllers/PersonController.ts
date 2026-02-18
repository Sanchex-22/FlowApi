import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { generateNextUserCode } from '../../prisma/seed.js';

export class PersonController {
  
  // ✅ GET - Obtener una persona por ID
  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const person = await prisma.person.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

      if (!person) {
        return res.status(404).json({ error: 'Persona no encontrada.' });
      }

      res.status(200).json(person);
    } catch (error: any) {
      console.error('Error fetching person:', error);
      res.status(500).json({
        error: 'Error al obtener la persona.',
        details: error.message,
      });
    }
  }

  // ✅ GET ALL - Obtener todas las personas
  async getAll(req: Request, res: Response) {
    try {
      const persons = await prisma.person.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json(persons);
    } catch (error: any) {
      console.error('Error fetching all persons:', error);
      res.status(500).json({
        error: 'Error al obtener las personas.',
        details: error.message,
      });
    }
  }

  // ✅ GET ALL BY COMPANY - Obtener personas de usuarios de la compañía
  async getAllByCompany(req: Request, res: Response) {
    try {
      const { companyCode } = req.params;

      // Validar que la compañía existe
      const company = await prisma.company.findUnique({
        where: { id: companyCode },
      });

      if (!company) {
        return res.status(404).json({ error: 'Compañía no encontrada.' });
      }

      // Obtener IDs de usuarios de la compañía
      const usersInCompany = await prisma.user.findMany({
        where: {
          companies: {
            some: {
              companyId: company.id,
            },
          },
        },
        select: {
          id: true,
        },
      });

      const userIds = usersInCompany.map(u => u.id);

      // Obtener personas asociadas a esos usuarios
      const persons = await prisma.person.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json(persons);
    } catch (error: any) {
      console.error('Error fetching persons by company:', error);
      res.status(500).json({
        error: 'Error al obtener las personas.',
        details: error.message,
      });
    }
  }

  // ✅ CREATE - Crear una nueva persona (userId OPCIONAL)
  async Create(req: Request, res: Response) {
    try {
      const {
        userId,
        firstName,
        lastName,
        contactEmail,
        phoneNumber,
        departmentId,
        position,
        status,
      } = req.body;

      // Validar que al menos nombre y apellido existan
      if (!firstName || !lastName) {
        return res.status(400).json({
          error: 'El nombre y apellido son obligatorios.',
        });
      }

      // Si se proporciona userId, validar que existe
      if (userId) {
        const userExists = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!userExists) {
          return res.status(404).json({
            error: 'Usuario no encontrado.',
          });
        }

        // Validar que la persona no existe ya para ese usuario
        const existingPerson = await prisma.person.findUnique({
          where: { userId },
        });

        if (existingPerson) {
          return res.status(409).json({
            error: 'Este usuario ya tiene un perfil de persona.',
          });
        }
      }

      // Generar código de usuario
      let userCode: string;
      try {
        userCode = await generateNextUserCode();
      } catch (codeError) {
        userCode = `PERSON_${Date.now()}`;
      }

      // Validar departamento si se proporciona
      if (departmentId) {
        const deptExists = await prisma.department.findUnique({
          where: { id: departmentId },
        });

        if (!deptExists) {
          return res.status(404).json({
            error: 'Departamento no encontrado.',
          });
        }
      }

      // ✅ CORRECCIÓN CRÍTICA: Construir objeto de datos correctamente
      const createData: any = {
        firstName: firstName || null,
        lastName: lastName || null,
        fullName: `${firstName || ''} ${lastName || ''}`.trim() || null,
        contactEmail: contactEmail || null,
        phoneNumber: phoneNumber || null,
        departmentId: departmentId || null,
        position: position || null,
        status: status || 'Activo',
        userCode,
      };

      // ✅ Solo agregar userId si se proporciona y no es null/undefined
      if (userId) {
        createData.userId = userId;
      }
      // Si no se proporciona userId, dejarlo como undefined (Prisma lo manejará como NULL)

      // ✅ CORRECCIÓN: Incluir user solo si userId fue proporcionado
      const includeOptions: any = {
        department: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      };

      // Solo incluir user si userId fue proporcionado
      if (userId) {
        includeOptions.user = {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            isActive: true,
          },
        };
      }

      const newPerson = await prisma.person.create({
        data: createData,
        include: includeOptions,
      });

      res.status(201).json(newPerson);
    } catch (error: any) {
      console.error('Error creating person:', error);

      if (error.code === 'P2002') {
        let errorMessage = 'El código de usuario ya existe.';
        if (error.meta?.target) {
          if (error.meta.target.includes('contactEmail'))
            errorMessage = 'El email de contacto ya existe.';
          if (error.meta.target.includes('userCode'))
            errorMessage = 'El código de usuario ya existe.';
        }
        return res.status(409).json({ error: errorMessage });
      }

      if (error.code === 'P2025') {
        return res.status(404).json({
          error: 'Usuario o recurso relacionado no encontrado.',
        });
      }

      res.status(500).json({
        error: 'Error al crear la persona.',
        details: error.message,
      });
    }
  }

  // ✅ EDIT - Actualizar persona
  async Edit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        firstName,
        lastName,
        contactEmail,
        phoneNumber,
        departmentId,
        position,
        status,
        userId,
      } = req.body;

      // Validar que la persona existe
      const personExists = await prisma.person.findUnique({
        where: { id },
      });

      if (!personExists) {
        return res.status(404).json({ error: 'Persona no encontrada.' });
      }

      // Validar departamento si se proporciona
      if (departmentId) {
        const deptExists = await prisma.department.findUnique({
          where: { id: departmentId },
        });

        if (!deptExists) {
          return res.status(404).json({
            error: 'Departamento no encontrado.',
          });
        }
      }

      // Validar userId si se proporciona (para asignar o cambiar)
      if (userId) {
        const userExists = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!userExists) {
          return res.status(404).json({
            error: 'Usuario no encontrado.',
          });
        }

        // Si el userId es diferente al actual, validar que no tenga otro perfil
        if (userId !== personExists.userId) {
          const existingPerson = await prisma.person.findUnique({
            where: { userId },
          });

          if (existingPerson) {
            return res.status(409).json({
              error: 'Este usuario ya tiene un perfil de persona.',
            });
          }
        }
      }

      // Preparar datos a actualizar
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
      if (userId !== undefined) {
        personDataToUpdate.userId = userId === null || userId === '' ? null : userId;
      }

      // Calcular fullName si hay cambios en firstName o lastName
      if (firstName !== undefined || lastName !== undefined) {
        const newFirstName = firstName ?? personExists.firstName ?? '';
        const newLastName = lastName ?? personExists.lastName ?? '';
        personDataToUpdate.fullName = `${newFirstName} ${newLastName}`.trim() || null;
      }

      // Actualizar persona
      const updatedPerson = await prisma.person.update({
        where: { id },
        data: personDataToUpdate,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

      res.status(200).json(updatedPerson);
    } catch (error: any) {
      console.error('Error updating person:', error);

      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Persona no encontrada.' });
      }

      if (error.code === 'P2002') {
        let errorMessage = 'El email de contacto ya existe.';
        if (error.meta?.target) {
          if (error.meta.target.includes('contactEmail'))
            errorMessage = 'El email de contacto ya existe.';
        }
        return res.status(409).json({ error: errorMessage });
      }

      res.status(500).json({
        error: 'Error al actualizar la persona.',
        details: error.message,
      });
    }
  }

  // ✅ DELETE - Eliminar persona
  async Delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const personExists = await prisma.person.findUnique({
        where: { id },
      });

      if (!personExists) {
        return res.status(404).json({ error: 'Persona no encontrada.' });
      }

      const deletedPerson = await prisma.person.delete({
        where: { id },
      });

      res.status(200).json({
        message: 'Persona eliminada exitosamente.',
        person: deletedPerson,
      });
    } catch (error: any) {
      console.error('Error deleting person:', error);

      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Persona no encontrada.' });
      }

      res.status(500).json({
        error: 'Error al eliminar la persona.',
        details: error.message,
      });
    }
  }
}