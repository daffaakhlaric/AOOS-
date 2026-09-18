import { describe, expect, it } from "vitest";

import {
  decidePropertyIntegrityMode,
  ILUSTRASI_LABEL,
  PropertyIntegrityMode,
} from "../../../../src/domain/value-objects/PropertyIntegrityMode.js";

describe("PropertyIntegrityMode", () => {
  it("has exactly 2 members (spec's ENHANCE is not honestly derivable from the real listing schema)", () => {
    expect(Object.values(PropertyIntegrityMode)).toHaveLength(2);
  });

  it("ILUSTRASI_LABEL renders as the spec's exact literal string", () => {
    expect(ILUSTRASI_LABEL).toBe("ILUSTRASI");
  });
});

describe("decidePropertyIntegrityMode", () => {
  it.each(["RUMAH", "APARTEMEN", "RUKO", "VILLA"])(
    "%s (a built-unit propertyType) -> STRICT",
    (propertyType) => {
      expect(decidePropertyIntegrityMode(propertyType)).toBe(PropertyIntegrityMode.STRICT);
    },
  );

  it("TANAH (land) -> CONCEPTUAL — the spec's own literal example", () => {
    expect(decidePropertyIntegrityMode("TANAH")).toBe(PropertyIntegrityMode.CONCEPTUAL);
  });

  it("an unrecognized propertyType -> CONCEPTUAL (safer/conservative default, never assumed a real ready unit)", () => {
    expect(decidePropertyIntegrityMode("SOMETHING_NEW")).toBe(PropertyIntegrityMode.CONCEPTUAL);
  });

  it("an empty propertyType -> CONCEPTUAL (same conservative default)", () => {
    expect(decidePropertyIntegrityMode("")).toBe(PropertyIntegrityMode.CONCEPTUAL);
  });

  it("is case-sensitive to the real enum's exact uppercase spelling — a lowercase variant is treated as unrecognized, degrading conservatively rather than being guessed at", () => {
    expect(decidePropertyIntegrityMode("rumah")).toBe(PropertyIntegrityMode.CONCEPTUAL);
  });
});
