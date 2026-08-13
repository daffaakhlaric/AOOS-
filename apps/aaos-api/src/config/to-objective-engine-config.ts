import type { Result } from "@aos/common";
import type { InvalidObjectiveError, ObjectiveEngineConfig } from "@aos/objective-engine";
import { parseObjectiveEngineConfig } from "@aos/objective-engine";

import type { AaosApiConfig } from "./aaos-api.config.js";

/**
 * Translates this app's `AaosApiConfig` (flat env-var shape) into `@aos/objective-engine`'s own
 * `ObjectiveEngineConfig`, mirroring `to-lead-store-config.ts`/`to-connector-config.ts`'s pattern
 * exactly — real Zod validation via `parseObjectiveEngineConfig`, not an unchecked cast. No new
 * `AaosApiConfig` fields are required: every `ObjectiveEngineConfig` field besides `tenantId` has
 * a sensible spec-pinned default (see `ObjectiveEngineConfigSchema`), so this app reuses
 * `AAOS_TENANT_ID` and accepts the package's own defaults rather than inventing new env vars for
 * an MVP dashboard slice.
 */
export function toObjectiveEngineConfig(
  config: AaosApiConfig,
): Result<ObjectiveEngineConfig, InvalidObjectiveError> {
  return parseObjectiveEngineConfig({ tenantId: config.AAOS_TENANT_ID });
}
