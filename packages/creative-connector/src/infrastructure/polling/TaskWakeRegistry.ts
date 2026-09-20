/**
 * PROMPT 53 — KIE WEBHOOK (Phase 41). Kie AI's real `callBackUrl` request field (already wired
 * end-to-end through `VideoGenerationService`/`ImageGenerationService` and every
 * `Veo*Payload`/`NanoBananaProGeneratePayload` — see those files' own docs) gives Kie AI somewhere
 * real to POST a completion notice to. This registry is the mechanism that notice actually speeds
 * up: it does NOT replace `TaskPoller`'s poll loop (`ITaskPoller`'s own doc: "this package
 * implements the poll strategy only" — still true), it lets an inbound webhook WAKE an
 * already-in-flight poll early, skipping the rest of its current backoff sleep so the very next
 * `ICreativeClient.getTaskStatus` GET fires immediately instead of up to 30s later.
 *
 * Deliberately does NOT accept or trust the webhook's own POST body as completion data — a woken
 * poller still calls the SAME authenticated `getTaskStatus` GET it always would, so the actual
 * `successFlag`/`videoUrl`/`imageUrl` values this package acts on always come from Kie AI's
 * trusted status endpoint, never from an inbound POST body that (per the real, confirmed absence of
 * any HMAC/signature scheme in this codebase's own Kie AI client — see `KieAiGenerationClient.ts`
 * and `KieApiResponseMapper.ts`) cannot be cryptographically verified as genuinely from Kie AI.
 *
 * Process-local, in-memory, by design — the SAME honest, already-established limitation this
 * codebase already accepts elsewhere for a "fresher when available, otherwise correct" registry
 * (`@aos/branch-manager`'s `SalesTeamRegistry`, per `CreativePackagesService
 * .recordManualShootEscalation`'s own doc: "seeded EMPTY at boot"). A webhook that arrives on a
 * different replica than the one polling, or after a restart, simply finds no waiter and no-ops
 * (`wake` returns `false`) — the existing poll loop still completes the task correctly on its own,
 * just without the early-wake speedup. Never a source of incorrectness, only of latency.
 */
export interface Waiter {
  readonly promise: Promise<void>;
  /** Stops listening — called once the race this waiter was part of resolves via its OTHER branch (the normal backoff sleep), so a long poll never accumulates waiters that are never cleaned up. */
  readonly cancel: () => void;
}

export interface ITaskWakeRegistry {
  /**
   * Registers one waiter for `taskId` — see `TaskWakeRegistry.waitForWake`'s own doc. `TaskPoller`
   * is the only real caller.
   */
  waitForWake(taskId: string): Waiter;

  /**
   * Wakes every poller currently waiting on `taskId`, if any. Returns `true` when at least one
   * waiter was actually woken, `false` when nothing was waiting in this process (already resolved,
   * never registered here, wrong id, or a different replica handled the poll) — a safe, honest,
   * idempotent no-op either way. Calling this twice for the same `taskId` (a duplicate webhook
   * callback) is always safe: the second call simply finds nothing left to wake.
   */
  wake(taskId: string): boolean;
}

export class TaskWakeRegistry implements ITaskWakeRegistry {
  private readonly waiters = new Map<string, Set<() => void>>();

  /**
   * Registers one waiter for `taskId` and returns a promise that resolves the next time `wake()`
   * is called for it. Never resolves on its own — `TaskPoller` always races this against its real
   * backoff `sleep`, and always calls `cancel()` once the race settles regardless of which side won.
   */
  waitForWake(taskId: string): Waiter {
    let resolveFn!: () => void;
    const promise = new Promise<void>((resolve) => {
      resolveFn = resolve;
    });

    const existing = this.waiters.get(taskId);
    const set = existing ?? new Set<() => void>();
    set.add(resolveFn);
    if (existing === undefined) {
      this.waiters.set(taskId, set);
    }

    const cancel = (): void => {
      const current = this.waiters.get(taskId);
      if (current === undefined) {
        return;
      }
      current.delete(resolveFn);
      if (current.size === 0) {
        this.waiters.delete(taskId);
      }
    };

    return { promise, cancel };
  }

  wake(taskId: string): boolean {
    const set = this.waiters.get(taskId);
    if (set === undefined || set.size === 0) {
      return false;
    }
    for (const resolveFn of set) {
      resolveFn();
    }
    this.waiters.delete(taskId);
    return true;
  }
}
