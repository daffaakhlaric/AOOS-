import type { IsoDateTime, Uuid } from "@aos/types";
import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../../src/context/index.js";
import { DiagnosticsService } from "../../src/diagnostics/diagnostics-service.js";
import { KernelState } from "../../src/types/index.js";

const runtimeContext: RuntimeContext = {
  kernelId: "kernel-1" as Uuid<"KernelId">,
  kernelName: "diagnostics-test-kernel",
  kernelVersion: "0.1.0",
  environment: "test",
  startedAt: new Date(Date.now() - 1000).toISOString() as IsoDateTime,
};

describe("DiagnosticsService", () => {
  it("produces a full RuntimeInfo snapshot from its injected dependencies", async () => {
    const service = new DiagnosticsService({
      runtimeContext,
      getState: () => KernelState.RUNNING,
      getModuleCount: () => 3,
      getPluginCount: () => 2,
      getConfigurationStatus: () => "loaded",
      getHealthSummary: async () => "healthy",
    });

    const snapshot = await service.snapshot();

    expect(snapshot).toMatchObject({
      kernelId: runtimeContext.kernelId,
      kernelName: "diagnostics-test-kernel",
      kernelVersion: "0.1.0",
      environment: "test",
      state: KernelState.RUNNING,
      loadedModuleCount: 3,
      loadedPluginCount: 2,
      configurationStatus: "loaded",
      healthSummary: "healthy",
    });
    expect(snapshot.uptimeMs).toBeGreaterThanOrEqual(1000);
  });

  it("reflects a not_loaded configuration status and unhealthy summary", async () => {
    const service = new DiagnosticsService({
      runtimeContext,
      getState: () => KernelState.LOADING_CONFIGURATION,
      getModuleCount: () => 0,
      getPluginCount: () => 0,
      getConfigurationStatus: () => "not_loaded",
      getHealthSummary: async () => "unhealthy",
    });

    const snapshot = await service.snapshot();
    expect(snapshot.configurationStatus).toBe("not_loaded");
    expect(snapshot.healthSummary).toBe("unhealthy");
  });
});
