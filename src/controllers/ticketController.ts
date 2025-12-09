// src/tickets/ticket.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';

export class TicketController {

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
            const { companyId } = req.params;
            console.log("📥 Datos recibidos para crear ticket:", req.body);
            console.log("📦 Company ID:", companyId);

            // Validar que la compañía existe
            const company = await prisma.company.findUnique({
                where: { id: companyId },
            });

            if (!company) {
                return res.status(404).json({
                    ok: false,
                    message: 'Compañía no encontrada'
                });
            }

            const data = req.body;
            const ticketNumber = await this.generateNextTicketNumber();
            const reviewedValue =
                data.reviewed === true ||
                data.reviewed === "true" ||
                data.reviewed === 1;

            const sendByIdClean = data.sendBy && data.sendBy.trim() !== "" ? data.sendBy : null;
            const sendToIdClean = data.sendTo && data.sendTo.trim() !== "" ? data.sendTo : null;

            // Validar que sendById pertenece a la compañía
            if (sendByIdClean) {
                const sendByUser = await prisma.user.findFirst({
                    where: { id: sendByIdClean, companyId },
                });
                if (!sendByUser) {
                    return res.status(400).json({
                        ok: false,
                        message: 'Usuario sendBy no pertenece a esta compañía'
                    });
                }
            }

            // Validar que sendToId pertenece a la compañía
            if (sendToIdClean) {
                const sendToUser = await prisma.user.findFirst({
                    where: { id: sendToIdClean, companyId },
                });
                if (!sendToUser) {
                    return res.status(400).json({
                        ok: false,
                        message: 'Usuario sendTo no pertenece a esta compañía'
                    });
                }
            }

            console.log("🔍 Datos procesados:", {
                ...data,
                reviewed: reviewedValue,
                sendById: sendByIdClean,
                sendToId: sendToIdClean,
                companyId
            });

            // Crear ticket
            const newTicket = await prisma.ticket.create({
                data: {
                    ticketNumber,
                    title: data.title,
                    description: data.description,
                    img: data.img,
                    comment: data.comment,
                    type: data.type,
                    priority: data.priority,
                    status: data.status,
                    startDate: data.startDate ? new Date(data.startDate) : null,
                    endDate: data.endDate ? new Date(data.endDate) : null,
                    requestDays: Number(data.requestDays) || null,
                    approvedDays: Number(data.approvedDays) || null,
                    reviewed: reviewedValue,
                    view: Boolean(data.view),
                    ...(sendByIdClean ? { sendBy: { connect: { id: sendByIdClean } } } : {}),
                    ...(sendToIdClean ? { sendTo: { connect: { id: sendToIdClean } } } : {}),
                    company: { connect: { id: companyId } },
                },
                include: {
                    company: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        }
                    },
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
                        }
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
     * Obtiene un ticket por su ID en una compañía específica.
     * Incluye las relaciones con los usuarios sendBy, sendTo y la compañía.
     * @param req Express Request. Espera companyId y id en req.params.
     * @param res Express Response.
     */
    async get(req: Request, res: Response, next: NextFunction) {
        try {
            const { companyId, id } = req.params;

            const ticket = await prisma.ticket.findFirst({
                where: {
                    id,
                    company: { id: companyId },
                },
                include: {
                    company: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        }
                    },
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
                return res.status(404).json({
                    ok: false,
                    message: 'Ticket no encontrado en esta compañía.'
                });
            }

            res.json(ticket);
        } catch (error) {
            console.error('Error al obtener el ticket:', error);
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor al obtener el ticket.'
            });
            next(error);
        }
    }

    /**
     * Obtiene todos los tickets de una compañía específica.
     * Incluye las relaciones con los usuarios sendBy, sendTo y la compañía.
     * @param req Express Request. Espera companyId en req.params.
     * @param res Express Response.
     */
    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { companyId } = req.params;

            // Validar que la compañía existe
            const company = await prisma.company.findUnique({
                where: { id: companyId },
            });

            if (!company) {
                return res.status(404).json({
                    ok: false,
                    message: 'Compañía no encontrada'
                });
            }

            const tickets = await prisma.ticket.findMany({
                where: { company: { id: companyId } },
                include: {
                    company: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        }
                    },
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
                    createdAt: 'desc',
                },
            });

            res.json(tickets);
        } catch (error) {
            console.error('Error al obtener todos los tickets:', error);
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor al obtener los tickets.'
            });
            next(error);
        }
    }

    /**
     * Actualiza un ticket existente en una compañía específica.
     * @param req Express Request. Espera companyId e id en req.params y los datos a actualizar en req.body.
     * @param res Express Response.
     */
    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { companyId, id } = req.params;
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
                sendBy,
                sendTo,
            } = req.body;

            // Verificar que el ticket pertenece a la compañía
            const ticket = await prisma.ticket.findFirst({
                where: { id, company: { id: companyId } },
            });

            if (!ticket) {
                return res.status(404).json({
                    ok: false,
                    message: 'Ticket no encontrado en esta compañía.'
                });
            }

            // Validar sendById si se proporciona
            if (sendBy) {
                const sendByUser = await prisma.user.findFirst({
                    where: { id: sendBy, companyId },
                });
                if (!sendByUser) {
                    return res.status(400).json({
                        ok: false,
                        message: 'Usuario sendBy no pertenece a esta compañía'
                    });
                }
            }

            // Validar sendToId si se proporciona
            if (sendTo) {
                const sendToUser = await prisma.user.findFirst({
                    where: { id: sendTo, companyId },
                });
                if (!sendToUser) {
                    return res.status(400).json({
                        ok: false,
                        message: 'Usuario sendTo no pertenece a esta compañía'
                    });
                }
            }

            const updatedTicket = await prisma.ticket.update({
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
                    sendBy: sendBy
                        ? { connect: { id: sendBy } }
                        : { disconnect: true },
                    sendTo: sendTo
                        ? { connect: { id: sendTo } }
                        : { disconnect: true },
                },
                include: {
                    company: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        }
                    },
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

            res.json(updatedTicket);
        } catch (error: any) {
            console.error('Error al actualizar el ticket:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({
                    ok: false,
                    message: 'Ticket no encontrado para actualizar o uno de los usuarios especificados no existe.'
                });
            }
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor al actualizar el ticket.'
            });
            next(error);
        }
    }

    /**
     * Elimina un ticket en una compañía específica.
     * @param req Express Request. Espera companyId e id en req.params.
     * @param res Express Response.
     */
    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { companyId, id } = req.params;

            // Verificar que el ticket pertenece a la compañía
            const ticket = await prisma.ticket.findFirst({
                where: { id, companyId },
            });

            if (!ticket) {
                return res.status(404).json({
                    ok: false,
                    message: 'Ticket no encontrado en esta compañía.'
                });
            }

            await prisma.ticket.delete({
                where: { id },
            });

            res.status(204).send();
        } catch (error: any) {
            console.error('Error al eliminar el ticket:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({
                    ok: false,
                    message: 'Ticket no encontrado para eliminar.'
                });
            }
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor al eliminar el ticket.'
            });
            next(error);
        }
    }
}