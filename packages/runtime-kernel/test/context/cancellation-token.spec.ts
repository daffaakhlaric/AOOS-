import { describe, expect, it, vi } from "vitest";

import {
  CancellationToken,
  CancellationTokenSource,
} from "../../src/context/cancellation-token.js";

describe("CancellationToken", () => {
  it("CancellationToken.none is never cancelled", () => {
    expect(CancellationToken.none.isCancellationRequested).toBe(false);
    expect(() => CancellationToken.none.throwIfCancellationRequested()).not.toThrow();
  });

  it("throwIfCancellationRequested does not throw before cancellation", () => {
    const source = new CancellationTokenSource();
    expect(() => source.token.throwIfCancellationRequested()).not.toThrow();
  });

  it("cancel() flips isCancellationRequested and records the reason", () => {
    const source = new CancellationTokenSource();
    source.cancel("user aborted");
    expect(source.token.isCancellationRequested).toBe(true);
    expect(source.token.reason).toBe("user aborted");
  });

  it("throwIfCancellationRequested throws after cancellation", () => {
    const source = new CancellationTokenSource();
    source.cancel("stopped");
    expect(() => source.token.throwIfCancellationRequested()).toThrow("stopped");
  });

  it("onCancelled fires registered callbacks exactly once", () => {
    const source = new CancellationTokenSource();
    const callback = vi.fn();
    source.token.onCancelled(callback);
    source.cancel("reason");
    source.cancel("reason-again"); // second cancel is a no-op
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("reason");
  });

  it("onCancelled invokes the callback immediately if already cancelled", () => {
    const source = new CancellationTokenSource();
    source.cancel("already gone");
    const callback = vi.fn();
    source.token.onCancelled(callback);
    expect(callback).toHaveBeenCalledWith("already gone");
  });

  it("cancel() defaults to a generic reason when none is given", () => {
    const source = new CancellationTokenSource();
    source.cancel();
    expect(source.token.reason).toBe("Operation was cancelled");
  });
});
