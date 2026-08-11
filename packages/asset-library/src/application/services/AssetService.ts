import type { Result } from "@aos/common";

import type { Asset } from "../../domain/entities/Asset.js";
import type { AssetCollection } from "../../domain/entities/AssetCollection.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import type { ArchiveAsset, ArchiveAssetInput } from "../use-cases/ArchiveAsset.js";
import type { ArchiveUnitAssets, ArchiveUnitAssetsInput } from "../use-cases/ArchiveUnitAssets.js";
import type { SaveAiCreative, SaveAiCreativeInput } from "../use-cases/SaveAiCreative.js";
import type { TagAsset, TagAssetInput } from "../use-cases/TagAsset.js";
import type { UploadAsset, UploadAssetInput } from "../use-cases/UploadAsset.js";

/** Facade over the asset-mutating use cases (upload, tag, archive, save AI creatives) — mirrors `@aos/lead-store`'s `LeadService` aggregation. */
export class AssetService {
  constructor(
    private readonly uploadAsset: UploadAsset,
    private readonly tagAsset: TagAsset,
    private readonly archiveAsset: ArchiveAsset,
    private readonly archiveUnitAssets: ArchiveUnitAssets,
    private readonly saveAiCreative: SaveAiCreative,
  ) {}

  async upload(input: UploadAssetInput): Promise<Result<Asset, AssetError>> {
    return this.uploadAsset.execute(input);
  }

  async tag(input: TagAssetInput): Promise<Result<Asset, AssetError>> {
    return this.tagAsset.execute(input);
  }

  async archive(input: ArchiveAssetInput): Promise<Result<Asset, AssetError>> {
    return this.archiveAsset.execute(input);
  }

  async archiveUnit(input: ArchiveUnitAssetsInput): Promise<Result<void, AssetError>> {
    return this.archiveUnitAssets.execute(input);
  }

  async saveCreative(input: SaveAiCreativeInput): Promise<Result<AssetCollection, AssetError>> {
    return this.saveAiCreative.execute(input);
  }
}
