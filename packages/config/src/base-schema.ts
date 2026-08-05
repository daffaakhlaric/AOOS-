import { z } from "zod";

/**
 * The minimal, generic base configuration every AOS service needs, regardless of what it does.
 * Service-specific schemas (future Runtime packages) extend this via `z.object({...}).merge(baseConfigSchema)`.
 */
export const baseConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  SERVICE_NAME: z.string().min(1),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type BaseConfig = z.infer<typeof baseConfigSchema>;
