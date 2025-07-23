// src/auth/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/AuthServices.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_for_jwt';

export class AuthController {
  constructor(private authService: AuthService) {}

  async postLogin(req: Request, res: Response) {
    const { email, password } = req.body;
    try {
      const user = await this.authService.login(email, password);

      // Crear token JWT
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user?.role ?? 'user'
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Responder con el token y la información del usuario
      return res.json({
        message: '¡Has iniciado sesión correctamente!',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error: any) {
      return res.status(401).json({
        message: error.message || 'Credenciales inválidas'
      });
    }
  }

  async postLogout(req: Request, res: Response) {
    // Con JWT no existe "logout" en el servidor, el cliente solo elimina el token.
    // Pero podemos implementar lista negra (blacklist) si es necesario.
    return res.json({
      message: 'Has cerrado sesión. El token debe ser eliminado en el cliente.'
    });
  }

  async postRegister(req: Request, res: Response) {
    const { username, email, password, role, companyId } = req.body;
    try {
      const newUser = await this.authService.register(username, email, password, role, companyId);
      return res.status(201).json({
        message: `Usuario ${newUser.username} registrado exitosamente.`,
        user: newUser
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message || 'Error al registrar usuario'
      });
    }
  }
}
