import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaId } from "../../src/domain/value-objects/PersonaId.js";
import { SimulationStatus } from "../../src/domain/value-objects/SimulationStatus.js";
import { SimulatorFactory } from "../../src/factories/SimulatorFactory.js";
import { makeSimulatorConfig } from "../fixtures/simulatorFixtures.js";
import { unwrap } from "../helpers/result.js";

/**
 * AAOS-W3A-S1 Fix 1 + Fix 3 dedicated coverage: `SyariahBuyer` driven against the REAL, now-fixed
 * `@aos/sales-agent` engine (no mocking of Clara herself — same convention as `RunSimulation.spec.ts`).
 */
describe("Integration: RunSimulation — SyariahBuyer (AAOS-W3A-S1)", () => {
  it("reaches HOT + handoff within 8 turns (persona's own maxTurns)", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.SYARIAH_BUYER, makeSimulatorConfig()),
    );

    expect(result.status).toBe(SimulationStatus.COMPLETED);
    expect(result.finalTemperature).toBe(LeadTemperature.HOT);
    expect(result.handoffTriggered).toBe(true);
    expect(result.handoffAtTurn).toBeDefined();
    expect(result.handoffAtTurn as number).toBeLessThanOrEqual(8);
    expect(result.metExpectation).toBe(true);
  });

  it("handoff happens on exactly turn 5 (PAYMENT[turn2] + UNIT[turn4] + BUDGET[turn5] = 75 ≥ 65)", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.SYARIAH_BUYER, makeSimulatorConfig()),
    );

    expect(result.handoffAtTurn).toBe(5);
    expect(result.finalScore).toBe(75);
  });

  it("scoreProgression records exactly the 3 qualifying deltas (PAYMENT, UNIT, BUDGET), each +25", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.SYARIAH_BUYER, makeSimulatorConfig()),
    );

    const deltas = result.scoreProgression.map((e) => e.delta);
    expect(deltas).toEqual([25, 25, 25]);
    const criteria = result.scoreProgression.map((e) => e.reason);
    expect(criteria).toEqual(["PAYMENT", "UNIT", "BUDGET"]);
  });

  it("at least one Clara reply carries syariah-specific wording (syariah/halal/murabahah) — the original gap #1", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.SYARIAH_BUYER, makeSimulatorConfig()),
    );

    const claraReplies = result.messages.filter((m) => m.speaker === "CLARA").map((m) => m.text);
    const syariahReplies = claraReplies.filter(
      (text) => text.includes("syariah") || text.includes("halal") || text.includes("murabahah"),
    );
    expect(syariahReplies.length).toBeGreaterThan(0);
  });

  it("the turn-2 reply to 'ada kredit syariah gak?' (SYARIAH + ASK_PRICE) is syariah-worded, not the generic KREDIT/DP reply", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.SYARIAH_BUYER, makeSimulatorConfig()),
    );

    const turn2ClaraReply = result.messages.find((m) => m.turn === 2 && m.speaker === "CLARA");
    expect(turn2ClaraReply).toBeDefined();
    expect(
      turn2ClaraReply!.text.includes("syariah") ||
        turn2ClaraReply!.text.includes("halal") ||
        turn2ClaraReply!.text.includes("murabahah"),
    ).toBe(true);
  });

  it("every Clara reply in this simulation stays ≤ 300 chars", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.SYARIAH_BUYER, makeSimulatorConfig()),
    );

    for (const message of result.messages) {
      if (message.speaker === "CLARA") {
        expect(message.text.length).toBeLessThanOrEqual(300);
      }
    }
  });
});
