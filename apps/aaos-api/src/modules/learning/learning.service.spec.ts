import { describe, expect, it, vi } from "vitest";

import type { LlmService } from "../llm/llm.service.js";
import type { PromptOverrideService } from "../prompt-override/prompt-override.service.js";
import { SIMULATION_CRITERIA } from "../simulation/domain/scoring.js";
import type {
  ClaraPersonaRun,
  SimulationScoring,
  StoredSimulation,
} from "../simulation/domain/simulation-record.js";
import type { SimulationRepository } from "../simulation/infrastructure/simulation.repository.js";

import type {
  CreateLearningProposalInput,
  LearningProposalRepository,
  LearningProposalRow,
} from "./infrastructure/learning-proposal.repository.js";
import { LearningService } from "./learning.service.js";

function buildScoring(overrides: Partial<SimulationScoring> = {}): SimulationScoring {
  return {
    samanthaCoverageScore: 80,
    kaiScore: 100,
    claraScore: 80,
    overallScore: 80,
    grade: "B",
    verdict: "GO",
    ...overrides,
  };
}

function buildStored(
  overrides: {
    readonly scoring?: Partial<SimulationScoring>;
    readonly feedbackItems?: readonly ClaraPersonaRun["feedbackItems"][number][];
  } = {},
): StoredSimulation {
  const runs: readonly ClaraPersonaRun[] = [
    {
      personaId: "ready_buyer",
      ok: true,
      overallScore: 60,
      grade: "D",
      verdict: "NO-GO",
      feedbackItems: overrides.feedbackItems ?? [
        { dimension: "clarity", message: "Balasan kurang jelas soal DP." },
      ],
    },
  ];
  return {
    id: "sim-1",
    tenantId: "dss-motor",
    objectiveSnapshot: {},
    campaignDataSource: "cache",
    personaIds: ["ready_buyer"],
    status: "DONE",
    currentStep: "DONE",
    result: {
      samantha: { available: true, elapsedMs: 10, coverageScore: 80 },
      kai: { available: true, elapsedMs: 10, videoGenerated: false, note: "n" },
      clara: { available: true, runs, elapsedMs: 10 },
      scoring: buildScoring(overrides.scoring),
    },
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
  };
}

function buildFakeSimulationRepository(stored?: StoredSimulation): SimulationRepository {
  return {
    findById: vi.fn(async (id: string) =>
      stored !== undefined && id === stored.id ? stored : undefined,
    ),
  } as unknown as SimulationRepository;
}

function buildFakeProposalRepository(
  recent: readonly LearningProposalRow[] = [],
): LearningProposalRepository & { readonly createCalls: CreateLearningProposalInput[] } {
  const createCalls: CreateLearningProposalInput[] = [];
  return {
    createCalls,
    create: vi.fn(async (input: CreateLearningProposalInput) => {
      createCalls.push(input);
      return {
        id: "proposal-1",
        tenant_id: input.tenantId,
        simulation_id: input.simulationId,
        agent: input.agent,
        analysis: input.analysis,
        gaps: input.gaps,
        improvements: input.improvements,
        status: "PENDING",
        decided_by: null,
        decision_notes: null,
        decided_at: null,
        created_at: "2026-08-13T00:00:00.000Z",
      } satisfies LearningProposalRow;
    }),
    listRecentForTenant: vi.fn(async () => recent),
  } as unknown as LearningProposalRepository & {
    readonly createCalls: CreateLearningProposalInput[];
  };
}

function buildFakeLlmService(overrides: Partial<LlmService> = {}): LlmService {
  return {
    generateImprovementPlan: vi.fn(async () => ({
      available: true as const,
      analysis: "analisa nyata dari LLM",
      improvements: [
        {
          agent: "SAMANTHA" as const,
          type: "PROMPT_UPDATE" as const,
          target: "analyze",
          before: "b",
          after: "a",
          reason: "r",
          severity: "MEDIUM" as const,
        },
      ],
      droppedCount: 0,
    })),
    ...overrides,
  } as unknown as LlmService;
}

function buildFakePromptOverride(content = "current active prompt"): PromptOverrideService {
  return {
    resolve: vi.fn(async () => content),
  } as unknown as PromptOverrideService;
}

