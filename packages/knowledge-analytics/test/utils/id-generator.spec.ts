import { describe, expect, it } from "vitest";

import { generateId } from "../../src/utils/id-generator.js";

describe("generateId", () => {
  it("generates a UUID-shaped string with no prefix", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("prefixes the id when a prefix is given", () => {
    const id = generateId("report");
    expect(id.startsWith("report_")).toBe(true);
  });

  it("generates unique ids across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });
});
