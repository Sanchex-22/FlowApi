import { Router } from 'express'
import {
  adminGetStats,
  adminGetCompanies,
  adminCreateCompany,
  adminToggleCompany,
  adminDeleteCompany,
  adminCreateSuperAdmin,
  adminAssignSuperAdmin,
  adminGetUsers,
  adminGetUser,
  adminSearchUser,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminGetLicenses,
  adminUpdateLicense,
} from '../controllers/AdminController.js'
import { requireRole } from '../middlewares/authGuards.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';
const AdminRouter = Router()

// Todas las rutas de este router requieren JWT + rol GLOBAL_ADMIN
AdminRouter.use(verifyJWT);
AdminRouter.use(requireRole(['GLOBAL_ADMIN']));

// ── Stats ─────────────────────────────────────────────────────────────────────
AdminRouter.get('/stats',                                 adminGetStats)

// ── Empresas ──────────────────────────────────────────────────────────────────
AdminRouter.get('/companies',                             adminGetCompanies)
AdminRouter.post('/companies',                            adminCreateCompany)
AdminRouter.patch('/companies/:id/toggle',                adminToggleCompany)
AdminRouter.delete('/companies/:id',                      adminDeleteCompany)
AdminRouter.post('/companies/:id/super-admin',            adminCreateSuperAdmin)
AdminRouter.post('/companies/:id/super-admin-assign',     adminAssignSuperAdmin)

// ── Usuarios ──────────────────────────────────────────────────────────────────
// IMPORTANTE: la ruta /search debe ir antes de /:id para no ser capturada por el parámetro
AdminRouter.get('/users/search',  adminSearchUser)
AdminRouter.get('/users',         adminGetUsers)
AdminRouter.get('/users/:id',     adminGetUser)
AdminRouter.post('/users',        adminCreateUser)
AdminRouter.put('/users/:id',     adminUpdateUser)
AdminRouter.delete('/users/:id',  adminDeleteUser)

// ── Licencias de suscripción ──────────────────────────────────────────────────
AdminRouter.get('/licenses',          adminGetLicenses)
AdminRouter.put('/licenses/:userId',  adminUpdateLicense)

export default AdminRouter
