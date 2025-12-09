// src/maintenance/maintenance.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export class MaintenanceController {

    /**
     * Creates a new maintenance record.
     * @param req Express Request. Expects { title, description?, type, status?, scheduledDate, completionDate?, cost?, equipmentId, assignedToUserId?, companyId } in the body.
     * @param res Express Response.
     */
    async Create(req: Request, res: Response) {
        try {
            const {
                title,
                description,
                type,
                status,
                scheduledDate,
                completionDate,
                cost,
                equipmentId,
                assignedToUserId,
                companyId
            } = req.body;

            // Basic validation
            if (!title || !type || !scheduledDate || !equipmentId || !companyId) {
                return res.status(400).json({ error: 'Faltan campos obligatorios: título, tipo, fecha programada, ID de equipo e ID de compañía.' });
            }

            const newMaintenance = await prisma.maintenance.create({
                data: {
                    title,
                    description,
                    type,
                    status: status || 'SCHEDULED', // Default to SCHEDULED if not provided
                    scheduledDate: new Date(scheduledDate),
                    completionDate: completionDate ? new Date(completionDate) : undefined,
                    cost: cost !== undefined ? parseFloat(cost) : undefined,
                    equipment: { connect: { id: equipmentId } },
                    company: { connect: { id: companyId } },
                    ...(assignedToUserId && { assignedToUser: { connect: { id: assignedToUserId } } }),
                },
            });

            res.status(201).json(newMaintenance);
        } catch (error: any) {
            console.error('Error al crear el mantenimiento:', error);
            if (error.code === 'P2025') { // Foreign key constraint failed (e.g., equipmentId or companyId not found)
                return res.status(400).json({ error: 'El equipo, la compañía o el usuario asignado no existen.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear el mantenimiento.' });
        }
    }

    /**
     * Deletes a maintenance record by its ID.
     * @param req Express Request. Expects the maintenance ID in req.params.
     * @param res Express Response.
     */
    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const maintenance = await prisma.maintenance.findUnique({
                where: { id },
            });

            if (!maintenance) {
                return res.status(404).json({ error: 'Mantenimiento no encontrado.' });
            }

            await prisma.maintenance.delete({
                where: { id },
            });

            res.status(204).send();
        } catch (error) {
            console.error('Error al eliminar el mantenimiento:', error);
            res.status(500).json({ error: 'Error interno del servidor al eliminar el mantenimiento.' });
        }
    }

    /**
     * Edits an existing maintenance record by its ID.
     * @param req Express Request. Expects the ID in req.params and the data to update in req.body.
     * @param res Express Response.
     */
    async Edit(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const {
                title,
                description,
                type,
                status,
                scheduledDate,
                completionDate,
                cost,
                equipmentId,
                assignedToUserId,
                companyId
            } = req.body;

            const updatedMaintenance = await prisma.maintenance.update({
                where: { id },
                data: {
                    title,
                    description,
                    type,
                    status,
                    scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                    completionDate: completionDate ? new Date(completionDate) : undefined,
                    cost: cost !== undefined ? parseFloat(cost) : undefined,
                    ...(equipmentId && { equipment: { connect: { id: equipmentId } } }),
                    ...(companyId && { company: { connect: { id: companyId } } }),
                    ...(assignedToUserId && { assignedToUser: { connect: { id: assignedToUserId } } }),
                },
            });

            res.json(updatedMaintenance);
        } catch (error: any) {
            console.error('Error al editar el mantenimiento:', error);
            if (error.code === 'P2025') { // Record not found or foreign key constraint failed
                return res.status(404).json({ error: 'Mantenimiento no encontrado o ID de relación inválido.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al editar el mantenimiento.' });
        }
    }

    /**
     * Gets a maintenance record by its ID.
     * @param req Express Request. Expects the maintenance ID in req.params.
     * @param res Express Response.
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const maintenance = await prisma.maintenance.findUnique({
                where: { id },
                include: {
                    equipment: {
                        select: { serialNumber: true, type: true, brand: true, model: true }
                    },
                    assignedToUser: {
                        select: { username: true, email: true, person: { select: { fullName: true } } }
                    },
                    company: {
                        select: { name: true, code: true }
                    }
                }
            });

            if (!maintenance) {
                return res.status(404).json({ error: 'Mantenimiento no encontrado.' });
            }
            res.json(maintenance);
        } catch (error) {
            console.error('Error al obtener el mantenimiento:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener el mantenimiento.' });
        }
    }

    /**
     * Gets all maintenance records.
     * @param req Express Request.
     * @param res Express Response.
     */
    async getAll(req: Request, res: Response) {
        try {
            const maintenances = await prisma.maintenance.findMany({
                include: {
                    equipment: {
                        select: { serialNumber: true, type: true }
                    },
                    assignedToUser: {
                        select: { username: true }
                    },
                    company: {
                        select: { name: true }
                    }
                }
            });
            res.json(maintenances);
        } catch (error) {
            console.error('Error al obtener los mantenimientos:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los mantenimientos.' });
        }
    }
    async getMaintenanceByCompanyCode(req: Request, res: Response) {
        const { companyId } = req.params;
        try {
            const company = await prisma.company.findUnique({
                where: { id: companyId },
            });

            if (!company) {
                res.status(404).json({ message: `Empresa con código ${companyId} no encontrada` });
                return;
            }

            const maintenances = await prisma.maintenance.findMany({
                where: {
                    companyId: company.id
                },
                include: {
                    equipment: {
                        select: { serialNumber: true, type: true }
                    },
                    assignedToUser: {
                        select: { username: true }
                    },
                    company: {
                        select: { name: true }
                    }
                }
            });
            res.json(maintenances);
        } catch (error) {
            console.error('Error al obtener los mantenimientos por código de compañía:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los mantenimientos por código de compañía.' });
        }   
    }
}