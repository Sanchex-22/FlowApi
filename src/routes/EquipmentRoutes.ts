// src/companies/company.routes.ts
import { Router } from 'express';
import { EquipmentController } from '../controllers/EquipmentController.js';

const EquipmentRouter = Router();
const equipmentController = new EquipmentController();

EquipmentRouter.post('/create', equipmentController.Create.bind(equipmentController));
EquipmentRouter.get('/all', equipmentController.getAll.bind(equipmentController));
EquipmentRouter.get('/:companyId/all', equipmentController.getEquipmentByCompanyCode.bind(equipmentController));
EquipmentRouter.get('/:id', equipmentController.get.bind(equipmentController));
EquipmentRouter.put('/:id', equipmentController.Edit.bind(equipmentController));
EquipmentRouter.delete('/:id', equipmentController.Delete.bind(equipmentController));

export default EquipmentRouter;