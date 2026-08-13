import type { AssetCollection, AssetError, GetAssetsByUnitInput } from "@aos/asset-library";
import type { Result } from "@aos/common";

/**
 * Port (Hexagonal Architecture) for querying source photos from `@aos/asset-library`. The real
 * implementation this package wires in is `@aos/asset-library`'s own `GetAssetsByUnit` use case
 * (structurally compatible — its `execute` method already matches this shape exactly); an
 * interface (rather than the concrete class) is used here specifically so unit tests can supply a
 * lightweight fake without constructing a real `GetAssetsByUnit` + its Supabase-backed
 * dependencies, per the mission brief's "creative-connector + asset-library both fully mocked"
 * testing requirement.
 */
export interface IPhotoSource {
  execute(input: GetAssetsByUnitInput): Promise<Result<AssetCollection, AssetError>>;
}
