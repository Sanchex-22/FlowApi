// src/licenses/license.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export class LicenseController {

    /**
     * Creates a new license.
     * @param req Express Request. Expects { softwareName, licenseKey, provider?, activationDate, expirationDate?, notes?, companyId } in the body.
     * @param res Express Response.
     */
    async Create(req: Request, res: Response) {
        try {
            const { softwareName, licenseKey, provider, activationDate, expirationDate, notes, companyId } = req.body;

            if (!softwareName || !licenseKey || !activationDate || !companyId) {
                return res.status(400).json({ error: 'Faltan campos obligatorios: nombre del software, clave de licencia, fecha de activación e ID de compañía.' });
            }

            const newLicense = await prisma.license.create({
                data: {
                    softwareName,
                    licenseKey,
                    provider,
                    activationDate: new Date(activationDate),
                    expirationDate: expirationDate ? new Date(expirationDate) : undefined,
                    notes,
                    company: { connect: { id: companyId } },
                },
            });

            res.status(201).json(newLicense);
        } catch (error: any) {
            console.error('Error al crear la licencia:', error);
            if (error.code === 'P2002') { // Unique constraint violation
                return res.status(409).json({ error: 'Ya existe una licencia con esta clave.' });
            }
            if (error.code === 'P2025') { // Foreign key constraint failed
                return res.status(400).json({ error: 'La compañía asociada no existe.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear la licencia.' });
        }
    }

    /**
     * Deletes a license by its ID.
     * @param req Express Request. Expects the license ID in req.params.
     * @param res Express Response.
     */
    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const license = await prisma.license.findUnique({
                where: { id },
            });

            if (!license) {
                return res.status(404).json({ error: 'Licencia no encontrada.' });
            }

            await prisma.license.delete({
                where: { id },
            });

            res.status(204).send();
        } catch (error) {
            console.error('Error al eliminar la licencia:', error);
            res.status(500).json({ error: 'Error interno del servidor al eliminar la licencia.' });
        }
    }

    /**
     * Edits an existing license by its ID.
     * @param req Express Request. Expects the ID in req.params and the data to update in req.body.
     * @param res Express Response.
     */
    async Edit(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { softwareName, licenseKey, provider, activationDate, expirationDate, notes, companyId } = req.body;

            const updatedLicense = await prisma.license.update({
                where: { id },
                data: {
                    softwareName,
                    licenseKey,
                    provider,
                    activationDate: activationDate ? new Date(activationDate) : undefined,
                    expirationDate: expirationDate ? new Date(expirationDate) : undefined,
                    notes,
                    ...(companyId && { company: { connect: { id: companyId } } }),
                },
            });

            res.json(updatedLicense);
        } catch (error: any) {
            console.error('Error al editar la licencia:', error);
            if (error.code === 'P2025') { // Record not found or foreign key constraint failed
                return res.status(404).json({ error: 'Licencia no encontrada o ID de compañía inválido.' });
            }
            if (error.code === 'P2002') { // Unique constraint violation
                return res.status(409).json({ error: 'Ya existe una licencia con la clave proporcionada.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al editar la licencia.' });
        }
    }

    /**
     * Gets a license by its ID.
     * @param req Express Request. Expects the license ID in req.params.
     * @param res Express Response.
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const license = await prisma.license.findUnique({
                where: { id },
                include: {
                    company: { select: { name: true, code: true } }
                }
            });

            if (!license) {
                return res.status(404).json({ error: 'Licencia no encontrada.' });
            }
            res.json(license);
        } catch (error) {
            console.error('Error al obtener la licencia:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener la licencia.' });
        }
    }

    /**
     * Gets all licenses.
     * @param req Express Request.
     * @param res Express Response.
     */
    async getAll(req: Request, res: Response) {
        try {
            const licenses = await prisma.license.findMany({
                include: {
                    company: { select: { name: true } }
                }
            });
            res.json(licenses);
        } catch (error) {
            console.error('Error al obtener las licencias:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener las licencias.' });
        }
    }
}