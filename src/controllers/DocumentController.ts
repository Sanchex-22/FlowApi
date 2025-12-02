// src/documents/document.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

export class DocumentController {

    /**
     * Creates a new document.
     * @param req Express Request. Expects { title, description?, fileUrl, fileType?, category?, companyId, equipmentId? } in the body.
     * @param res Express Response.
     */
    async Create(req: Request, res: Response) {
        try {
            const { title, description, fileUrl, fileType, category, companyId, equipmentId } = req.body;

            if (!title || !fileUrl || !companyId) {
                return res.status(400).json({ error: 'Faltan campos obligatorios: título, URL del archivo e ID de compañía.' });
            }

            const newDocument = await prisma.document.create({
                data: {
                    title,
                    description,
                    fileUrl,
                    fileType,
                    category,
                    company: { connect: { id: companyId } },
                    ...(equipmentId && { equipment: { connect: { id: equipmentId } } }),
                },
            });

            res.status(201).json(newDocument);
        } catch (error: any) {
            console.error('Error al crear el documento:', error);
            if (error.code === 'P2025') { // Foreign key constraint failed
                return res.status(400).json({ error: 'La compañía o el equipo asociado no existen.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear el documento.' });
        }
    }

    /**
     * Deletes a document by its ID.
     * @param req Express Request. Expects the document ID in req.params.
     * @param res Express Response.
     */
    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const document = await prisma.document.findUnique({
                where: { id },
            });

            if (!document) {
                return res.status(404).json({ error: 'Documento no encontrado.' });
            }

            await prisma.document.delete({
                where: { id },
            });

            res.status(204).send();
        } catch (error) {
            console.error('Error al eliminar el documento:', error);
            res.status(500).json({ error: 'Error interno del servidor al eliminar el documento.' });
        }
    }

    /**
     * Edits an existing document by its ID.
     * @param req Express Request. Expects the ID in req.params and the data to update in req.body.
     * @param res Express Response.
     */
    async Edit(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { title, description, fileUrl, fileType, category, companyId, equipmentId } = req.body;

            const updatedDocument = await prisma.document.update({
                where: { id },
                data: {
                    title,
                    description,
                    fileUrl,
                    fileType,
                    category,
                    ...(companyId && { company: { connect: { id: companyId } } }),
                    ...(equipmentId && { equipment: { connect: { id: equipmentId } } }),
                },
            });

            res.json(updatedDocument);
        } catch (error: any) {
            console.error('Error al editar el documento:', error);
            if (error.code === 'P2025') { // Record not found or foreign key constraint failed
                return res.status(404).json({ error: 'Documento no encontrado o ID de relación inválido.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al editar el documento.' });
        }
    }

    /**
     * Gets a document by its ID.
     * @param req Express Request. Expects the document ID in req.params.
     * @param res Express Response.
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const document = await prisma.document.findUnique({
                where: { id },
                include: {
                    company: { select: { name: true, code: true } },
                    equipment: { select: { serialNumber: true, type: true, brand: true } }
                }
            });

            if (!document) {
                return res.status(404).json({ error: 'Documento no encontrado.' });
            }
            res.json(document);
        } catch (error) {
            console.error('Error al obtener el documento:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener el documento.' });
        }
    }

    /**
     * Gets all documents.
     * @param req Express Request.
     * @param res Express Response.
     */
    async getAll(req: Request, res: Response) {
        try {
            const documents = await prisma.document.findMany({
                include: {
                    company: { select: { name: true } },
                    equipment: { select: { serialNumber: true } }
                }
            });
            res.json(documents);
        } catch (error) {
            console.error('Error al obtener los documentos:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener los documentos.' });
        }
    }
}