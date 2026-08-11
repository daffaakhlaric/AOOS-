import { err, ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { IAssetRepository } from "../../src/contracts/IAssetRepository.js";
import type { Asset } from "../../src/domain/entities/Asset.js";
import { AssetError } from "../../src/domain/errors/AssetError.js";
import type { AssetId } from "../../src/domain/value-objects/AssetId.js";
import type { AssetStatus } from "../../src/domain/value-objects/AssetStatus.js";
import type { AssetType } from "../../src/domain/value-objects/AssetType.js";

/**
 * A hand-written `IAssetRepository` test double whose every method can be individually overridden
 * to force a specific `Result` — useful for exercising a use case's error-propagation branches
 * without threading a forced-error through the full `FakeSupabaseClient` Postgrest emulator.
 */
export function createStubAssetRepository(
  overrides: Partial<IAssetRepository> = {},
): IAssetRepository {
  const defaultError = (): Promise<Result<never, AssetError>> =>
    Promise.resolve(err(new AssetError("stub: not configured")));

  return {
    findById: overrides.findById ?? (async (_id: AssetId) => defaultError()),
    insert: overrides.insert ?? (async (_asset: Asset) => defaultError()),
    update: overrides.update ?? (async (_asset: Asset) => defaultError()),
    findByUnitId:
      overrides.findByUnitId ?? (async (_unitId: string, _status?: AssetStatus) => defaultError()),
    findByBranch: overrides.findByBranch ?? (async (_branch: Branch) => defaultError()),
    findByType:
      overrides.findByType ?? (async (_type: AssetType, _status?: AssetStatus) => defaultError()),
  };
}

export { ok, err, AssetError };
