// src/server.ts
import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import AuthRouter from './routes/AuthRoutes.js';
import expressLayouts from 'express-ejs-layouts';
import flash from 'connect-flash';
import bodyParser from 'body-parser';
import { corsMiddleware } from './middlewares/CorsMiddleware.js';
import UserRouter from './routes/UserRoutes.js';
import CompaniesRouter from './routes/CompaniesRoutes.js';
import EquipmentRouter from './routes/EquipmentRoutes.js';
import MaintenanceRouter from './routes/MaintenanceRoutes.js';
import DocumentRouter from './routes/DocumentRoutes.js';
import LicenseRouter from './routes/LicenseRoutes.js';
import NetworkRouter from './routes/NetworkRoutes.js';
import SystemRouter from './routes/SystemRoutes.js';
import DashboardRouter from './routes/DashboardRoutes.js';
import { errorMiddleware } from './middlewares/errorHandler.js';
import ReportsRouter from './routes/ReportRoutes.js';
dotenv.config({ path: '.env' });

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: false }))
const port = process.env.PORT || 3000;
const __dirname = path.resolve();
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(corsMiddleware)
app.use(session({
  secret: process.env.SESSION_SECRET || 'super_secret_key_for_session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 día
    // secure: process.env.NODE_ENV === 'production'
  }
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

app.use(express.json());
app.use(bodyParser.json({ limit: '10mb' }))

app.get('/', (req, res) => {
  res.send('Welcome to IT System')
})
app.use('/api/user/auth', AuthRouter);
app.use('/api/users', UserRouter);
app.use('/api/companies', CompaniesRouter);
// Descomentar y usar cuando los módulos estén listos
// app.use('/api/users', isAuthenticated, authorizeRolesMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN]), userRoutes);
app.use('/api/devices', EquipmentRouter);
app.use('/api/maintenances', MaintenanceRouter);
app.use('/api/documents', DocumentRouter);
app.use('/api/licenses', LicenseRouter);
app.use('/api/network', NetworkRouter);
app.use('/api/system', SystemRouter);
app.use('/api/dashboard',DashboardRouter);
app.use('/api/reports',ReportsRouter);
// Middleware de manejo de errores al final
app.use(errorMiddleware);

// Manejo de errores 404 (Debe ir después de todas tus rutas definidas)
// app.use((req, res, next) => {
//   res.status(404).render('404', { title: 'Página no encontrada' });
// });

// Manejador de errores general (middleware de 4 argumentos, siempre al final)
// app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
//   console.error(err.stack); // Registra el stack trace del error
//   res.status(500).render('error', { title: 'Error del servidor', error: err.message });
// });

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  console.log(`Página de inicio: http://localhost:${port}`);
});