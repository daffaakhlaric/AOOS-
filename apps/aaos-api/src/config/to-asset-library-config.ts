import type { AssetError, AssetLibraryConfig } from "@aos/asset-library";
import { parseAssetLibraryConfig } from "@aos/asset-library";
import type { Result } from "@aos/common";

import type { AaosApiConfig } from "./aaos-api.config.js";

/**
 * True when this deployment has enough GCS configuration for `@aos/asset-library` to be composed at
 * all (AAOS-SCRAPER-ASSET-LIBRARY).
 *
 * Checked BEFORE `toAssetLibraryConfig` in `app.module.ts` because `GcsStorageClient`'s constructor
 * throws (not `Result.err`s) when given neither `gcsCredentials` nor `gcsKeyFilePath` — so an
 * unconfigured deployment must skip composition entirely rather than let the whole app fail to
 * boot. See `AaosApiConfig.GCS_*`'s doc comment.
 */
export function isAssetLibraryConfigured(config: AaosApiConfig): boolean {
  return (
    config.GCS_PROJECT_ID.length > 0 &&
    (config.GCS_CREDENTIALS.length > 0 || config.GCS_KEY_FILE_PATH.length > 0)
  );
}

/**
 * Translates this app's `AaosApiConfig` (flat env-var shape) into `@aos/asset-library`'s own
 * `AssetLibraryConfig`, going through `parseAssetLibraryConfig`'s real Zod validation (same pattern
 * as `to-lead-store-config.ts`/`to-connector-config.ts`) rather than an unchecked cast.
 *
 * The two optional GCS credential fields are omitted rather than passed as `""` — the package's
 * schema declares them `.min(1).optional()`, so an empty string is a validation FAILURE there,
 * while `undefined` correctly means "not provided".
 */
export function toAssetLibraryConfig(
  config: AaosApiConfig,
): Result<AssetLibraryConfig, AssetError> {
  return parseAssetLibraryConfig({
    supabaseUrl: config.SUPABASE_URL,
    supabaseServiceKey: config.SUPABASE_SERVICE_KEY,
    tenantId: config.AAOS_TENANT_ID,
    gcsBucketName: config.GCS_BUCKET_NAME,
    gcsProjectId: config.GCS_PROJECT_ID,
    ...(config.GCS_CREDENTIALS.length > 0 ? { gcsCredentials: config.GCS_CREDENTIALS } : {}),
    ...(config.GCS_KEY_FILE_PATH.length > 0 ? { gcsKeyFilePath: config.GCS_KEY_FILE_PATH } : {}),
  });
}
