import { describe, expect, it } from "vitest";

import { LeadSource, parseLeadSource } from "../../../src/domain/value-objects/LeadSource.js";
import { unwrapErr } from "../../helpers/result.js";

describe("parseLeadSource", () => {
  it("parses CTWA, FORM, ORGANIC", () => {
    expect(parseLeadSource("CTWA").ok).toBe(true);
    expect(parseLeadSource("FORM").ok).toBe(true);
    expect(parseLeadSource("ORGANIC").ok).toBe(true);
  });

  it("is case-insensitive and trims", () => {
    const result = parseLeadSource(" ctwa ");
    expect(result.ok && result.value).toBe(LeadSource.CTWA);
  });

  it("rejects an unknown source", () => {
    const error = unwrapErr(parseLeadSource("REFERRAL"));
    expect(error.message).toContain("REFERRAL");
  });

  it("rejects a non-string input", () => {
    const error = unwrapErr(parseLeadSource(7 as unknown as string));
    expect(error.message).toContain("leadSource");
  });
});
