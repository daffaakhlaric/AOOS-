import semver from "semver";

import type { BaseManifest } from "../contracts/base-manifest.js";
import type { RegistryEntry } from "../entities/registry-entry.js";
import type { IResolver, VersionReference } from "../interfaces/i-resolver.js";

/**
 * Resolves an id + optional version reference ("latest", an exact SemVer, or a SemVer range)
 * to a single concrete RegistryEntry — the highest version satisfying the reference wins.
 */
export class EntryResolver<TManifest extends BaseManifest> implements IResolver<TManifest> {
  constructor(
    private readonly getEntriesById: (id: string) => readonly RegistryEntry<TManifest>[],
  ) {}

  resolve(id: string, versionRef?: VersionReference): RegistryEntry<TManifest> | undefined {
    const entries = this.getEntriesById(id);
    if (entries.length === 0) {
      return undefined;
    }

    if (!versionRef || versionRef === "latest") {
      return this.highest(entries);
    }

    const exact = entries.find((entry) => entry.manifest.version === versionRef);
    if (exact) {
      return exact;
    }

    if (!semver.validRange(versionRef)) {
      return undefined;
    }
    const satisfying = entries.filter((entry) =>
      semver.satisfies(entry.manifest.version, versionRef),
    );
    return satisfying.length > 0 ? this.highest(satisfying) : undefined;
  }

  private highest(entries: readonly RegistryEntry<TManifest>[]): RegistryEntry<TManifest> {
    return entries.reduce((latest, entry) =>
      semver.gt(entry.manifest.version, latest.manifest.version) ? entry : latest,
    );
  }
}
