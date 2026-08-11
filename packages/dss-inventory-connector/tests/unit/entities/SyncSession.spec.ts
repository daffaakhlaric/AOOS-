import { describe, expect, it } from "vitest";

import { SyncSession } from "../../../src/domain/entities/SyncSession.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SyncSession.create", () => {
  it("builds a valid session", () => {
    const session = unwrap(
      SyncSession.create({
        id: "s1",
        triggeredAt: new Date("2026-01-01T00:00:00.000Z"),
        sources: [SourceSystem.MOCK],
        unitsAdded: 1,
        unitsUpdated: 0,
        unitsSold: 0,
        errors: [],
        status: "COMPLETED",
      }),
    );
    expect(session.id).toBe("s1");
    expect(session.triggeredAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(session.sources).toEqual([SourceSystem.MOCK]);
    expect(session.unitsAdded).toBe(1);
    expect(session.status).toBe("COMPLETED");
  });

  it("rejects an empty id", () => {
    const error = unwrapErr(
      SyncSession.create({
        id: "",
        triggeredAt: new Date(),
        sources: [],
        unitsAdded: 0,
        unitsUpdated: 0,
        unitsSold: 0,
        errors: [],
        status: "RUNNING",
      }),
    );
    expect(error.message).toContain("id");
  });

  it("rejects an invalid status at the type boundary", () => {
    const error = unwrapErr(
      SyncSession.create({
        id: "s1",
        triggeredAt: new Date(),
        sources: [],
        unitsAdded: 0,
        unitsUpdated: 0,
        unitsSold: 0,
        errors: [],
        status: "UNKNOWN" as unknown as "RUNNING",
      }),
    );
    expect(error.message).toContain("status");
  });

  it("rejects negative unit counts", () => {
    const error = unwrapErr(
      SyncSession.create({
        id: "s1",
        triggeredAt: new Date(),
        sources: [],
        unitsAdded: -1,
        unitsUpdated: 0,
        unitsSold: 0,
        errors: [],
        status: "RUNNING",
      }),
    );
    expect(error.message).toContain("negative");
  });
});

describe("SyncSession.start / complete", () => {
  it("start() produces a RUNNING session with zeroed counters", () => {
    const session = SyncSession.start(
      "s1",
      [SourceSystem.MOCK],
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(session.status).toBe("RUNNING");
    expect(session.unitsAdded).toBe(0);
    expect(session.completedAt).toBeUndefined();
    expect(session.errors).toEqual([]);
  });

  it("complete() transitions to a terminal status with a new instance", () => {
    const running = SyncSession.start(
      "s1",
      [SourceSystem.MOCK],
      new Date("2026-01-01T00:00:00.000Z"),
    );
    const completedAt = new Date("2026-01-01T00:05:00.000Z");
    const completed = running.complete({
      unitsAdded: 3,
      unitsUpdated: 1,
      unitsSold: 0,
      errors: [],
      status: "COMPLETED",
      completedAt,
    });
    expect(completed).not.toBe(running);
    expect(running.status).toBe("RUNNING");
    expect(completed.status).toBe("COMPLETED");
    expect(completed.unitsAdded).toBe(3);
    expect(completed.completedAt).toEqual(completedAt);
    expect(completed.id).toBe("s1");
  });
});
