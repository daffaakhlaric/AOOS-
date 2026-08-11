import { Branch, Funnel } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AdHistoricalRecord } from "../../../../src/domain/entities/AdHistoricalRecord.js";
import { AdAngle } from "../../../../src/domain/value-objects/AdAngle.js";
import { EvergreenScore } from "../../../../src/domain/value-objects/EvergreenScore.js";
import { unwrap } from "../../../helpers/result.js";

function props(overrides: Partial<Parameters<typeof AdHistoricalRecord.create>[0]> = {}) {
  return {
    adId: "ad-1",
    adName: "Meta-CTWA-Leads-Mobix-Cinere",
    branch: Branch.CINERE,
    funnel: Funnel.CTWA,
    angle: AdAngle.DP_RINGAN,
    daysActive: 65,
    avgRphD3: 6500,
    avgRphChat: 8964,
    avgFrequency: 2.1,
    totalSpend: 15_000_000,
    totalD3: 45,
    fatigueCount: 0,
    evergreenScore: unwrap(EvergreenScore.create(85)),
    ...overrides,
  };
}

describe("AdHistoricalRecord", () => {
  it("creates a valid record and exposes all getters", () => {
    const result = AdHistoricalRecord.create(props());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const record = result.value;
      expect(record.adId).toBe("ad-1");
      expect(record.adName).toBe("Meta-CTWA-Leads-Mobix-Cinere");
      expect(record.branch).toBe(Branch.CINERE);
      expect(record.funnel).toBe(Funnel.CTWA);
      expect(record.angle).toBe(AdAngle.DP_RINGAN);
      expect(record.daysActive).toBe(65);
      expect(record.avgRphD3).toBe(6500);
      expect(record.avgRphChat).toBe(8964);
      expect(record.avgFrequency).toBe(2.1);
      expect(record.totalSpend).toBe(15_000_000);
      expect(record.totalD3).toBe(45);
      expect(record.fatigueCount).toBe(0);
      expect(record.evergreenScore.value).toBe(85);
    }
  });

  it("rejects an empty adId", () => {
    expect(AdHistoricalRecord.create(props({ adId: "" })).ok).toBe(false);
  });

  it("rejects a negative daysActive", () => {
    expect(AdHistoricalRecord.create(props({ daysActive: -1 })).ok).toBe(false);
  });

  it("rejects a negative totalSpend", () => {
    expect(AdHistoricalRecord.create(props({ totalSpend: -1 })).ok).toBe(false);
  });

  it("isEvergreen is true when active > 60 days AND evergreenScore.isHealthy()", () => {
    const result = AdHistoricalRecord.create(
      props({ daysActive: 65, evergreenScore: unwrap(EvergreenScore.create(85)) }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.isEvergreen).toBe(true);
  });

  it("isEvergreen is false when active <= 60 days, even if healthy", () => {
    const result = AdHistoricalRecord.create(
      props({ daysActive: 60, evergreenScore: unwrap(EvergreenScore.create(85)) }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.isEvergreen).toBe(false);
  });

  it("isEvergreen is false when active > 60 days but unhealthy", () => {
    const result = AdHistoricalRecord.create(
      props({ daysActive: 90, evergreenScore: unwrap(EvergreenScore.create(50)) }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.isEvergreen).toBe(false);
  });
});
