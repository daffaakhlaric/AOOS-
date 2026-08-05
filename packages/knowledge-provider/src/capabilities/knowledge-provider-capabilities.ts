import type { KnowledgeProviderCapabilityFlag } from "../domain/knowledge-provider-capability-flag.js";

/**
 * "KnowledgeProviderCapabilities" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md — "PUBLIC
 * API") — a read-only, queryable wrapper over the 20 `KnowledgeProviderCapabilityFlag`
 * values a Provider declares. Backs the Pipeline's Capability Resolution stage and the
 * Resolver's "resolve by Capability" query.
 */
export class KnowledgeProviderCapabilities {
  private readonly flags: ReadonlySet<KnowledgeProviderCapabilityFlag>;

  constructor(flags: readonly KnowledgeProviderCapabilityFlag[]) {
    this.flags = new Set(flags);
  }

  has(flag: KnowledgeProviderCapabilityFlag): boolean {
    return this.flags.has(flag);
  }

  hasAll(flags: readonly KnowledgeProviderCapabilityFlag[]): boolean {
    return flags.every((flag) => this.flags.has(flag));
  }

  hasAny(flags: readonly KnowledgeProviderCapabilityFlag[]): boolean {
    return flags.some((flag) => this.flags.has(flag));
  }

  list(): readonly KnowledgeProviderCapabilityFlag[] {
    return Array.from(this.flags);
  }

  get size(): number {
    return this.flags.size;
  }
}
