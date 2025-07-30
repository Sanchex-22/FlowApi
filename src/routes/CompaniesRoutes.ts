// src/companies/company.routes.ts
import { Router } from 'express';
import { CompanyController } from '../controllers/CompaniesController.js';

const CompaniesRouter = Router();
const companyController = new CompanyController();

CompaniesRouter.post('/create', companyController.Create.bind(companyController));
CompaniesRouter.get('/all', companyController.getAll.bind(companyController));
CompaniesRouter.get('/:id', companyController.get.bind(companyController));
CompaniesRouter.put('/:id', companyController.Edit.bind(companyController));
CompaniesRouter.delete('/delete/:id', companyController.Delete.bind(companyController));
CompaniesRouter.get('/:companyCode/departments', companyController.getDepartmentsByCompanyCode.bind(companyController));


export default CompaniesRouter;