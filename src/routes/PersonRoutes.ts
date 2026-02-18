import { Router } from 'express';
import { PersonController } from '../controllers/PersonController.js';

const personController = new PersonController();
const PersonRouter = Router();

// ✅ IMPORTANTE: Las rutas específicas deben ir ANTES de las rutas con parámetros dinámicos
// Esto previene que /all o /company/:companyCode sean interpretadas como /:id

// ✅ POST - Crear persona (userId opcional)
PersonRouter.post('/create', personController.Create.bind(personController));

// ✅ GET ALL - Obtener todas las personas
PersonRouter.get('/all', personController.getAll.bind(personController));

// ✅ GET BY COMPANY - Obtener personas por compañía
PersonRouter.get('/company/:companyCode', personController.getAllByCompany.bind(personController));

// ✅ PUT - Actualizar persona (incluido userId)
PersonRouter.put('/edit/:id', personController.Edit.bind(personController));

// ✅ DELETE - Eliminar persona
PersonRouter.delete('/delete/:id', personController.Delete.bind(personController));

// ✅ GET - Obtener una persona por ID (DEBE IR AL FINAL para no conflictuar con rutas específicas)
PersonRouter.get('/:id', personController.get.bind(personController));

export default PersonRouter;