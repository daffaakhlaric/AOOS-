import type { EmbeddingModelName } from "./embedding-model-name.js";
import type { EmbeddingProviderType } from "./embedding-provider-type.js";

/**
 * Deterministic, tenant-scoped composite ids used so the Pipeline's Provider/Model
 * Resolution stages can resolve "which registered Provider/Model handles this Request"
 * via a single Map lookup ("Registry ... Never scan collections.") keyed purely off the
 * Request's declared `providerType`/`modelName` metadata tags — WITHOUT the Request
 * needing to carry an opaque `providerId`/`modelId` the caller would otherwise have to
 * look up out-of-band first. `registerProvider`/`registerModel` on `EmbeddingManager`
 * default a record's id to this composite key when the caller doesn't supply one
 * explicitly. A documented judgment call, see docs/005.7N-EMBEDDING-MANAGER-REPORT.md —
 * "Pipeline".
 */
export function buildProviderRegistryId(
  tenantId: string,
  providerType: EmbeddingProviderType,
): string {
  return `${tenantId}::${providerType}`;
}

export function buildModelRegistryId(tenantId: string, modelName: EmbeddingModelName): string {
  return `${tenantId}::${modelName}`;
}
