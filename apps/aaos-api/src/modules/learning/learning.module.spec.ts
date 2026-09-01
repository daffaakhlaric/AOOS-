import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { LlmModule } from "../llm/llm.module.js";
import { PromptOverrideModule } from "../prompt-override/prompt-override.module.js";
import { SimulationRepository } from "../simulation/infrastructure/simulation.repository.js";

import { LearningProposalRepository } from "./infrastructure/learning-proposal.repository.js";
import { LearningModule } from "./learning.module.js";
import { LearningService } from "./learning.service.js";

describe("LearningModule", () => {
  it("imports LlmModule and PromptOverrideModule (so LearningService injects the SAME real LlmService/PromptOverrideService)", () => {
    const metadata = Reflect.getMetadata("imports", LearningModule) as unknown[];
    expect(metadata).toContain(LlmModule);
    expect(metadata).toContain(PromptOverrideModule);
  });

  it("exports LearningService (so SimulationModule can inject it)", () => {
    const metadata = Reflect.getMetadata("exports", LearningModule) as unknown[];
    expect(metadata).toEqual([LearningService]);
  });

  it("registers LearningService and SimulationRepository/LearningProposalRepository factories as providers", () => {
    const metadata = Reflect.getMetadata("providers", LearningModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toContain(LearningService);
    const simulationRepoProvider = metadata.find(
      (p) =>
        typeof p === "object" && p !== null && "provide" in p && p.provide === SimulationRepository,
    );
    expect(simulationRepoProvider).toBeDefined();
    const learningProposalRepoProvider = metadata.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in p &&
        p.provide === LearningProposalRepository,
    );
    expect(learningProposalRepoProvider).toBeDefined();
  });
});
