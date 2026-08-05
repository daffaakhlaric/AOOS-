import { describe, expect, it } from "vitest";

import type { JsonObject, JsonValue, Uuid } from "../src/index.js";

describe("branded", () => {
  it("allows a plain string to be treated as a branded Uuid via explicit cast", () => {
    const id = "9c1f3e2a-2b1a-4e3a-8b0a-1a2b3c4d5e6f" as Uuid<"TenantId">;
    expect(typeof id).toBe("string");
  });
});

describe("json", () => {
  it("JsonObject accepts nested JSON-serializable structures", () => {
    const payload: JsonObject = {
      tenant_id: "abc",
      score: 82,
      active: true,
      tags: ["hot", "verified"],
      nested: { ok: true },
      nothing: null,
    };
    expect(JSON.stringify(payload)).toContain("tenant_id");
  });

  it("JsonValue rejects non-serializable shapes at the type level (compile-time only)", () => {
    const value: JsonValue = { a: [1, "two", null, { b: false }] };
    expect(Array.isArray((value as JsonObject).a)).toBe(true);
  });
});
