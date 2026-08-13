import type { AssetCollection, AssetError } from "@aos/asset-library";
import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

/**
 * Mirrors `@aos/asset-library`'s `SaveAiCreativeInput` (NOT publicly exported by that package's
 * `index.ts`, so this port redeclares its exact shape — verified by reading
 * `packages/asset-library/src/application/use-cases/SaveAiCreative.ts` directly).
 */
export interface CreativeAssetSaveInput {
  readonly videoBuffer?: Buffer;
  readonly imageBuffers: readonly Buffer[];
  readonly creativeBriefId: string;
  readonly unitId?: string;
  readonly branch: Branch;
  readonly aiPrompt: string;
  readonly aiModel: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

/**
 * Port (Hexagonal Architecture) for persisting Kai's generated video/images to
 * `@aos/asset-library`. The real implementation is `@aos/asset-library`'s own `SaveAiCreative` use
 * case; an interface is used here for the same testability reason `IPhotoSource` documents.
 */
export interface ICreativeAssetSaver {
  execute(input: CreativeAssetSaveInput): Promise<Result<AssetCollection, AssetError>>;
}
