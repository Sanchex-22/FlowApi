// src/equipment/equipment.controller.ts
import { Request, Response } from 'express';
import { put, del } from '@vercel/blob';
import { prisma } from '../../lib/prisma.js';
import { EquipmentStatus } from '../../generated/prisma/enums.js';

declare global {
    namespace Express {
        interface Request {
            file?: Express.Multer.File;
        }
    }
}

// Valores válidos de EquipmentStatus según el schema
const VALID_EQUIPMENT_STATUS = ['ACTIVE', 'IN_MAINTENANCE', 'DISPOSED', 'DAMAGED', 'ASSIGNED', 'STORAGE'] as const;

export class EquipmentController {

    /**
     * Creates a new equipment record.
     * @param req Express Request. Expects { type, brand, model, serialNumber, plateNumber?, location?, status?, acquisitionDate?, warrantyDetails?, qrCode?, invoiceUrl?, cost?, companyId, assignedToUserId?, endUser?, operatingSystem? } in the body.
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
                cost,
                location,
                status,
                acquisitionDate,
                warrantyDetails,
                qrCode,
                invoiceUrl,
                companyId,
                assignedToUserId,
                endUser,
                operatingSystem
            } = req.body;

            if (!type || !brand || !model || !serialNumber || !companyId) {
                return res.status(400).json({ 
                    error: 'Faltan campos obligatorios: tipo, marca, modelo, número de serie e ID de compañía.' 
                });
            }

            const newEquipment = await prisma.equipment.create({
                data: {
                    type,
                    brand,
                    model,
                    serialNumber,
                    plateNumber: plateNumber || null,
                    cost: cost ? parseFloat(cost) : 0,
                    location: location || null,
                    status: (VALID_EQUIPMENT_STATUS.includes(status) ? status : 'ACTIVE') as EquipmentStatus,
                    acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
                    warrantyDetails: warrantyDetails || null,
                    qrCode: qrCode || null,
                    invoiceUrl: invoiceUrl || null,
                    company: { connect: { id: companyId } },
                    ...(assignedToUserId && { assignedToUser: { connect: { id: assignedToUserId } } }),
                    endUser: endUser || null,
                    operatingSystem: operatingSystem || null,
                },
                include: {
                    company: { select: { id: true, name: true, code: true } },
                    assignedToUser: { select: { id: true, username: true, email: true, person: { select: { fullName: true } } } },
                }
            });

            res.status(201).json(newEquipment);
        } catch (error: any) {
            console.error('Error al crear el equipo:', error);
            if (error.code === 'P2002') {
                return res.status(409).json({ error: 'Ya existe un equipo con este número de serie o número de placa.' });
            }
            if (error.code === 'P2025') {
                return res.status(400).json({ error: 'La compañía o el usuario asignado no existen.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear el equipo.' });
        }
    }

    /**
     * Uploads an invoice file to Vercel Blob
     */
    async uploadInvoice(req: Request, res: Response) {
        try {
            const { equipmentId } = req.params;
            const file = req.file;
            console.log('Received file:', file);
            if (!file) {
                return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
            }

            // Verify equipment exists
            const equipment = await prisma.equipment.findUnique({
                where: { id: equipmentId },
            });

            if (!equipment) {
                return res.status(404).json({ error: 'Equipo no encontrado.' });
            }

            // Delete old invoice if exists
            if (equipment.invoiceUrl) {
                try {
                    await del(equipment.invoiceUrl);
                } catch (delError) {
                    console.warn('Error deleting old invoice:', delError);
                }
            }

            // Upload new invoice to Vercel Blob
            const filename = `equipment/${equipmentId}/${Date.now()}-${file.originalname}`;
            const blob = await put(filename, file.buffer, {
                access: 'public',
                contentType: file.mimetype,
            });

            // Update equipment with new invoice URL
            const updatedEquipment = await prisma.equipment.update({
                where: { id: equipmentId },
                data: { invoiceUrl: blob.url },
                include: {
                    company: { select: { id: true, name: true } },
                    assignedToUser: { select: { id: true, username: true, email: true } },
                }
            });

            res.json({
                message: 'Factura subida exitosamente',
                invoiceUrl: blob.url,
                equipment: updatedEquipment
            });
        } catch (error: any) {
            console.error('Error al subir la factura:', error);
            res.status(500).json({ error: 'Error interno del servidor al subir la factura.' });
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

            // Delete invoice from Vercel Blob if exists
            if (equipment.invoiceUrl) {
                try {
                    await del(equipment.invoiceUrl);
                } catch (delError) {
                    console.warn('Error deleting invoice from blob:', delError);
                }
            }

            await prisma.equipment.delete({
                where: { id },
            });

            res.status(200).json({ message: 'Equipo eliminado exitosamente.' });
        } catch (error: any) {
            console.error('Error al eliminar el equipo:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Equipo no encontrado.' });
            }
            if (error.code === 'P2003') {
                return res.status(409).json({ 
                    error: 'No se puede eliminar el equipo porque tiene registros de mantenimiento asociados.' 
                });
            }
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
                cost,
                location,
                status,
                acquisitionDate,
                warrantyDetails,
                qrCode,
                invoiceUrl,
                companyId,
                assignedToUserId,
                endUser,
                operatingSystem
            } = req.body;

            const updatedEquipment = await prisma.equipment.update({
                where: { id },
                data: {
                    ...(type && { type }),
                    ...(brand && { brand }),
                    ...(model && { model }),
                    ...(serialNumber && { serialNumber }),
                    ...(plateNumber !== undefined && { plateNumber }),
                    ...(cost !== undefined && { cost: parseFloat(cost) }),
                    ...(location !== undefined && { location }),
                    ...(status && VALID_EQUIPMENT_STATUS.includes(status) && { status: status as EquipmentStatus }),
                    ...(acquisitionDate && { acquisitionDate: new Date(acquisitionDate) }),
                    ...(warrantyDetails !== undefined && { warrantyDetails }),
                    ...(qrCode !== undefined && { qrCode }),
                    ...(invoiceUrl !== undefined && { invoiceUrl }),
                    ...(companyId && { company: { connect: { id: companyId } } }),
                    ...(assignedToUserId && { assignedToUser: { connect: { id: assignedToUserId } } }),
                    ...(endUser !== undefined && { endUser }),
                    ...(operatingSystem !== undefined && { operatingSystem }),
                },
                include: {
                    company: { select: { id: true, name: true, code: true } },
                    assignedToUser: { select: { id: true, username: true, email: true, person: { select: { fullName: true } } } },
                }
            });

            res.json(updatedEquipment);
        } catch (error: any) {
            console.error('Error al editar el equipo:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Equipo no encontrado o ID de relación inválido.' });
            }
            if (error.code === 'P2002') {
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
                    company: { select: { id: true, name: true, code: true } },
                    assignedToUser: {
                        select: { id: true, username: true, email: true, person: { select: { fullName: true } } }
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
        } catch (error: any) {
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
                    company: { select: { id: true, name: true, code: true } },
                    assignedToUser: { select: { id: true, username: true, person: { select: { fullName: true } } } },
                    _count: {
                        select: {
                            maintenances: true,
                            documents: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            res.json(equipment);
        } catch (error: any) {
            console.error('Error al obtener los equipos:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los equipos.' });
        }
    }

    /**
     * Gets equipment by company ID
     */
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
                    company: { select: { id: true, name: true, code: true } },
                    assignedToUser: { select: { id: true, username: true, email: true } },
                    maintenances: {
                        select: { id: true, title: true, type: true, status: true }
                    },
                    documents: {
                        select: { id: true, title: true, fileType: true }
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            if (inventory.length === 0) {
                res.status(200).json({ message: "No hay equipos registrados en inventario" });
                return;
            }
            res.status(200).json(inventory);
        } catch (error: any) {
            console.error('Error al obtener el inventario:', error);
            res.status(500).json({ message: 'Error al obtener el inventario', error: error.message });
        }
    }

}