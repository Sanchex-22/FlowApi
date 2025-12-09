// src/tickets/ticket.routes.ts
import { Router } from 'express';
import { TicketController } from '../controllers/ticketController.js';

const ticketRouter = Router({ mergeParams: true });
const ticketController = new TicketController();

// POST /companies/:companyId/tickets/create
ticketRouter.post('/:companyId/create', ticketController.create.bind(ticketController));

// GET /companies/:companyId/tickets/all
ticketRouter.get('/:companyId/all', ticketController.getAll.bind(ticketController));

// GET /companies/:companyId/tickets/:id
ticketRouter.get('/:companyId/:id', ticketController.get.bind(ticketController));

// PUT /companies/:companyId/tickets/:id
ticketRouter.put('/:companyId/:id', ticketController.update.bind(ticketController));

// DELETE /companies/:companyId/tickets/:id
ticketRouter.delete('/:companyId/:id', ticketController.delete.bind(ticketController));

export default ticketRouter;