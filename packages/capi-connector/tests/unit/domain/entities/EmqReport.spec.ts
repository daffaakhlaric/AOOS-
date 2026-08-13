import { describe, expect, it } from "vitest";

import { EmqReport } from "../../../../src/domain/entities/EmqReport.js";
import { EmqScore } from "../../../../src/domain/value-objects/EmqScore.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("EmqReport", () => {
  it("creates a report with the given fields", () => {
    const score = unwrap(EmqScore.create(8.3));
    const capturedAt = new Date("2026-01-01T00:00:00.000Z");
    const report = unwrap(
      EmqReport.create({ pixelId: "123", score, eventsReceived: 42, capturedAt }),
    );
    expect(report.pixelId).toBe("123");
    expect(report.score).toBe(score);
    expect(report.eventsReceived).toBe(42);
    expect(report.capturedAt).toBe(capturedAt);
  });

  it("rejects a negative eventsReceived", () => {
    const score = unwrap(EmqScore.create(0));
    const error = unwrapErr(
      EmqReport.create({ pixelId: "123", score, eventsReceived: -1, capturedAt: new Date() }),
    );
    expect(error.message).toContain("EmqReport.eventsReceived must be a non-negative number");
  });

  it("rejects a non-finite eventsReceived", () => {
    const score = unwrap(EmqScore.create(0));
    expect(
      EmqReport.create({
        pixelId: "123",
        score,
        eventsReceived: Number.NaN,
        capturedAt: new Date(),
      }).ok,
    ).toBe(false);
  });
});
