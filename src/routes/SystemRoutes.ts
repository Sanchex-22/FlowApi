// src/companies/company.routes.ts
import { Router, Request, Response } from 'express';
import { SystemConfigController } from '../controllers/SystemConfig.js';
import prisma from '../../lib/prisma.js';

const SystemRouter = Router();
const systemController = new SystemConfigController();

// Setup status — tells the frontend if first-run setup is needed
SystemRouter.get('/setup-status', async (_req: Request, res: Response) => {
  try {
    const companyCount = await prisma.company.count();
    const userCount = await prisma.user.count();
    res.json({
      needsSetup: companyCount === 0,
      hasUsers: userCount > 0,
      appName: process.env.APP_NAME || 'Flow IT',
      appVersion: process.env.APP_VERSION || '1.0.0',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get setup status' });
  }
});

SystemRouter.post('/create', systemController.Create.bind(systemController));
SystemRouter.get('/all', systemController.getAll.bind(systemController));
SystemRouter.get('/:id', systemController.get.bind(systemController));
SystemRouter.put('/:id', systemController.Edit.bind(systemController));
SystemRouter.delete('/:id', systemController.Delete.bind(systemController));

export default SystemRouter;