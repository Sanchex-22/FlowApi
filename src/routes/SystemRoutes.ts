// src/companies/company.routes.ts
import { Router } from 'express';
import { SystemConfigController } from '../controllers/SystemConfig.js';

const SystemRouter = Router();
const systemController = new SystemConfigController();

SystemRouter.post('/create', systemController.Create.bind(systemController));
SystemRouter.get('/all', systemController.getAll.bind(systemController));
SystemRouter.get('/:id', systemController.get.bind(systemController));
SystemRouter.put('/:id', systemController.Edit.bind(systemController));
SystemRouter.delete('/:id', systemController.Delete.bind(systemController));

export default SystemRouter;