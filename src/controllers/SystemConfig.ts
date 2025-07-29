// src/systemConfig/systemConfig.controller.ts
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export class SystemConfigController {

    /**
     * Creates a new system configuration entry.
     * @param req Express Request. Expects { key, value, description? } in the body.
     * @param res Express Response.
     */
    async Create(req: Request, res: Response) {
        try {
            const { key, value, description } = req.body;

            if (!key || !value) {
                return res.status(400).json({ error: 'Faltan campos obligatorios: clave y valor.' });
            }

            const newConfig = await prisma.systemConfig.create({
                data: {
                    key,
                    value,
                    description,
                },
            });

            res.status(201).json(newConfig);
        } catch (error: any) {
            console.error('Error al crear la configuración del sistema:', error);
            if (error.code === 'P2002') { // Unique constraint violation for 'key'
                return res.status(409).json({ error: 'Ya existe una configuración con esta clave.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear la configuración.' });
        }
    }

    /**
     * Deletes a system configuration entry by its ID.
     * @param req Express Request. Expects the config ID in req.params.
     * @param res Express Response.
     */
    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const config = await prisma.systemConfig.findUnique({
                where: { id },
            });

            if (!config) {
                return res.status(404).json({ error: 'Configuración del sistema no encontrada.' });
            }

            await prisma.systemConfig.delete({
                where: { id },
            });

            res.status(204).send();
        } catch (error) {
            console.error('Error al eliminar la configuración del sistema:', error);
            res.status(500).json({ error: 'Error interno del servidor al eliminar la configuración.' });
        }
    }

    /**
     * Edits an existing system configuration entry by its ID.
     * @param req Express Request. Expects the ID in req.params and the data to update in req.body.
     * @param res Express Response.
     */
    async Edit(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { key, value, description } = req.body;

            const updatedConfig = await prisma.systemConfig.update({
                where: { id },
                data: {
                    key,
                    value,
                    description,
                },
            });

            res.json(updatedConfig);
        } catch (error: any) {
            console.error('Error al editar la configuración del sistema:', error);
            if (error.code === 'P2025') { // Record not found
                return res.status(404).json({ error: 'Configuración del sistema no encontrada para actualizar.' });
            }
            if (error.code === 'P2002') { // Unique constraint violation
                return res.status(409).json({ error: 'Ya existe una configuración con la clave proporcionada.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al editar la configuración.' });
        }
    }

    /**
     * Gets a system configuration entry by its ID.
     * @param req Express Request. Expects the config ID in req.params.
     * @param res Express Response.
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const config = await prisma.systemConfig.findUnique({
                where: { id },
            });

            if (!config) {
                return res.status(404).json({ error: 'Configuración del sistema no encontrada.' });
            }
            res.json(config);
        } catch (error) {
            console.error('Error al obtener la configuración del sistema:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener la configuración.' });
        }
    }

    /**
     * Gets all system configuration entries.
     * @param req Express Request.
     * @param res Express Response.
     */
    async getAll(req: Request, res: Response) {
        try {
            const configs = await prisma.systemConfig.findMany();
            res.json(configs);
        } catch (error) {
            console.error('Error al obtener las configuraciones del sistema:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener las configuraciones.' });
        }
    }
}