// src/routes/networkProviders.routes.ts
import express from 'express';
import { NetworkProvidersController } from '../controllers/NetworkProvidersController.js';

const NetworkProvidersRoutes = express.Router();
const networkProvidersController = new NetworkProvidersController();

NetworkProvidersRoutes.post('/', networkProvidersController.create.bind(networkProvidersController));
NetworkProvidersRoutes.get('/all', networkProvidersController.getAll.bind(networkProvidersController));
NetworkProvidersRoutes.get('/:id', networkProvidersController.getById.bind(networkProvidersController));
NetworkProvidersRoutes.put('/:id', networkProvidersController.update.bind(networkProvidersController));
NetworkProvidersRoutes.delete('/:id', networkProvidersController.delete.bind(networkProvidersController));

export default NetworkProvidersRoutes;
