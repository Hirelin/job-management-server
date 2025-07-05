import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    PORT: z.coerce.number().default(8080),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    AUTH_SERVER: z.string().url(),
    SERVER_URL: z.string().url().default("http://localhost:80"),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default("*")
      .transform((val) => val.split(",")),

    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_DB: z.coerce.number().default(0),
    REDIS_PASSWORD: z.string().optional().default(""),
    EVENT_QUEUE: z.string().default("events"),
  },
  runtimeEnv: process.env,
});
