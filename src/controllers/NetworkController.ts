// src/network/network.controller.ts
import { Request, Response } from 'express';
import { NetworkDeviceStatus } from '../../generated/prisma/enums.js';
import prisma from '../../lib/prisma.js';

export class NetworkController {

    async Create(req: Request, res: Response) {
        try {
            const {
                name,
                status,
                location,
                description,
                notes,
                ssid,
                password,
                ip,
                dns,
                gw,
                uploadSpeed,
                downloadSpeed,
                companyId,
                assignedToUserId,
                createdByUserId,
                providerId,
            } = req.body;

            // Validación de campos obligatorios
            if (!name || !companyId) {
                return res.status(400).json({ error: 'Los campos nombre y compañía son obligatorios.' });
            }

            const newNetworkDevice = await prisma.network.create({
                data: {
                    name,
                    status: status as NetworkDeviceStatus || NetworkDeviceStatus.UNKNOWN,
                    location,
                    description,
                    notes,
                    ssid,
                    password,
                    ip,
                    dns,
                    gw,
                    uploadSpeed,
                    downloadSpeed,
                    company: { connect: { id: companyId } },
                    assignedToUser: assignedToUserId ? { connect: { id: assignedToUserId } } : undefined,
                    createdBy: createdByUserId ? { connect: { id: createdByUserId } } : undefined,
                    provider: providerId ? { connect: { id: providerId } } : undefined,
                },
                include: {
                    company: { select: { id: true, name: true } },
                    assignedToUser: { select: { id: true, username: true, email: true } },
                    createdBy: { select: { id: true, username: true, email: true } },
                    provider: true,
                },
            });

            res.status(201).json({ message: 'Dispositivo de red creado exitosamente', data: newNetworkDevice });
        } catch (error: any) {
            console.error('Error al crear el dispositivo de red:', error);
            if (error.code === 'P2002') {
                return res.status(409).json({ error: `Conflicto: El valor para ${error.meta.target.join(', ')} ya existe.` });
            }
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'La compañía, usuario o proveedor no existe.' });
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
                status,
                location,
                description,
                notes,
                ssid,
                password,
                ip,
                dns,
                gw,
                uploadSpeed,
                downloadSpeed,
                companyId,
                assignedToUserId,
                createdByUserId,
                providerId,
            } = req.body;

            // Construir objeto de actualización dinámicamente
            const updateData: any = {};
            if (name !== undefined) updateData.name = name;
            if (status !== undefined) updateData.status = status as NetworkDeviceStatus;
            if (location !== undefined) updateData.location = location;
            if (description !== undefined) updateData.description = description;
            if (notes !== undefined) updateData.notes = notes;
            if (ssid !== undefined) updateData.ssid = ssid;
            if (password !== undefined) updateData.password = password;
            if (ip !== undefined) updateData.ip = ip;
            if (dns !== undefined) updateData.dns = dns;
            if (gw !== undefined) updateData.gw = gw;
            if (uploadSpeed !== undefined) updateData.uploadSpeed = uploadSpeed;
            if (downloadSpeed !== undefined) updateData.downloadSpeed = downloadSpeed;

            if (companyId !== undefined) {
                updateData.company = { connect: { id: companyId } };
            }
            if (assignedToUserId !== undefined) {
                updateData.assignedToUser = assignedToUserId ? { connect: { id: assignedToUserId } } : { disconnect: true };
            }
            if (createdByUserId !== undefined) {
                updateData.createdBy = createdByUserId ? { connect: { id: createdByUserId } } : { disconnect: true };
            }
            if (providerId !== undefined) {
                updateData.provider = providerId ? { connect: { id: providerId } } : { disconnect: true };
            }

            const updatedDevice = await prisma.network.update({
                where: { id },
                data: updateData,
                include: {
                    company: { select: { id: true, name: true } },
                    assignedToUser: { select: { id: true, username: true, email: true } },
                    createdBy: { select: { id: true, username: true, email: true } },
                    provider: true,
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
                    company: { select: { id: true, name: true } },
                    assignedToUser: {
                        select: { id: true, username: true, email: true }
                    },
                    createdBy: {
                        select: { id: true, username: true, email: true }
                    },
                    provider: true,
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
                        select: { id: true, name: true }
                    },
                    assignedToUser: {
                        select: { id: true, username: true, email: true }
                    },
                    createdBy: {
                        select: { id: true, username: true, email: true }
                    },
                    provider: true,
                },
            });
            res.status(200).json(allNetworkDevices);
        } catch (error: any) {
            console.error('Error al obtener todos los dispositivos de red:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los dispositivos de red.' });
        }
    }

    /**
     * Obtiene todos los dispositivos de red de una compañía.
     */
    async getNetworkByCompanyCode(req: Request, res: Response) {
        const { companyId } = req.params;
        console.log('companyId recibido:', companyId);
        try {
            const company = await prisma.company.findUnique({
                where: { id: companyId },
            });

            if (!company) {
                return res.status(404).json({ message: `Empresa con ID ${companyId} no encontrada` });
            }

            const networks = await prisma.network.findMany({
                where: { companyId: company.id },
                // include: {
                //     // company: { select: { id: true, name: true } },
                //     // assignedToUser: { select: { id: true, username: true, email: true } },
                //     createdBy: { select: { id: true, username: true, email: true } },
                //     // provider: true,
                // },
            });

            res.status(200).json(networks);
        } catch (error: any) {
            console.error('Error al obtener dispositivos de red por ID de compañía:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los dispositivos de red por compañía.', details: error.message });
        }
    }
}