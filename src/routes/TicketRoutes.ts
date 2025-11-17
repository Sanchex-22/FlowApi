// src/companies/ticket.ts
import { Router } from 'express';
import { TicketController } from '../controllers/ticketController.js';


const TicketRouter = Router();
const ticketController = new TicketController();
TicketRouter.post('/create', ticketController.create.bind(ticketController));
TicketRouter.get('/all', ticketController.getAll.bind(ticketController));
TicketRouter.get('/:id', ticketController.get.bind(ticketController));
TicketRouter.put('/:id', ticketController.update.bind(ticketController));
TicketRouter.delete('/:id', ticketController.delete.bind(ticketController));

export default TicketRouter;