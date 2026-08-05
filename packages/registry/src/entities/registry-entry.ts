import type { IsoDateTime, Uuid } from "@aos/types";

import type { BaseManifest } from "../contracts/base-manifest.js";
import type { EntryStatus } from "../contracts/entry-status.js";
import type { RegistryKind } from "../contracts/registry-kind.js";
import type { TenantScope } from "../contracts/tenant-scope.js";

/**
 * The stored, live representation of a manifest inside a Registry — the common envelope
 * (mirroring the Registry Contract's entry shape, docs/003.5-CONTRACT-FIRST-DESIGN.md §13)
 * wrapping the kind-specific manifest payload.
 */
export interface RegistryEntry<TManifest extends BaseManifest = BaseManifest> {
  readonly entryId: Uuid<"RegistryEntryId">;
  readonly registryKind: RegistryKind;
  readonly manifest: TManifest;
  readonly status: EntryStatus;
  readonly tenantScope: TenantScope;
  readonly owner: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  /** Every version string ever registered for this manifest's `id`, oldest first — append-only. */
  readonly changelog: readonly string[];
}
