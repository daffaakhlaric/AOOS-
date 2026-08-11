import { describe, expect, it } from "vitest";

import { AdId } from "../../../src/domain/value-objects/AdId.js";
import { AdSetId } from "../../../src/domain/value-objects/AdSetId.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

const idClasses = [
  { name: "CampaignId", cls: CampaignId },
  { name: "AdSetId", cls: AdSetId },
  { name: "AdId", cls: AdId },
  { name: "LeadId", cls: LeadId },
] as const;

describe.each(idClasses)("$name", ({ cls }) => {
  it("creates from a valid UUID", () => {
    const id = unwrap(cls.create(VALID_UUID));
    expect(id.toString()).toBe(VALID_UUID);
  });

  it("accepts uppercase UUIDs (case-insensitive)", () => {
    expect(cls.create(VALID_UUID.toUpperCase()).ok).toBe(true);
  });

  it("rejects a malformed UUID", () => {
    expect(unwrapErr(cls.create("not-a-uuid")).message).toMatch(/UUID/);
  });

  it("rejects a non-string input", () => {
    expect(cls.create(42 as unknown as string).ok).toBe(false);
  });

  it("generate() produces a valid, self-consistent id", () => {
    const generated = cls.generate();
    const reparsed = unwrap(cls.create(generated.toString()));
    expect(reparsed.equals(generated)).toBe(true);
  });

  it("equals distinguishes different ids", () => {
    const a = cls.generate();
    const b = cls.generate();
    expect(a.equals(b)).toBe(false);
    expect(a.equals(a)).toBe(true);
  });
});
