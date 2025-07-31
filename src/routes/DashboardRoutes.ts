import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController.js';

// Aquí podrías agregar middlewares de autenticación para proteger la ruta
// import { authMiddleware } from '../middlewares/auth'; 

const DashboardRouter = Router();
const dashboardController = new DashboardController();

// La ruta espera un companyId como parámetro
// GET /api/dashboard/:companyId
DashboardRouter.get('/:companyId', /* authMiddleware, */ dashboardController.getDashboardData.bind(dashboardController));

export default DashboardRouter