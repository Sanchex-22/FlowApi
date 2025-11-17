// src/companies/company.routes.ts
import { Router } from 'express';
import { NetworkController } from '../controllers/NetworkController.js';

const NetworkRouter = Router();
const networkController = new NetworkController();

NetworkRouter.post('/create', networkController.Create.bind(networkController));
NetworkRouter.get('/all', networkController.getAll.bind(networkController));
NetworkRouter.get('/:companyId/all', networkController.getNetworkByCompanyCode.bind(networkController));
NetworkRouter.get('/:id', networkController.get.bind(networkController));
NetworkRouter.put('/:id', networkController.Edit.bind(networkController));
NetworkRouter.delete('/:id', networkController.Delete.bind(networkController));

export default NetworkRouter;