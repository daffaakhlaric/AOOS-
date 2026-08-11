import { err, ErrorCode, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { LeadStoreError } from "../domain/errors/LeadStoreError.js";

export interface LeadStoreConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly supabaseServiceKey: string;
  readonly tenantId: string;
  readonly realtimeEnabled: boolean;
}

/** Judgment call (same as every prior AAOS package's config): `@aos/config`'s `parseConfig` is shaped for flat `process.env`-style string records; this config's typed/defaulted `realtimeEnabled` boolean fits a plain Zod object schema over an arbitrary input better. */
export const LeadStoreConfigSchema = z.object({
  supabaseUrl: z.string().url("supabaseUrl must be a valid URL"),
  supabaseAnonKey: z.string().min(1, "supabaseAnonKey must not be empty"),
  supabaseServiceKey: z.string().min(1, "supabaseServiceKey must not be empty"),
  tenantId: z.string().min(1, "tenantId must not be empty").default("dss-motor"),
  realtimeEnabled: z.boolean().default(true),
});

export type LeadStoreConfigInput = z.input<typeof LeadStoreConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err` rather than throwing. */
export function parseLeadStoreConfig(input: unknown): Result<LeadStoreConfig, LeadStoreError> {
  const parsed = LeadStoreConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new LeadStoreError(`LeadStoreConfig validation failed: ${details}`, {
        code: ErrorCode.VALIDATION_ERROR,
        cause: new ValidationError(details),
      }),
    );
  }
  return ok(parsed.data);
}
