import Cors from 'cors';
import initMiddleware from './init-middleware';

// Aquí está tu configuración de CORS
export const CorsOrigin = initMiddleware(
  Cors({
    methods: ["POST", "GET", "DELETE", "PUT","OPTIONS"],
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:5173",
        "https://pmts-quote.vercel.app",
        "https://quote.panamamaritimetraining.com",
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("No autorizado por CORS"));
      }
    },
  })
);

// export default CorsOrigin;