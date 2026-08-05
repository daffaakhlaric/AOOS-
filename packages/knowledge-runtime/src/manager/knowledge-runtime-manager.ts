import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import type { KnowledgeRuntimeSnapshot } from "../domain/knowledge-runtime-snapshot.js";
import { KnowledgeRuntimeRegistry } from "../registry/knowledge-runtime-registry.js";
import type { KnowledgeRuntimeSessionRecord } from "../session/knowledge-runtime-session-record.js";
import { KnowledgeRuntimeSession } from "../session/knowledge-runtime-session.js";
import { SnapshotManager } from "../snapshot/snapshot-manager.js";

/**
 * The mid-level orchestrator combining `KnowledgeRuntimeRegistry` (Instance bookkeeping),
 * `KnowledgeRuntimeSession` (access-window bookkeeping), and `SnapshotManager`
 * (point-in-time capture) behind one API — the layer `KnowledgeRuntime` (the top-level
 * façade) delegates all state-holding to, so the façade itself stays a thin dispatcher
 * over the Middleware Pipeline.
 */
export class KnowledgeRuntimeManager {
  readonly registry = new KnowledgeRuntimeRegistry();
  readonly session = new KnowledgeRuntimeSession();
  private readonly snapshotManager = new SnapshotManager();

  register(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.registry.register(execution);
  }

  unregister(token: string): void {
    this.registry.unregister(token);
  }

  get(token: string): KnowledgeRuntimeExecution | undefined {
    return this.registry.get(token);
  }

  require(token: string): KnowledgeRuntimeExecution {
    return this.registry.require(token);
  }

  update(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.registry.update(execution);
  }

  list(tenantId?: string): readonly KnowledgeRuntimeExecution[] {
    return this.registry.list(tenantId);
  }

  count(): number {
    return this.registry.count();
  }

  snapshot(token: string): KnowledgeRuntimeSnapshot {
    const execution = this.registry.require(token);
    return this.snapshotManager.capture(execution);
  }

  listSnapshots(token: string): readonly KnowledgeRuntimeSnapshot[] {
    return this.snapshotManager.list(token);
  }

  latestSnapshot(token: string): KnowledgeRuntimeSnapshot {
    return this.snapshotManager.latest(token);
  }

  openSession(token: string, holder: string, ttlMs?: number): KnowledgeRuntimeSessionRecord {
    return this.session.open(token, holder, ttlMs);
  }

  closeSession(token: string): KnowledgeRuntimeSessionRecord {
    return this.session.close(token);
  }

  suspendSession(token: string): KnowledgeRuntimeSessionRecord {
    return this.session.suspend(token);
  }

  resumeSession(token: string): KnowledgeRuntimeSessionRecord {
    return this.session.resume(token);
  }

  renewSession(token: string, ttlMs?: number): KnowledgeRuntimeSessionRecord {
    return this.session.renew(token, ttlMs);
  }

  expireSession(token: string): KnowledgeRuntimeSessionRecord {
    return this.session.expire(token);
  }

  destroySession(token: string): void {
    this.session.destroy(token);
  }
}
