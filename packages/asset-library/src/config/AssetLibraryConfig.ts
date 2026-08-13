import { err, ErrorCode, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { AssetError } from "../domain/errors/AssetError.js";

/**
 * `supabaseUrl`/`supabaseServiceKey` back this package's METADATA persistence only
 * (`AssetRepository`, the Postgrest `assets` table, via `createSupabaseClient` in
 * `infrastructure/supabase/SupabaseClient.ts`) — a completely separate concern from file-byte
 * storage. They are NOT removed by the GCS storage swap (AAOS-W3E-S1); only the storage-backend
 * fields below (`gcsBucketName`/`gcsProjectId`/`gcsCredentials`/`gcsKeyFilePath`) replace the
 * old Supabase Storage `bucketName` field.
 */
export interface AssetLibraryConfig {
  readonly supabaseUrl: string;
  readonly supabaseServiceKey: string;
  readonly tenantId: string;
  readonly imageSizeLimitBytes: number;
  readonly videoSizeLimitBytes: number;

  // GCS (file-byte storage — replaces the old Supabase Storage `bucketName` field)
  readonly gcsBucketName: string;
  readonly gcsProjectId: string;
  /** Service-account credentials as a JSON string (typical for production env vars). Takes precedence over `gcsKeyFilePath` when both are provided — see `GcsStorageClient`'s docstring. */
  readonly gcsCredentials?: string;
  /** Path to a service-account JSON key file on disk (typical for local dev). */
  readonly gcsKeyFilePath?: string;
}

const IMAGE_SIZE_LIMIT_DEFAULT_BYTES = 10 * 1024 * 1024;
const VIDEO_SIZE_LIMIT_DEFAULT_BYTES = 100 * 1024 * 1024;

/**
 * Design resolution #2 (AAOS-W3E-S1): at least one of `gcsCredentials`/`gcsKeyFilePath` MUST be
 * provided in this package's own config object — enforced below via `.superRefine`. The spec's
 * prose also mentions a third valid path ("OR `GOOGLE_APPLICATION_CREDENTIALS` env var must be
 * set"), but that env var is read directly by the `@google-cloud/storage` SDK itself, not
 * observable by this config object, and the spec's own pinned test ("neither provided ->
 * StorageError on init") doesn't carve out an exception for it — so this schema deliberately does
 * NOT special-case Application Default Credentials. A deployment relying on ADC must still pass a
 * `gcsCredentials`/`gcsKeyFilePath` value to satisfy this validation.
 */
function requiresGcsCredentials(
  val: { readonly gcsCredentials?: string; readonly gcsKeyFilePath?: string },
  ctx: z.RefinementCtx,
): void {
  if (val.gcsCredentials === undefined && val.gcsKeyFilePath === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["gcsCredentials"],
      message: "Either gcsCredentials or gcsKeyFilePath must be provided",
    });
  }
}

/** Judgment call (same as every prior AAOS package's config, e.g. `@aos/lead-store`'s `LeadStoreConfig`): `@aos/config`'s `parseConfig` is shaped for flat `process.env`-style string records; this config's typed/defaulted numeric limits fit a plain Zod object schema over an arbitrary input better. */
export const AssetLibraryConfigSchema = z
  .object({
    supabaseUrl: z.string().url("supabaseUrl must be a valid URL"),
    supabaseServiceKey: z.string().min(1, "supabaseServiceKey must not be empty"),
    tenantId: z.string().min(1, "tenantId must not be empty").default("dss-motor"),
    imageSizeLimitBytes: z.number().int().positive().default(IMAGE_SIZE_LIMIT_DEFAULT_BYTES),
    videoSizeLimitBytes: z.number().int().positive().default(VIDEO_SIZE_LIMIT_DEFAULT_BYTES),
    gcsBucketName: z.string().min(1, "gcsBucketName must not be empty").default("aoos"),
    gcsProjectId: z.string().min(1, "gcsProjectId must not be empty"),
    gcsCredentials: z.string().min(1, "gcsCredentials must not be empty").optional(),
    gcsKeyFilePath: z.string().min(1, "gcsKeyFilePath must not be empty").optional(),
  })
  .superRefine(requiresGcsCredentials);

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
