import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../src/domain/value-objects/PersonaDifficulty.js";
import { SimulationStatus } from "../../src/domain/value-objects/SimulationStatus.js";
import { SimulatorFactory } from "../../src/factories/SimulatorFactory.js";
import { makeSimulatorConfig } from "../fixtures/simulatorFixtures.js";
import { unwrap } from "../helpers/result.js";

describe("Integration: RunAllScenarios", () => {
  it("runs all 10 personas without error", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const results = unwrap(await simulator.runAllScenarios.execute(makeSimulatorConfig()));

    expect(results).toHaveLength(10);
    for (const result of results) {
      expect(result.status).not.toBe(SimulationStatus.FAILED);
    }
  });

  it("the 3 EASY personas (ColdBuyer, ReadyBuyer, UrgentBuyer) reach HOT or COLD as pinned", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const results = unwrap(await simulator.runAllScenarios.execute(makeSimulatorConfig()));

    const easyResults = results.filter((r) => r.personaDifficulty === PersonaDifficulty.EASY);
    expect(easyResults).toHaveLength(3);
    for (const result of easyResults) {
      expect(result.metExpectation).toBe(true);
    }
  });

  /**
   * The spec's testing section pins "5 medium personas → WARM or HOT". AAOS-W3A-S1 fixed
   * `SyariahBuyer` (MEDIUM) — its script now supplies UNIT + BUDGET signals alongside PAYMENT,
   * reaching HOT (see `tests/integration/RunSimulation.spec.ts`'s dedicated SyariahBuyer test and
   * `docs/AAOS-CONVERSATION-SIMULATOR-REPORT.md`'s changelog) — so all 5 of 5 MEDIUM personas now
   * land WARM/HOT, not the previously-documented 4 of 5.
   */
  it("all 5 of the 5 MEDIUM personas end WARM or HOT", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const results = unwrap(await simulator.runAllScenarios.execute(makeSimulatorConfig()));

    const mediumResults = results.filter((r) => r.personaDifficulty === PersonaDifficulty.MEDIUM);
    expect(mediumResults).toHaveLength(5);
    const warmOrHotCount = mediumResults.filter((r) =>
      [LeadTemperature.WARM, LeadTemperature.HOT].includes(r.finalTemperature),
    ).length;
    expect(warmOrHotCount).toBe(5);
  });

  it("the 2 HARD personas (GhostBuyer, ComplainerBuyer) end COLD or WARM", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const results = unwrap(await simulator.runAllScenarios.execute(makeSimulatorConfig()));

    const hardResults = results.filter((r) => r.personaDifficulty === PersonaDifficulty.HARD);
    expect(hardResults).toHaveLength(2);
    for (const result of hardResults) {
      expect([LeadTemperature.COLD, LeadTemperature.WARM]).toContain(result.finalTemperature);
    }
  });

  it("every result carries a unique sessionId", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const results = unwrap(await simulator.runAllScenarios.execute(makeSimulatorConfig()));

    const ids = new Set(results.map((r) => r.sessionId.toString()));
    expect(ids.size).toBe(10);
  });
});
