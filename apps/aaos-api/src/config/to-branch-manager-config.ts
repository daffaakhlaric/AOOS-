import type { BranchManagerConfig, BranchManagerError } from "@aos/branch-manager";
import { parseBranchManagerConfig } from "@aos/branch-manager";
import type { Result } from "@aos/common";

import type { AaosApiConfig } from "./aaos-api.config.js";

/**
 * Translates this app's `AaosApiConfig` into `@aos/branch-manager`'s own `BranchManagerConfig`,
 * mirroring `to-whatsapp-connector-config.ts`'s pattern — real Zod validation via
 * `parseBranchManagerConfig`, not an unchecked cast. Reuses the exact same 4-branch WABA
 * phone-number env vars `AaosApiConfig` already validates for `@aos/whatsapp-connector`
 * (`WABA`/`PHONE_NUMBER`/`PHONE_NUMBER_ID` per branch) — `@aos/branch-manager` only needs the
 * phone-number-id/phone-number pair per branch, not the WABA id itself.
 */
export function toBranchManagerConfig(
  config: AaosApiConfig,
): Result<BranchManagerConfig, BranchManagerError> {
  return parseBranchManagerConfig({
    tenantId: config.AAOS_TENANT_ID,
    phoneNumberIdBintaro: config.PHONE_NUMBER_ID_BINTARO,
    phoneNumberIdCinere: config.PHONE_NUMBER_ID_CINERE,
    phoneNumberIdPondokBambu: config.PHONE_NUMBER_ID_PONDOK_BAMBU,
    phoneNumberIdBandung: config.PHONE_NUMBER_ID_BANDUNG,
    phoneNumberBintaro: config.PHONE_NUMBER_BINTARO,
    phoneNumberCinere: config.PHONE_NUMBER_CINERE,
    phoneNumberPondokBambu: config.PHONE_NUMBER_PONDOK_BAMBU,
    phoneNumberBandung: config.PHONE_NUMBER_BANDUNG,
  });
}
