import os from "node:os";

import { HealthCheckRegistry, type HealthCheckFn, type HealthReport } from "@aos/telemetry";

import { LIVE_STATES, READY_STATES, type KernelState } from "../types/index.js";

/**
 * Kernel-level health: wraps @aos/telemetry's generic HealthCheckRegistry (no need to
 * reinvent it), adds built-in memory/CPU checks, and derives Kubernetes-style
 * readiness/liveness from the current KernelState.
 */
export class KernelHealthService {
  private readonly registry = new HealthCheckRegistry();

  constructor(private readonly getState: () => KernelState) {
    this.registry.register("memory", () => this.checkMemory());
    this.registry.register("cpu", () => this.checkCpu());
  }

  registerDependencyCheck(name: string, check: HealthCheckFn): void {
    this.registry.register(name, check);
  }

  async check(): Promise<HealthReport> {
    return this.registry.run();
  }

  /** Liveness: is the Kernel process alive and not in a dead/unrecoverable state. */
  isLive(): boolean {
    return LIVE_STATES.has(this.getState());
  }

  /** Readiness: is the Kernel currently able to serve (Ready or Running). */
  isReady(): boolean {
    return READY_STATES.has(this.getState());
  }

  private checkMemory(): boolean {
    const usage = process.memoryUsage();
    if (usage.heapTotal === 0) {
      return true;
    }
    return usage.heapUsed / usage.heapTotal < 0.95;
  }

  private checkCpu(): boolean {
    // os.loadavg() always returns [0, 0, 0] on Windows (documented Node.js behavior) —
    // this check is a best-effort heuristic on platforms where load averages are meaningful.
    const [oneMinuteLoad] = os.loadavg();
    const cpuCount = os.cpus().length || 1;
    return (oneMinuteLoad ?? 0) < cpuCount * 2;
  }
}
