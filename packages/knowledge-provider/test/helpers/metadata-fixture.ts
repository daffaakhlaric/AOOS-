import { KnowledgeProviderCapabilityFlag } from "../../src/domain/knowledge-provider-capability-flag.js";
import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { KnowledgeProviderStatus } from "../../src/domain/knowledge-provider-status.js";
import type { ProviderMetadataRecord } from "../../src/domain/provider-metadata-record.js";

export function metadataFixture(
  overrides: Partial<ProviderMetadataRecord> = {},
): ProviderMetadataRecord {
  return {
    providerId: "provider-1",
    providerName: "Test Provider",
    providerVersion: "1.0.0",
    providerCategory: KnowledgeProviderCategory.DOCUMENT,
    providerCapabilities: [KnowledgeProviderCapabilityFlag.SUPPORTS_READ],
    providerConfiguration: {},
    providerStatus: KnowledgeProviderStatus.ACTIVE,
    providerPriority: 0,
    providerTags: [],
    providerLabels: [],
    providerDependencies: [],
    ...overrides,
  };
}
