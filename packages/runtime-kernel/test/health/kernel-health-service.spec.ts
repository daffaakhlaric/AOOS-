import { describe, expect, it } from "vitest";

import { KernelHealthService } from "../../src/health/kernel-health-service.js";
import { KernelState } from "../../src/types/index.js";

describe("KernelHealthService", () => {
  it("check() reports healthy by default (built-in memory/cpu checks pass under normal load)", async () => {
    const service = new KernelHealthService(() => KernelState.RUNNING);
    const report = await service.check();
    expect(report.status).toBe("healthy");
    expect(report.checks.map((c) => c.name)).toEqual(expect.arrayContaining(["memory", "cpu"]));
  });

  it("registerDependencyCheck adds a check included in future check() runs", async () => {
    const service = new KernelHealthService(() => KernelState.RUNNING);
    service.registerDependencyCheck("fake-db", () => true);
    const report = await service.check();
    expect(report.checks.find((c) => c.name === "fake-db")?.status).toBe("healthy");
  });

  it("a failing registered dependency check makes the overall report unhealthy", async () => {
    const service = new KernelHealthService(() => KernelState.RUNNING);
    service.registerDependencyCheck("broken-dependency", () => false);
    const report = await service.check();
    expect(report.status).toBe("unhealthy");
  });

  it("isLive() reflects LIVE_STATES for the current Kernel state", () => {
    let state = KernelState.CREATED;
    const service = new KernelHealthService(() => state);
    expect(service.isLive()).toBe(false);

    state = KernelState.RUNNING;
    expect(service.isLive()).toBe(true);
  });

  it("isReady() is true only for Ready/Running", () => {
    let state = KernelState.LOADING_MODULES;
    const service = new KernelHealthService(() => state);
    expect(service.isReady()).toBe(false);

    state = KernelState.READY;
    expect(service.isReady()).toBe(true);

    state = KernelState.RUNNING;
    expect(service.isReady()).toBe(true);
  });
});
