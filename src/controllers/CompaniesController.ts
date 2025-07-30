// src/companies/company.controller.ts
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
// Asegúrate de que esta ruta sea correcta para tu proyecto
import { generateNextCompanyCode } from '../utils/companyCodeGenerator.js';

const prisma = new PrismaClient();

export class CompanyController {

    /**
     * Creates a new company.
     * Automatically generates a sequential code for the company.
     * @param req Express Request. Expects { name, address?, phone?, email?, createdByUserId? } in the body.
     * @param res Express Response.
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
                    code: companyCode, // Assign the generated code
                    address,
                    phone,
                    email,
                    isActive: true, // By default, a new company is active
                    // Optional: connect to the creating user if an ID is provided
                    ...(createdByUserId && {
                        createdBy: {
                            connect: { id: createdByUserId },
                        },
                    }),
                },
                // Incluir departamentos para la respuesta de creación si se desea
                // include: {
                //     departments: true,
                // }
            });

            res.status(201).json(newCompany); // 201 Created
        } catch (error: any) {
            console.error('Error al crear la compañía:', error);
            // Handle uniqueness errors (e.g., name or code already exist)
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
     * Deletes a company by its ID.
     * Handles deletion of associated departments before deleting the company.
     * @param req Express Request. Expects the company ID in req.params.
     * @param res Express Response.
     */
    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const company = await prisma.company.findUnique({
                where: { id },
            });

            if (!company) {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }

            // Primero, elimina todos los departamentos asociados a esta compañía
            await prisma.department.deleteMany({
                where: { companyId: id },
            });

            // Luego, elimina la compañía
            await prisma.company.delete({
                where: { id },
            });

            res.status(204).send(); // 204 No Content for successful deletion
        } catch (error: any) {
            console.error('Error al eliminar la compañía:', error);
            if (error.code === 'P2025') {
                 return res.status(404).json({ error: 'Compañía no encontrada.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al eliminar la compañía.' });
        }
    }

    /**
     * Edits an existing company by its ID.
     * @param req Express Request. Expects the ID in req.params and the data to update in req.body.
     * @param res Express Response.
     */
    async Edit(req: Request, res: Response) {
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
                    // Optional: update the company creator
                    ...(createdByUserId && {
                        createdBy: {
                            connect: { id: createdByUserId },
                        },
                    }),
                },
                // Incluir departamentos para la respuesta de edición si se desea
                // include: {
                //     departments: true,
                // }
            });

            res.json(updatedCompany);
        } catch (error: any) {
            console.error('Error al editar la compañía:', error);
            if (error.code === 'P2025') { // Record not found
                return res.status(404).json({ error: 'Compañía no encontrada para actualizar.' });
            }
            if (error.code === 'P2002') { // Unique constraint violation
                 let errorMessage = 'Ya existe una compañía con el nombre o código proporcionado.';
                if (error.meta?.target) {
                    if (error.meta.target.includes('name')) errorMessage = 'El nombre de la compañía ya existe.';
                    if (error.meta.target.includes('code')) errorMessage = 'El código de la compañía ya existe.';
                }
                return res.status(409).json({ error: errorMessage });
            }
            res.status(500).json({ error: 'Error interno del servidor al editar la compañía.' });
        }
    }

    /**
     * Gets a company by its ID.
     * Includes related users, equipments, licenses, documents, maintenances, and departments.
     * @param req Express Request. Expects the company ID in req.params.
     * @param res Express Response.
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const company = await prisma.company.findUnique({
                where: { id },
                include: { // Include common relations for a detailed view
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
                    departments: { // <--- **IMPORTANTE: Se ha añadido esta línea para incluir los departamentos**
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
        } catch (error) {
            console.error('Error al obtener la compañía:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener la compañía.' });
        }
    }

    /**
     * Gets all companies.
     * Includes counts of related users, equipments, licenses, documents, maintenances, and departments.
     * @param req Express Request.
     * @param res Express Response.
     */
    async getAll(req: Request, res: Response) {
        try {
            const companies = await prisma.company.findMany({
                include: { // Include common relations for a list view if necessary
                    _count: {
                        select: {
                            users: true,
                            equipments: true,
                            licenses: true,
                            documents: true,
                            maintenances: true,
                            departments: true, // <--- **IMPORTANTE: Se ha añadido esta línea para incluir el conteo de departamentos**
                        }
                    },
                    // Si deseas obtener los datos completos de los departamentos en la lista, descomenta lo siguiente:
                    // departments: {
                    //     select: {
                    //         id: true,
                    //         name: true,
                    //     }
                    // }
                }
            });
            res.json(companies);
        } catch (error) {
            console.error('Error al obtener las compañías:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener las compañías.' });
        }
    }

    /**
     * Retrieves all departments belonging to a specific company identified by its code.
     * @param req Express Request. Expects the company code in req.params.
     * @param res Express Response.
     */
    async getDepartmentsByCompanyCode(req: Request, res: Response) {
        try {
            const { companyCode } = req.params; // Asume que el código de la compañía viene en los parámetros de la URL

            if (!companyCode) {
                return res.status(400).json({ error: 'El código de la compañía es obligatorio.' });
            }

            // Buscar la compañía por su código
            const company = await prisma.company.findUnique({
                where: { code: companyCode },
                // Incluir los departamentos directamente para obtenerlos en la misma consulta
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
                        orderBy: {
                            name: 'asc' // Opcional: ordenar los departamentos por nombre
                        }
                    },
                },
            });

            if (!company) {
                return res.status(404).json({ error: `Compañía con código '${companyCode}' no encontrada.` });
            }

            if (company.departments.length === 0) {
                return res.status(404).json({ error: `Compañía con código '${companyCode}' no tiene departamentos.` });
            }

            // Si la compañía existe, devuelve sus departamentos
            res.status(200).json(company.departments);

        } catch (error: any) {
            console.error('Error fetching departments by company code:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los departamentos de la compañía.', details: error.message });
        }
    }
}