import { beforeEach, describe, expect, it } from "vitest";

import { generateId, resetIdCounters } from "../../src/utils/id-generator.js";

describe("generateId", () => {
  beforeEach(() => {
    resetIdCounters();
  });

  it("generates a deterministic, monotonically-increasing id per prefix", () => {
    expect(generateId("foo")).toBe("foo-1");
    expect(generateId("foo")).toBe("foo-2");
    expect(generateId("foo")).toBe("foo-3");
  });

  it("tracks counters independently per prefix", () => {
    expect(generateId("a")).toBe("a-1");
    expect(generateId("b")).toBe("b-1");
    expect(generateId("a")).toBe("a-2");
  });

  it("resets counters back to 1", () => {
    generateId("foo");
    generateId("foo");
    resetIdCounters();
    expect(generateId("foo")).toBe("foo-1");
  });
});
