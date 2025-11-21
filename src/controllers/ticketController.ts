// src/tickets/ticket.controller.ts
import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

const prisma = new PrismaClient();

export class TicketController { // Renombrado de FormController a TicketController

    async generateNextTicketNumber() {
        const lastTicket = await prisma.ticket.findFirst({
            orderBy: { ticketNumber: "desc" }
        });

        return lastTicket ? lastTicket.ticketNumber! + 1 : 1;
    }

    // ---------------------------------------------------------
    // CREAR TICKET
    // ---------------------------------------------------------
    async create(req: Request, res: Response) {
        try {
            console.log("📥 Datos recibidos para crear ticket:", req.body);

            const data = req.body;
            const ticketNumber = await this.generateNextTicketNumber();
            const reviewedValue =
                data.reviewed === true ||
                data.reviewed === "true" ||
                data.reviewed === 1;

            const sendByIdClean = data.sendById && data.sendById.trim() !== "" ? data.sendById : null;
            const sendToIdClean = data.sendToId && data.sendToId.trim() !== "" ? data.sendToId : null;

            console.log("🔍 Datos procesados:", {
                ...data,
                reviewed: reviewedValue,
                sendById: sendByIdClean,
                sendToId: sendToIdClean
            });

            // Crear ticket
            const newTicket = await prisma.ticket.create({
                data: {
                    ticketNumber,
                    title: data.title,
                    description: data.description,
                    img: data.img,
                    comment: data.comment,

                    // Enums del prisma
                    type: data.type,
                    priority: data.priority,
                    status: data.status,

                    // Fechas convertidas
                    startDate: data.startDate ? new Date(data.startDate) : null,
                    endDate: data.endDate ? new Date(data.endDate) : null,

                    requestDays: Number(data.requestDays) || null,
                    approvedDays: Number(data.approvedDays) || null,

                    reviewed: reviewedValue,
                    view: Boolean(data.view),

                    sendById: sendByIdClean,
                    sendToId: sendToIdClean
                },

                include: {
                    sendBy: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    sendTo: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    }
                }
            });

            console.log("✅ Ticket creado correctamente:", newTicket);

            return res.status(201).json({
                ok: true,
                message: "Ticket creado exitosamente",
                ticket: newTicket
            });

        } catch (error) {
            console.error("❌ Error creando ticket:", error);
            return res.status(500).json({
                ok: false,
                message: "Error al crear el ticket",
                error
            });
        }
    }

    /**
     * Obtiene un ticket por su ID.
     * Incluye las relaciones con los usuarios sendBy y sendTo.
     * @param req Express Request. Espera el ID del ticket en req.params.
     * @param res Express Response.
     */
    async get(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            const ticket = await prisma.ticket.findUnique({ // Referencia a prisma.ticket.findUnique
                where: { id },
                include: {
                    sendBy: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            person: {
                                select: {
                                    fullName: true,
                                    userCode: true,
                                }
                            }
                        },
                    },
                    sendTo: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            person: {
                                select: {
                                    fullName: true,
                                    userCode: true,
                                }
                            }
                        },
                    },
                },
            });

            if (!ticket) {
                return res.status(404).json({ error: 'Ticket no encontrado.' }); // Mensaje de error actualizado
            }

            res.json(ticket);
        } catch (error) {
            console.error('Error al obtener el ticket:', error); // Mensaje de error actualizado
            res.status(500).json({ error: 'Error interno del servidor al obtener el ticket.' }); // Mensaje de error actualizado
            next(error);
        }
    }

    /**
     * Obtiene todos los tickets.
     * Incluye las relaciones con los usuarios sendBy y sendTo.
     * @param req Express Request.
     * @param res Express Response.
     */
    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const tickets = await prisma.ticket.findMany({ // Referencia a prisma.ticket.findMany
                include: {
                    sendBy: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            person: {
                                select: {
                                    fullName: true,
                                    userCode: true,
                                }
                            }
                        },
                    },
                    sendTo: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            person: {
                                select: {
                                    fullName: true,
                                    userCode: true,
                                }
                            }
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc', // Ordenar por fecha de creación descendente
                },
            });

            res.json(tickets);
        } catch (error) {
            console.error('Error al obtener todos los tickets:', error); // Mensaje de error actualizado
            res.status(500).json({ error: 'Error interno del servidor al obtener los tickets.' }); // Mensaje de error actualizado
            next(error);
        }
    }

    /**
     * Actualiza un ticket existente por su ID.
     * @param req Express Request. Espera el ID en req.params y los datos a actualizar en req.body.
     * @param res Express Response.
     */
    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const {
                title,
                description,
                img,
                comment,
                type,
                priority,
                status,
                startDate,
                endDate,
                requestDays,
                approvedDays,
                reviewed,
                view,
                sendById,
                sendToId,
            } = req.body;

            const updatedTicket = await prisma.ticket.update({ // Referencia a prisma.ticket.update
                where: { id },
                data: {
                    title,
                    description,
                    img,
                    comment,
                    type,
                    priority,
                    status,
                    startDate: startDate ? new Date(startDate) : undefined,
                    endDate: endDate ? new Date(endDate) : undefined,
                    requestDays,
                    approvedDays,
                    reviewed,
                    view,
                    // Actualizar la relación con sendBy
                    sendBy: sendById
                        ? { connect: { id: sendById } }
                        : { disconnect: true }, // Desconectar si no se proporciona un ID
                    // Actualizar la relación con sendTo
                    sendTo: sendToId
                        ? { connect: { id: sendToId } }
                        : { disconnect: true }, // Desconectar si no se proporciona un ID
                },
                include: {
                    sendBy: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                        },
                    },
                    sendTo: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                        },
                    },
                },
            });

            res.json(updatedTicket);
        } catch (error: any) {
            console.error('Error al actualizar el ticket:', error); // Mensaje de error actualizado
            if (error.code === 'P2025') { // Registro no encontrado o relación no encontrada
                return res.status(404).json({ error: 'Ticket no encontrado para actualizar o uno de los usuarios especificados no existe.' }); // Mensaje de error actualizado
            }
            res.status(500).json({ error: 'Error interno del servidor al actualizar el ticket.' }); // Mensaje de error actualizado
            next(error);
        }
    }

    /**
     * Elimina un ticket por su ID.
     * @param req Express Request. Espera el ID del ticket en req.params.
     * @param res Express Response.
     */
    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            const ticket = await prisma.ticket.findUnique({ // Referencia a prisma.ticket.findUnique
                where: { id },
            });

            if (!ticket) {
                return res.status(404).json({ error: 'Ticket no encontrado.' }); // Mensaje de error actualizado
            }

            await prisma.ticket.delete({ // Referencia a prisma.ticket.delete
                where: { id },
            });

            res.status(204).send(); // 204 No Content para eliminación exitosa
        } catch (error: any) {
            console.error('Error al eliminar el ticket:', error); // Mensaje de error actualizado
            if (error.code === 'P2025') { // Registro no encontrado
                return res.status(404).json({ error: 'Ticket no encontrado para eliminar.' }); // Mensaje de error actualizado
            }
            res.status(500).json({ error: 'Error interno del servidor al eliminar el ticket.' }); // Mensaje de error actualizado
            next(error);
        }
    }
}