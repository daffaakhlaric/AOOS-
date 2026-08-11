import { describe, expect, it } from "vitest";

import { SalesHumanId } from "../../../src/domain/value-objects/SalesHumanId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SalesHumanId", () => {
  it("creates from a valid non-empty string", () => {
    expect(unwrap(SalesHumanId.create("abc")).toString()).toBe("abc");
  });

  it("rejects an empty string", () => {
    expect(unwrapErr(SalesHumanId.create("   ")).message).toContain("SalesHumanId");
  });

  it("rejects a non-string", () => {
    expect(unwrapErr(SalesHumanId.create(123 as unknown as string)).message).toContain(
      "SalesHumanId",
    );
  });

  it("generate() produces unique ids", () => {
    const a = SalesHumanId.generate();
    const b = SalesHumanId.generate();
    expect(a.equals(b)).toBe(false);
  });

  it("equals compares by value", () => {
    const a = unwrap(SalesHumanId.create("x"));
    const b = unwrap(SalesHumanId.create("x"));
    expect(a.equals(b)).toBe(true);
  });
});
