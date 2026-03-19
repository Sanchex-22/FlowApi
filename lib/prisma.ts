// lib/prisma.ts
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.js'

// Singleton para evitar múltiples instancias en hot-reload (dev) y en serverless (prod)
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Guardar singleton en desarrollo (hot-reload) y en producción (reutilizar entre invocaciones)
globalForPrisma.prisma = prisma

// Conectar siempre — en serverless el engine arranca lazy y puede no estar listo en la primera request
prisma.$connect().catch((error: Error) => {
  console.error('❌ Error conectando a PostgreSQL:', error.message)
})

export default prisma