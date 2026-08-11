import { err, ok, type Result } from "@aos/common";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import type { Asset } from "../../domain/entities/Asset.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import { AssetNotFoundError } from "../../domain/errors/AssetNotFoundError.js";
import { AssetId } from "../../domain/value-objects/AssetId.js";

/** Looks up a single asset by id. */
export class GetAsset {
  constructor(private readonly repository: IAssetRepository) {}

  async execute(id: string): Promise<Result<Asset, AssetError>> {
    const idResult = AssetId.create(id);
    if (!idResult.ok) {
      return err(new AssetNotFoundError(idResult.error.message));
    }
    const found = await this.repository.findById(idResult.value);
    if (!found.ok) {
      return err(found.error);
    }
    if (found.value === undefined) {
      return err(new AssetNotFoundError(`Asset not found: ${id}`));
    }
    return ok(found.value);
  }
}
