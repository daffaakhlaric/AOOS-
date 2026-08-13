import { describe, expect, it } from "vitest";

import {
  DEFAULT_CLOSING_TRACKER_CONFIG,
  parseClosingTrackerConfig,
} from "../../../src/config/ClosingTrackerConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseClosingTrackerConfig", () => {
  it("rejects a missing tenantId", () => {
    const error = unwrapErr(parseClosingTrackerConfig({}));
    expect(error.message).toContain("tenantId");
  });

  it("rejects a non-object input with a root-level issue path", () => {
    const error = unwrapErr(parseClosingTrackerConfig(null));
    expect(error.message).toContain("(root)");
  });

  it("applies the spec's exact stated defaults", () => {
    const config = unwrap(parseClosingTrackerConfig({ tenantId: "dss-motor" }));
    expect(config.rphSpkScaleThreshold).toBe(2_000_000);
    expect(config.rphSpkKeepThreshold).toBe(5_000_000);
    expect(config.rphSpkPauseThreshold).toBe(10_000_000);
    expect(config.minSpkForAttribution).toBe(1);
    expect(config.minSpendForPause).toBe(1_000_000);
  });

  it("accepts explicit overrides", () => {
    const config = unwrap(
      parseClosingTrackerConfig({
        tenantId: "dss-motor",
        rphSpkScaleThreshold: 1_000_000,
        rphSpkKeepThreshold: 3_000_000,
        rphSpkPauseThreshold: 8_000_000,
        minSpkForAttribution: 2,
        minSpendForPause: 500_000,
      }),
    );
    expect(config.rphSpkScaleThreshold).toBe(1_000_000);
    expect(config.minSpkForAttribution).toBe(2);
  });

  it("rejects rphSpkScaleThreshold >= rphSpkKeepThreshold", () => {
    const error = unwrapErr(
      parseClosingTrackerConfig({
        tenantId: "dss-motor",
        rphSpkScaleThreshold: 5_000_000,
        rphSpkKeepThreshold: 5_000_000,
      }),
    );
    expect(error.message).toContain("rphSpkScaleThreshold");
  });

  it("rejects rphSpkKeepThreshold >= rphSpkPauseThreshold", () => {
    const error = unwrapErr(
      parseClosingTrackerConfig({
        tenantId: "dss-motor",
        rphSpkKeepThreshold: 10_000_000,
        rphSpkPauseThreshold: 10_000_000,
      }),
    );
    expect(error.message).toContain("rphSpkKeepThreshold");
  });

  it("rejects a negative minSpkForAttribution", () => {
    const error = unwrapErr(
      parseClosingTrackerConfig({ tenantId: "dss-motor", minSpkForAttribution: -1 }),
    );
    expect(error.message).toContain("minSpkForAttribution");
  });

  it("DEFAULT_CLOSING_TRACKER_CONFIG matches the spec's exact defaults", () => {
    expect(DEFAULT_CLOSING_TRACKER_CONFIG).toEqual({
      rphSpkScaleThreshold: 2_000_000,
      rphSpkKeepThreshold: 5_000_000,
      rphSpkPauseThreshold: 10_000_000,
      minSpkForAttribution: 1,
      minSpendForPause: 1_000_000,
    });
  });
});
