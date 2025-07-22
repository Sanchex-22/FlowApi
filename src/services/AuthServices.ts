// src/auth/auth.service.ts
import { PrismaClient, User, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Instancia de PrismaClient para interactuar con la base de datos
const prisma = new PrismaClient();

export class AuthService {

  /**
   * Intenta autenticar un usuario con el email y la contraseña proporcionados.
   * @param email El correo electrónico del usuario.
   * @param password_plain La contraseña sin hashear proporcionada por el usuario.
   * @returns El objeto User si la autenticación es exitosa.
   * @throws Error si las credenciales son inválidas o el usuario está inactivo.
   */
  async login(email: string, password_plain: string): Promise<User> {
    // 1. Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // 2. Verificar si el usuario existe
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

  /**
   * Registra un nuevo usuario en la base de datos.
   * La validación de permisos (quién puede crear qué rol) debe hacerse en el controlador o un middleware.
   * @param username El nombre de usuario.
   * @param email El correo electrónico (debe ser único).
   * @param password_plain La contraseña sin hashear.
   * @param role El rol del usuario (UserRole enum).
   * @param companyId (Opcional) El ID de la empresa a la que pertenece el usuario.
   * @returns El objeto User recién creado.
   * @throws Error si el email ya está en uso o hay un problema en la creación.
   */
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

  // Puedes añadir más métodos relacionados con la autenticación aquí, por ejemplo:
  // - resetPassword(email: string, newPassword_plain: string): Promise<void>
  // - requestPasswordReset(email: string): Promise<string> (para enviar un token de recuperación)
  // - verifyEmail(token: string): Promise<void>
}