import Cors from 'cors';
import initMiddleware from './init-middleware';

// Convertir la variable de entorno en array
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [];

export const CorsOrigin = initMiddleware(
  Cors({
    methods: ["POST", "GET", "DELETE", "PUT", "OPTIONS"],
    origin: (origin, callback) => {
      // Permitir requests sin origin (ej: Postman, SSR)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("No autorizado por CORS"));
      }
    },
  })
);