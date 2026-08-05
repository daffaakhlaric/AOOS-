import { describe, expect, it } from "vitest";

import {
  HookName,
  KernelEventName,
  KernelState,
  Lifetime,
  LIVE_STATES,
  READY_STATES,
  tokenToString,
} from "../../src/types/index.js";

describe("KernelState sets", () => {
  it("LIVE_STATES includes every actively-alive state and excludes Created/Stopped/Failed", () => {
    expect(LIVE_STATES.has(KernelState.RUNNING)).toBe(true);
    expect(LIVE_STATES.has(KernelState.BOOTING)).toBe(true);
    expect(LIVE_STATES.has(KernelState.CREATED)).toBe(false);
    expect(LIVE_STATES.has(KernelState.STOPPED)).toBe(false);
    expect(LIVE_STATES.has(KernelState.FAILED)).toBe(false);
  });

  it("READY_STATES includes only Ready and Running", () => {
    expect(READY_STATES.has(KernelState.READY)).toBe(true);
    expect(READY_STATES.has(KernelState.RUNNING)).toBe(true);
    expect(READY_STATES.has(KernelState.BOOTING)).toBe(false);
    expect(READY_STATES.size).toBe(2);
  });
});

describe("enums", () => {
  it("Lifetime has exactly three values", () => {
    expect(Object.values(Lifetime)).toEqual(["singleton", "scoped", "transient"]);
  });

  it("HookName covers all six named hooks", () => {
    expect(Object.values(HookName)).toHaveLength(6);
  });

  it("KernelEventName covers all eight named events", () => {
    expect(Object.values(KernelEventName)).toHaveLength(8);
  });
});

describe("tokenToString", () => {
  it("renders a string token as itself", () => {
    expect(tokenToString("my-token")).toBe("my-token");
  });

  it("renders a symbol token via its own toString()", () => {
    const symbol = Symbol("my-symbol");
    expect(tokenToString(symbol)).toBe(symbol.toString());
  });

  it("renders a class token as its name", () => {
    class MyService {}
    expect(tokenToString(MyService)).toBe("MyService");
  });

  it("renders an anonymous class token with a fallback label", () => {
    const anonymous = (0, class {});
    Object.defineProperty(anonymous, "name", { value: "" });
    expect(tokenToString(anonymous)).toBe("AnonymousClass");
  });
});
