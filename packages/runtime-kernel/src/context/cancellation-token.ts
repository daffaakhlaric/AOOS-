export type CancellationCallback = (reason: unknown) => void;

/**
 * A cooperative cancellation signal, independent of any specific I/O API — long-running
 * Kernel operations (module/plugin loading, shutdown draining) accept a CancellationToken
 * and are expected to check it periodically or pass it through to cancellable sub-operations.
 */
export class CancellationToken {
  private _isCancellationRequested = false;
  private _reason: unknown;
  private readonly callbacks = new Set<CancellationCallback>();

  static readonly none = new CancellationToken();

  get isCancellationRequested(): boolean {
    return this._isCancellationRequested;
  }

  get reason(): unknown {
    return this._reason;
  }

  /** Throws if cancellation has been requested — the standard guard at the top of a cancellable step. */
  throwIfCancellationRequested(): void {
    if (this._isCancellationRequested) {
      throw new Error(typeof this._reason === "string" ? this._reason : "Operation was cancelled");
    }
  }

  /** Registers a callback invoked exactly once, the moment cancellation is requested. */
  onCancelled(callback: CancellationCallback): void {
    if (this._isCancellationRequested) {
      callback(this._reason);
      return;
    }
    this.callbacks.add(callback);
  }

  /** @internal — invoked only by CancellationTokenSource. */
  _cancel(reason: unknown): void {
    if (this._isCancellationRequested) {
      return;
    }
    this._isCancellationRequested = true;
    this._reason = reason;
    for (const callback of this.callbacks) {
      callback(reason);
    }
    this.callbacks.clear();
  }
}

/** Owns a CancellationToken and controls when it fires — the token itself is read-only to consumers. */
export class CancellationTokenSource {
  readonly token = new CancellationToken();

  cancel(reason: unknown = "Operation was cancelled"): void {
    this.token._cancel(reason);
  }
}
