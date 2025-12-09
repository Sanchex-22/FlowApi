// src/equipment/equipment.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export class EquipmentController {

    /**
     * Creates a new equipment record.
     * @param req Express Request. Expects { type, brand, model, serialNumber, plateNumber?, location?, status?, acquisitionDate?, warrantyDetails?, qrCode?, companyId, assignedToUserId? } in the body.
     * @param res Express Response.
     */
    async Create(req: Request, res: Response) {
        try {
            const {
                type,
                brand,
                model,
                serialNumber,
                plateNumber,
                cost, // Se añadió el campo 'cost'
                location,
                status,
                acquisitionDate,
                warrantyDetails,
                qrCode,
                companyId,
                assignedToUserId
            } = req.body;

            if (!type || !brand || !model || !serialNumber || !companyId) {
                return res.status(400).json({ error: 'Faltan campos obligatorios: tipo, marca, modelo, número de serie e ID de compañía.' });
            }

            const newEquipment = await prisma.equipment.create({
                data: {
                    type,
                    brand,
                    model,
                    serialNumber,
                    plateNumber,
                    cost: cost ? parseFloat(cost) : undefined, // Se añade 'cost' y se parsea a un número si existe
                    location,
                    status: status || 'ACTIVE', // Default to ACTIVE
                    acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : undefined,
                    warrantyDetails,
                    qrCode,
                    company: { connect: { id: companyId } },
                    ...(assignedToUserId && { assignedToUser: { connect: { id: assignedToUserId } } }),
                },
            });

            res.status(201).json(newEquipment);
        } catch (error: any) {
            console.error('Error al crear el equipo:', error);
            if (error.code === 'P2002') { // Unique constraint violation (serialNumber or plateNumber)
                return res.status(409).json({ error: 'Ya existe un equipo con este número de serie o número de placa.' });
            }
            if (error.code === 'P2025') { // Foreign key constraint failed
                return res.status(400).json({ error: 'La compañía o el usuario asignado no existen.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear el equipo.' });
        }
    }

    /**
     * Deletes an equipment record by its ID.
     * @param req Express Request. Expects the equipment ID in req.params.
     * @param res Express Response.
     */
    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const equipment = await prisma.equipment.findUnique({
                where: { id },
            });

            if (!equipment) {
                return res.status(404).json({ error: 'Equipo no encontrado.' });
            }

            await prisma.equipment.delete({
                where: { id },
            });

            res.status(204).send();
        } catch (error) {
            console.error('Error al eliminar el equipo:', error);
            res.status(500).json({ error: 'Error interno del servidor al eliminar el equipo.' });
        }
    }

    /**
     * Edits an existing equipment record by its ID.
     * @param req Express Request. Expects the ID in req.params and the data to update in req.body.
     * @param res Express Response.
     */
    async Edit(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const {
                type,
                brand,
                model,
                serialNumber,
                plateNumber,
                cost, // Se añadió el campo 'cost'
                location,
                status,
                acquisitionDate,
                warrantyDetails,
                qrCode,
                companyId,
                assignedToUserId
            } = req.body;

            const updatedEquipment = await prisma.equipment.update({
                where: { id },
                data: {
                    type,
                    brand,
                    model,
                    serialNumber,
                    plateNumber,
                    cost: cost ? parseFloat(cost) : undefined, // Se añade 'cost' y se parse al número
                    location,
                    status,
                    acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : undefined,
                    warrantyDetails,
                    qrCode,
                    ...(companyId && { company: { connect: { id: companyId } } }),
                    ...(assignedToUserId && { assignedToUser: { connect: { id: assignedToUserId } } }),
                },
            });

            res.json(updatedEquipment);
        } catch (error: any) {
            console.error('Error al editar el equipo:', error);
            if (error.code === 'P2025') { // Record not found or foreign key constraint failed
                return res.status(404).json({ error: 'Equipo no encontrado o ID de relación inválido.' });
            }
            if (error.code === 'P2002') { // Unique constraint violation
                return res.status(409).json({ error: 'Ya existe un equipo con el número de serie o número de placa proporcionado.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al editar el equipo.' });
        }
    }

    /**
     * Gets an equipment record by its ID.
     * @param req Express Request. Expects the equipment ID in req.params.
     * @param res Express Response.
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const equipment = await prisma.equipment.findUnique({
                where: { id },
                include: {
                    company: { select: { name: true, code: true } },
                    assignedToUser: {
                        select: { username: true, email: true, person: { select: { fullName: true } } }
                    },
                    maintenances: {
                        select: { id: true, title: true, type: true, status: true, scheduledDate: true },
                        orderBy: { scheduledDate: 'desc' }
                    },
                    documents: {
                        select: { id: true, title: true, fileType: true }
                    }
                }
            });

            if (!equipment) {
                return res.status(404).json({ error: 'Equipo no encontrado.' });
            }
            res.json(equipment);
        } catch (error) {
            console.error('Error al obtener el equipo:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener el equipo.' });
        }
    }

    /**
     * Gets all equipment records.
     * @param req Express Request.
     * @param res Express Response.
     */
    async getAll(req: Request, res: Response) {
        try {
            const equipment = await prisma.equipment.findMany({
                include: {
                    company: { select: { name: true } },
                    assignedToUser: { select: { username: true, person: { select: { fullName: true } } } },
                    _count: {
                        select: {
                            maintenances: true,
                            documents: true
                        }
                    }
                }
            });
            res.json(equipment);
        } catch (error) {
            console.error('Error al obtener los equipos:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los equipos.' });
        }
    }

    async getEquipmentByCompanyCode(req: Request, res: Response): Promise<void> {
        const { companyId } = req.params;

        try {
            const company = await prisma.company.findUnique({
                where: { id: companyId },
            });

            if (!company) {
                res.status(404).json({ message: `Empresa con código ${companyId} no encontrada` });
                return;
            }

            const inventory = await prisma.equipment.findMany({
                where: { companyId: company.id },
                include: {
                    assignedToUser: true,
                    maintenances: true,
                    documents: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            if (inventory.length === 0) {
                res.status(200).json({ message: "No hay equipos registrados en inventario" });
                return;
            }
            res.status(200).json(inventory);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener el inventario', error });
        }
    }
}
