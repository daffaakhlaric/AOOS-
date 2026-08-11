import { describe, expect, it } from "vitest";

import {
  getObjectionResponse,
  OBJECTION_NOT_SURE,
} from "../../../src/responses/ObjectionResponses.js";

describe("ObjectionResponses", () => {
  it("'takut bermasalah' → Otospector response", () => {
    expect(getObjectionResponse("saya takut bermasalah nih", 0)).toContain("Otospector");
  });

  it("'mahal' → transparent pricing response", () => {
    expect(getObjectionResponse("kayaknya mahal ya", 0)).toContain("transparan");
  });

  it("'pikir dulu' → reserve-unit response", () => {
    expect(getObjectionResponse("pikir dulu ya kak", 0)).toContain("reserve");
  });

  it("'takut kredit ditolak' → credit-assistance response", () => {
    expect(getObjectionResponse("takut kredit ditolak", 0)).toContain("leasing");
  });

  it("an unknown objection falls back to OBJECTION_NOT_SURE", () => {
    const text = getObjectionResponse("hmm ok deh", 0);
    expect(OBJECTION_NOT_SURE).toContain(text);
  });

  it("every response stays ≤ 300 chars", () => {
    for (const entry of OBJECTION_NOT_SURE) {
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });
});
