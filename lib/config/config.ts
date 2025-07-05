import { CorsOptions, CorsOptionsDelegate } from "cors";
import { env } from "../env";

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = env.CORS_ALLOWED_ORIGINS;

    // Allow requests with no origin (like mobile apps, curl requests, etc)
    if (!origin) {
      return callback(null, true);
    }

    // Allow all origins if wildcard is specified
    if (allowedOrigins.includes("*")) {
      return callback(null, true);
    }

    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Not allowed
    callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
