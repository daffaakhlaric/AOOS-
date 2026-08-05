import type { BaseManifest } from "../contracts/base-manifest.js";
import { extractCapabilityNamespace } from "../contracts/capability-namespace.js";
import type { RegistryEntry } from "../entities/registry-entry.js";
import type { ISearchEngine, SearchCriteria } from "../interfaces/i-search-engine.js";

/**
 * In-memory inverted-index search engine: Find By ID/Name/Tag/Capability/Category/Tenant/Version,
 * plus Namespace/Industry/Owner (docs/PROMPT-005.3-REGISTRY-SYSTEM.md;
 * docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md Enhancement 9). All criteria in a single
 * `search()` call are AND-ed together.
 */
export class SearchIndex<
  TManifest extends BaseManifest = BaseManifest,
> implements ISearchEngine<TManifest> {
  private readonly byId = new Map<string, RegistryEntry<TManifest>>();

  index(entry: RegistryEntry<TManifest>): void {
    this.byId.set(entry.entryId, entry);
  }

  remove(entryId: string): void {
    this.byId.delete(entryId);
  }

  search(criteria: SearchCriteria): readonly RegistryEntry<TManifest>[] {
    return Array.from(this.byId.values()).filter((entry) => this.matches(entry, criteria));
  }

  clear(): void {
    this.byId.clear();
  }

  private matches(entry: RegistryEntry<TManifest>, criteria: SearchCriteria): boolean {
    const { manifest } = entry;

    if (criteria.id !== undefined && manifest.id !== criteria.id) {
      return false;
    }
    if (criteria.name !== undefined) {
      const name = manifest.name?.toLowerCase() ?? manifest.id.toLowerCase();
      if (!name.includes(criteria.name.toLowerCase())) {
        return false;
      }
    }
    if (criteria.tag !== undefined && !(manifest.tags ?? []).includes(criteria.tag)) {
      return false;
    }
    if (
      criteria.capability !== undefined &&
      !(manifest.capabilities ?? []).includes(criteria.capability)
    ) {
      return false;
    }
    if (criteria.category !== undefined && manifest.category !== criteria.category) {
      return false;
    }
    if (criteria.tenantId !== undefined && manifest.tenantId !== criteria.tenantId) {
      return false;
    }
    if (criteria.version !== undefined && manifest.version !== criteria.version) {
      return false;
    }
    if (
      criteria.namespace !== undefined &&
      !(manifest.capabilities ?? []).some(
        (capabilityId) => extractCapabilityNamespace(capabilityId) === criteria.namespace,
      )
    ) {
      return false;
    }
    if (criteria.industry !== undefined && !(manifest.industry ?? []).includes(criteria.industry)) {
      return false;
    }
    if (criteria.owner !== undefined && manifest.owner !== criteria.owner) {
      return false;
    }
    return true;
  }
}
