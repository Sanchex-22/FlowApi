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

      // Obtener personas asociadas a esos usuarios
      const persons = await prisma.person.findMany({
        where: {
          OR: [
            {
              companyId: companyCode
            },
            {
              user: {
                companies: {
                  some: {
                    companyId: companyCode
                  }
                }
              }
            }
        ]
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

  async Create(req: Request, res: Response) {
    try {
      const {
        userId,
        firstName,
        lastName,
        contactEmail,
        phoneNumber,
        departmentId,
        companyId, // Este es el ID de la compañía donde trabaja la persona
        position,
        status,
      } = req.body;

      // 1. Validaciones básicas
      if (!firstName || !lastName) {
        return res.status(400).json({ error: 'Nombre y apellido obligatorios.' });
      }
      if (!companyId) {
        return res.status(400).json({ error: 'La compañía es obligatoria para crear una persona.' });
      }

      // 2. Validar existencia de la compañía
      const companyExists = await prisma.company.findUnique({ where: { id: companyId } });
      if (!companyExists) return res.status(404).json({ error: 'Compañía no encontrada.' });

      // 3. Lógica de Coherencia Usuario-Compañía
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { companies: true } // Traemos las relaciones UserCompany
        });

        if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

        // Verificamos si el usuario ya pertenece a esta compañía
        const isUserInCompany = user.companies.some(uc => uc.companyId === companyId);

        if (!isUserInCompany) {
          // OPCIÓN 1: AUTOMÁTICA (Recomendada) -> Agregamos el usuario a la compañía
          await prisma.userCompany.create({
            data: {
              userId: userId,
              companyId: companyId
            }
          });
          console.log(`Usuario ${user.username} agregado automáticamente a la compañía ${companyExists.name}`);

          // OPCIÓN 2: ESTRICTA (Si prefieres que de error, descomenta esto y comenta la Opción 1)
          /*
          return res.status(400).json({ 
            error: 'Incoherencia: El usuario seleccionado no pertenece a la compañía indicada.' 
          });
          */
        }

        // Validar que el usuario no tenga ya otra Persona asignada
        const existingPerson = await prisma.person.findUnique({ where: { userId } });
        if (existingPerson) return res.status(409).json({ error: 'Este usuario ya tiene un perfil.' });
      }

      // 4. Generar código y crear
      let userCode = await generateNextUserCode();

      const newPerson = await prisma.person.create({
        data: {
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim(),
          contactEmail,
          phoneNumber,
          position,
          status: status || 'Activo',
          userCode,
          companyId: companyId, // Asignamos la compañía
          departmentId: departmentId || null,
          userId: userId || null
        },
        include: {
          user: true,
          // company: true,
          department: true,
          
        }
      });

      res.status(201).json(newPerson);

    } catch (error: any) {
      // ... manejo de errores (P2002, etc)
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  async Edit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        firstName, lastName, contactEmail, phoneNumber,
        departmentId, position, status,
        userId,    // Posible cambio de usuario
        companyId  // Posible cambio de compañía (transferencia de empleado)
      } = req.body;

      // 1. Obtener persona actual
      const currentPerson = await prisma.person.findUnique({ where: { id } });
      if (!currentPerson) return res.status(404).json({ error: 'Persona no encontrada.' });

      // Determinar los valores finales para validar coherencia
      const finalCompanyId = companyId !== undefined ? companyId : currentPerson.companyId;
      const finalUserId = userId !== undefined ? userId : currentPerson.userId;

      // 2. Lógica de Coherencia (Solo si hay usuario y compañía definidos)
      if (finalUserId && finalCompanyId) {
        // Verificar si el usuario tiene acceso a la compañía final
        const userCompanyRelation = await prisma.userCompany.findUnique({
          where: {
            userId_companyId: {
              userId: finalUserId,
              companyId: finalCompanyId
            }
          }
        });

        if (!userCompanyRelation) {
          // OPCIÓN AUTOMÁTICA: Dar acceso al usuario a la nueva compañía
          await prisma.userCompany.create({
            data: { userId: finalUserId, companyId: finalCompanyId }
          });

          // OPCIÓN ESTRICTA:
          // return res.status(400).json({ error: 'El usuario no pertenece a la compañía destino.' });
        }
      }

      // 3. Preparar updateData
      const updateData: any = {};
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (firstName || lastName) {
        const f = firstName ?? currentPerson.firstName ?? '';
        const l = lastName ?? currentPerson.lastName ?? '';
        updateData.fullName = `${f} ${l}`.trim();
      }
      // ... resto de campos simples ...
      if (companyId !== undefined) updateData.companyId = companyId;
      if (userId !== undefined) updateData.userId = userId;
      if (departmentId !== undefined) updateData.departmentId = departmentId;

      // 4. Actualizar
      const updatedPerson = await prisma.person.update({
        where: { id },
        data: updateData,
        include: { user: true, company: true }
      });

      res.status(200).json(updatedPerson);

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
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