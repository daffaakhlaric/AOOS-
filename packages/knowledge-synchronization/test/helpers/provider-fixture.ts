import type { IKnowledgeSynchronizationProvider } from "../../src/contracts/i-knowledge-synchronization-provider.js";
import { KnowledgeSynchronizationProviderType } from "../../src/domain/knowledge-synchronization-provider-type.js";

export function providerFixture(
  overrides: Partial<IKnowledgeSynchronizationProvider> = {},
): IKnowledgeSynchronizationProvider {
  return {
    id: "provider-1",
    providerType: KnowledgeSynchronizationProviderType.DOCUMENT,
    ...overrides,
  };
}
