import { describe, expect, it } from "vitest";

import {
  AnomalyDetector,
  FREQUENCY_HIGH_MEDIUM_THRESHOLD,
  FREQUENCY_HIGH_SEVERE_THRESHOLD,
  type AdFrequencySignal,
} from "../../../src/intelligence/AnomalyDetector.js";

function ad(overrides: Partial<AdFrequencySignal> = {}): AdFrequencySignal {
  return { adId: "ad-1", adName: "Xpander Cinere", frequency: 1, ...overrides };
}

describe("AnomalyDetector.detectFrequencyHigh", () => {
  it("returns nothing for a healthy portfolio (frequency at or below the MEDIUM threshold)", () => {
    const anomalies = AnomalyDetector.detectFrequencyHigh([
      ad({ frequency: 1.2 }),
      ad({ adId: "ad-2", frequency: FREQUENCY_HIGH_MEDIUM_THRESHOLD }),
    ]);
    expect(anomalies).toEqual([]);
  });

  it("returns nothing for an empty input — never a fabricated anomaly", () => {
    expect(AnomalyDetector.detectFrequencyHigh([])).toEqual([]);
  });

  it("flags an ad just above the MEDIUM threshold as MEDIUM severity", () => {
    const anomalies = AnomalyDetector.detectFrequencyHigh([
      ad({ frequency: FREQUENCY_HIGH_MEDIUM_THRESHOLD + 0.1 }),
    ]);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.severity).toBe("MEDIUM");
    expect(anomalies[0]?.anomalyType).toBe("FREQUENCY_HIGH");
  });

  it("flags an ad at exactly the SEVERE threshold as MEDIUM (strictly greater-than for HIGH)", () => {
    const anomalies = AnomalyDetector.detectFrequencyHigh([
      ad({ frequency: FREQUENCY_HIGH_SEVERE_THRESHOLD }),
    ]);
    expect(anomalies[0]?.severity).toBe("MEDIUM");
  });

  it("flags an ad above the SEVERE threshold as HIGH severity", () => {
    const anomalies = AnomalyDetector.detectFrequencyHigh([
      ad({ frequency: FREQUENCY_HIGH_SEVERE_THRESHOLD + 0.5 }),
    ]);
    expect(anomalies[0]?.severity).toBe("HIGH");
  });

  it("includes the real ad id/name and a formatted frequency in the message", () => {
    const anomalies = AnomalyDetector.detectFrequencyHigh([
      ad({ adId: "ad-99", adName: "Brio Bintaro", frequency: 5.234 }),
    ]);
    expect(anomalies[0]?.adId).toBe("ad-99");
    expect(anomalies[0]?.adName).toBe("Brio Bintaro");
    expect(anomalies[0]?.frequency).toBe(5.234);
    expect(anomalies[0]?.message).toContain("5.2x");
  });

  it("sorts results by descending frequency (worst first)", () => {
    const anomalies = AnomalyDetector.detectFrequencyHigh([
      ad({ adId: "low", frequency: 3.6 }),
      ad({ adId: "high", frequency: 6 }),
      ad({ adId: "mid", frequency: 4 }),
    ]);
    expect(anomalies.map((a) => a.adId)).toEqual(["high", "mid", "low"]);
  });
});
