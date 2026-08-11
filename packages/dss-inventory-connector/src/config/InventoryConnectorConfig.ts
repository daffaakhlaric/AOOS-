import { err, ErrorCode, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { InventoryError } from "../domain/errors/index.js";

export type SyncMode = "MOCK" | "LIVE" | "HYBRID";

export interface InventoryConnectorConfig {
  readonly tenantId: string;
  /**
   * Default: `"MOCK"` — a sensible default for a package where 3 of the 4 sources are shells with
   * no real credentials yet; every other mode requires configuration this package cannot assume
   * exists.
   */
  readonly syncMode: SyncMode;
  readonly apiSyncIntervalMs: number;
  readonly dmsSyncIntervalMs: number;
  readonly sheetsSyncIntervalMs: number;
  readonly googleSheetsCredentials?: string;
  readonly googleSheetsSpreadsheetId?: string;
  readonly dmsApiUrl?: string;
  readonly dmsApiKey?: string;
  readonly inventoryApiUrl?: string;
  readonly inventoryApiKey?: string;
}

/**
 * Judgment call (same as `@aos/whatsapp-connector`'s `WhatsAppConnectorConfig` and
 * `@aos/meta-ads-connector`'s `MetaAdsConnectorConfig`): `@aos/config`'s `parseConfig` is shaped
 * for flat `process.env`-style string records; this config's optional per-adapter credential
 * fields fit a plain Zod object schema over an arbitrary input better.
 */
export const InventoryConnectorConfigSchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  syncMode: z.enum(["MOCK", "LIVE", "HYBRID"]).default("MOCK"),
  apiSyncIntervalMs: z.number().int().positive().default(120_000),
  dmsSyncIntervalMs: z.number().int().positive().default(1_800_000),
  sheetsSyncIntervalMs: z.number().int().positive().default(900_000),
  googleSheetsCredentials: z.string().min(1).optional(),
  googleSheetsSpreadsheetId: z.string().min(1).optional(),
  dmsApiUrl: z.string().min(1).optional(),
  dmsApiKey: z.string().min(1).optional(),
  inventoryApiUrl: z.string().min(1).optional(),
  inventoryApiKey: z.string().min(1).optional(),
});

export type InventoryConnectorConfigInput = z.input<typeof InventoryConnectorConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err` rather than throwing. */
export function parseInventoryConnectorConfig(
  input: unknown,
): Result<InventoryConnectorConfig, InventoryError> {
  const parsed = InventoryConnectorConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new InventoryError(
        ErrorCode.VALIDATION_ERROR,
        `InventoryConnectorConfig validation failed: ${details}`,
        { cause: new ValidationError(details) },
      ),
    );
  }
  return ok(parsed.data);
}
