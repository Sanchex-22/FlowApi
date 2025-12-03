// lib/prisma.ts
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.js'

// Singleton de PrismaClient
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Usa la misma variable que en tu test exitoso
    accelerateUrl: process.env.PRISMA_ACCELERATE_URL || process.env.DATABASE_URL || '',
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Test de conexión (opcional - solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  prisma.$connect()
    .then(() => {
      console.log('✅ Conectado a PostgreSQL (via Prisma Accelerate)')
    })
    .catch((error) => {
      console.error('❌ Error conectando a PostgreSQL:', error.message)
    })
}

export default prisma