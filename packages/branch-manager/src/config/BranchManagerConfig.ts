import { err, ErrorCode, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { BranchManagerError } from "../domain/errors/BranchManagerError.js";
import { AssignmentMode } from "../domain/value-objects/AssignmentMode.js";

export interface BranchManagerConfig {
  readonly tenantId: string;
  // WABA phone number IDs (same as whatsapp-connector .env)
  readonly phoneNumberIdBintaro: string;
  readonly phoneNumberIdCinere: string;
  readonly phoneNumberIdPondokBambu: string;
  readonly phoneNumberIdBandung: string;
  readonly phoneNumberBintaro: string;
  readonly phoneNumberCinere: string;
  readonly phoneNumberPondokBambu: string;
  readonly phoneNumberBandung: string;
  // Global defaults (overridable per branch)
  readonly defaultMaxLeadsPerSalesPerDay: number;
  readonly defaultAssignmentMode: AssignmentMode;
  // Queue
  readonly maxQueueSize: number;
  readonly queueTtlMs: number;
}

/**
 * Judgment call (same as `@aos/dss-inventory-connector`'s `InventoryConnectorConfig` and
 * `@aos/whatsapp-connector`'s `WhatsAppConnectorConfig`): `@aos/config`'s `parseConfig` is shaped
 * for flat `process.env`-style string records; this config's typed/defaulted numeric fields fit a
 * plain Zod object schema over an arbitrary input better.
 */
export const BranchManagerConfigSchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  phoneNumberIdBintaro: z.string().min(1, "phoneNumberIdBintaro must not be empty"),
  phoneNumberIdCinere: z.string().min(1, "phoneNumberIdCinere must not be empty"),
  phoneNumberIdPondokBambu: z.string().min(1, "phoneNumberIdPondokBambu must not be empty"),
  phoneNumberIdBandung: z.string().min(1, "phoneNumberIdBandung must not be empty"),
  phoneNumberBintaro: z.string().min(1, "phoneNumberBintaro must not be empty"),
  phoneNumberCinere: z.string().min(1, "phoneNumberCinere must not be empty"),
  phoneNumberPondokBambu: z.string().min(1, "phoneNumberPondokBambu must not be empty"),
  phoneNumberBandung: z.string().min(1, "phoneNumberBandung must not be empty"),
  defaultMaxLeadsPerSalesPerDay: z.number().int().min(1).max(50).default(10),
  defaultAssignmentMode: z.nativeEnum(AssignmentMode).default(AssignmentMode.SMART_ASSIGN),
  maxQueueSize: z.number().int().positive().default(100),
  queueTtlMs: z.number().int().positive().default(86_400_000),
});

export type BranchManagerConfigInput = z.input<typeof BranchManagerConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err` rather than throwing. */
export function parseBranchManagerConfig(
  input: unknown,
): Result<BranchManagerConfig, BranchManagerError> {
  const parsed = BranchManagerConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new BranchManagerError(
        ErrorCode.VALIDATION_ERROR,
        `BranchManagerConfig validation failed: ${details}`,
        { cause: new ValidationError(details) },
      ),
    );
  }
  return ok(parsed.data);
}
