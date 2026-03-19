import cors from 'cors'
import { CorsConfig } from '../config/corsConfig.js'

const rawOrigins = (CorsConfig.ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean)

// Si no hay orígenes configurados, en desarrollo permite todo; en producción bloquea
const originOption: cors.CorsOptions['origin'] =
  rawOrigins.length > 0
    ? rawOrigins
    : process.env.NODE_ENV === 'production'
      ? false
      : true // desarrollo: permite cualquier origen

const corsOptions: cors.CorsOptions = {
  origin: originOption,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  credentials: true,
  optionsSuccessStatus: 204, // compatibilidad con IE11
}

const corsMiddleware = cors(corsOptions)

export { corsMiddleware }