describe("LearningService", () => {
  describe("onSimulationComplete", () => {
    it("writes no proposal when verdict is GO (no gap)", async () => {
      const stored = buildStored({ scoring: { verdict: "GO" } });
      const proposals = buildFakeProposalRepository();
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        buildFakeLlmService(),
        buildFakePromptOverride(),
      );
      await service.onSimulationComplete(stored.id);
      expect(proposals.create).not.toHaveBeenCalled();
    });

    it("writes no proposal when verdict is INCOMPLETE (an infra gap, not a prompt-quality signal — see this class's own doc)", async () => {
      const stored = buildStored({ scoring: { verdict: "INCOMPLETE" } });
      const proposals = buildFakeProposalRepository();
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        buildFakeLlmService(),
        buildFakePromptOverride(),
      );
      await service.onSimulationComplete(stored.id);
      expect(proposals.create).not.toHaveBeenCalled();
    });

    it("attributes the proposal to SAMANTHA when samanthaCoverageScore fails its real gate (SIMULATION_CRITERIA.minSamanthaScore)", async () => {
      const stored = buildStored({
        scoring: {
          verdict: "NO-GO",
          samanthaCoverageScore: SIMULATION_CRITERIA.minSamanthaScore - 1,
        },
      });
      const proposals = buildFakeProposalRepository();
      const llm = buildFakeLlmService();
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        llm,
        buildFakePromptOverride(),
      );
      await service.onSimulationComplete(stored.id);

      expect(llm.generateImprovementPlan).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({ agent: "SAMANTHA", currentPromptKey: "analyze" }),
      );
      expect(proposals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "dss-motor",
          simulationId: stored.id,
          agent: "SAMANTHA",
        }),
      );
    });

    it("attributes the proposal to CLARA when the Samantha gate passed but overall verdict still failed", async () => {
      const stored = buildStored({
        scoring: {
          verdict: "CONDITIONAL",
          samanthaCoverageScore: SIMULATION_CRITERIA.minSamanthaScore,
          claraScore: 40,
        },
      });
      const proposals = buildFakeProposalRepository();
      const llm = buildFakeLlmService();
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        llm,
        buildFakePromptOverride(),
      );
      await service.onSimulationComplete(stored.id);

      expect(llm.generateImprovementPlan).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({ agent: "CLARA", currentPromptKey: "clara_system_prompt" }),
      );
      expect(proposals.create).toHaveBeenCalledWith(expect.objectContaining({ agent: "CLARA" }));
    });

    it("feeds real feedbackItems and the tenant's last-3 recentProposals into the LLM call", async () => {
      const stored = buildStored({ scoring: { verdict: "NO-GO" } });
      const recent: readonly LearningProposalRow[] = [
        {
          id: "p-1",
          tenant_id: "dss-motor",
          simulation_id: "sim-0",
          agent: "SAMANTHA",
          analysis: "analisa lama",
          gaps: {},
          improvements: [],
          status: "PENDING",
          decided_by: null,
          decision_notes: null,
          decided_at: null,
          created_at: "2026-08-01T00:00:00.000Z",
        },
      ];
      const proposals = buildFakeProposalRepository(recent);
      const llm = buildFakeLlmService();
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        llm,
        buildFakePromptOverride(),
      );
      await service.onSimulationComplete(stored.id);

      expect(llm.generateImprovementPlan).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({
          gap: expect.objectContaining({
            feedbackItems: [{ dimension: "clarity", message: "Balasan kurang jelas soal DP." }],
          }),
          recentProposals: [
            expect.objectContaining({ agent: "SAMANTHA", analysis: "analisa lama" }),
          ],
        }),
      );
    });

    it("writes nothing when the simulation cannot be found (never throws)", async () => {
      const proposals = buildFakeProposalRepository();
      const service = new LearningService(
        buildFakeSimulationRepository(undefined),
        proposals,
        buildFakeLlmService(),
        buildFakePromptOverride(),
      );
      await expect(service.onSimulationComplete("missing-id")).resolves.toBeUndefined();
      expect(proposals.create).not.toHaveBeenCalled();
    });

    it("writes nothing when generateImprovementPlan is unavailable", async () => {
      const stored = buildStored({ scoring: { verdict: "NO-GO" } });
      const proposals = buildFakeProposalRepository();
      const llm = buildFakeLlmService({
        generateImprovementPlan: vi.fn(async () => ({
          available: false as const,
          reason: "PROVIDER_ERROR" as const,
          message: "unavailable",
          droppedCount: 0,
        })),
      });
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        llm,
        buildFakePromptOverride(),
      );
      await service.onSimulationComplete(stored.id);
      expect(proposals.create).not.toHaveBeenCalled();
    });

    it("never throws — a repository failure is caught, logged, and swallowed (best-effort, same discipline as SchedulerService.countHotLeads)", async () => {
      const failingSimulations = {
        findById: vi.fn(async () => {
          throw new Error("boom");
        }),
      } as unknown as SimulationRepository;
      const proposals = buildFakeProposalRepository();
      const service = new LearningService(
        failingSimulations,
        proposals,
        buildFakeLlmService(),
        buildFakePromptOverride(),
      );
      await expect(service.onSimulationComplete("sim-1")).resolves.toBeUndefined();
      expect(proposals.create).not.toHaveBeenCalled();
    });

    it("never writes to agent_prompt_overrides/agent_config_overrides — only ever calls proposals.create with status implicitly PENDING (the repository's own hard-coded default)", async () => {
      const stored = buildStored({ scoring: { verdict: "NO-GO" } });
      const proposals = buildFakeProposalRepository();
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        buildFakeLlmService(),
        buildFakePromptOverride(),
      );
      await service.onSimulationComplete(stored.id);
      expect(proposals.create).toHaveBeenCalledTimes(1);
      const call = proposals.create as unknown as { mock: { calls: unknown[][] } };
      expect(call.mock.calls[0]?.[0]).not.toHaveProperty("status");
    });
  });
});
