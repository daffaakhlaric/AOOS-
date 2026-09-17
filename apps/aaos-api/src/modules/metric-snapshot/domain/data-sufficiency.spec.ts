import { describe, expect, it } from "vitest";

import {
  assessDataSufficiency,
  INSUFFICIENT_DAYS_THRESHOLD,
  INSUFFICIENT_IMPRESSIONS_THRESHOLD,
  LOW_IMPRESSIONS_THRESHOLD,
  LOW_LEADS_THRESHOLD,
  MEDIUM_IMPRESSIONS_THRESHOLD,
  MEDIUM_LEADS_THRESHOLD,
  type SampleSize,
} from "./data-sufficiency.js";

function sample(overrides: Partial<SampleSize> = {}): SampleSize {
  return { impressions: 0, clicks: 0, leads: 0, ...overrides };
}

describe("assessDataSufficiency", () => {
  describe("INSUFFICIENT", () => {
    it("classifies zero data as INSUFFICIENT with a score of 0", () => {
      const result = assessDataSufficiency(sample(), 0);
      expect(result.level).toBe("INSUFFICIENT");
      expect(result.score).toBe(0);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("is INSUFFICIENT when impressions is below the threshold even with plenty of days", () => {
      const result = assessDataSufficiency(
        sample({ impressions: INSUFFICIENT_IMPRESSIONS_THRESHOLD - 1 }),
        30,
      );
      expect(result.level).toBe("INSUFFICIENT");
      expect(result.reasons.some((r) => r.includes("Impressions"))).toBe(true);
    });

    it("is INSUFFICIENT when daysCovered is below the threshold even with huge impressions", () => {
      const result = assessDataSufficiency(
        sample({ impressions: 1_000_000, leads: 1_000 }),
        INSUFFICIENT_DAYS_THRESHOLD - 1,
      );
      expect(result.level).toBe("INSUFFICIENT");
      expect(result.reasons.some((r) => r.includes("hari"))).toBe(true);
    });

    it("names BOTH failing dimensions when both impressions and days are insufficient", () => {
      const result = assessDataSufficiency(sample({ impressions: 10 }), 0);
      expect(result.level).toBe("INSUFFICIENT");
      expect(result.reasons).toHaveLength(2);
    });
  });

  describe("LOW", () => {
    it("classifies just-past-INSUFFICIENT data as LOW when impressions is still under the LOW threshold", () => {
      const result = assessDataSufficiency(
        sample({ impressions: INSUFFICIENT_IMPRESSIONS_THRESHOLD, leads: LOW_LEADS_THRESHOLD }),
        INSUFFICIENT_DAYS_THRESHOLD,
      );
      expect(result.level).toBe("LOW");
      expect(result.reasons.some((r) => r.includes("Impressions"))).toBe(true);
    });

    it("is LOW when leads is under the LOW threshold even with high impressions", () => {
      const result = assessDataSufficiency(
        sample({ impressions: LOW_IMPRESSIONS_THRESHOLD, leads: LOW_LEADS_THRESHOLD - 1 }),
        5,
      );
      expect(result.level).toBe("LOW");
      expect(result.reasons.some((r) => r.includes("Leads"))).toBe(true);
    });
  });

  describe("MEDIUM", () => {
    it("classifies data past the LOW gate but under the MEDIUM impressions threshold as MEDIUM", () => {
      const result = assessDataSufficiency(
        sample({ impressions: LOW_IMPRESSIONS_THRESHOLD, leads: LOW_LEADS_THRESHOLD }),
        7,
      );
      expect(result.level).toBe("MEDIUM");
    });

    it("is MEDIUM when leads is under the MEDIUM threshold even with very high impressions", () => {
      const result = assessDataSufficiency(
        sample({ impressions: MEDIUM_IMPRESSIONS_THRESHOLD, leads: MEDIUM_LEADS_THRESHOLD - 1 }),
        14,
      );
      expect(result.level).toBe("MEDIUM");
      expect(result.reasons.some((r) => r.includes("Leads"))).toBe(true);
    });
  });

  describe("HIGH", () => {
    it("classifies data clearing every threshold as HIGH with an empty reasons array", () => {
      const result = assessDataSufficiency(
        sample({ impressions: MEDIUM_IMPRESSIONS_THRESHOLD, leads: MEDIUM_LEADS_THRESHOLD }),
        14,
      );
      expect(result.level).toBe("HIGH");
      expect(result.reasons).toEqual([]);
    });

    it("scores exactly 100 at or above every threshold's cap", () => {
      const result = assessDataSufficiency(
        sample({
          impressions: MEDIUM_IMPRESSIONS_THRESHOLD * 10,
          leads: MEDIUM_LEADS_THRESHOLD * 10,
        }),
        30,
      );
      expect(result.level).toBe("HIGH");
      expect(result.score).toBe(100);
    });
  });

  describe("score", () => {
    it("is a monotonically non-decreasing function of impressions, holding leads/days fixed", () => {
      const low = assessDataSufficiency(sample({ impressions: 1_000, leads: 5 }), 3).score;
      const mid = assessDataSufficiency(sample({ impressions: 10_000, leads: 5 }), 3).score;
      const high = assessDataSufficiency(sample({ impressions: 30_000, leads: 5 }), 3).score;
      expect(mid).toBeGreaterThanOrEqual(low);
      expect(high).toBeGreaterThanOrEqual(mid);
    });

    it("is a monotonically non-decreasing function of daysCovered, holding sample size fixed", () => {
      const fixedSample = sample({ impressions: 2_000, leads: 3 });
      const day1 = assessDataSufficiency(fixedSample, 1).score;
      const day3 = assessDataSufficiency(fixedSample, 3).score;
      const day7 = assessDataSufficiency(fixedSample, 7).score;
      expect(day3).toBeGreaterThanOrEqual(day1);
      expect(day7).toBeGreaterThanOrEqual(day3);
    });

    it("is never negative and never exceeds 100 for any real input", () => {
      const result = assessDataSufficiency(sample({ impressions: 5_000_000, leads: 5_000 }), 365);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
