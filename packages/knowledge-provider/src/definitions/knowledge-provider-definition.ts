import type { KnowledgeProviderCapabilityFlag } from "../domain/knowledge-provider-capability-flag.js";
import type { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";

/**
 * "BUILT-IN PROVIDER DEFINITIONS: Create metadata definitions only. NO implementation."
 * (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — a static catalog entry describing a
 * well-known external system's identity/category/default capabilities. Carries no
 * connector logic, no API client, no OAuth — a caller registering the matching
 * `IKnowledgeProvider` may use this entry's `defaultCapabilities` as a starting point
 * for that Provider's `ProviderMetadataRecord.providerCapabilities`.
 */
export interface KnowledgeProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: KnowledgeProviderCategory;
  readonly defaultCapabilities: readonly KnowledgeProviderCapabilityFlag[];
  readonly description: string;
}
