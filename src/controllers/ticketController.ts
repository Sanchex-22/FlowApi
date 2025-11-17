// src/tickets/ticket.controller.ts
import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

const prisma = new PrismaClient();

export class TicketController { // Renombrado de FormController a TicketController

    /**
     * Genera el siguiente número de ticket consecutivo.
     * Podrías querer implementar una lógica más robusta para esto,
     * por ejemplo, por compañía o por año, pero para empezar,
     * busca el último ticket y le suma uno.
     */
    private async generateNextTicketNumber(): Promise<number> {
        const lastTicket = await prisma.ticket.findFirst({ // Referencia a prisma.ticket
            orderBy: {
                ticketNumber: 'desc',
            },
            select: {
                ticketNumber: true,
            },
        });

        if (lastTicket && lastTicket.ticketNumber) {
            return lastTicket.ticketNumber + 1;
        }
        return 1; // Primer ticket si no hay ninguno.
    }

    /**
     * Crea un nuevo ticket.
     * @param req Express Request. Espera los datos del ticket en req.body.
     * @param res Express Response.
     */
    async create(req: Request, res: Response, next: NextFunction) {
        try {
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
                sendById, // ID del usuario que envía
                sendToId,   // ID del usuario a quien se envía
            } = req.body;

            // Validación básica
            if (!title || !description || !type || !priority || !status) {
                return res.status(400).json({ error: 'Faltan campos obligatorios para crear el ticket.' });
            }

            // Generar el número de ticket
            const ticketNumber = await this.generateNextTicketNumber();

            const newTicket = await prisma.ticket.create({ // Referencia a prisma.ticket.create
                data: {
                    ticketNumber,
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
                    // Conectar con el usuario que envía si se proporciona un ID
                    ...(sendById && {
                        sendBy: {
                            connect: { id: sendById },
                        },
                    }),
                    // Conectar con el usuario a quien se envía si se proporciona un ID
                    ...(sendToId && {
                        sendTo: {
                            connect: { id: sendToId },
                        },
                    }),
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

            res.status(201).json(newTicket);
        } catch (error: any) {
            console.error('Error al crear el ticket:', error); // Mensaje de error actualizado
            if (error.code === 'P2025') { // Relación no encontrada (ej. sendById o sendToId no existen)
                return res.status(404).json({ error: 'Uno de los usuarios especificados (sendBy o sendTo) no fue encontrado.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al crear el ticket.' }); // Mensaje de error actualizado
            next(error);
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