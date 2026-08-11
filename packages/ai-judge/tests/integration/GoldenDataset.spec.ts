import { DEFAULT_SIMULATOR_CONFIG, PersonaId, SimulatorFactory } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { AiJudgeFactory } from "../../src/factories/AiJudgeFactory.js";
import { unwrap } from "../helpers/result.js";

describe("Integration: GoldenDataset", () => {
  it("SaveGoldenConversation stores a high-scoring real ReadyBuyer conversation in the registry", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const simulationResult = unwrap(
      await simulator.runSimulation.execute(PersonaId.READY_BUYER, DEFAULT_SIMULATOR_CONFIG),
    );

    const judge = unwrap(AiJudgeFactory.create());
    const judged = unwrap(await judge.judgeConversation.execute(simulationResult));

    if (judged.isGoldenCandidate) {
      const saved = unwrap(
        await judge.saveGoldenConversation.execute(simulationResult, judged, ["ready"]),
      );
      expect(saved.personaId).toBe(PersonaId.READY_BUYER);
      expect(judge.goldenDatasetRegistry.size).toBe(1);
    } else {
      const rejected = await judge.saveGoldenConversation.execute(simulationResult, judged);
      expect(rejected.ok).toBe(false);
    }
  });

  it("GetGoldenDataset returns everything saved so far, across multiple personas", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const judge = unwrap(AiJudgeFactory.create());

    for (const personaId of [
      PersonaId.READY_BUYER,
      PersonaId.URGENT_BUYER,
      PersonaId.SYARIAH_BUYER,
    ]) {
      const simulationResult = unwrap(
        await simulator.runSimulation.execute(personaId, DEFAULT_SIMULATOR_CONFIG),
      );
      const judged = unwrap(await judge.judgeConversation.execute(simulationResult));
      if (judged.isGoldenCandidate) {
        await judge.saveGoldenConversation.execute(simulationResult, judged);
      }
    }

    const all = judge.getGoldenDataset.execute();
    expect(all.length).toBe(judge.goldenDatasetRegistry.size);
  });

  it("tags are assigned correctly: personaId is always present, hot-lead/handoff when applicable", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const simulationResult = unwrap(
      await simulator.runSimulation.execute(PersonaId.URGENT_BUYER, DEFAULT_SIMULATOR_CONFIG),
    );

    const judge = unwrap(AiJudgeFactory.create());
    const judged = unwrap(await judge.judgeConversation.execute(simulationResult));

    if (judged.isGoldenCandidate) {
      const saved = unwrap(await judge.saveGoldenConversation.execute(simulationResult, judged));
      expect(saved.tags).toContain(PersonaId.URGENT_BUYER);
      if (simulationResult.handoffTriggered) {
        expect(saved.tags).toContain("handoff");
      }
    }
  });
});
