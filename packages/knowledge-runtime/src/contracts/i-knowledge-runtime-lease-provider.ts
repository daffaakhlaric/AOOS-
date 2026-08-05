import type { KnowledgeRuntimeLease } from "../domain/knowledge-runtime-lease.js";

/** Interface only — no implementation in this package. `KnowledgeRuntimeSession` manages a `KnowledgeRuntimeLease` purely in memory; a future multi-process deployment would use this to coordinate leases across nodes. */
export interface IKnowledgeRuntimeLeaseProvider {
  /** Returns `undefined` if `token` is already leased by a different holder. */
  acquire(token: string, holder: string, ttlMs: number): Promise<KnowledgeRuntimeLease | undefined>;
  /** Extends an existing lease's `expiresAt`; returns `undefined` if the lease has already expired or been taken over. */
  renew(lease: KnowledgeRuntimeLease, ttlMs: number): Promise<KnowledgeRuntimeLease | undefined>;
  release(lease: KnowledgeRuntimeLease): Promise<void>;
}
