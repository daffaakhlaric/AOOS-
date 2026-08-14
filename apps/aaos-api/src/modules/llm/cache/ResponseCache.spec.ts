import { describe, expect, it } from "vitest";

import { ResponseCache } from "./ResponseCache.js";

describe("ResponseCache", () => {
  it("returns undefined for a namespace/body pair that was never set", () => {
    const cache = new ResponseCache<string>();
    expect(cache.get("analyze", { a: 1 })).toBeUndefined();
  });

  it("returns the cached value for an identical (namespace, body) pair", () => {
    const cache = new ResponseCache<string>();
    cache.set("analyze", { campaigns: [1, 2, 3] }, "result-a");
    expect(cache.get("analyze", { campaigns: [1, 2, 3] })).toBe("result-a");
  });

  it("treats different request bodies under the same namespace as distinct entries", () => {
    const cache = new ResponseCache<string>();
    cache.set("analyze", { id: 1 }, "result-1");
    cache.set("analyze", { id: 2 }, "result-2");
    expect(cache.get("analyze", { id: 1 })).toBe("result-1");
    expect(cache.get("analyze", { id: 2 })).toBe("result-2");
  });

  it("treats the same body under different namespaces as distinct entries", () => {
    const cache = new ResponseCache<string>();
    cache.set("analyze", { x: 1 }, "analyze-result");
    expect(cache.get("creative-brief", { x: 1 })).toBeUndefined();
  });

  it("expires an entry after its TTL elapses", () => {
    let now = 1_000;
    const cache = new ResponseCache<string>(1_000, () => now);
    cache.set("chat", { q: "hi" }, "reply");
    expect(cache.get("chat", { q: "hi" })).toBe("reply");
    now += 999;
    expect(cache.get("chat", { q: "hi" })).toBe("reply");
    now += 2;
    expect(cache.get("chat", { q: "hi" })).toBeUndefined();
  });

  it("defaults to a 30-minute TTL when none is provided", () => {
    let now = 0;
    const cache = new ResponseCache<string>(undefined, () => now);
    cache.set("chat", { q: "hi" }, "reply");
    now = 30 * 60 * 1000 - 1;
    expect(cache.get("chat", { q: "hi" })).toBe("reply");
    now = 30 * 60 * 1000;
    expect(cache.get("chat", { q: "hi" })).toBeUndefined();
  });
});
