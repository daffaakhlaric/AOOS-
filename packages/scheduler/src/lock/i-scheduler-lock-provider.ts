export interface ILockHandle {
  readonly resource: string;
  release(): Promise<void>;
}

/**
 * Distributed Lock port (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md addendum 2).
 * "Walaupun sekarang Scheduler masih single-node, siapkan kontrak... Nanti pada
 * deployment multi-node bisa ditambahkan Redis Lock, PostgreSQL Advisory Lock, Kubernetes
 * Lease, tanpa mengubah logika Scheduler." `InMemoryLockProvider` is the only
 * implementation in this package.
 */
export interface ISchedulerLockProvider {
  /** Returns `undefined` if `resource` is already locked by someone else; otherwise an `ILockHandle` valid for `ttlMs`. */
  acquire(resource: string, ttlMs: number): Promise<ILockHandle | undefined>;
}
