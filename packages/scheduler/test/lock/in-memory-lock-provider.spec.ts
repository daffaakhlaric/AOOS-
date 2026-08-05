import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { InMemoryLockProvider } from "../../src/lock/in-memory-lock-provider.js";

describe("InMemoryLockProvider", () => {
  it("acquires a lock for an unlocked resource", async () => {
    const provider = new InMemoryLockProvider(new MockClock("2026-01-01T00:00:00.000Z"));
    const lock = await provider.acquire("resource-1", 30_000);
    expect(lock?.resource).toBe("resource-1");
  });

  it("denies a second acquire while the first lock is still valid", async () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const provider = new InMemoryLockProvider(clock);
    await provider.acquire("resource-1", 30_000);
    const second = await provider.acquire("resource-1", 30_000);
    expect(second).toBeUndefined();
  });

  it("allows re-acquiring after release()", async () => {
    const provider = new InMemoryLockProvider(new MockClock("2026-01-01T00:00:00.000Z"));
    const first = await provider.acquire("resource-1", 30_000);
    await first?.release();
    const second = await provider.acquire("resource-1", 30_000);
    expect(second).toBeDefined();
  });

  it("allows re-acquiring after the TTL expires", async () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const provider = new InMemoryLockProvider(clock);
    await provider.acquire("resource-1", 1000);
    clock.advanceMs(1001);
    const second = await provider.acquire("resource-1", 1000);
    expect(second).toBeDefined();
  });

  it("a stale release() (after expiry + re-acquisition) does not release the new holder's lock", async () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const provider = new InMemoryLockProvider(clock);
    const first = await provider.acquire("resource-1", 1000);
    clock.advanceMs(1001);
    const second = await provider.acquire("resource-1", 1000);
    await first?.release();
    // The second holder's lock must still be in force — re-acquiring should fail.
    const third = await provider.acquire("resource-1", 1000);
    expect(third).toBeUndefined();
    expect(second).toBeDefined();
  });

  it("locks on different resources are independent", async () => {
    const provider = new InMemoryLockProvider(new MockClock("2026-01-01T00:00:00.000Z"));
    await provider.acquire("resource-1", 30_000);
    const other = await provider.acquire("resource-2", 30_000);
    expect(other).toBeDefined();
  });
});
