// src/companies/company.routes.ts
import { Router } from 'express';
import { MaintenanceController } from '../controllers/MaintenanceController.js';

const MaintenanceRouter = Router();
const maintenanceController = new MaintenanceController();

MaintenanceRouter.post('/create', maintenanceController.Create.bind(maintenanceController));
MaintenanceRouter.get('/all', maintenanceController.getAll.bind(maintenanceController));
MaintenanceRouter.get('/:companyId/all', maintenanceController.getMaintenanceByCompanyCode.bind(maintenanceController));
MaintenanceRouter.get('/:id', maintenanceController.get.bind(maintenanceController));
MaintenanceRouter.put('/:id', maintenanceController.Edit.bind(maintenanceController));
MaintenanceRouter.delete('/:id', maintenanceController.Delete.bind(maintenanceController));

export default MaintenanceRouter;