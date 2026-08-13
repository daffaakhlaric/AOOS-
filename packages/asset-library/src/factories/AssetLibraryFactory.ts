import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";

import { AssetQueryService } from "../application/services/AssetQueryService.js";
import { AssetService } from "../application/services/AssetService.js";
import { DefaultAssetTagger } from "../application/services/DefaultAssetTagger.js";
import { StorageService } from "../application/services/StorageService.js";
import { ArchiveAsset } from "../application/use-cases/ArchiveAsset.js";
import { ArchiveUnitAssets } from "../application/use-cases/ArchiveUnitAssets.js";
import { GetAsset } from "../application/use-cases/GetAsset.js";
import { GetAssetsByBranch } from "../application/use-cases/GetAssetsByBranch.js";
import { GetAssetsByType } from "../application/use-cases/GetAssetsByType.js";
import { GetAssetsByUnit } from "../application/use-cases/GetAssetsByUnit.js";
import { GetBrandAssets } from "../application/use-cases/GetBrandAssets.js";
import { SaveAiCreative } from "../application/use-cases/SaveAiCreative.js";
import { TagAsset } from "../application/use-cases/TagAsset.js";
import { UploadAsset } from "../application/use-cases/UploadAsset.js";
import type { AssetLibraryConfig } from "../config/AssetLibraryConfig.js";
import type { IAssetRepository } from "../contracts/IAssetRepository.js";
import type { IAssetStorage } from "../contracts/IAssetStorage.js";
import type { IAssetTagger } from "../contracts/IAssetTagger.js";
import { AssetLibraryEvents } from "../domain/events/AssetLibraryEvents.js";
import { GcsStorageClient } from "../infrastructure/gcs/GcsStorageClient.js";
import { AssetRepository } from "../infrastructure/supabase/AssetRepository.js";
import { createSupabaseClient } from "../infrastructure/supabase/SupabaseClient.js";
import type { SupabaseClientLike } from "../infrastructure/supabase/SupabaseTypes.js";

export interface AssetLibraryFactoryOptions {
  readonly config: AssetLibraryConfig;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, the same composition-boundary discipline every prior AAOS package's factory establishes. */
  readonly publisher: IPublisher;
  readonly logger?: Logger;
  /** Injectable clock — defaults to the real wall clock only here. */
  readonly now?: () => Date;
  /** Injectable Supabase Postgrest client (tests supply a mock satisfying `SupabaseClientLike`; production omits this and gets the real `@supabase/supabase-js` client). Metadata persistence only — see `AssetLibraryConfig.ts`'s docstring. */
  readonly supabaseClient?: SupabaseClientLike;
  /** Injectable file-byte storage adapter (tests supply a fake `IAssetStorage`; production omits this and gets a real `GcsStorageClient` backed by `@google-cloud/storage`). Replaces the old `supabaseStorageClient` option (AAOS-W3E-S1). */
  readonly assetStorage?: IAssetStorage;
}

export interface AssetLibrary {
  readonly uploadAsset: UploadAsset;
  readonly getAsset: GetAsset;
  readonly getAssetsByUnit: GetAssetsByUnit;
  readonly getAssetsByBranch: GetAssetsByBranch;
  readonly getAssetsByType: GetAssetsByType;
  readonly getBrandAssets: GetBrandAssets;
  readonly saveAiCreative: SaveAiCreative;
  readonly archiveAsset: ArchiveAsset;
  readonly archiveUnitAssets: ArchiveUnitAssets;
  readonly tagAsset: TagAsset;
  readonly assetService: AssetService;
  readonly assetQueryService: AssetQueryService;
  readonly assetRepository: IAssetRepository;
  readonly assetStorage: IAssetStorage;
}

/** The composition root (Factory Pattern) — wires the Supabase clients, repository, storage adapter, tagger, event publisher, and every use case/service. Mirrors `@aos/lead-store`'s `LeadStoreFactory`. */
export class AssetLibraryFactory {
  static create(options: AssetLibraryFactoryOptions): AssetLibrary {
    const logger = options.logger ?? createLogger({ serviceName: "asset-library" });
    const now = options.now ?? (() => new Date());
    const client = options.supabaseClient ?? createSupabaseClient(options.config);

    const assetRepository = new AssetRepository(client);
    const assetStorage: IAssetStorage =
      options.assetStorage ?? new GcsStorageClient(options.config);
    const storageService = new StorageService(assetStorage, options.config);
    const tagger: IAssetTagger = new DefaultAssetTagger();
    const events = new AssetLibraryEvents(options.publisher);

    const uploadAsset = new UploadAsset(assetRepository, storageService, tagger, events, now);
    const getAsset = new GetAsset(assetRepository);
    const getAssetsByUnit = new GetAssetsByUnit(assetRepository);
    const getAssetsByBranch = new GetAssetsByBranch(assetRepository);
    const getAssetsByType = new GetAssetsByType(assetRepository);
    const getBrandAssets = new GetBrandAssets(assetRepository);
    const saveAiCreative = new SaveAiCreative(assetRepository, storageService, tagger, events, now);
    const archiveAsset = new ArchiveAsset(assetRepository, events, now);
    const archiveUnitAssets = new ArchiveUnitAssets(assetRepository, events, now);
    const tagAsset = new TagAsset(assetRepository, events, now);

    logger.info({ tenantId: options.config.tenantId }, "asset-library: factory composed");

    return {
      uploadAsset,
      getAsset,
      getAssetsByUnit,
      getAssetsByBranch,
      getAssetsByType,
      getBrandAssets,
      saveAiCreative,
      archiveAsset,
      archiveUnitAssets,
      tagAsset,
      assetService: new AssetService(
        uploadAsset,
        tagAsset,
        archiveAsset,
        archiveUnitAssets,
        saveAiCreative,
      ),
      assetQueryService: new AssetQueryService(
        getAsset,
        getAssetsByUnit,
        getAssetsByBranch,
        getAssetsByType,
        getBrandAssets,
      ),
      assetRepository,
      assetStorage,
    };
  }
}
