import { describe, expect, it } from "vitest";

import {
  SelectTargetingLlmPayloadSchema,
  SelectTargetingRequestSchema,
} from "./select-targeting.dto.js";

const REAL_CANDIDATE = {
  id: "6003257869482",
  name: "Used car (vehicle)",
  audienceSizeLower: 61362891,
  audienceSizeUpper: 72162760,
  topic: "Business and industry",
};

describe("SelectTargetingRequestSchema", () => {
  it("accepts a real request with real candidates", () => {
    const parsed = SelectTargetingRequestSchema.safeParse({
      unit: "Xpander Ultimate",
      angle: "DP_RINGAN",
      branch: "BINTARO",
      candidates: [REAL_CANDIDATE],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a candidate with no topic (Meta does not guarantee the field)", () => {
    const { topic: _topic, ...withoutTopic } = REAL_CANDIDATE;
    const parsed = SelectTargetingRequestSchema.safeParse({
      unit: "Xpander",
      branch: "CINERE",
      candidates: [withoutTopic],
    });
    expect(parsed.success).toBe(true);
  });

  it("fails closed on a branch outside the real Branch enum", () => {
    const parsed = SelectTargetingRequestSchema.safeParse({
      unit: "Xpander",
      branch: "MADE_UP_BRANCH",
      candidates: [REAL_CANDIDATE],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty candidate list — there would be nothing legitimate to select from", () => {
    const parsed = SelectTargetingRequestSchema.safeParse({
      unit: "Xpander",
      branch: "CINERE",
      candidates: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an oversized candidate list (never send the LLM the whole table)", () => {
    const parsed = SelectTargetingRequestSchema.safeParse({
      unit: "Xpander",
      branch: "CINERE",
      candidates: Array.from({ length: 41 }, (_, index) => ({
        ...REAL_CANDIDATE,
        id: `id-${index}`,
      })),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("SelectTargetingLlmPayloadSchema", () => {
  it("accepts a well-formed model response", () => {
    const parsed = SelectTargetingLlmPayloadSchema.safeParse({
      interestIds: ["6003257869482"],
      reasoning: "Relevan untuk pembeli mobil bekas.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty selection and a missing reasoning", () => {
    expect(
      SelectTargetingLlmPayloadSchema.safeParse({ interestIds: [], reasoning: "x" }).success,
    ).toBe(false);
    expect(
      SelectTargetingLlmPayloadSchema.safeParse({ interestIds: ["6003257869482"] }).success,
    ).toBe(false);
  });

  it("cannot by itself tell an invented id from a real one — that is LlmService's candidate-set check", () => {
    // Documents the deliberate division of responsibility: Zod validates SHAPE, the service
    // validates MEMBERSHIP. This id was never in any candidate list.
    const parsed = SelectTargetingLlmPayloadSchema.safeParse({
      interestIds: ["9999999999999"],
      reasoning: "x",
    });
    expect(parsed.success).toBe(true);
  });
});
