// src/server.ts
import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import AuthRouter from './routes/AuthRoutes.js';
import expressLayouts from 'express-ejs-layouts';
import flash from 'connect-flash';
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
import NetworkProvidersRoutes from './routes/networkProvidersRoutes.js';
import TicketRouter from './routes/TicketRoutes.js';
import InventoryRouter from './routes/InventoryRoutes.js';
import ExpenseRoute from './routes/annualSoftwareExpenseRoutes.js';
import AssignedUserRouter from './routes/assignedUsersRoutes.js';
import DepartmentRouter from './routes/DepartmentRoutes.js';

dotenv.config({ path: '.env' });

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.resolve();

app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(corsMiddleware);

// ⛔ NO PARSEAR JSON en importación CSV
app.use((req, res, next) => {
  if (req.path.includes("/inventory/import")) return next();
  express.json({ limit: "10mb" })(req, res, next);
});

// ⛔ NO PARSEAR URLENCODED en importación CSV
app.use((req, res, next) => {
  if (req.path.includes("/inventory/import")) return next();
  express.urlencoded({ extended: true })(req, res, next);
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'super_secret_key_for_session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
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

app.get('/', (req, res) => {
  res.send('Welcome to IT System')
});

app.use('/api/user/auth', AuthRouter);
app.use('/api/users', UserRouter);
app.use('/api/companies', CompaniesRouter);
app.use('/api/departments', DepartmentRouter);
app.use('/api/devices', EquipmentRouter);
app.use('/api/maintenances', MaintenanceRouter);
app.use('/api/documents', DocumentRouter);
app.use('/api/licenses', LicenseRouter);
app.use('/api/network', NetworkRouter);
app.use('/api/network/providers', NetworkProvidersRoutes);
app.use('/api/system', SystemRouter);
app.use('/api/dashboard',DashboardRouter);
app.use('/api/reports',ReportsRouter);
app.use('/api/annual-software-expense',ExpenseRoute);
app.use('/api/annual-software-expense/assigned-users',AssignedUserRouter);
app.use('/api/companies/tickets',TicketRouter);

// ✔ Aquí sí se permite formidable sin interferencia
app.use('/api/inventory', InventoryRouter);

app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  console.log(`Página de inicio: http://localhost:${port}`);
});
