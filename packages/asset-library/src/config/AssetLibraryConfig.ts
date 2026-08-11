import { err, ErrorCode, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { AssetError } from "../domain/errors/AssetError.js";

export interface AssetLibraryConfig {
  readonly supabaseUrl: string;
  readonly supabaseServiceKey: string;
  readonly bucketName: string;
  readonly tenantId: string;
  readonly imageSizeLimitBytes: number;
  readonly videoSizeLimitBytes: number;
}

const IMAGE_SIZE_LIMIT_DEFAULT_BYTES = 10 * 1024 * 1024;
const VIDEO_SIZE_LIMIT_DEFAULT_BYTES = 100 * 1024 * 1024;

/** Judgment call (same as every prior AAOS package's config, e.g. `@aos/lead-store`'s `LeadStoreConfig`): `@aos/config`'s `parseConfig` is shaped for flat `process.env`-style string records; this config's typed/defaulted numeric limits fit a plain Zod object schema over an arbitrary input better. */
export const AssetLibraryConfigSchema = z.object({
  supabaseUrl: z.string().url("supabaseUrl must be a valid URL"),
  supabaseServiceKey: z.string().min(1, "supabaseServiceKey must not be empty"),
  bucketName: z.string().min(1, "bucketName must not be empty").default("mobix-assets"),
  tenantId: z.string().min(1, "tenantId must not be empty").default("dss-motor"),
  imageSizeLimitBytes: z.number().int().positive().default(IMAGE_SIZE_LIMIT_DEFAULT_BYTES),
  videoSizeLimitBytes: z.number().int().positive().default(VIDEO_SIZE_LIMIT_DEFAULT_BYTES),
});

export type AssetLibraryConfigInput = z.input<typeof AssetLibraryConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err` rather than throwing. */
export function parseAssetLibraryConfig(input: unknown): Result<AssetLibraryConfig, AssetError> {
  const parsed = AssetLibraryConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new AssetError(`AssetLibraryConfig validation failed: ${details}`, {
        code: ErrorCode.VALIDATION_ERROR,
        cause: new ValidationError(details),
      }),
    );
  }
  return ok(parsed.data);
}
