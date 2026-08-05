import type { BaseManifest } from "../contracts/base-manifest.js";
import type { EntryStatus } from "../contracts/entry-status.js";
import type { RegistryKind } from "../contracts/registry-kind.js";
import type { TenantScope } from "../contracts/tenant-scope.js";
import type { RegistryEntry } from "../entities/registry-entry.js";

import type { VersionReference } from "./i-resolver.js";
import type { SearchCriteria } from "./i-search-engine.js";

export interface RegisterOptions {
  readonly tenantScope?: TenantScope;
  readonly owner?: string;
  readonly status?: EntryStatus;
}

/**
 * The full Registry port — every one of the Target capabilities (Register/Update/Remove/
 * Enable/Disable/Version/Validate/Load/Unload/Discover/Search/Resolve/Reload) from
 * docs/PROMPT-005.3-REGISTRY-SYSTEM.md, generic over the manifest type of one Registry kind.
 */
export interface IRegistry<TManifest extends BaseManifest = BaseManifest> {
  readonly kind: RegistryKind;

  register(manifest: TManifest, options?: RegisterOptions): Promise<RegistryEntry<TManifest>>;
  update(id: string, manifest: TManifest): Promise<RegistryEntry<TManifest>>;
  remove(id: string): Promise<void>;
  enable(id: string): Promise<void>;
  disable(id: string): Promise<void>;

  get(id: string, versionRef?: VersionReference): RegistryEntry<TManifest> | undefined;
  has(id: string): boolean;
  versions(id: string): readonly string[];
  list(): readonly RegistryEntry<TManifest>[];
  discover(): readonly RegistryEntry<TManifest>[];
  search(criteria: SearchCriteria): readonly RegistryEntry<TManifest>[];

  load(location: string): Promise<void>;
  unload(id: string): Promise<void>;
  reload(): Promise<void>;

  readonly count: number;
}
