import type { BaseManifest } from "../contracts/base-manifest.js";

export interface LoadResult<TManifest extends BaseManifest> {
  readonly loaded: readonly TManifest[];
  readonly failed: ReadonlyArray<{ readonly sourcePath: string; readonly error: string }>;
}

/** Port for the Manifest Loader — turns a source location into parsed, schema-shaped manifests. */
export interface ILoader<TManifest extends BaseManifest> {
  load(location: string): Promise<LoadResult<TManifest>>;
}
