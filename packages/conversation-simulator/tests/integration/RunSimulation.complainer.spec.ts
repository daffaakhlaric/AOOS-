import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaId } from "../../src/domain/value-objects/PersonaId.js";
import { SimulatorFactory } from "../../src/factories/SimulatorFactory.js";
import { makeSimulatorConfig } from "../fixtures/simulatorFixtures.js";
import { unwrap } from "../helpers/result.js";

/**
 * AAOS-W3A-S1 Fix 2 + Fix 3 dedicated coverage: `ComplainerBuyer` driven against the REAL, now-fixed
 * `@aos/sales-agent` engine. Before this fix, none of `ComplainerBuyer`'s literal script phrases
 * matched the original 5-pattern HESITATION list, so Clara never entered OBJECTION for this
 * persona — see `docs/AAOS-CONVERSATION-SIMULATOR-REPORT.md`'s changelog for the prior finding.
 */
describe("Integration: RunSimulation — ComplainerBuyer (AAOS-W3A-S1)", () => {
  it("enters OBJECTION stage (previously never triggered for this script)", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.COMPLAINER_BUYER, makeSimulatorConfig()),
    );

    expect(result.claraHandledObjection).toBe(true);
    expect(result.stageTransitions.some((t) => t.to === "OBJECTION")).toBe(true);
  });

  it("enters OBJECTION on turn 1 ('mobilnya beneran bagus gak sih?' — new quality-doubt pattern)", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.COMPLAINER_BUYER, makeSimulatorConfig()),
    );

    expect(result.stageTransitions.some((t) => t.turn === 1 && t.to === "OBJECTION")).toBe(true);
  });

  it("turn 3 ('kemarin temen beli mobil bekas rusak terus' — new COMPLAINT intent) also gets a quality-objection reply, even though the stage stays OBJECTION (no new transition is recorded — `SimulationSession` only records a change of stage, and turns 1-3 all stay OBJECTION)", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.COMPLAINER_BUYER, makeSimulatorConfig()),
    );

    const turn3Reply = result.messages.find((m) => m.turn === 3 && m.speaker === "CLARA");
    expect(turn3Reply).toBeDefined();
    expect(turn3Reply!.text.includes("Otospector") || turn3Reply!.text.includes("150")).toBe(true);
  });

  it("Clara responds to the objection turns with a quality/trust response mentioning Otospector or 150+ titik", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.COMPLAINER_BUYER, makeSimulatorConfig()),
    );

    const claraReplies = result.messages.filter((m) => m.speaker === "CLARA").map((m) => m.text);
    const qualityReplies = claraReplies.filter(
      (text) => text.includes("Otospector") || text.includes("150"),
    );
    expect(qualityReplies.length).toBeGreaterThan(0);
  });

  it("turn 4 ('harga segitu mahal banget') is PRICE_INFO, not OBJECTION — ASK_PRICE ('harga') wins StageDetector's priority order over HESITATION ('mahal'), a real, verified property of the engine, not a bug", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.COMPLAINER_BUYER, makeSimulatorConfig()),
    );

    expect(result.stageTransitions.some((t) => t.turn === 4 && t.to === "PRICE_INFO")).toBe(true);
    expect(result.stageTransitions.some((t) => t.turn === 4 && t.to === "OBJECTION")).toBe(false);
  });

  it("still ends COLD: this script's only ScoreCalculator-recognized signal is PAYMENT (+25, from 'kredit' on turn 5) — not a remaining bug, a real property of this specific script (objection handling is orthogonal to scoring)", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(PersonaId.COMPLAINER_BUYER, makeSimulatorConfig()),
    );

    expect(result.finalScore).toBe(25);
    expect(result.finalTemperature).toBe(LeadTemperature.COLD);
    expect(result.handoffTriggered).toBe(false);
  });
});
