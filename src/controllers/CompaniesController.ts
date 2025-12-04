// src/companies/company.controller.ts
import { NextFunction, Request, Response } from 'express';
import { generateNextCompanyCode } from '../utils/companyCodeGenerator.js';
import prisma from '../../lib/prisma.js';

export class CompanyController {

    /**
     * Creates a new company
     * @param req Express Request with company data in body
     * @param res Express Response
     */
    async Create(req: Request, res: Response) {
        try {
            const { name, address, phone, email, createdByUserId } = req.body;

            // Validate that the company name is provided
            if (!name) {
                return res.status(400).json({ error: 'El nombre de la compañía es obligatorio.' });
            }

            // Generate the next available company code
            const companyCode = await generateNextCompanyCode(prisma);

            const newCompany = await prisma.company.create({
                data: {
                    name,
                    code: companyCode,
                    address,
                    phone,
                    email,
                    isActive: true,
                    ...(createdByUserId && {
                        createdBy: {
                            connect: { id: createdByUserId },
                        },
                    }),
                },
            });

            res.status(201).json(newCompany);
        } catch (error: any) {
            console.error('Error al crear la compañía:', error);
            if (error.code === 'P2002') {
                let errorMessage = 'Ya existe una compañía con este nombre o código.';
                if (error.meta?.target) {
                    if (error.meta.target.includes('name')) errorMessage = 'El nombre de la compañía ya existe.';
                    if (error.meta.target.includes('code')) errorMessage = 'El código de la compañía ya existe.';
                }
                return res.status(409).json({ error: errorMessage });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear la compañía.' });
        }
    }

    /**
     * Deletes a company and all its related data
     * Users are automatically disassociated (companyId set to null)
     * @param req Express Request with company ID in params
     * @param res Express Response
     */
    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // Verify company exists
            const company = await prisma.company.findUnique({
                where: { id },
                include: {
                    users: {
                        select: { id: true, username: true },
                    },
                },
            });

            if (!company) {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }

            // Log which users will be disassociated
            console.log(
                `Eliminando compañía "${company.name}" (${company.code}). ` +
                `${company.users.length} usuario(s) serán desasociado(s).`
            );

            // Delete the company
            // Due to the cascade configuration in schema.prisma:
            // - Departments, Equipment, Licenses, Maintenances, Documents, Networks, NetworkProviders will be DELETED
            // - Users will be DISASSOCIATED (companyId set to null)
            await prisma.company.delete({
                where: { id },
            });

            res.status(200).json({
                message: 'Compañía eliminada correctamente',
                deletedCompany: {
                    id: company.id,
                    name: company.name,
                    code: company.code,
                },
                usersDisassociated: company.users.length,
                usersDetails: company.users.map(u => ({
                    id: u.id,
                    username: u.username,
                    status: 'Desasociado',
                })),
            });
        } catch (error: any) {
            console.error('Error al eliminar la compañía:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al eliminar la compañía.' });
        }
    }

    /**
     * Updates an existing company
     * @param req Express Request with company ID in params and update data in body
     * @param res Express Response
     */
    async Edit(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { name, address, phone, email, isActive, createdByUserId } = req.body;

            const updatedCompany = await prisma.company.update({
                where: { id },
                data: {
                    name,
                    address,
                    phone,
                    email,
                    isActive,
                    ...(createdByUserId && {
                        createdBy: {
                            connect: { id: createdByUserId },
                        },
                    }),
                },
            });

            res.json(updatedCompany);
        } catch (error: any) {
            console.error('Error al editar la compañía:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Compañía no encontrada para actualizar.' });
            }
            if (error.code === 'P2002') {
                let errorMessage = 'Ya existe una compañía con el nombre o código proporcionado.';
                if (error.meta?.target) {
                    if (error.meta.target.includes('name')) errorMessage = 'El nombre de la compañía ya existe.';
                    if (error.meta.target.includes('code')) errorMessage = 'El código de la compañía ya existe.';
                }
                return res.status(409).json({ error: errorMessage });
            }
            res.status(500).json({ error: 'Error interno del servidor al editar la compañía.' });
            next(error);
        }
    }

    /**
     * Gets a single company with all its relations
     * @param req Express Request with company ID in params
     * @param res Express Response
     */
    async get(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            
            const company = await prisma.company.findUnique({
                where: { id },
                include: {
                    users: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            person: {
                                select: {
                                    fullName: true,
                                    position: true,
                                }
                            }
                        }
                    },
                    equipments: true,
                    licenses: true,
                    documents: true,
                    maintenances: true,
                    departments: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            isActive: true,
                        }
                    },
                }
            });

            if (!company) {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }

            res.json(company);
        } catch (error: any) {
            console.error('Error al obtener la compañía:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener la compañía.' });
            next(error);
        }
    }

    /**
     * Gets all companies with counts of related records
     * Filters based on user role:
     * - SUPER_ADMIN: sees all companies
     * - ADMIN: sees only their company
     * @param req Express Request with optional user context
     * @param res Express Response
     */
    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            // Optional: Filter by user's company if not super admin
            // const userRole = (req as any).user?.role;
            // const userId = (req as any).user?.id;
            // const userCompany = (req as any).user?.companyId;

            const companies = await prisma.company.findMany({
                include: {
                    _count: {
                        select: {
                            users: true,
                            equipments: true,
                            licenses: true,
                            documents: true,
                            maintenances: true,
                            departments: true,
                            networks: true,
                        }
                    },
                    departments: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            isActive: true,
                        },
                        where: { isActive: true },
                    },
                },
                orderBy: {
                    name: 'asc',
                }
            });

            res.json(companies);
        } catch (error: any) {
            console.error('Error al obtener las compañías:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener las compañías.' });
            next(error);
        }
    }

    /**
     * Gets companies filtered by user role
     * SUPER_ADMIN: sees all companies
     * ADMIN/USER: sees only their company
     * @param req Express Request with authenticated user
     * @param res Express Response
     */
    async getMyCompanies(req: Request, res: Response, next: NextFunction) {
        try {
            const userRole = (req as any).user?.role;
            const userCompanyId = (req as any).user?.companyId;

            let companies;

            if (userRole === 'SUPER_ADMIN') {
                // Super admin sees all companies
                companies = await prisma.company.findMany({
                    include: {
                        _count: {
                            select: {
                                users: true,
                                equipments: true,
                                licenses: true,
                                documents: true,
                                maintenances: true,
                                departments: true,
                            }
                        },
                        departments: {
                            select: {
                                id: true,
                                name: true,
                                isActive: true,
                            },
                        },
                    },
                    orderBy: { name: 'asc' },
                });
            } else if (userCompanyId) {
                // Other roles see only their company
                companies = await prisma.company.findMany({
                    where: { id: userCompanyId },
                    include: {
                        _count: {
                            select: {
                                users: true,
                                equipments: true,
                                licenses: true,
                                documents: true,
                                maintenances: true,
                                departments: true,
                            }
                        },
                        departments: {
                            select: {
                                id: true,
                                name: true,
                                isActive: true,
                            },
                        },
                    },
                });
            } else {
                return res.status(403).json({ error: 'Usuario no asociado a ninguna compañía.' });
            }

            res.json(companies);
        } catch (error: any) {
            console.error('Error al obtener compañías del usuario:', error);
            res.status(500).json({ error: 'Error interno del servidor.' });
            next(error);
        }
    }

    /**
     * Gets all departments of a company by company code
     * @param req Express Request with company code in params
     * @param res Express Response
     */
    async getDepartmentsByCompanyCode(req: Request, res: Response) {
        try {
            const { companyCode } = req.params;

            console.log('getDepartmentsByCompanyCode - Params recibidos:', req.params);
            console.log('companyCode:', companyCode);

            if (!companyCode) {
                return res.status(400).json({ error: 'El código de la compañía es obligatorio.' });
            }

            const company = await prisma.company.findUnique({
                where: { code: companyCode },
                include: {
                    departments: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            isActive: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                        orderBy: { name: 'asc' },
                    },
                },
            });

            if (!company) {
                console.log(`Compañía con código '${companyCode}' no encontrada`);
                return res.status(404).json({ 
                    error: `Compañía con código '${companyCode}' no encontrada.`,
                    receivedCode: companyCode,
                });
            }

            if (company.departments.length === 0) {
                console.log(`Compañía '${companyCode}' no tiene departamentos`);
                return res.status(404).json({ 
                    error: `Compañía con código '${companyCode}' no tiene departamentos.` 
                });
            }

            res.status(200).json(company.departments);

        } catch (error: any) {
            console.error('Error fetching departments by company code:', error);
            res.status(500).json({ 
                error: 'Error interno del servidor al obtener los departamentos de la compañía.',
                details: error.message 
            });
        }
    }

    /**
     * Disassociate users from a company (set companyId to null)
     * Useful when you want to remove users without deleting the company
     * @param req Express Request with company ID in params and userIds in body
     * @param res Express Response
     */
    async disassociateUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { userIds } = req.body;

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({ error: 'Se requiere un array de IDs de usuarios.' });
            }

            // Verify company exists
            const company = await prisma.company.findUnique({
                where: { id },
            });

            if (!company) {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }

            // Update users to remove company association
            const updatedUsers = await prisma.user.updateMany({
                where: {
                    id: { in: userIds },
                    companyId: id, // Only update users from this company
                },
                data: {
                    companyId: null,
                },
            });

            res.json({
                message: 'Usuarios desasociados correctamente',
                updatedCount: updatedUsers.count,
                companyId: id,
            });
        } catch (error: any) {
            console.error('Error al desasociar usuarios:', error);
            res.status(500).json({ error: 'Error interno del servidor al desasociar usuarios.' });
            next(error);
        }
    }
}