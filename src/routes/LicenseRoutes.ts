// src/companies/company.routes.ts
import { Router } from 'express';
import { LicenseController } from '../controllers/LicenseController.js';

const LicenseRouter = Router();
const licenseController = new LicenseController();

LicenseRouter.post('/create', licenseController.Create.bind(licenseController));
LicenseRouter.get('/all', licenseController.getAll.bind(licenseController));
LicenseRouter.get('/:id', licenseController.get.bind(licenseController));
LicenseRouter.put('/:id', licenseController.Edit.bind(licenseController));
LicenseRouter.delete('/:id', licenseController.Delete.bind(licenseController));

export default LicenseRouter;