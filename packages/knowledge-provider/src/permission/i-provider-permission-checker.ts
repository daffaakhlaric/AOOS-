import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";
import type { ProviderMetadataRecord } from "../domain/provider-metadata-record.js";

/** A coarse-grained "may this Context use this Provider at all" gate — permissive by default when unconfigured, mirroring `@aos/knowledge-synchronization`'s `ISynchronizationPermissionChecker`. */
export interface IProviderPermissionChecker {
  check(
    metadata: ProviderMetadataRecord,
    context: KnowledgeProviderContext,
  ): boolean | Promise<boolean>;
}
