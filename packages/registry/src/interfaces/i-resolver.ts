import type { BaseManifest } from "../contracts/base-manifest.js";
import type { RegistryEntry } from "../entities/registry-entry.js";

/** A reference to an entry: an exact version, a semver range, or "latest". */
export type VersionReference = string;

/** Port for the Resolver — turns an id + version reference into a concrete RegistryEntry. */
export interface IResolver<TManifest extends BaseManifest = BaseManifest> {
  resolve(id: string, versionRef?: VersionReference): RegistryEntry<TManifest> | undefined;
}
