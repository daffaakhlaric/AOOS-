import { describe, expect, it } from "vitest";

import { DuplicateEntryException } from "../../src/errors/duplicate-entry-exception.js";
import { RegistryBucket } from "../../src/registry/registry-bucket.js";

class NotFoundError extends Error {}

describe("RegistryBucket", () => {
  it("register/get/has/list/remove round-trip", () => {
    const bucket = new RegistryBucket<string>("widget", (id) => new NotFoundError(id));
    bucket.register("a", "value-a");
    expect(bucket.has("a")).toBe(true);
    expect(bucket.get("a")).toBe("value-a");
    expect(bucket.tryGet("a")).toBe("value-a");
    expect(bucket.list()).toEqual(["value-a"]);
    expect(bucket.listIds()).toEqual(["a"]);
    expect(bucket.size).toBe(1);
    expect(bucket.remove("a")).toBe(true);
    expect(bucket.has("a")).toBe(false);
    expect(bucket.remove("a")).toBe(false);
  });

  it("register throws DuplicateEntryException on id collision", () => {
    const bucket = new RegistryBucket<string>("widget", (id) => new NotFoundError(id));
    bucket.register("a", "value-a");
    expect(() => bucket.register("a", "value-b")).toThrow(DuplicateEntryException);
  });

  it("get throws the injected not-found error for a missing id", () => {
    const bucket = new RegistryBucket<string>("widget", (id) => new NotFoundError(id));
    expect(() => bucket.get("missing")).toThrow(NotFoundError);
  });

  it("tryGet returns undefined for a missing id", () => {
    const bucket = new RegistryBucket<string>("widget", (id) => new NotFoundError(id));
    expect(bucket.tryGet("missing")).toBeUndefined();
  });

  it("put overwrites an existing entry without throwing", () => {
    const bucket = new RegistryBucket<string>("widget", (id) => new NotFoundError(id));
    bucket.register("a", "value-a");
    bucket.put("a", "value-a2");
    expect(bucket.get("a")).toBe("value-a2");
  });

  it("clear empties the bucket", () => {
    const bucket = new RegistryBucket<string>("widget", (id) => new NotFoundError(id));
    bucket.register("a", "value-a");
    bucket.clear();
    expect(bucket.size).toBe(0);
  });
});
