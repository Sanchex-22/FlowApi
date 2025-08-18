// src/network/network.controller.ts
import { PrismaClient, NetworkDeviceType, NetworkDeviceStatus } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export class NetworkController {

    async Create(req: Request, res: Response) {
        try {
            const {
                name,
                ipAddress,
                macAddress,
                deviceType,
                status,
                location,
                description,
                serialNumber,
                brand,
                purchaseDate,
                warrantyEndDate,
                notes,
                model,
                companyId,
                assignedToUserId,
            } = req.body;

            // Validación de campos obligatorios
            if (!name || !ipAddress || !companyId || !deviceType) {
                return res.status(400).json({ error: 'Los campos nombre, IP, compañía y tipo de dispositivo son obligatorios.' });
            }

            const newNetworkDevice = await prisma.network.create({
                data: {
                    name,
                    ipAddress,
                    macAddress,
                    deviceType: deviceType as NetworkDeviceType, // Se asegura que el string coincida con el enum
                    status: status as NetworkDeviceStatus,
                    location,
                    description,
                    serialNumber,
                    brand,
                    purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
                    warrantyEndDate: warrantyEndDate ? new Date(warrantyEndDate) : undefined,
                    notes,
                    model,
                    company: { connect: { id: companyId } },
                    assignedToUser: assignedToUserId ? { connect: { id: assignedToUserId } } : undefined,
                },
            });

            res.status(201).json({ message: 'Dispositivo de red creado exitosamente', data: newNetworkDevice });
        } catch (error: any) {
            console.error('Error al crear el dispositivo de red:', error);
            // Error de restricción única (ej. IP, MAC o Serial duplicados)
            if (error.code === 'P2002') {
                return res.status(409).json({ error: `Conflicto: El valor para ${error.meta.target.join(', ')} ya existe.` });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear el dispositivo de red.' });
        }
    }

    /**
     * Elimina un dispositivo de red por su ID.
     */
    async Delete(req: Request, res: Response) {
        const { id } = req.params;
        try {
            await prisma.network.delete({
                where: { id },
            });
            res.status(200).json({ message: 'Dispositivo de red eliminado exitosamente.' });
        } catch (error: any) {
            console.error(`Error al eliminar el dispositivo de red con ID ${id}:`, error);
            // Error cuando el registro a eliminar no se encuentra
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Dispositivo de red no encontrado.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al eliminar el dispositivo de red.' });
        }
    }

    /**
     * Edita un dispositivo de red existente por su ID.
     */
    async Edit(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const {
                name,
                ipAddress,
                macAddress,
                deviceType,
                status,
                location,
                description,
                serialNumber,
                brand,
                purchaseDate,
                warrantyEndDate,
                notes,
                model,
                companyId,
                assignedToUserId,
            } = req.body;

            const updatedDevice = await prisma.network.update({
                where: { id },
                data: {
                    name,
                    ipAddress,
                    macAddress,
                    deviceType: deviceType as NetworkDeviceType,
                    status: status as NetworkDeviceStatus,
                    location,
                    description,
                    serialNumber,
                    brand,
                    purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
                    warrantyEndDate: warrantyEndDate ? new Date(warrantyEndDate) : undefined,
                    notes,
                    model,
                    company: companyId ? { connect: { id: companyId } } : undefined,
                    assignedToUser: assignedToUserId ? { connect: { id: assignedToUserId } } : undefined,
                },
            });

            res.status(200).json({ message: 'Dispositivo de red actualizado exitosamente.', data: updatedDevice });
        } catch (error: any) {
            console.error(`Error al editar el dispositivo de red con ID ${id}:`, error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Dispositivo de red no encontrado.' });
            }
            if (error.code === 'P2002') {
                return res.status(409).json({ error: `Conflicto: El valor para ${error.meta.target.join(', ')} ya existe.` });
            }
            res.status(500).json({ error: 'Error interno del servidor al editar el dispositivo de red.' });
        }
    }


    /**
     * Obtiene un dispositivo de red por su ID.
     */
    async get(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const networkDevice = await prisma.network.findUnique({
                where: { id },
                include: {
                    company: true,
                    assignedToUser: {
                        select: { id: true, username: true, email: true } // Selecciona solo campos específicos del usuario
                    },
                },
            });

            if (!networkDevice) {
                return res.status(404).json({ error: 'Dispositivo de red no encontrado.' });
            }

            res.status(200).json(networkDevice);
        } catch (error: any) {
            console.error(`Error al obtener el dispositivo de red con ID ${id}:`, error);
            res.status(500).json({ error: 'Error interno del servidor al obtener el dispositivo de red.' });
        }
    }

    /**
     * Obtiene todos los dispositivos de red.
     */
    async getAll(req: Request, res: Response) {
        try {
            const allNetworkDevices = await prisma.network.findMany({
                include: {
                    company: {
                        select: { id: true, name: true } // Selecciona campos específicos de la compañía
                    },
                },
            });
            res.status(200).json(allNetworkDevices);
        } catch (error: any) {
            console.error('Error al obtener todos los dispositivos de red:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los dispositivos de red.' });
        }
    }
}