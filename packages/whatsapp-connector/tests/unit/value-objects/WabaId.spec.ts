import { describe, expect, it } from "vitest";

import { WabaId } from "../../../src/domain/value-objects/WabaId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("WabaId", () => {
  it("creates from a non-empty string", () => {
    const id = unwrap(WabaId.create("waba-123"));
    expect(id.toString()).toBe("waba-123");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(WabaId.create(""));
    expect(error.message).toContain("non-empty");
  });

  it("rejects a whitespace-only string", () => {
    const error = unwrapErr(WabaId.create("   "));
    expect(error.message).toContain("non-empty");
  });

  it("equals compares by value", () => {
    const a = unwrap(WabaId.create("waba-1"));
    const b = unwrap(WabaId.create("waba-1"));
    const c = unwrap(WabaId.create("waba-2"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
