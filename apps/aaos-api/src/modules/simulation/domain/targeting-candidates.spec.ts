import { describe, expect, it } from "vitest";

import type { StoredMetaInterest } from "../../meta-interests/domain/meta-interest.js";

import { MAX_TARGETING_CANDIDATES, selectTargetingCandidates } from "./targeting-candidates.js";

/** Real rows, verbatim from live Meta `GET /search?type=adinterest` responses (2026-08-18). */
function stored(overrides: Partial<StoredMetaInterest> & { id: string }): StoredMetaInterest {
  return {
    tenantId: "dss-motor",
    name: "x",
    audienceSizeLower: 1,
    audienceSizeUpper: 2,
    path: [],
    searchTerm: "x",
    fetchedAt: "2026-08-18T00:00:00.000Z",
    ...overrides,
  };
}

const USED_CAR = stored({
  id: "6003257869482",
  name: "Used car (vehicle)",
  audienceSizeLower: 61362891,
  audienceSizeUpper: 72162760,
  topic: "Business and industry",
  searchTerm: "used car",
});

const CAR_FINANCE = stored({
  id: "6003739713691",
  name: "car finance (credit and lending)",
  audienceSizeLower: 8039557,
  audienceSizeUpper: 9454520,
  topic: "Business and industry",
  searchTerm: "car finance",
});

const FAMILY = stored({
  id: "6003476182657",
  name: "Family (social concept)",
  audienceSizeLower: 1029906930,
  audienceSizeUpper: 1211170550,
  topic: "Family and relationships",
  searchTerm: "family",
});

describe("selectTargetingCandidates", () => {
  it("returns an empty list only when there is genuinely nothing stored", () => {
    expect(selectTargetingCandidates([], { unit: "Xpander" })).toEqual([]);
  });

  it("keeps every stored interest as a candidate — scoring orders, it does not disqualify", () => {
    const result = selectTargetingCandidates([USED_CAR, CAR_FINANCE, FAMILY], {
      unit: "Xpander Ultimate",
    });
    expect(result).toHaveLength(3);
  });

  it("orders by Meta's own upper audience bound when nothing matches the unit name", () => {
    const result = selectTargetingCandidates([CAR_FINANCE, USED_CAR, FAMILY], {
      unit: "Xpander",
    });
    expect(result.map((i) => i.id)).toEqual([FAMILY.id, USED_CAR.id, CAR_FINANCE.id]);
  });

  it("ranks a unit-name keyword match above a much larger unrelated audience", () => {
    const result = selectTargetingCandidates([FAMILY, USED_CAR], { unit: "Used Car Promo" });
    expect(result[0]?.id).toBe(USED_CAR.id);
  });

  it("boosts financing interests for the DP_RINGAN / KREDIT_SYARIAH angles", () => {
    const withAngle = selectTargetingCandidates([USED_CAR, CAR_FINANCE], {
      unit: "Xpander",
      angle: "KREDIT_SYARIAH",
    });
    expect(withAngle[0]?.id).toBe(CAR_FINANCE.id);

    // Without a financing angle, the larger real audience leads again.
    const withoutAngle = selectTargetingCandidates([USED_CAR, CAR_FINANCE], {
      unit: "Xpander",
      angle: "TESTIMONIAL",
    });
    expect(withoutAngle[0]?.id).toBe(USED_CAR.id);
  });

  it("caps the candidate set well under the LLM request schema's hard max", () => {
    const many = Array.from({ length: 60 }, (_, index) => stored({ id: `id-${index}` }));
    expect(selectTargetingCandidates(many, { unit: "Xpander" })).toHaveLength(
      MAX_TARGETING_CANDIDATES,
    );
    expect(MAX_TARGETING_CANDIDATES).toBeLessThanOrEqual(40);
  });

  it("does not mutate the caller's array", () => {
    const input = [CAR_FINANCE, FAMILY];
    selectTargetingCandidates(input, { unit: "Xpander" });
    expect(input.map((i) => i.id)).toEqual([CAR_FINANCE.id, FAMILY.id]);
  });

  it("ignores generic filler tokens so 'mobil'/'new' never score a bogus match", () => {
    const result = selectTargetingCandidates([FAMILY, USED_CAR], { unit: "Mobil Baru" });
    // Purely audience-ordered: no token contributed a relevance hit.
    expect(result.map((i) => i.id)).toEqual([FAMILY.id, USED_CAR.id]);
  });
});
