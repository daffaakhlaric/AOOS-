export type HealthCheckFn = () => Promise<boolean> | boolean;

export type HealthStatus = "healthy" | "unhealthy";

export interface HealthCheckResult {
  readonly name: string;
  readonly status: HealthStatus;
  readonly error?: string;
}

export interface HealthReport {
  readonly status: HealthStatus;
  readonly checks: readonly HealthCheckResult[];
}

/**
 * Generic health-check registry (Constitution §25 Monitoring Standards / Architecture §18
 * Health Contract concept). Foundation-phase scope: an in-process registry any future
 * Runtime service can attach its own readiness checks (DB ping, queue connectivity, etc.) to.
 */
export class HealthCheckRegistry {
  private readonly checks = new Map<string, HealthCheckFn>();

  register(name: string, check: HealthCheckFn): void {
    if (this.checks.has(name)) {
      throw new Error(`Health check "${name}" is already registered`);
    }
    this.checks.set(name, check);
  }

  async run(): Promise<HealthReport> {
    const results: HealthCheckResult[] = [];

    for (const [name, check] of this.checks) {
      try {
        const passed = await check();
        results.push({ name, status: passed ? "healthy" : "unhealthy" });
      } catch (error) {
        results.push({
          name,
          status: "unhealthy",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const overall: HealthStatus = results.every((r) => r.status === "healthy")
      ? "healthy"
      : "unhealthy";
    return { status: overall, checks: results };
  }
}
