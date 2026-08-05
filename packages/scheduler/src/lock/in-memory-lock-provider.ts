import type { IClockProvider } from "../clock/i-clock-provider.js";

import type { ILockHandle, ISchedulerLockProvider } from "./i-scheduler-lock-provider.js";

/** The only `ISchedulerLockProvider` implementation in this package — correct for a single Scheduler node, not a distributed one. */
export class InMemoryLockProvider implements ISchedulerLockProvider {
  private readonly expiresAtByResource = new Map<string, number>();

  constructor(private readonly clock: IClockProvider) {}

  async acquire(resource: string, ttlMs: number): Promise<ILockHandle | undefined> {
    const now = this.clock.now().getTime();
    const existingExpiry = this.expiresAtByResource.get(resource);
    if (existingExpiry !== undefined && existingExpiry > now) {
      return undefined;
    }

    const expiresAt = now + ttlMs;
    this.expiresAtByResource.set(resource, expiresAt);

    return {
      resource,
      release: async () => {
        // Only release if we still hold the lock we granted — an expired-then-reacquired
        // lock must not be released out from under its new holder.
        if (this.expiresAtByResource.get(resource) === expiresAt) {
          this.expiresAtByResource.delete(resource);
        }
      },
    };
  }
}
