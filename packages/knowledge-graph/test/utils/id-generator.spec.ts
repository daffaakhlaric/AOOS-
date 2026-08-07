import { describe, expect, it } from "vitest";

import { generateId } from "../../src/utils/id-generator.js";

describe("generateId", () => {
  it("generates a UUID-shaped id with no prefix", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("prefixes the id when given a prefix", () => {
    const id = generateId("node");
    expect(id.startsWith("node_")).toBe(true);
  });

  it("generates unique ids across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });
});
