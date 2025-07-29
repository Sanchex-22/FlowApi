// src/companies/company.routes.ts
import { Router } from 'express';
import { DocumentController } from '../controllers/DocumentController.js';

const DocumentRouter = Router();
const documentController = new DocumentController();

DocumentRouter.post('/create', documentController.Create.bind(documentController));
DocumentRouter.get('/all', documentController.getAll.bind(documentController));
DocumentRouter.get('/:id', documentController.get.bind(documentController));
DocumentRouter.put('/:id', documentController.Edit.bind(documentController));
DocumentRouter.delete('/:id', documentController.Delete.bind(documentController));

export default DocumentRouter;