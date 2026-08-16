import { describe, expect, it } from "vitest";

import { stripAdNameSuffix } from "@/lib/adName";

describe("stripAdNameSuffix (best-effort pattern match, not verified against real Meta data — see adName.ts's docstring)", () => {
  it('strips a " - Ad [uuid]" suffix', () => {
    expect(stripAdNameSuffix("Xpander Creative 1 - Ad 3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(
      "Xpander Creative 1",
    );
  });

  it('strips a " · [uuid]" suffix', () => {
    expect(stripAdNameSuffix("Xpander Creative 1 · 3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(
      "Xpander Creative 1",
    );
  });

  it("leaves a name with no UUID suffix unchanged", () => {
    expect(stripAdNameSuffix("Meta-DM-Leads-Mobix")).toBe("Meta-DM-Leads-Mobix");
  });

  it("leaves a name whose trailing segment is not a valid UUID unchanged", () => {
    expect(stripAdNameSuffix("Xpander Creative 1 - Ad not-a-uuid")).toBe(
      "Xpander Creative 1 - Ad not-a-uuid",
    );
  });

  it("only strips a suffix at the very end of the string, not a UUID-looking substring in the middle", () => {
    const withMiddleUuid = "Ad 3fa85f64-5717-4562-b3fc-2c963f66afa6 Extra Text";
    expect(stripAdNameSuffix(withMiddleUuid)).toBe(withMiddleUuid);
  });

  it("does not mutate an empty string", () => {
    expect(stripAdNameSuffix("")).toBe("");
  });

  it("is case-insensitive on the uuid's hex digits", () => {
    expect(stripAdNameSuffix("Creative · 3FA85F64-5717-4562-B3FC-2C963F66AFA6")).toBe("Creative");
  });

  it('strips a " - Boost [uuid]" suffix (TOTAL UI REBUILD spec extension)', () => {
    expect(
      stripAdNameSuffix("Xpander Creative 1 - Boost 3fa85f64-5717-4562-b3fc-2c963f66afa6"),
    ).toBe("Xpander Creative 1");
  });

  it.each(["platinum", "gold", "silver"])(
    'strips a " - %s [uuid]" suffix, case-insensitively',
    (tier) => {
      expect(
        stripAdNameSuffix(`Xpander Creative 1 - ${tier} 3fa85f64-5717-4562-b3fc-2c963f66afa6`),
      ).toBe("Xpander Creative 1");
    },
  );

  it("strips a generic UUID-shaped trailing segment not matching any keyword variant", () => {
    expect(stripAdNameSuffix("Xpander Creative 1 - 3fa85f64-5717-4562-b3fc")).toBe(
      "Xpander Creative 1",
    );
  });
});
