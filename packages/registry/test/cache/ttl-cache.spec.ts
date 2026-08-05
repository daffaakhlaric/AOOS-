import { describe, expect, it } from "vitest";

import { TtlCache } from "../../src/cache/ttl-cache.js";

describe("Cache Test — TtlCache", () => {
  it("stores and retrieves a value", () => {
    const cache = new TtlCache<string>();
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
  });

  it("get() on a missing key returns undefined and counts a miss", () => {
    const cache = new TtlCache<string>();
    expect(cache.get("missing")).toBeUndefined();
    expect(cache.missCount).toBe(1);
  });

  it("get() on a present key counts a hit", () => {
    const cache = new TtlCache<string>();
    cache.set("key", "value");
    cache.get("key");
    expect(cache.hitCount).toBe(1);
  });

  it("has() reflects presence without necessarily being called elsewhere", () => {
    const cache = new TtlCache<string>();
    expect(cache.has("key")).toBe(false);
    cache.set("key", "value");
    expect(cache.has("key")).toBe(true);
  });

  it("invalidate() removes a single key", () => {
    const cache = new TtlCache<string>();
    cache.set("a", "1");
    cache.set("b", "2");
    cache.invalidate("a");
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
  });

  it("clear() empties the cache and resets hit/miss counters", () => {
    const cache = new TtlCache<string>();
    cache.set("a", "1");
    cache.get("a");
    cache.get("missing");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.hitCount).toBe(0);
    expect(cache.missCount).toBe(0);
  });

  it("respects a per-entry TTL — expired entries are treated as a miss", async () => {
    const cache = new TtlCache<string>();
    cache.set("key", "value", 10);
    expect(cache.get("key")).toBe("value");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(cache.get("key")).toBeUndefined();
  });

  it("respects a default TTL configured at construction", async () => {
    const cache = new TtlCache<string>(10);
    cache.set("key", "value");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(cache.get("key")).toBeUndefined();
  });

  it("size reflects the number of stored entries", () => {
    const cache = new TtlCache<string>();
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.size).toBe(2);
  });
});
