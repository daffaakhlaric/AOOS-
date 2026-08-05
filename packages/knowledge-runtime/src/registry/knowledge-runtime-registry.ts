import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import { RuntimeInstanceNotFoundException } from "../errors/runtime-instance-not-found-exception.js";

/**
 * "RUNTIME REGISTRY: Maintain runtime instances. Register, Unregister, Lookup, Snapshot,
 * Health, Metrics, Lifecycle." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — one in-memory
 * `Map<KnowledgeRuntimeToken, KnowledgeRuntimeExecution>` every imperative Runtime
 * operation looks a live Instance up through — "Never search runtime instances by
 * scanning collections. Use token lookup." `list()` is an enumeration for
 * Metrics/Health/Monitoring, never used to resolve a specific Instance.
 */
export class KnowledgeRuntimeRegistry {
  private readonly executionsByToken = new Map<string, KnowledgeRuntimeExecution>();

  register(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  unregister(token: string): void {
    this.executionsByToken.delete(token);
  }

  get(token: string): KnowledgeRuntimeExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgeRuntimeExecution {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      throw new RuntimeInstanceNotFoundException(
        `No Knowledge Runtime Instance is registered for Token "${token}"`,
      );
    }
    return execution;
  }

  update(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    this.require(execution.instance.token);
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  list(tenantId?: string): readonly KnowledgeRuntimeExecution[] {
    const all = Array.from(this.executionsByToken.values());
    return tenantId === undefined
      ? all
      : all.filter((execution) => execution.instance.tenantId === tenantId);
  }

  count(): number {
    return this.executionsByToken.size;
  }
}
