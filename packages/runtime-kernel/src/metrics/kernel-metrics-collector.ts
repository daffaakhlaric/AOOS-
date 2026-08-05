import type { HealthReport } from "@aos/telemetry";

export interface KernelMetricsSnapshot {
  readonly uptimeMs: number;
  readonly bootTimeMs: number | undefined;
  readonly memoryUsageBytes: number;
  readonly moduleCount: number;
  readonly pluginCount: number;
  /** Fraction of health checks currently passing, 0..1. */
  readonly healthScore: number;
}

export interface KernelMetricsDependencies {
  readonly startedAt: Date;
  readonly getModuleCount: () => number;
  readonly getPluginCount: () => number;
  readonly getHealthReport: () => Promise<HealthReport>;
}

/** Collects the Kernel Metrics enumerated in the source prompt as a point-in-time snapshot. */
export class KernelMetricsCollector {
  private bootTimeMs: number | undefined;

  constructor(private readonly deps: KernelMetricsDependencies) {}

  /** Recorded once, externally, the moment the Kernel finishes booting (Created → Ready). */
  recordBootTime(durationMs: number): void {
    this.bootTimeMs = durationMs;
  }

  async snapshot(): Promise<KernelMetricsSnapshot> {
    const health = await this.deps.getHealthReport();
    const healthScore =
      health.checks.length === 0
        ? 1
        : health.checks.filter((check) => check.status === "healthy").length / health.checks.length;

    return {
      uptimeMs: Date.now() - this.deps.startedAt.getTime(),
      bootTimeMs: this.bootTimeMs,
      memoryUsageBytes: process.memoryUsage().heapUsed,
      moduleCount: this.deps.getModuleCount(),
      pluginCount: this.deps.getPluginCount(),
      healthScore,
    };
  }
}
