import { describe, expect, it } from "vitest";

import { ConversionFunnel } from "../../../src/domain/value-objects/ConversionFunnel.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ConversionFunnel (spec gap filled — coordinator note #3)", () => {
  it("rejects a negative hotLeadCount", () => {
    const error = unwrapErr(
      ConversionFunnel.create({ hotLeadCount: -1, testDriveCount: 0, spkCount: 0 }),
    );
    expect(error.message).toContain("hotLeadCount");
  });

  it("rejects a non-integer testDriveCount", () => {
    const error = unwrapErr(
      ConversionFunnel.create({ hotLeadCount: 10, testDriveCount: 1.5, spkCount: 0 }),
    );
    expect(error.message).toContain("testDriveCount");
  });

  it("exposes the 3 raw stage counts", () => {
    const funnel = unwrap(
      ConversionFunnel.create({ hotLeadCount: 100, testDriveCount: 40, spkCount: 12 }),
    );
    expect(funnel.hotLeadCount).toBe(100);
    expect(funnel.testDriveCount).toBe(40);
    expect(funnel.spkCount).toBe(12);
  });

  it("hotToTestDriveRate = testDriveCount / hotLeadCount", () => {
    const funnel = unwrap(
      ConversionFunnel.create({ hotLeadCount: 100, testDriveCount: 40, spkCount: 12 }),
    );
    expect(funnel.hotToTestDriveRate.value).toBe(0.4);
  });

  it("testDriveToSpkRate = spkCount / testDriveCount", () => {
    const funnel = unwrap(
      ConversionFunnel.create({ hotLeadCount: 100, testDriveCount: 40, spkCount: 12 }),
    );
    expect(funnel.testDriveToSpkRate.value).toBe(0.3);
  });

  it("hotToTestDriveRate is 0.0 (not NaN) when hotLeadCount is 0", () => {
    const funnel = unwrap(
      ConversionFunnel.create({ hotLeadCount: 0, testDriveCount: 0, spkCount: 0 }),
    );
    expect(funnel.hotToTestDriveRate.value).toBe(0);
  });

  it("testDriveToSpkRate is 0.0 (not NaN) when testDriveCount is 0", () => {
    const funnel = unwrap(
      ConversionFunnel.create({ hotLeadCount: 10, testDriveCount: 0, spkCount: 0 }),
    );
    expect(funnel.testDriveToSpkRate.value).toBe(0);
  });
});
