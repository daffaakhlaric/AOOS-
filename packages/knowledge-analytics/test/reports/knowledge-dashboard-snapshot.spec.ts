import { describe, expect, it } from "vitest";

import { KnowledgeDashboardSnapshot } from "../../src/reports/knowledge-dashboard-snapshot.js";

describe("KnowledgeDashboardSnapshot", () => {
  const build = () =>
    new KnowledgeDashboardSnapshot({ id: "dash_1", generatedAt: 1000, metrics: { hit_rate: 0.8 } });

  it("stores every constructor property", () => {
    const snapshot = build();
    expect(snapshot.id).toBe("dash_1");
    expect(snapshot.generatedAt).toBe(1000);
    expect(snapshot.metrics).toEqual({ hit_rate: 0.8 });
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(build())).toBe(true);
  });

  it("freezes metrics", () => {
    expect(Object.isFrozen(build().metrics)).toBe(true);
  });

  describe("metric", () => {
    it("returns the value for a known metric id", () => {
      expect(build().metric("hit_rate")).toBe(0.8);
    });

    it("returns undefined for an unknown metric id", () => {
      expect(build().metric("unknown")).toBeUndefined();
    });
  });
});
