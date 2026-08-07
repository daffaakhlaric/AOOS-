import type { KnowledgeVersionExecution } from "../domain/knowledge-version-execution.js";
import { VersionNotFoundException } from "../errors/version-not-found-exception.js";
import { KnowledgeVersionRegistry } from "../registry/knowledge-version-registry.js";
import { KnowledgeVersionSession } from "../session/knowledge-version-session.js";
import { KnowledgeVersionStatistics } from "../statistics/knowledge-version-statistics.js";

/**
 * "KnowledgeVersionManager" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public API") —
 * the mid-level orchestrator combining `KnowledgeVersionRegistry` (Version/Snapshot/
 * Branch/History/Lineage/Metadata/Statistics/Session bookkeeping), `KnowledgeVersionSession`
 * (access-window bookkeeping), and `KnowledgeVersionStatistics` (per-`KnowledgeVersionType`
 * counters) behind one API, plus its own token-keyed `KnowledgeVersionExecution` ledger —
 * "Never scan collections." Distinct from the `versioning/` façade `KnowledgeVersioning`,
 * which drives the State Machine/Pipeline/Middleware around this Manager, mirroring
 * `@aos/knowledge-provider`'s `KnowledgeProvider`/`KnowledgeProviderManager` split.
 */
export class KnowledgeVersionManager {
  readonly registry = new KnowledgeVersionRegistry();
  readonly session = new KnowledgeVersionSession();
  readonly statistics = new KnowledgeVersionStatistics();
  private readonly executionsByToken = new Map<string, KnowledgeVersionExecution>();

  register(execution: KnowledgeVersionExecution): KnowledgeVersionExecution {
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  unregister(token: string): void {
    this.executionsByToken.delete(token);
  }

  get(token: string): KnowledgeVersionExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgeVersionExecution {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      throw new VersionNotFoundException(
        `No Knowledge Version Instance is registered for Token "${token}"`,
      );
    }
    return execution;
  }

  update(execution: KnowledgeVersionExecution): KnowledgeVersionExecution {
    this.require(execution.instance.token);
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  list(tenantId?: string): readonly KnowledgeVersionExecution[] {
    const all = Array.from(this.executionsByToken.values());
    return tenantId === undefined
      ? all
      : all.filter((execution) => execution.instance.tenantId === tenantId);
  }

  count(): number {
    return this.executionsByToken.size;
  }
}
