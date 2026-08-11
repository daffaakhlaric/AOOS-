import { err, ok, type Result } from "@aos/common";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import { AssetCollection } from "../../domain/entities/AssetCollection.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import type { AssetType } from "../../domain/value-objects/AssetType.js";

export interface GetAssetsByTypeInput {
  readonly type: AssetType;
}

/** Returns every asset of the given `type`, newest first. */
export class GetAssetsByType {
  constructor(private readonly repository: IAssetRepository) {}

  async execute(input: GetAssetsByTypeInput): Promise<Result<AssetCollection, AssetError>> {
    const found = await this.repository.findByType(input.type);
    if (!found.ok) {
      return err(found.error);
    }
    return ok(AssetCollection.of(found.value).sortedByNewest());
  }
}
