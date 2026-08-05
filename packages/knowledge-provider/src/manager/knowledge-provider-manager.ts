import type { KnowledgeProviderExecution } from "../domain/knowledge-provider-execution.js";
import { ProviderNotFoundException } from "../errors/provider-not-found-exception.js";
import { KnowledgeProviderRegistry } from "../registry/knowledge-provider-registry.js";
import { KnowledgeProviderSession } from "../session/knowledge-provider-session.js";
import { KnowledgeProviderStatistics } from "../statistics/knowledge-provider-statistics.js";

/**
 * The mid-level orchestrator combining `KnowledgeProviderRegistry` (Provider/Capability/
 * Metadata/Category/Policy/Session/Health/Statistics bookkeeping),
 * `KnowledgeProviderSession` (access-window bookkeeping), and `KnowledgeProviderStatistics`
 * (per-Category counters) behind one API, plus its own token-keyed
 * `KnowledgeProviderExecution` ledger — "Never scan provider collections. Lookup by
 * token."
 */
export class KnowledgeProviderManager {
  readonly registry = new KnowledgeProviderRegistry();
  readonly session = new KnowledgeProviderSession();
  readonly statistics = new KnowledgeProviderStatistics();
  private readonly executionsByToken = new Map<string, KnowledgeProviderExecution>();

  register(execution: KnowledgeProviderExecution): KnowledgeProviderExecution {
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  unregister(token: string): void {
    this.executionsByToken.delete(token);
  }

  get(token: string): KnowledgeProviderExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgeProviderExecution {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      throw new ProviderNotFoundException(
        `No Knowledge Provider Instance is registered for Token "${token}"`,
      );
    }
    return execution;
  }

  update(execution: KnowledgeProviderExecution): KnowledgeProviderExecution {
    this.require(execution.instance.token);
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  list(tenantId?: string): readonly KnowledgeProviderExecution[] {
    const all = Array.from(this.executionsByToken.values());
    return tenantId === undefined
      ? all
      : all.filter((execution) => execution.instance.tenantId === tenantId);
  }

  count(): number {
    return this.executionsByToken.size;
  }
}
