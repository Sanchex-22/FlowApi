// src/auth/auth.controller.ts
import { Request, Response } from 'express';

import { UserRole } from '@prisma/client';
import { AuthService } from '../services/AuthServices.js';

export class AuthController {
  constructor(private authService: AuthService) {}

  // Renderiza la página de login (ya manejado en server.ts, pero podrías tener un método aquí si quisieras)
  // getLoginPage(req: Request, res: Response) {
  //   res.render('login', { title: 'Iniciar Sesión' });
  // }

  async postLogin(req: Request, res: Response) {
    const { email, password } = req.body;
    try {
      const user = await this.authService.login(email, password);

      // Almacenar información del usuario en la sesión
      req.session.user = {
        userId: user.id,
        role: user.role,
        companyId: user.companyId || undefined, // Asegurarse de que sea undefined si es null
        username: user.username // Para mostrar en la UI
      };

      req.flash('success_msg', '¡Has iniciado sesión correctamente!');

      // Redirigir al dashboard o a la página anterior
      res.redirect('/dashboard');
    } catch (error: any) {
      req.flash('error_msg', error.message);
      res.redirect('/login'); // Redirigir de nuevo al login con el mensaje de error
    }
  }

  async postLogout(req: Request, res: Response) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error al cerrar sesión:', err);
        req.flash('error_msg', 'Error al cerrar sesión.');
        return res.redirect('/dashboard'); // O a una página de error
      }
      res.clearCookie('connect.sid'); // Limpiar la cookie de sesión
      req.flash('success_msg', 'Has cerrado sesión.');
      res.redirect('/login');
    });
  }

  // Puedes tener un método para registrar usuarios si lo permites desde una vista
  async postRegister(req: Request, res: Response) {
    const { username, email, password, role, companyId } = req.body;
    try {
      // Lógica para determinar el rol (ej: por defecto USER, o SUPER_ADMIN si es el primero)
      // Asegúrate de validar que solo roles autorizados puedan crear usuarios con ciertos roles
      const newUser = await this.authService.register(username, email, password, role as UserRole, companyId);
      req.flash('success_msg', `Usuario ${newUser.username} registrado exitosamente.`);
      res.redirect('/login');
    } catch (error: any) {
      req.flash('error_msg', error.message);
      res.redirect('/register'); // O de nuevo al formulario de registro
    }
  }
}