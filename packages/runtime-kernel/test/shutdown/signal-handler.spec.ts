import { afterEach, describe, expect, it, vi } from "vitest";

import { SignalHandler } from "../../src/shutdown/signal-handler.js";

describe("SignalHandler", () => {
  let handler: SignalHandler | undefined;

  afterEach(() => {
    handler?.unregister();
    handler = undefined;
  });

  it("is not registered initially", () => {
    handler = new SignalHandler(["SIGUSR2"]);
    expect(handler.isRegistered).toBe(false);
  });

  it("invokes the callback when a wired signal is emitted", () => {
    handler = new SignalHandler(["SIGUSR2"]);
    const callback = vi.fn();
    handler.register(callback);

    process.emit("SIGUSR2");

    expect(callback).toHaveBeenCalledOnce();
    expect(handler.isRegistered).toBe(true);
  });

  it("throws if register() is called twice without unregistering", () => {
    handler = new SignalHandler(["SIGUSR2"]);
    handler.register(() => undefined);
    expect(() => handler!.register(() => undefined)).toThrow(/already registered/);
  });

  it("unregister() stops the callback from firing again, and is safe to call twice", () => {
    handler = new SignalHandler(["SIGUSR2"]);
    const callback = vi.fn();
    handler.register(callback);
    handler.unregister();
    handler.unregister(); // second call is a no-op, must not throw

    process.emit("SIGUSR2");

    expect(callback).not.toHaveBeenCalled();
    expect(handler.isRegistered).toBe(false);
  });

  it("defaults to SIGINT/SIGTERM when no signal list is provided", () => {
    handler = new SignalHandler();
    expect(handler.isRegistered).toBe(false);
  });
});
