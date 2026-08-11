import { err, ok, type Result } from "@aos/common";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import { AssetCollection } from "../../domain/entities/AssetCollection.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import { AssetStatus } from "../../domain/value-objects/AssetStatus.js";
import { AssetType } from "../../domain/value-objects/AssetType.js";

/** Returns brand assets (logo, templates, overlays — spec: "GetBrandAssets ← logo, templates, overlays"), `ACTIVE` only, newest first. */
export class GetBrandAssets {
  constructor(private readonly repository: IAssetRepository) {}

  async execute(): Promise<Result<AssetCollection, AssetError>> {
    const found = await this.repository.findByType(AssetType.BRAND, AssetStatus.ACTIVE);
    if (!found.ok) {
      return err(found.error);
    }
    return ok(AssetCollection.of(found.value).sortedByNewest());
  }
}
