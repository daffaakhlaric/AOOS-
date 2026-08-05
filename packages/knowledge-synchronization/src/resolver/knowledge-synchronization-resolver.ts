import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";
import type { IKnowledgeSynchronizationChangeDetector } from "../contracts/i-knowledge-synchronization-change-detector.js";
import type { IKnowledgeSynchronizationProvider } from "../contracts/i-knowledge-synchronization-provider.js";
import type { KnowledgeChangeRecord } from "../domain/knowledge-change-record.js";
import { ProviderNotFoundException } from "../errors/provider-not-found-exception.js";
import { KnowledgeSynchronizationRegistryBucket } from "../registry/knowledge-synchronization-registry-bucket.js";
import type { KnowledgeSynchronizationRegistry } from "../registry/knowledge-synchronization-registry.js";

/**
 * "KnowledgeSynchronizationResolver" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md —
 * "PUBLIC API") — "Resolve providers only. No provider implementation." Resolves a
 * registered `IKnowledgeSynchronizationProvider` by id from
 * `KnowledgeSynchronizationRegistry`'s `PROVIDER` bucket, and delegates Change Detection
 * to an optional injected `IKnowledgeSynchronizationChangeDetector` — permissive (no
 * changes) when unconfigured, the same "permissive-by-default checker delegation"
 * pattern used by `@aos/knowledge-retrieval`'s `KnowledgePermissionResolver`.
 */
export class KnowledgeSynchronizationResolver {
  constructor(
    private readonly registry: KnowledgeSynchronizationRegistry,
    private readonly changeDetector?: IKnowledgeSynchronizationChangeDetector,
  ) {}

  resolveProvider(providerId: string): IKnowledgeSynchronizationProvider {
    const provider = this.registry.get<IKnowledgeSynchronizationProvider>(
      KnowledgeSynchronizationRegistryBucket.PROVIDER,
      providerId,
    );
    if (!provider) {
      throw new ProviderNotFoundException(
        `No IKnowledgeSynchronizationProvider is registered for Provider Id "${providerId}"`,
      );
    }
    return provider;
  }

  tryResolveProvider(providerId: string): IKnowledgeSynchronizationProvider | undefined {
    return this.registry.get<IKnowledgeSynchronizationProvider>(
      KnowledgeSynchronizationRegistryBucket.PROVIDER,
      providerId,
    );
  }

  async detectChanges(
    context: KnowledgeSynchronizationContext,
  ): Promise<readonly KnowledgeChangeRecord[]> {
    if (!this.changeDetector) {
      return [];
    }
    return this.changeDetector.detect(context);
  }
}
