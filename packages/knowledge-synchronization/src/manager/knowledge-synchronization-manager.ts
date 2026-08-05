import type { IKnowledgeSynchronizationScheduler } from "../contracts/i-knowledge-synchronization-scheduler.js";
import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";
import { SynchronizationNotFoundException } from "../errors/synchronization-not-found-exception.js";
import { KnowledgeSynchronizationRegistry } from "../registry/knowledge-synchronization-registry.js";
import { KnowledgeSynchronizationScheduler } from "../scheduler/knowledge-synchronization-scheduler.js";
import { KnowledgeSynchronizationSession } from "../session/knowledge-synchronization-session.js";
import { KnowledgeSynchronizationStatistics } from "../statistics/knowledge-synchronization-statistics.js";

/**
 * The mid-level orchestrator combining `KnowledgeSynchronizationRegistry`
 * (Job/Provider/Policy/Schedule/Session/Statistics/Health/Lifecycle bookkeeping),
 * `KnowledgeSynchronizationSession` (access-window bookkeeping),
 * `KnowledgeSynchronizationStatistics` (per-Synchronization-Mode counters), and
 * `KnowledgeSynchronizationScheduler` (in-memory job ledger) behind one API, plus its
 * own token-keyed `KnowledgeSynchronizationExecution` ledger — "Never scan
 * synchronization collections. Lookup by token."
 */
export class KnowledgeSynchronizationManager {
  readonly registry = new KnowledgeSynchronizationRegistry();
  readonly session = new KnowledgeSynchronizationSession();
  readonly statistics = new KnowledgeSynchronizationStatistics();
  readonly scheduler: KnowledgeSynchronizationScheduler;
  private readonly executionsByToken = new Map<string, KnowledgeSynchronizationExecution>();

  constructor(externalScheduler?: IKnowledgeSynchronizationScheduler) {
    this.scheduler = new KnowledgeSynchronizationScheduler(externalScheduler);
  }

  register(execution: KnowledgeSynchronizationExecution): KnowledgeSynchronizationExecution {
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  unregister(token: string): void {
    this.executionsByToken.delete(token);
  }

  get(token: string): KnowledgeSynchronizationExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgeSynchronizationExecution {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      throw new SynchronizationNotFoundException(
        `No Knowledge Synchronization Instance is registered for Token "${token}"`,
      );
    }
    return execution;
  }

  update(execution: KnowledgeSynchronizationExecution): KnowledgeSynchronizationExecution {
    this.require(execution.instance.token);
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  list(tenantId?: string): readonly KnowledgeSynchronizationExecution[] {
    const all = Array.from(this.executionsByToken.values());
    return tenantId === undefined
      ? all
      : all.filter((execution) => execution.instance.tenantId === tenantId);
  }

  count(): number {
    return this.executionsByToken.size;
  }
}
