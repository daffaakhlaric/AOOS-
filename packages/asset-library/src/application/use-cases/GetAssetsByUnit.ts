import { err, ok, type Result } from "@aos/common";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import { AssetCollection } from "../../domain/entities/AssetCollection.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import { AssetStatus } from "../../domain/value-objects/AssetStatus.js";

export interface GetAssetsByUnitInput {
  readonly unitId: string;
}

/** Called by Kai to find source photos for creative generation (spec). Returns only `ACTIVE` assets, newest first. */
export class GetAssetsByUnit {
  constructor(private readonly repository: IAssetRepository) {}

  async execute(input: GetAssetsByUnitInput): Promise<Result<AssetCollection, AssetError>> {
    const found = await this.repository.findByUnitId(input.unitId, AssetStatus.ACTIVE);
    if (!found.ok) {
      return err(found.error);
    }
    return ok(AssetCollection.of(found.value).sortedByNewest());
  }
}
