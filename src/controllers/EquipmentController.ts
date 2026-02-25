import { Request, Response } from 'express';
import { put, del } from '@vercel/blob';
import { prisma } from '../../lib/prisma.js';
import { EquipmentStatus } from '../../generated/prisma/index.js';
import { generatePlateNumber, isValidPlateNumber } from './PlateNumberGenerator.js'; // ✅ Importar
declare global {
    namespace Express {
        interface Request {
            file?: Express.Multer.File;
        }
    }
}

const VALID_EQUIPMENT_STATUS = ['ACTIVE', 'IN_MAINTENANCE', 'DISPOSED', 'DAMAGED', 'ASSIGNED', 'STORAGE'] as const;

// ✅ Include reutilizable
const equipmentInclude = {
    company: { select: { id: true, name: true, code: true } },
    assignedToPerson: {
        select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            contactEmail: true,
            position: true,
        }
    },
};

export class EquipmentController {

    async Create(req: Request, res: Response) {
        try {
            const {
                type,
                brand,
                model,
                serialNumber,
                plateNumber, // ✅ Puede venir o no
                cost,
                location,
                status,
                acquisitionDate,
                warrantyDetails,
                qrCode,
                invoiceUrl,
                companyId,
                assignedToPersonId,
                endUser,
                operatingSystem
            } = req.body;

            if (!type || !brand || !model || !serialNumber || !companyId) {
                return res.status(400).json({
                    error: 'Faltan campos obligatorios: tipo, marca, modelo, número de serie e ID de compañía.'
                });
            }

            // ✅ GENERAR PLATE NUMBER AUTOMÁTICAMENTE
            let finalPlateNumber = plateNumber;

            if (!finalPlateNumber) {
                console.log('📌 Generando plateNumber automáticamente...');
                finalPlateNumber = await generatePlateNumber(prisma);
                console.log(`✅ PlateNumber generado: ${finalPlateNumber}`);
            } else if (!isValidPlateNumber(finalPlateNumber)) {
                // Si viene un plateNumber pero no tiene formato válido, lo rechazamos
                return res.status(400).json({
                    error: 'El formato del número de placa debe ser IT-XXXXXX (6 caracteres alfanuméricos).'
                });
            }

            const newEquipment = await prisma.equipment.create({
                data: {
                    type,
                    brand,
                    model,
                    serialNumber,
                    plateNumber: finalPlateNumber, // ✅ Asignar plateNumber generado
                    cost: cost ? parseFloat(cost) : 0,
                    location: location || null,
                    status: (VALID_EQUIPMENT_STATUS.includes(status) ? status : 'ACTIVE') as EquipmentStatus,
                    acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
                    warrantyDetails: warrantyDetails || null,
                    qrCode: qrCode || null,
                    invoiceUrl: invoiceUrl || null,
                    company: { connect: { id: companyId } },
                    ...(assignedToPersonId && { assignedToPerson: { connect: { id: assignedToPersonId } } }),
                    endUser: endUser || null,
                    operatingSystem: operatingSystem || null,
                },
                include: equipmentInclude,
            });

            res.status(201).json(newEquipment);
        } catch (error: any) {
            console.error('Error al crear el equipo:', error);
            if (error.code === 'P2002') {
                return res.status(409).json({ error: 'Ya existe un equipo con este número de serie o número de placa.' });
            }
            if (error.code === 'P2025') {
                return res.status(400).json({ error: 'La compañía o la persona asignada no existen.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear el equipo.' });
        }
    }

    async uploadInvoice(req: Request, res: Response) {
        try {
            const { equipmentId } = req.params;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
            }

            const equipment = await prisma.equipment.findUnique({
                where: { id: equipmentId },
            });

            if (!equipment) {
                return res.status(404).json({ error: 'Equipo no encontrado.' });
            }

            if (equipment.invoiceUrl) {
                try {
                    await del(equipment.invoiceUrl);
                } catch (delError) {
                    console.warn('Error deleting old invoice:', delError);
                }
            }

            const filename = `equipment/${equipmentId}/${Date.now()}-${file.originalname}`;
            const blob = await put(filename, file.buffer, {
                access: 'public',
                contentType: file.mimetype,
            });

            const updatedEquipment = await prisma.equipment.update({
                where: { id: equipmentId },
                data: { invoiceUrl: blob.url },
                include: equipmentInclude,
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

    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const equipment = await prisma.equipment.findUnique({
                where: { id },
            });

            if (!equipment) {
                return res.status(404).json({ error: 'Equipo no encontrado.' });
            }

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
                assignedToPersonId,
                endUser,
                operatingSystem
            } = req.body;

            // ✅ Validar plateNumber si se intenta cambiar
            if (plateNumber !== undefined && plateNumber !== null && !isValidPlateNumber(plateNumber)) {
                return res.status(400).json({
                    error: 'El formato del número de placa debe ser IT-XXXXXX (6 caracteres alfanuméricos).'
                });
            }

            // ✅ NUEVO: Verificar si el equipo actual tiene plateNumber
            const currentEquipment = await prisma.equipment.findUnique({
                where: { id },
                select: { plateNumber: true }
            });

            if (!currentEquipment) {
                return res.status(404).json({ error: 'Equipo no encontrado.' });
            }

            // ✅ Si no tiene plateNumber, generar uno automáticamente
            let finalPlateNumber = plateNumber;
            if (!currentEquipment.plateNumber && !plateNumber) {
                console.log(`📌 Generando plateNumber automáticamente para equipo ${id}`);
                finalPlateNumber = await generatePlateNumber(prisma);
                console.log(`✅ PlateNumber generado: ${finalPlateNumber}`);
            }

            const updatedEquipment = await prisma.equipment.update({
                where: { id },
                data: {
                    ...(type && { type }),
                    ...(brand && { brand }),
                    ...(model && { model }),
                    ...(serialNumber && { serialNumber }),
                    ...(finalPlateNumber && { plateNumber: finalPlateNumber }), // ✅ Usar plateNumber generado si aplica
                    ...(cost !== undefined && { cost: parseFloat(cost) }),
                    ...(location !== undefined && { location }),
                    ...(status && VALID_EQUIPMENT_STATUS.includes(status) && { status: status as EquipmentStatus }),
                    ...(acquisitionDate && { acquisitionDate: new Date(acquisitionDate) }),
                    ...(warrantyDetails !== undefined && { warrantyDetails }),
                    ...(qrCode !== undefined && { qrCode }),
                    ...(invoiceUrl !== undefined && { invoiceUrl }),
                    ...(companyId && { company: { connect: { id: companyId } } }),
                    ...(assignedToPersonId !== undefined && {
                        assignedToPerson: assignedToPersonId
                            ? { connect: { id: assignedToPersonId } }
                            : { disconnect: true }
                    }),
                    ...(endUser !== undefined && { endUser }),
                    ...(operatingSystem !== undefined && { operatingSystem }),
                },
                include: equipmentInclude,
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

    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const equipment = await prisma.equipment.findUnique({
                where: { id },
                include: {
                    ...equipmentInclude,
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

            // ✅ NUEVO: Si no tiene plateNumber, generar automáticamente
            if (!equipment.plateNumber) {
                console.log(`📌 Equipo sin plateNumber detectado: ${id}`);
                const generatedPlate = await generatePlateNumber(prisma);
                console.log(`✅ Generando y asignando plateNumber: ${generatedPlate}`);
                
                try {
                    // Guardar el plateNumber generado
                    const updatedEquipment = await prisma.equipment.update({
                        where: { id },
                        data: { plateNumber: generatedPlate },
                        include: {
                            ...equipmentInclude,
                            maintenances: {
                                select: { id: true, title: true, type: true, status: true, scheduledDate: true },
                                orderBy: { scheduledDate: 'desc' }
                            },
                            documents: {
                                select: { id: true, title: true, fileType: true }
                            }
                        }
                    });
                    res.json(updatedEquipment);
                } catch (updateError: any) {
                    console.error('Error al guardar plateNumber:', updateError);
                    // Si hay conflicto (ej: otro proceso generó el mismo), retornar el equipo actual
                    if (updateError.code === 'P2002') {
                        const retryEquipment = await prisma.equipment.findUnique({
                            where: { id },
                            include: {
                                ...equipmentInclude,
                                maintenances: {
                                    select: { id: true, title: true, type: true, status: true, scheduledDate: true },
                                    orderBy: { scheduledDate: 'desc' }
                                },
                                documents: {
                                    select: { id: true, title: true, fileType: true }
                                }
                            }
                        });
                        res.json(retryEquipment);
                    } else {
                        throw updateError;
                    }
                }
            } else {
                res.json(equipment);
            }
        } catch (error: any) {
            console.error('Error al obtener el equipo:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener el equipo.' });
        }
    }

    async getAll(req: Request, res: Response) {
        try {
            const equipment = await prisma.equipment.findMany({
                include: {
                    ...equipmentInclude,
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
                    ...equipmentInclude,
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