import { describe, expect, it } from "vitest";

import {
  ALL_SIMULATION_STATUSES,
  SimulationStatus,
} from "../../../../src/domain/value-objects/SimulationStatus.js";

describe("SimulationStatus", () => {
  it("has exactly 4 members: RUNNING, COMPLETED, FAILED, TIMEOUT", () => {
    expect(Object.values(SimulationStatus)).toHaveLength(4);
    expect(ALL_SIMULATION_STATUSES).toEqual([
      SimulationStatus.RUNNING,
      SimulationStatus.COMPLETED,
      SimulationStatus.FAILED,
      SimulationStatus.TIMEOUT,
    ]);
  });
});
