// Factory
export { AssetLibraryFactory } from "./factories/AssetLibraryFactory.js";
export type { AssetLibrary, AssetLibraryFactoryOptions } from "./factories/AssetLibraryFactory.js";

// Use Cases
export { UploadAsset } from "./application/use-cases/UploadAsset.js";
export type { UploadAssetInput } from "./application/use-cases/UploadAsset.js";
export { GetAsset } from "./application/use-cases/GetAsset.js";
export { GetAssetsByUnit } from "./application/use-cases/GetAssetsByUnit.js";
export type { GetAssetsByUnitInput } from "./application/use-cases/GetAssetsByUnit.js";
export { GetAssetsByBranch } from "./application/use-cases/GetAssetsByBranch.js";
export type { GetAssetsByBranchInput } from "./application/use-cases/GetAssetsByBranch.js";
export { GetAssetsByType } from "./application/use-cases/GetAssetsByType.js";
export type { GetAssetsByTypeInput } from "./application/use-cases/GetAssetsByType.js";
export { GetBrandAssets } from "./application/use-cases/GetBrandAssets.js";
export { ListAssets } from "./application/use-cases/ListAssets.js";
export type { ListAssetsInput } from "./application/use-cases/ListAssets.js";
export { GetAssetStats } from "./application/use-cases/GetAssetStats.js";
export type { GetAssetStatsInput } from "./application/use-cases/GetAssetStats.js";
export { SaveAiCreative } from "./application/use-cases/SaveAiCreative.js";
export type { SaveAiCreativeInput } from "./application/use-cases/SaveAiCreative.js";
export { ArchiveAsset } from "./application/use-cases/ArchiveAsset.js";
export type { ArchiveAssetInput } from "./application/use-cases/ArchiveAsset.js";
export { ArchiveUnitAssets } from "./application/use-cases/ArchiveUnitAssets.js";
export type { ArchiveUnitAssetsInput } from "./application/use-cases/ArchiveUnitAssets.js";
export { TagAsset } from "./application/use-cases/TagAsset.js";
export type { TagAssetInput } from "./application/use-cases/TagAsset.js";

// Services
export { AssetService } from "./application/services/AssetService.js";
export { AssetQueryService } from "./application/services/AssetQueryService.js";
export { StorageService } from "./application/services/StorageService.js";
export { DefaultAssetTagger } from "./application/services/DefaultAssetTagger.js";

// Domain — Entities
export type { Asset, AssetProps } from "./domain/entities/index.js";
export { AssetCollection } from "./domain/entities/index.js";

// Domain — Value Objects
export { AssetType } from "./domain/value-objects/AssetType.js";
export { AssetStatus } from "./domain/value-objects/AssetStatus.js";
export { AssetTag } from "./domain/value-objects/AssetTag.js";
export {
  MimeType,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
} from "./domain/value-objects/MimeType.js";
export { FileSize } from "./domain/value-objects/FileSize.js";
export type { AssetId, PublicUrl, StoragePath } from "./domain/value-objects/index.js";

// Domain — Events
export type {
  AssetUploaded,
  AssetArchived,
  AssetTagged,
  CollectionUpdated,
} from "./domain/events/index.js";
export { AssetLibraryEvents } from "./domain/events/AssetLibraryEvents.js";

// Errors
export {
  AssetError,
  AssetNotFoundError,
  StorageError,
  InvalidFileTypeError,
  FileSizeLimitError,
} from "./domain/errors/index.js";

// Config
export type { AssetLibraryConfig, AssetLibraryConfigInput } from "./config/AssetLibraryConfig.js";
export { AssetLibraryConfigSchema, parseAssetLibraryConfig } from "./config/AssetLibraryConfig.js";

// Contracts
export type {
  IAssetRepository,
  AssetListFilter,
  AssetPage,
  AssetStats,
} from "./contracts/IAssetRepository.js";
export type { IAssetStorage, UploadFileInput, UploadedFile } from "./contracts/IAssetStorage.js";
export type { IAssetTagger, DeriveTagsInput } from "./contracts/IAssetTagger.js";

// Builders
export { AssetBuilder } from "./builders/AssetBuilder.js";
export { AssetCollectionBuilder } from "./builders/AssetCollectionBuilder.js";

// Infrastructure
export { AssetRepository } from "./infrastructure/supabase/AssetRepository.js";
export { createSupabaseClient } from "./infrastructure/supabase/SupabaseClient.js";
export type { SupabaseClientLike } from "./infrastructure/supabase/SupabaseTypes.js";
export { GcsStorageClient } from "./infrastructure/gcs/GcsStorageClient.js";

// Mappers
export { AssetMapper } from "./infrastructure/mappers/AssetMapper.js";
export type { AssetRow } from "./infrastructure/mappers/AssetMapper.js";
