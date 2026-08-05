import type { BaseManifest } from "../contracts/base-manifest.js";
import type { RegistryEntry } from "../entities/registry-entry.js";

export interface SearchCriteria {
  readonly id?: string;
  readonly name?: string;
  readonly tag?: string;
  readonly capability?: string;
  readonly category?: string;
  readonly tenantId?: string;
  readonly version?: string;
  /** 005.3A Enhancement 9 — the Capability namespace prefix (e.g. "inventory") a manifest's `capabilities` ids fall under. */
  readonly namespace?: string;
  /** 005.3A Enhancement 9 — matches an id in the manifest's `industry` array. */
  readonly industry?: string;
  /** 005.3A Enhancement 9. */
  readonly owner?: string;
}

/**
 * Port for the Search Engine — Find By ID/Name/Tag/Capability/Category/Tenant/Version, plus
 * Namespace/Industry/Owner (005.3A Enhancement 9). "Search by Solution Pack" and "Search by
 * Connector" are cross-registry lookups, not per-entry criteria — see
 * `RegistrySystem.findBySolutionPack()` and the generic `search()` on the Connector Registry.
 */
export interface ISearchEngine<TManifest extends BaseManifest = BaseManifest> {
  index(entry: RegistryEntry<TManifest>): void;
  remove(entryId: string): void;
  search(criteria: SearchCriteria): readonly RegistryEntry<TManifest>[];
  clear(): void;
}
