import { describe, expect, it } from "vitest";

import { UnitUrl } from "../../../src/domain/value-objects/UnitUrl.js";

describe("UnitUrl", () => {
  it("creates a valid https URL", () => {
    const result = UnitUrl.create("https://mobixbydss.id/unit/xpander-2019-abc123");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.href).toBe("https://mobixbydss.id/unit/xpander-2019-abc123");
  });

  it("derives the slug from the last path segment", () => {
    const result = UnitUrl.create("https://mobixbydss.id/unit/xpander-2019-abc123");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.slug).toBe("xpander-2019-abc123");
  });

  it("rejects an empty string", () => {
    expect(UnitUrl.create("").ok).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(UnitUrl.create("not a url").ok).toBe(false);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(UnitUrl.create("ftp://mobixbydss.id/unit/1").ok).toBe(false);
  });

  it("slug is empty when the URL has no path segments", () => {
    const result = UnitUrl.create("https://mobixbydss.id/");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.slug).toBe("");
  });

  it("equals compares by href", () => {
    const a = UnitUrl.create("https://mobixbydss.id/unit/1");
    const b = UnitUrl.create("https://mobixbydss.id/unit/1");
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });
});
