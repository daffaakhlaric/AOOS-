import { err, ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import { AssetCollection } from "../../domain/entities/AssetCollection.js";
import type { AssetError } from "../../domain/errors/AssetError.js";

export interface GetAssetsByBranchInput {
  readonly branch: Branch;
}

/** Returns every asset tagged with the given `branch`, newest first. */
export class GetAssetsByBranch {
  constructor(private readonly repository: IAssetRepository) {}

  async execute(input: GetAssetsByBranchInput): Promise<Result<AssetCollection, AssetError>> {
    const found = await this.repository.findByBranch(input.branch);
    if (!found.ok) {
      return err(found.error);
    }
    return ok(AssetCollection.of(found.value).sortedByNewest());
  }
}
