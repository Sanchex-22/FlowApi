// src/companies/company.routes.ts
import { Router } from 'express';
import { NetworkController } from '../controllers/NetworkController.js';

const NetworkRouter = Router();
const networkController = new NetworkController();

NetworkRouter.post('/create', networkController.Create.bind(networkController));
NetworkRouter.get('/all', networkController.getAll.bind(networkController));
NetworkRouter.get('/:companyId/all', networkController.getNetworkByCompanyCode.bind(networkController));
NetworkRouter.get('/:companyId/:id', networkController.get.bind(networkController));
NetworkRouter.put('/:companyId/:id', networkController.Edit.bind(networkController));
NetworkRouter.delete('/:companyId/:id', networkController.Delete.bind(networkController));

export default NetworkRouter;