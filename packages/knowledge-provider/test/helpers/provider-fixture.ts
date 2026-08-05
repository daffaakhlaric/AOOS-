import type { IKnowledgeProvider } from "../../src/contracts/i-knowledge-provider.js";
import { KnowledgeProviderCapabilityFlag } from "../../src/domain/knowledge-provider-capability-flag.js";
import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";

export function providerFixture(overrides: Partial<IKnowledgeProvider> = {}): IKnowledgeProvider {
  return {
    id: "provider-1",
    category: KnowledgeProviderCategory.DOCUMENT,
    capabilities: [KnowledgeProviderCapabilityFlag.SUPPORTS_READ],
    ...overrides,
  };
}
