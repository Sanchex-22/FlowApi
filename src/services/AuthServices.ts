// src/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { User, UserRole } from '../../generated/prisma/client.js';


export class AuthService {

  async login(email: string, password_plain: string): Promise<User> {
    // 1. Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Credenciales inválidas.');
    }

    // 3. Verificar si la cuenta de usuario está activa
    if (!user.isActive) {
      throw new Error('Tu cuenta está inactiva. Por favor, contacta al administrador.');
    }

    // 4. Comparar la contraseña proporcionada con la contraseña hasheada almacenada
    const isPasswordValid = await bcrypt.compare(password_plain, user.password);

    if (!isPasswordValid) {
      throw new Error('Credenciales inválidas.');
    }

    // 5. Si todo es correcto, devolver el objeto User
    // No devolvemos la contraseña hasheada por seguridad
    return user;
  }

  async register(username: string, email: string, password_plain: string, role: UserRole, companyId?: string): Promise<User> {
    // 1. Hashear la contraseña antes de almacenarla
    const hashedPassword = await bcrypt.hash(password_plain, 10);

    try {
      // 2. Crear el nuevo usuario en la base de datos
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          role,
          companyId, // Puede ser null/undefined si el rol no requiere una empresa (e.g., SUPER_ADMIN inicial)
        },
      });
      // 3. Devolver el usuario creado (sin la contraseña hasheada)
      return newUser;
    } catch (error: any) {
      // Manejo de errores específicos, por ejemplo, si el email ya existe (violación de la restricción unique)
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        throw new Error('El correo electrónico ya está registrado.');
      }
      // Otros errores de base de datos
      console.error('Error al registrar usuario:', error);
      throw new Error('No se pudo registrar el usuario. Por favor, inténtalo de nuevo.');
    }
  }

}