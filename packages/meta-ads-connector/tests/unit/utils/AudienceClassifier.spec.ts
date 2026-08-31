import { describe, expect, it } from "vitest";

import { classifyAudience } from "../../../src/utils/AudienceClassifier.js";

describe("classifyAudience", () => {
  it("classifies undefined targeting as BROAD", () => {
    expect(classifyAudience(undefined)).toBe("BROAD");
  });

  it("classifies an empty targeting spec (no custom audiences, no interests) as BROAD", () => {
    expect(classifyAudience({})).toBe("BROAD");
  });

  it("classifies a targeting spec with only interests as INTEREST", () => {
    expect(
      classifyAudience({
        flexibleSpec: [{ interests: [{ id: "1", name: "Automotive" }] }],
      }),
    ).toBe("INTEREST");
  });

  it("classifies an empty interests array (present but empty) as BROAD, not INTEREST", () => {
    expect(classifyAudience({ flexibleSpec: [{ interests: [] }] })).toBe("BROAD");
  });

  it("classifies a LOOKALIKE custom audience as LOOKALIKE_1", () => {
    expect(classifyAudience({ customAudiences: [{ subtype: "LOOKALIKE" }] })).toBe("LOOKALIKE_1");
  });

  it("classifies a WEBSITE custom audience as RETARGETING", () => {
    expect(classifyAudience({ customAudiences: [{ subtype: "WEBSITE" }] })).toBe("RETARGETING");
  });

  it("classifies an ENGAGEMENT custom audience as RETARGETING", () => {
    expect(classifyAudience({ customAudiences: [{ subtype: "ENGAGEMENT" }] })).toBe("RETARGETING");
  });

  it("classifies an APP custom audience as RETARGETING", () => {
    expect(classifyAudience({ customAudiences: [{ subtype: "APP" }] })).toBe("RETARGETING");
  });

  it("classifies a VIDEO custom audience as RETARGETING", () => {
    expect(classifyAudience({ customAudiences: [{ subtype: "VIDEO" }] })).toBe("RETARGETING");
  });

  it("classifies a CUSTOM (uploaded CRM list) audience as CUSTOM_CRM", () => {
    expect(classifyAudience({ customAudiences: [{ subtype: "CUSTOM" }] })).toBe("CUSTOM_CRM");
  });

  it("classifies an unrecognized custom-audience subtype as CUSTOM_CRM (closest bucket, not silently dropped)", () => {
    expect(classifyAudience({ customAudiences: [{ subtype: "OFFLINE_CONVERSION" }] })).toBe(
      "CUSTOM_CRM",
    );
  });

  it("prioritizes LOOKALIKE over other custom audiences and interests when multiple are present", () => {
    expect(
      classifyAudience({
        customAudiences: [{ subtype: "CUSTOM" }, { subtype: "LOOKALIKE" }],
        flexibleSpec: [{ interests: [{ id: "1", name: "Automotive" }] }],
      }),
    ).toBe("LOOKALIKE_1");
  });

  it("prioritizes RETARGETING over CUSTOM_CRM and interests when both a behavioral and an uploaded audience are present", () => {
    expect(
      classifyAudience({
        customAudiences: [{ subtype: "CUSTOM" }, { subtype: "WEBSITE" }],
        flexibleSpec: [{ interests: [{ id: "1", name: "Automotive" }] }],
      }),
    ).toBe("RETARGETING");
  });

  it("prioritizes any custom audience over interests", () => {
    expect(
      classifyAudience({
        customAudiences: [{ subtype: "CUSTOM" }],
        flexibleSpec: [{ interests: [{ id: "1", name: "Automotive" }] }],
      }),
    ).toBe("CUSTOM_CRM");
  });
});
