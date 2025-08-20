// src/companies/company.routes.ts
import { Router } from 'express';
import { ReportController } from '../controllers/ReportsController.js';

const ReportsRouter = Router();
const reportController = new ReportController();

ReportsRouter.get('/all', reportController.getAllReports.bind(reportController));

export default ReportsRouter;