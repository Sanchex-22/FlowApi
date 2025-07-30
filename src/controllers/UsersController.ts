// src/auth/user.controller.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
// Asegúrate de que esta ruta sea correcta para tu proyecto
import { generateNextUserCode } from '../../prisma/seed.js';

const prisma = new PrismaClient();

export class UserController {

async Create(req: Request, res: Response) {
    const {
        username,
        email,
        password,
        role,
        companyId,
        firstName,
        lastName,
        contactEmail,
        phoneNumber,
        departmentId,
        position,
    } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email y password son obligatorios.' });
    }

    if (!companyId) {
        return res.status(400).json({ error: 'El campo companyId es obligatorio.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserCode = await generateNextUserCode(prisma);

        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                role: role || 'USER',
                companyId,
                person: {
                    create: {
                        firstName,
                        lastName,
                        fullName: `${firstName || ''} ${lastName || ''}`.trim(),
                        contactEmail,
                        phoneNumber,
                        department: departmentId
                            ? { connect: { id: departmentId } }
                            : undefined,
                        position,
                        userCode: newUserCode,
                    },
                },
            },
            include: {
                person: {
                    include: {
                        department: true,
                    },
                },
            },
        });

        return res.status(201).json(newUser);
    } catch (error: any) {
        if (error.code === 'P2002') {
            let errorMessage = 'Username, email o userCode ya existen.';
            if (error.meta?.target) {
                if (error.meta.target.includes('username')) errorMessage = 'El username ya existe.';
                if (error.meta.target.includes('email')) errorMessage = 'El email ya existe.';
                if (error.meta.target.includes('userCode')) errorMessage = 'El userCode generado ya existe. Por favor, inténtelo de nuevo.';
                if (error.meta.target.includes('contactEmail')) errorMessage = 'El email de contacto ya existe.';
                if (error.meta.target.includes('fullName')) errorMessage = 'El nombre completo ya existe.';
            }
            return res.status(409).json({ error: errorMessage });
        }

        console.error('Error creating user:', error);
        return res.status(500).json({ error: 'Error al crear el usuario.', details: error.message });
    }
}


    async Delete(req: Request, res: Response) {
        const { id } = req.params;

        try {
            // Eliminar la persona asociada primero si existe una relación uno a uno
            // Opcional: Podrías considerar una eliminación en cascada en tu esquema Prisma si esto es común
            await prisma.person.deleteMany({
                where: { userId: id }
            });

            const deletedUser = await prisma.user.delete({
                where: { id },
            });
            res.status(200).json({ message: 'Usuario eliminado exitosamente.', user: deletedUser });
        } catch (error: any) {
            if (error.code === 'P2025') {
                // Código de error de Prisma para registro no encontrado
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }
            console.error('Error deleting user:', error);
            res.status(500).json({ error: 'Error al eliminar el usuario.', details: error.message });
        }
    }

    async Edit(req: Request, res: Response) {
        const { id } = req.params;
        // department ahora se espera como departmentId
        const { username, email, password, role, isActive, companyId, firstName, lastName, contactEmail, phoneNumber, departmentId, position, status, userCode } = req.body;

        try {
            // Preparar datos para actualizar el usuario
            const userDataToUpdate: any = {
                username,
                email,
                role,
                isActive,
                companyId,
            };

            // Si se proporciona una nueva contraseña, hashearla
            if (password) {
                userDataToUpdate.password = await bcrypt.hash(password, 10);
            }

            const updatedUser = await prisma.user.update({
                where: { id },
                data: userDataToUpdate,
                include: {
                    person: {
                        include: {
                            department: true, // Incluye el departamento en la respuesta de actualización
                        },
                    },
                },
            });

            // Actualizar o crear la información de la persona
            // Solo procede si hay al menos un campo de persona en el body o si departmentId se envió
            if (firstName || lastName || contactEmail || phoneNumber || departmentId !== undefined || position || status || userCode) {
                const personDataToUpsert: any = {
                    firstName,
                    lastName,
                    fullName: `${firstName || updatedUser.person?.firstName || ''} ${lastName || updatedUser.person?.lastName || ''}`.trim(),
                    contactEmail,
                    phoneNumber,
                    position,
                    status,
                    userCode,
                };

                // Manejo específico para el campo 'department' (relación)
                if (departmentId !== undefined) { // Si departmentId fue enviado en el request (puede ser null)
                    if (departmentId === null || departmentId === '') { // Si es explícitamente null o cadena vacía, desconecta
                        personDataToUpsert.department = { disconnect: true };
                    } else { // De lo contrario, intenta conectar
                        personDataToUpsert.department = { connect: { id: departmentId } };
                    }
                }

                await prisma.person.upsert({
                    where: { userId: id },
                    update: personDataToUpsert,
                    create: {
                        userId: id,
                        ...personDataToUpsert,
                        // Al crear, el departamento solo se conecta si departmentId tiene un valor válido
                        department: (departmentId && departmentId !== '') ? { connect: { id: departmentId } } : undefined,
                    },
                });

                // Obtener el usuario con los datos de persona actualizados para la respuesta final
                const userWithUpdatedPerson = await prisma.user.findUnique({
                    where: { id },
                    include: {
                        person: {
                            include: {
                                department: true,
                            },
                        },
                    },
                });
                return res.status(200).json(userWithUpdatedPerson);
            }

            res.status(200).json(updatedUser);
        } catch (error: any) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }
            if (error.code === 'P2002') {
                let errorMessage = 'Username, email o userCode ya existen.';
                if (error.meta?.target) {
                    if (error.meta.target.includes('username')) errorMessage = 'El username ya existe.';
                    if (error.meta.target.includes('email')) errorMessage = 'El email ya existe.';
                    if (error.meta.target.includes('userCode')) errorMessage = 'El userCode ya existe.';
                    if (error.meta.target.includes('contactEmail')) errorMessage = 'El email de contacto ya existe.';
                    if (error.meta.target.includes('fullName')) errorMessage = 'El nombre completo ya existe.';
                }
                return res.status(409).json({ error: errorMessage });
            }
            console.error('Error updating user:', error);
            res.status(500).json({ error: 'Error al actualizar el usuario.', details: error.message });
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
                            department: true, // Incluir los datos del departamento asociado a la persona
                        },
                    },
                    company: true, // Incluir la compañía a la que pertenece el usuario
                    assignedEquipments: true, // Incluir equipos asignados
                    assignedMaintenances: true, // Incluir mantenimientos asignados
                    createdCompanies: true, // Incluir compañías creadas por este usuario
                    assignedNetworks: true, // Incluir redes asignadas
                },
            });
            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }
            res.status(200).json(user); // Status 200 para éxito
        } catch (error: any) {
            console.error('Error fetching user:', error); // Mejorar el log de error
            res.status(500).json({ error: 'Error al obtener el usuario.', details: error.message });
        }
    }

    async getAll(req: Request, res: Response) {
        try {
            const users = await prisma.user.findMany({
                include: {
                    person: {
                        include: {
                            department: true, // Incluir el departamento asociado a la persona
                        },
                    },
                    company: true,
                },
            });
            res.status(200).json(users);
        } catch (error: any) {
            console.error('Error fetching all users:', error);
            res.status(500).json({ error: 'Error al obtener los usuarios.', details: error.message });
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
                            department: true, // Incluir el departamento asociado a la persona
                        },
                    },
                    company: true, // También es útil incluir la compañía del perfil
                    assignedEquipments: {
                        select: {
                            id: true,
                            type: true,
                            model: true,
                            serialNumber: true,
                            status: true
                        }
                    },
                    assignedMaintenances: {
                        select: {
                            id: true,
                            title: true,
                            type: true,
                            status: true,
                            scheduledDate: true
                        }
                    },
                    assignedNetworks: {
                        select: {
                            id: true,
                            name: true,
                            ipAddress: true,
                            deviceType: true,
                            status: true
                        }
                    },
                },
            });

            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }

            res.status(200).json(user);
        } catch (error: any) {
            console.error('Error fetching user profile:', error);
            res.status(500).json({ error: 'Error al obtener el perfil del usuario.', details: error.message });
        }
    }

    async getAllWithPerson(req: Request, res: Response) {
        try {
            const users = await prisma.user.findMany({
                include: {
                    person: {
                        include: {
                            department: true, // Incluir el departamento asociado a la persona
                        },
                    },
                },
            });
            res.status(200).json(users);
        } catch (error: any) {
            console.error('Error fetching users with person data:', error);
            res.status(500).json({ error: 'Error al obtener los usuarios.' });
        }
    }
}