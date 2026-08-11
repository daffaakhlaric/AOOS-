import { describe, expect, it } from "vitest";

import { SyncSessionBuilder } from "../../../src/builders/SyncSessionBuilder.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SyncSessionBuilder", () => {
  it("builds a valid session with sensible defaults", () => {
    const session = unwrap(new SyncSessionBuilder().build());
    expect(session.id).toBe("sync-session-1");
    expect(session.status).toBe("RUNNING");
  });

  it("applies every with*() override", () => {
    const session = unwrap(
      new SyncSessionBuilder()
        .withId("s2")
        .withTriggeredAt(new Date("2026-01-01T00:00:00.000Z"))
        .withCompletedAt(new Date("2026-01-01T00:05:00.000Z"))
        .withSources([SourceSystem.MOCK, SourceSystem.API])
        .withUnitsAdded(5)
        .withUnitsUpdated(2)
        .withUnitsSold(1)
        .withErrors(["oops"])
        .withStatus("PARTIAL")
        .build(),
    );
    expect(session.id).toBe("s2");
    expect(session.completedAt).toEqual(new Date("2026-01-01T00:05:00.000Z"));
    expect(session.sources).toEqual([SourceSystem.MOCK, SourceSystem.API]);
    expect(session.unitsAdded).toBe(5);
    expect(session.unitsUpdated).toBe(2);
    expect(session.unitsSold).toBe(1);
    expect(session.errors).toEqual(["oops"]);
    expect(session.status).toBe("PARTIAL");
  });

  it("propagates a validation error", () => {
    const error = unwrapErr(new SyncSessionBuilder().withId("").build());
    expect(error.message).toContain("id");
  });
});
