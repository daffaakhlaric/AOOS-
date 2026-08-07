import { describe, expect, it } from "vitest";

import { KnowledgeDashboardSnapshotFactory } from "../../src/factories/knowledge-dashboard-snapshot-factory.js";
import { createFixedClock } from "../../src/utils/clock.js";

describe("KnowledgeDashboardSnapshotFactory", () => {
  it("creates a snapshot with the given metrics", () => {
    const factory = new KnowledgeDashboardSnapshotFactory(createFixedClock(1000));
    const snapshot = factory.create({ metrics: { hit_rate: 0.8 } });
    expect(snapshot.metrics).toEqual({ hit_rate: 0.8 });
  });

  it("generates an id automatically when none is supplied", () => {
    const factory = new KnowledgeDashboardSnapshotFactory();
    expect(factory.create({ metrics: {} }).id.startsWith("dashboard_")).toBe(true);
  });

  it("uses a supplied id verbatim", () => {
    const factory = new KnowledgeDashboardSnapshotFactory();
    expect(factory.create({ metrics: {}, id: "custom" }).id).toBe("custom");
  });

  it("uses the injected clock when no generatedAt is supplied", () => {
    const factory = new KnowledgeDashboardSnapshotFactory(createFixedClock(999));
    expect(factory.create({ metrics: {} }).generatedAt).toBe(999);
  });

  it("uses a supplied generatedAt verbatim", () => {
    const factory = new KnowledgeDashboardSnapshotFactory(createFixedClock(999));
    expect(factory.create({ metrics: {}, generatedAt: 42 }).generatedAt).toBe(42);
  });
});
