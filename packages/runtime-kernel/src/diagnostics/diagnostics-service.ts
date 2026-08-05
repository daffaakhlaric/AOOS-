import type { HealthStatus } from "@aos/telemetry";

import type { RuntimeContext } from "../context/index.js";
import type { KernelState } from "../types/index.js";
import { getUptimeMs } from "../version/index.js";

export type ConfigurationStatus = "not_loaded" | "loaded" | "error";

export interface RuntimeInfo {
  readonly kernelId: string;
  readonly kernelName: string;
  readonly kernelVersion: string;
  readonly environment: string;
  readonly state: KernelState;
  readonly uptimeMs: number;
  readonly loadedModuleCount: number;
  readonly loadedPluginCount: number;
  readonly configurationStatus: ConfigurationStatus;
  readonly healthSummary: HealthStatus;
}

export interface DiagnosticsDependencies {
  readonly runtimeContext: RuntimeContext;
  readonly getState: () => KernelState;
  readonly getModuleCount: () => number;
  readonly getPluginCount: () => number;
  readonly getConfigurationStatus: () => ConfigurationStatus;
  readonly getHealthSummary: () => Promise<HealthStatus>;
}

/** Produces the Runtime Information snapshot enumerated in the source prompt's DIAGNOSTICS section. */
export class DiagnosticsService {
  constructor(private readonly deps: DiagnosticsDependencies) {}

  async snapshot(): Promise<RuntimeInfo> {
    return {
      kernelId: this.deps.runtimeContext.kernelId,
      kernelName: this.deps.runtimeContext.kernelName,
      kernelVersion: this.deps.runtimeContext.kernelVersion,
      environment: this.deps.runtimeContext.environment,
      state: this.deps.getState(),
      uptimeMs: getUptimeMs(new Date(this.deps.runtimeContext.startedAt)),
      loadedModuleCount: this.deps.getModuleCount(),
      loadedPluginCount: this.deps.getPluginCount(),
      configurationStatus: this.deps.getConfigurationStatus(),
      healthSummary: await this.deps.getHealthSummary(),
    };
  }
}
