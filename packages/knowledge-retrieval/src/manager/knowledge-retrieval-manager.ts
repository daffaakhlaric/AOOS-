import type { KnowledgeRetrievalExecution } from "../domain/knowledge-retrieval-execution.js";
import { RetrievalNotFoundException } from "../errors/retrieval-not-found-exception.js";
import { KnowledgeRetrievalRegistry } from "../registry/knowledge-retrieval-registry.js";
import { KnowledgeQuerySession } from "../session/knowledge-query-session.js";
import { KnowledgeRetrievalStatistics } from "../statistics/knowledge-retrieval-statistics.js";

/**
 * The mid-level orchestrator combining `KnowledgeRetrievalRegistry` (Strategy/Ranking/
 * Filter/Policy/Permission Provider/Result Builder/Search Provider bookkeeping),
 * `KnowledgeQuerySession` (access-window bookkeeping), and `KnowledgeRetrievalStatistics`
 * (per-Search-Mode counters) behind one API, plus its own token-keyed
 * `KnowledgeRetrievalExecution` ledger — "Never search runtime instances by scanning
 * collections. Use token lookup." (the same rule `@aos/knowledge-runtime`'s
 * `KnowledgeRuntimeRegistry` follows).
 */
export class KnowledgeRetrievalManager {
  readonly registry = new KnowledgeRetrievalRegistry();
  readonly session = new KnowledgeQuerySession();
  readonly statistics = new KnowledgeRetrievalStatistics();
  private readonly executionsByToken = new Map<string, KnowledgeRetrievalExecution>();

  register(execution: KnowledgeRetrievalExecution): KnowledgeRetrievalExecution {
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  unregister(token: string): void {
    this.executionsByToken.delete(token);
  }

  get(token: string): KnowledgeRetrievalExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgeRetrievalExecution {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      throw new RetrievalNotFoundException(
        `No Knowledge Retrieval Instance is registered for Token "${token}"`,
      );
    }
    return execution;
  }

  update(execution: KnowledgeRetrievalExecution): KnowledgeRetrievalExecution {
    this.require(execution.instance.token);
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  list(tenantId?: string): readonly KnowledgeRetrievalExecution[] {
    const all = Array.from(this.executionsByToken.values());
    return tenantId === undefined
      ? all
      : all.filter((execution) => execution.instance.tenantId === tenantId);
  }

  count(): number {
    return this.executionsByToken.size;
  }
}
