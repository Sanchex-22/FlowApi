// src/companies/company.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { EquipmentController } from '../controllers/EquipmentController.js';

const EquipmentRouter = Router();
const equipmentController = new EquipmentController();

// ====================================
// Configuración de Multer
// ====================================
const upload = multer({
  storage: multer.memoryStorage(), // Almacena en memoria para enviar a Vercel Blob
  limits: {
    fileSize: 50 * 1024 * 1024, // Límite de 50MB
  },
  fileFilter: (req, file, cb) => {
    // Acepta solo ciertos tipos de archivo
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
  }
});

// ====================================
// Rutas (orden importante)
// ====================================

// 1️⃣ Rutas sin parámetros PRIMERO
EquipmentRouter.post('/create', equipmentController.Create.bind(equipmentController));
EquipmentRouter.get('/all', equipmentController.getAll.bind(equipmentController));

// 2️⃣ Rutas con parámetros específicos
EquipmentRouter.post(
  '/:equipmentId/upload-invoice',
  upload.single('invoice'),
  equipmentController.uploadInvoice.bind(equipmentController)
);

// 3️⃣ Rutas genéricas con parámetros (al final)
EquipmentRouter.get('/:companyId/all', equipmentController.getEquipmentByCompanyCode.bind(equipmentController));
EquipmentRouter.get('/:id', equipmentController.get.bind(equipmentController));
EquipmentRouter.put('/:id', equipmentController.Edit.bind(equipmentController));
EquipmentRouter.delete('/:id', equipmentController.Delete.bind(equipmentController));

// ====================================
// Manejo de errores de Multer
// ====================================
EquipmentRouter.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: `Error en la carga: ${error.message}` });
  }
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
});

export default EquipmentRouter;