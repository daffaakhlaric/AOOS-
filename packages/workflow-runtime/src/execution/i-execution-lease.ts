import type { ExecutionToken } from "../instance/execution-token.js";

/**
 * "Siapkan interface IExecutionLease. Sekarang belum dipakai." (user, 005.6B additional
 * improvements). Not implemented or consumed anywhere in this package — a future
 * multi-node deployment would use an `IExecutionLeaseProvider` to prevent two Runtime
 * processes from concurrently driving the same `ExecutionToken`.
 */
export interface IExecutionLease {
  readonly token: ExecutionToken;
  readonly holder: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
}

export interface IExecutionLeaseProvider {
  /** Returns `undefined` if `token` is already leased by a different holder. */
  acquire(
    token: ExecutionToken,
    holder: string,
    ttlMs: number,
  ): Promise<IExecutionLease | undefined>;
  /** Extends an existing lease's `expiresAt`; returns `undefined` if the lease has already expired or been taken over. */
  renew(lease: IExecutionLease, ttlMs: number): Promise<IExecutionLease | undefined>;
  release(lease: IExecutionLease): Promise<void>;
}
