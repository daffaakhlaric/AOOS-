import { BranchId } from "@aos/branch-manager";

import type { SimulatorConfig } from "../../src/config/SimulatorConfig.js";

/** A `SimulatorConfig` fixture with fast, deterministic, test-friendly defaults (no artificial delay between turns, generous turn budget). */
export function makeSimulatorConfig(overrides: Partial<SimulatorConfig> = {}): SimulatorConfig {
  return {
    maxTurnsPerSimulation: 15,
    maxDurationMs: 30_000,
    branchId: BranchId.CINERE,
    useRealInventory: false,
    delayBetweenTurnsMs: 0,
    tenantId: "tenant-dss-motor-test",
    ...overrides,
  };
}
