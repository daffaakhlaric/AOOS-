import type { KnowledgeGeneratorExecution } from "../domain/knowledge-generator-execution.js";
import { GeneratorNotFoundException } from "../errors/generator-not-found-exception.js";
import { KnowledgeGeneratorRegistryBucket } from "../registry/knowledge-generator-registry-bucket.js";
import type { KnowledgeGeneratorRegistryEntry } from "../registry/knowledge-generator-registry-entry.js";
import type { KnowledgeGeneratorRegistry } from "../registry/knowledge-generator-registry.js";
import type { KnowledgeGeneratorSession } from "../session/knowledge-generator-session.js";
import { KnowledgeGeneratorStatistics } from "../statistics/knowledge-generator-statistics.js";

/**
 * "KnowledgeGeneratorManager" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Public
 * API") — mid-level orchestrator composing Registry + Session + Statistics +
 * executionsByToken (token-keyed ledger; Map lookups only, never array-scan).
 */
export class KnowledgeGeneratorManager {
  private readonly executionsByToken = new Map<string, KnowledgeGeneratorExecution>();
  readonly statistics = new KnowledgeGeneratorStatistics();

  constructor(
    readonly registry: KnowledgeGeneratorRegistry,
    readonly session: KnowledgeGeneratorSession,
  ) {}

  register(
    token: string,
    execution: KnowledgeGeneratorExecution,
    entry: KnowledgeGeneratorRegistryEntry,
  ): void {
    this.registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, entry);
    this.executionsByToken.set(token, execution);
    this.statistics.recordRequested(execution.request.assetType);
  }

  get(token: string): KnowledgeGeneratorExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgeGeneratorExecution {
    const execution = this.get(token);
    if (!execution) {
      throw new GeneratorNotFoundException(`No execution registered for token "${token}"`);
    }
    return execution;
  }

  update(token: string, execution: KnowledgeGeneratorExecution): void {
    if (!this.executionsByToken.has(token)) {
      throw new GeneratorNotFoundException(`No execution registered for token "${token}"`);
    }
    this.executionsByToken.set(token, execution);
  }

  unregister(token: string): boolean {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      return false;
    }
    this.registry.remove(
      KnowledgeGeneratorRegistryBucket.GENERATION,
      execution.metadata.generationId,
    );
    this.executionsByToken.delete(token);
    return true;
  }

  list(): readonly KnowledgeGeneratorExecution[] {
    return Array.from(this.executionsByToken.values());
  }

  count(): number {
    return this.executionsByToken.size;
  }
}
