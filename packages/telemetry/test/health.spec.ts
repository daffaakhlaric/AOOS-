import { describe, expect, it } from "vitest";

import { HealthCheckRegistry } from "../src/health.js";

describe("HealthCheckRegistry", () => {
  it("reports healthy when all checks pass", async () => {
    const registry = new HealthCheckRegistry();
    registry.register("db", () => true);
    registry.register("cache", async () => true);

    const report = await registry.run();
    expect(report.status).toBe("healthy");
    expect(report.checks).toHaveLength(2);
  });

  it("reports unhealthy when any check fails", async () => {
    const registry = new HealthCheckRegistry();
    registry.register("db", () => true);
    registry.register("queue", () => false);

    const report = await registry.run();
    expect(report.status).toBe("unhealthy");
    expect(report.checks.find((c) => c.name === "queue")?.status).toBe("unhealthy");
  });

  it("captures a thrown error as an unhealthy result rather than propagating", async () => {
    const registry = new HealthCheckRegistry();
    registry.register("flaky", () => {
      throw new Error("connection refused");
    });

    const report = await registry.run();
    expect(report.status).toBe("unhealthy");
    expect(report.checks[0]?.error).toContain("connection refused");
  });

  it("throws when registering the same check name twice", () => {
    const registry = new HealthCheckRegistry();
    registry.register("db", () => true);
    expect(() => registry.register("db", () => true)).toThrow(/already registered/);
  });
});
