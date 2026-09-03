import { describe, expect, it, vi } from "vitest";

import type { AgentConfigService } from "../agent-config/agent-config.service.js";
import type {
  ApplyConfigUpdateResult,
  ConfigApplierService,
} from "../agent-config/config-applier.service.js";
import type {
  ApplyLogicUpdateResult,
  LogicApplierService,
} from "../agent-config/logic-applier.service.js";
import type { ImprovementItem } from "../llm/dto/improvement-plan.dto.js";
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
        simulation_id: input.simulationId ?? null,
        agent_run_id: input.agentRunId ?? null,
        agent: input.agent,
        analysis: input.analysis,
        gaps: input.gaps,
        improvements: input.improvements,
        status: "PENDING",
        decided_by: null,
        decision_notes: null,
        decided_at: null,
        created_at: "2026-08-13T00:00:00.000Z",
        auto_applied_config_keys: [],
        self_analysis: input.selfAnalysis ?? null,
      } satisfies LearningProposalRow;
    }),
    listRecentForTenant: vi.fn(async () => recent),
    markAutoApplied: vi.fn(async () => undefined),
  } as unknown as LearningProposalRepository & {
    readonly createCalls: CreateLearningProposalInput[];
  };
}

/**
 * AAOS Self-Improving (Phase SI-3) — default fake `selfAnalyze` returns a real, honest
 * `available: false` (`PROVIDER_ERROR`), exactly the shape a real degrade takes — so every
 * PRE-EXISTING test in this file (none of which asserts anything about `selfAnalyze`/
 * `selfAnalysis`) keeps exercising the real best-effort "no self-analysis available — proceed
 * exactly as before this phase" path unchanged.
 */
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
    selfAnalyze: vi.fn(async () => ({
      available: false as const,
      reason: "PROVIDER_ERROR" as const,
      message: "unavailable",
    })),
    ...overrides,
  } as unknown as LlmService;
}

function buildFakePromptOverride(content = "current active prompt"): PromptOverrideService {
  return {
    resolve: vi.fn(async () => content),
  } as unknown as PromptOverrideService;
}

/** AAOS Self-Improving (Phase SI-1) — a fake `AgentConfigService` that always resolves to the caller's own `fallback` (the exact real default-passthrough behavior `AgentConfigService.get` documents on itself), so every existing test keeps exercising `LIVE_RUN_GAP_THRESHOLD`'s real default value (60) unchanged. */
function buildFakeAgentConfigService(
  get: AgentConfigService["get"] = vi.fn(
    async (_tenantId: string, _agent: string, _key: string, fallback: number) => fallback,
  ),
): AgentConfigService {
  return { get, set: vi.fn(async () => ({}) as never) } as unknown as AgentConfigService;
}

/** A fake `ConfigApplierService` — defaults to a real, honest no-op ("not a CONFIG_UPDATE item") since every existing test's fake LLM plan only ever proposes a PROMPT_UPDATE item. */
function buildFakeConfigApplier(
  applyConfigUpdate: ConfigApplierService["applyConfigUpdate"] = vi.fn(
    async (_tenantId: string, item: ImprovementItem): Promise<ApplyConfigUpdateResult> => ({
      applied: false,
      reason: `type "${item.type}" is not CONFIG_UPDATE`,
    }),
  ),
): ConfigApplierService {
  return { applyConfigUpdate } as unknown as ConfigApplierService;
}

/** AAOS Self-Improving (Phase SI-2) — the exact `LogicApplierService` sibling of `buildFakeConfigApplier` above, same default-no-op reasoning ("not a LOGIC_UPDATE item"). */
function buildFakeLogicApplier(
  applyLogicUpdate: LogicApplierService["applyLogicUpdate"] = vi.fn(
    async (_tenantId: string, item: ImprovementItem): Promise<ApplyLogicUpdateResult> => ({
      applied: false,
      reason: `type "${item.type}" is not LOGIC_UPDATE`,
    }),
  ),
): LogicApplierService {
  return { applyLogicUpdate } as unknown as LogicApplierService;
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
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
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
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
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
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
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
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
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
          agent_run_id: null,
          agent: "SAMANTHA",
          analysis: "analisa lama",
          gaps: {},
          improvements: [],
          status: "PENDING",
          decided_by: null,
          decision_notes: null,
          decided_at: null,
          created_at: "2026-08-01T00:00:00.000Z",
          auto_applied_config_keys: [],
          self_analysis: null,
        },
      ];
      const proposals = buildFakeProposalRepository(recent);
      const llm = buildFakeLlmService();
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        llm,
        buildFakePromptOverride(),
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
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
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
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
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
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
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
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
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
      );
      await service.onSimulationComplete(stored.id);
      expect(proposals.create).toHaveBeenCalledTimes(1);
      const call = proposals.create as unknown as { mock: { calls: unknown[][] } };
      expect(call.mock.calls[0]?.[0]).not.toHaveProperty("status");
    });
  });

  describe("onAgentRunJudged (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3)", () => {
    function buildService(
      proposals: LearningProposalRepository,
      llm: LlmService = buildFakeLlmService(),
      agentConfig: AgentConfigService = buildFakeAgentConfigService(),
      configApplier: ConfigApplierService = buildFakeConfigApplier(),
      logicApplier: LogicApplierService = buildFakeLogicApplier(),
    ): LearningService {
      return new LearningService(
        buildFakeSimulationRepository(undefined),
        proposals,
        llm,
        buildFakePromptOverride(),
        agentConfig,
        configApplier,
        logicApplier,
      );
    }

    it("writes a real learning_proposals row with agentRunId populated and simulationId undefined when overall is below LIVE_RUN_GAP_THRESHOLD", async () => {
      const proposals = buildFakeProposalRepository();
      const llm = buildFakeLlmService();
      const service = buildService(proposals, llm);

      await service.onAgentRunJudged("dss-motor", "agent-run-1", "CLARA", {
        scores: { overall: 45, outcome_completeness: 40 },
        gaps: [
          {
            dimension: "outcome_completeness",
            issue: "Closing record tidak lengkap",
            suggestion: "Minta cabang & unit model diisi",
          },
        ],
        trend: "DECLINING",
      });

      expect(llm.generateImprovementPlan).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({
          agent: "CLARA",
          currentPromptKey: "clara_system_prompt",
          gap: expect.objectContaining({
            source: "LIVE_RUN",
            agent: "CLARA",
            overallScore: 45,
            trend: "DECLINING",
            feedbackItems: [
              {
                dimension: "outcome_completeness",
                message: "Closing record tidak lengkap — Saran: Minta cabang & unit model diisi",
              },
            ],
          }),
        }),
      );
      expect(proposals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "dss-motor",
          agentRunId: "agent-run-1",
          agent: "CLARA",
        }),
      );
      const call = proposals.create as unknown as { mock: { calls: unknown[][] } };
      expect(call.mock.calls[0]?.[0]).not.toHaveProperty("simulationId");
    });

    it("does NOT write a proposal when overall is at/above LIVE_RUN_GAP_THRESHOLD (no gap)", async () => {
      const proposals = buildFakeProposalRepository();
      const service = buildService(proposals);

      await service.onAgentRunJudged("dss-motor", "agent-run-2", "SAMANTHA", {
        scores: { overall: 60 },
        gaps: [],
        trend: "STABLE",
      });

      expect(proposals.create).not.toHaveBeenCalled();
    });

    it("skips KAI (no known learning-proposal prompt key for it — see this method's own doc)", async () => {
      const proposals = buildFakeProposalRepository();
      const service = buildService(proposals);

      await service.onAgentRunJudged("dss-motor", "agent-run-3", "KAI", {
        scores: { overall: 10 },
        gaps: [],
        trend: "STABLE",
      });

      expect(proposals.create).not.toHaveBeenCalled();
    });

    it("writes nothing when generateImprovementPlan is unavailable", async () => {
      const proposals = buildFakeProposalRepository();
      const llm = buildFakeLlmService({
        generateImprovementPlan: vi.fn(async () => ({
          available: false as const,
          reason: "PROVIDER_ERROR" as const,
          message: "unavailable",
          droppedCount: 0,
        })),
      });
      const service = buildService(proposals, llm);

      await service.onAgentRunJudged("dss-motor", "agent-run-4", "SAMANTHA", {
        scores: { overall: 20 },
        gaps: [],
        trend: "STABLE",
      });

      expect(proposals.create).not.toHaveBeenCalled();
    });

    it("never throws — a proposal-generation failure at this trigger point is caught, logged, and swallowed (must never abort judgeRun/the real agent action above it)", async () => {
      const failingProposals = {
        create: vi.fn(),
        listRecentForTenant: vi.fn(async () => {
          throw new Error("boom");
        }),
      } as unknown as LearningProposalRepository;
      const service = buildService(failingProposals);

      await expect(
        service.onAgentRunJudged("dss-motor", "agent-run-5", "SAMANTHA", {
          scores: { overall: 10 },
          gaps: [],
          trend: "STABLE",
        }),
      ).resolves.toBeUndefined();
      expect(failingProposals.create).not.toHaveBeenCalled();
    });

    describe("AAOS Self-Improving (Phase SI-1) — real, DB-backed live_run_gap_threshold", () => {
      it("resolves the threshold via AgentConfigService.get with the real (tenantId, 'GLOBAL', 'live_run_gap_threshold', 60) args — zero behavior change when no override row exists", async () => {
        const proposals = buildFakeProposalRepository();
        const get = vi.fn(async (_t: string, _a: string, _k: string, fallback: number) => fallback);
        const service = buildService(
          proposals,
          buildFakeLlmService(),
          buildFakeAgentConfigService(get),
        );

        await service.onAgentRunJudged("dss-motor", "agent-run-6", "SAMANTHA", {
          scores: { overall: 45 },
          gaps: [],
          trend: "STABLE",
        });

        expect(get).toHaveBeenCalledWith("dss-motor", "GLOBAL", "live_run_gap_threshold", 60);
        expect(proposals.create).toHaveBeenCalledTimes(1);
      });

      it("a real, DIFFERENT (higher) configured threshold genuinely changes the gap boundary — a run that would NOT trigger under the hardcoded default (60) now DOES", async () => {
        const proposals = buildFakeProposalRepository();
        const llm = buildFakeLlmService();
        const agentConfig = buildFakeAgentConfigService(vi.fn(async () => 70));
        const service = buildService(proposals, llm, agentConfig);

        // overall=65 is >= the hardcoded default (60), so under zero-override behavior this would
        // NOT trigger a proposal (see the sibling "does NOT write..." test above) — but with a
        // real, custom agent_configs row raising the threshold to 70, it now genuinely does.
        await service.onAgentRunJudged("dss-motor", "agent-run-7", "SAMANTHA", {
          scores: { overall: 65 },
          gaps: [],
          trend: "STABLE",
        });

        expect(proposals.create).toHaveBeenCalledTimes(1);
      });
    });

    describe("AAOS Self-Improving (Phase SI-1) — real CONFIG_UPDATE auto-apply, no human gate", () => {
      function buildConfigOnlyLlm(): LlmService {
        return buildFakeLlmService({
          generateImprovementPlan: vi.fn(async () => ({
            available: true as const,
            analysis: "config-only plan",
            improvements: [
              {
                agent: "SAMANTHA" as const,
                type: "CONFIG_UPDATE" as const,
                target: "pause_cpl_multiplier",
                before: "1.5",
                after: "1.8",
                reason: "r",
                severity: "MEDIUM" as const,
              },
            ],
            droppedCount: 0,
          })),
        });
      }

      it("real successful apply: calls ConfigApplierService.applyConfigUpdate and marks the proposal AUTO_APPLIED when every item is a successfully-applied CONFIG_UPDATE", async () => {
        const proposals = buildFakeProposalRepository();
        const applyConfigUpdate = vi.fn(async () => ({ applied: true }));
        const configApplier = buildFakeConfigApplier(applyConfigUpdate);
        const service = buildService(proposals, buildConfigOnlyLlm(), undefined, configApplier);

        await service.onAgentRunJudged("dss-motor", "agent-run-8", "SAMANTHA", {
          scores: { overall: 10 },
          gaps: [],
          trend: "STABLE",
        });

        expect(applyConfigUpdate).toHaveBeenCalledWith(
          "dss-motor",
          expect.objectContaining({ type: "CONFIG_UPDATE", target: "pause_cpl_multiplier" }),
        );
        expect(proposals.markAutoApplied).toHaveBeenCalledWith(
          "proposal-1",
          ["pause_cpl_multiplier"],
          "AUTO_APPLIED",
        );
      });

      it("real write-failure best-effort degrade: never throws, and keeps the proposal PENDING (never records a failed key as auto-applied)", async () => {
        const proposals = buildFakeProposalRepository();
        const applyConfigUpdate = vi.fn(async () => ({ applied: false, reason: "write failed" }));
        const configApplier = buildFakeConfigApplier(applyConfigUpdate);
        const service = buildService(proposals, buildConfigOnlyLlm(), undefined, configApplier);

        await expect(
          service.onAgentRunJudged("dss-motor", "agent-run-9", "SAMANTHA", {
            scores: { overall: 10 },
            gaps: [],
            trend: "STABLE",
          }),
        ).resolves.toBeUndefined();

        expect(proposals.create).toHaveBeenCalledTimes(1);
        expect(proposals.markAutoApplied).not.toHaveBeenCalled();
      });

      it("mixed proposal (one CONFIG_UPDATE auto-applied + one PROMPT_UPDATE still pending) keeps status PENDING while still recording the applied key", async () => {
        const proposals = buildFakeProposalRepository();
        const llm = buildFakeLlmService({
          generateImprovementPlan: vi.fn(async () => ({
            available: true as const,
            analysis: "mixed plan",
            improvements: [
              {
                agent: "SAMANTHA" as const,
                type: "CONFIG_UPDATE" as const,
                target: "pause_cpl_multiplier",
                before: "1.5",
                after: "1.8",
                reason: "r",
                severity: "MEDIUM" as const,
              },
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
        });
        const applyConfigUpdate = vi.fn(async () => ({ applied: true }));
        const configApplier = buildFakeConfigApplier(applyConfigUpdate);
        const service = buildService(proposals, llm, undefined, configApplier);

        await service.onAgentRunJudged("dss-motor", "agent-run-10", "SAMANTHA", {
          scores: { overall: 10 },
          gaps: [],
          trend: "STABLE",
        });

        expect(applyConfigUpdate).toHaveBeenCalledTimes(1);
        expect(proposals.markAutoApplied).toHaveBeenCalledWith(
          "proposal-1",
          ["pause_cpl_multiplier"],
          "PENDING",
        );
      });

      it("never calls applyConfigUpdate for a plan with no CONFIG_UPDATE items (e.g. the default fake PROMPT_UPDATE-only plan)", async () => {
        const proposals = buildFakeProposalRepository();
        const applyConfigUpdate = vi.fn(async () => ({ applied: true }));
        const configApplier = buildFakeConfigApplier(applyConfigUpdate);
        const service = buildService(proposals, buildFakeLlmService(), undefined, configApplier);

        await service.onAgentRunJudged("dss-motor", "agent-run-11", "SAMANTHA", {
          scores: { overall: 10 },
          gaps: [],
          trend: "STABLE",
        });

        expect(applyConfigUpdate).not.toHaveBeenCalled();
        expect(proposals.markAutoApplied).not.toHaveBeenCalled();
      });

      it("real best-effort discipline: the whole auto-apply step never fails onAgentRunJudged even if markAutoApplied itself throws", async () => {
        const proposals = buildFakeProposalRepository();
        (proposals.markAutoApplied as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new Error("boom"),
        );
        const applyConfigUpdate = vi.fn(async () => ({ applied: true }));
        const configApplier = buildFakeConfigApplier(applyConfigUpdate);
        const service = buildService(proposals, buildConfigOnlyLlm(), undefined, configApplier);

        await expect(
          service.onAgentRunJudged("dss-motor", "agent-run-12", "SAMANTHA", {
            scores: { overall: 10 },
            gaps: [],
            trend: "STABLE",
          }),
        ).resolves.toBeUndefined();
        expect(proposals.create).toHaveBeenCalledTimes(1);
      });
    });

    describe("AAOS Self-Improving (Phase SI-2) — real LOGIC_UPDATE auto-apply, no human gate", () => {
      const LOGIC_DEFINITION_JSON = JSON.stringify([
        { conditions: [{ field: "frequency", operator: "gte", value: 4 }], result: "REFRESH" },
      ]);

      function buildLogicOnlyLlm(): LlmService {
        return buildFakeLlmService({
          generateImprovementPlan: vi.fn(async () => ({
            available: true as const,
            analysis: "logic-only plan",
            improvements: [
              {
                agent: "SAMANTHA" as const,
                type: "LOGIC_UPDATE" as const,
                target: "verdict_classification",
                before: "[]",
                after: LOGIC_DEFINITION_JSON,
                reason: "r",
                severity: "MEDIUM" as const,
              },
            ],
            droppedCount: 0,
          })),
        });
      }

      it("real successful apply: calls LogicApplierService.applyLogicUpdate and marks the proposal AUTO_APPLIED when every item is a successfully-applied LOGIC_UPDATE", async () => {
        const proposals = buildFakeProposalRepository();
        const applyLogicUpdate = vi.fn(async () => ({ applied: true }));
        const logicApplier = buildFakeLogicApplier(applyLogicUpdate);
        const service = buildService(
          proposals,
          buildLogicOnlyLlm(),
          undefined,
          undefined,
          logicApplier,
        );

        await service.onAgentRunJudged("dss-motor", "agent-run-13", "SAMANTHA", {
          scores: { overall: 10 },
          gaps: [],
          trend: "STABLE",
        });

        expect(applyLogicUpdate).toHaveBeenCalledWith(
          "dss-motor",
          expect.objectContaining({ type: "LOGIC_UPDATE", target: "verdict_classification" }),
        );
        expect(proposals.markAutoApplied).toHaveBeenCalledWith(
          "proposal-1",
          ["verdict_classification"],
          "AUTO_APPLIED",
        );
      });

      it("real write-failure best-effort degrade: never throws, and keeps the proposal PENDING (never records a failed key as auto-applied)", async () => {
        const proposals = buildFakeProposalRepository();
        const applyLogicUpdate = vi.fn(async () => ({ applied: false, reason: "write failed" }));
        const logicApplier = buildFakeLogicApplier(applyLogicUpdate);
        const service = buildService(
          proposals,
          buildLogicOnlyLlm(),
          undefined,
          undefined,
          logicApplier,
        );

        await expect(
          service.onAgentRunJudged("dss-motor", "agent-run-14", "SAMANTHA", {
            scores: { overall: 10 },
            gaps: [],
            trend: "STABLE",
          }),
        ).resolves.toBeUndefined();

        expect(proposals.create).toHaveBeenCalledTimes(1);
        expect(proposals.markAutoApplied).not.toHaveBeenCalled();
      });

      it("mixed proposal (one CONFIG_UPDATE + one LOGIC_UPDATE, both auto-applied) marks AUTO_APPLIED and records both keys", async () => {
        const proposals = buildFakeProposalRepository();
        const llm = buildFakeLlmService({
          generateImprovementPlan: vi.fn(async () => ({
            available: true as const,
            analysis: "mixed config+logic plan",
            improvements: [
              {
                agent: "SAMANTHA" as const,
                type: "CONFIG_UPDATE" as const,
                target: "pause_cpl_multiplier",
                before: "1.5",
                after: "1.8",
                reason: "r",
                severity: "MEDIUM" as const,
              },
              {
                agent: "SAMANTHA" as const,
                type: "LOGIC_UPDATE" as const,
                target: "verdict_classification",
                before: "[]",
                after: LOGIC_DEFINITION_JSON,
                reason: "r",
                severity: "MEDIUM" as const,
              },
            ],
            droppedCount: 0,
          })),
        });
        const applyConfigUpdate = vi.fn(async () => ({ applied: true }));
        const applyLogicUpdate = vi.fn(async () => ({ applied: true }));
        const configApplier = buildFakeConfigApplier(applyConfigUpdate);
        const logicApplier = buildFakeLogicApplier(applyLogicUpdate);
        const service = buildService(proposals, llm, undefined, configApplier, logicApplier);

        await service.onAgentRunJudged("dss-motor", "agent-run-15", "SAMANTHA", {
          scores: { overall: 10 },
          gaps: [],
          trend: "STABLE",
        });

        expect(applyConfigUpdate).toHaveBeenCalledTimes(1);
        expect(applyLogicUpdate).toHaveBeenCalledTimes(1);
        expect(proposals.markAutoApplied).toHaveBeenCalledWith(
          "proposal-1",
          ["pause_cpl_multiplier", "verdict_classification"],
          "AUTO_APPLIED",
        );
      });

      it("never calls applyLogicUpdate for a plan with no LOGIC_UPDATE items (e.g. the default fake PROMPT_UPDATE-only plan)", async () => {
        const proposals = buildFakeProposalRepository();
        const applyLogicUpdate = vi.fn(async () => ({ applied: true }));
        const logicApplier = buildFakeLogicApplier(applyLogicUpdate);
        const service = buildService(
          proposals,
          buildFakeLlmService(),
          undefined,
          undefined,
          logicApplier,
        );

        await service.onAgentRunJudged("dss-motor", "agent-run-16", "SAMANTHA", {
          scores: { overall: 10 },
          gaps: [],
          trend: "STABLE",
        });

        expect(applyLogicUpdate).not.toHaveBeenCalled();
        expect(proposals.markAutoApplied).not.toHaveBeenCalled();
      });
    });
  });

  describe("AAOS Self-Improving (Phase SI-3) — real Self-Analyzer wiring, best-effort", () => {
    function buildLlmWithSelfAnalysis(
      selfAnalyze: LlmService["selfAnalyze"] = vi.fn(async () => ({
        available: true as const,
        rootCauses: ["Ringkasan sering kosong"],
        patterns: "Ini proposal pertama untuk tenant ini.",
        confidence: 0.6,
      })),
    ): LlmService {
      return buildFakeLlmService({ selfAnalyze });
    }

    it("onSimulationComplete: calls selfAnalyze BEFORE generateImprovementPlan with the SAME real gap/prompt/history context, then feeds its real output into generateImprovementPlan's body.selfAnalysis and persists it on the proposal row", async () => {
      const stored = buildStored({
        scoring: {
          verdict: "NO-GO",
          samanthaCoverageScore: SIMULATION_CRITERIA.minSamanthaScore - 1,
        },
      });
      const proposals = buildFakeProposalRepository();
      const selfAnalyze = vi.fn(async () => ({
        available: true as const,
        rootCauses: ["Ringkasan sering kosong pada respons Samantha"],
        patterns: "Ini proposal pertama untuk tenant ini.",
        confidence: 0.6,
      }));
      const llm = buildLlmWithSelfAnalysis(selfAnalyze);
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        llm,
        buildFakePromptOverride(),
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
      );
      await service.onSimulationComplete(stored.id);

      expect(selfAnalyze).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({ tenantId: "dss-motor", currentPromptKey: "analyze" }),
      );
      // Real call ORDER: selfAnalyze must be invoked before generateImprovementPlan for this to be
      // a genuine "ask why, then ask what to change" sequence, not a fire-and-forget side call.
      const selfAnalyzeOrder = (
        selfAnalyze as unknown as { mock: { invocationCallOrder: number[] } }
      ).mock.invocationCallOrder[0];
      const planOrder = (
        llm.generateImprovementPlan as unknown as { mock: { invocationCallOrder: number[] } }
      ).mock.invocationCallOrder[0];
      expect(selfAnalyzeOrder).toBeLessThan(planOrder as number);

      expect(llm.generateImprovementPlan).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({
          selfAnalysis: {
            rootCauses: ["Ringkasan sering kosong pada respons Samantha"],
            patterns: "Ini proposal pertama untuk tenant ini.",
            confidence: 0.6,
          },
        }),
      );
      expect(proposals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          selfAnalysis: {
            rootCauses: ["Ringkasan sering kosong pada respons Samantha"],
            patterns: "Ini proposal pertama untuk tenant ini.",
            confidence: 0.6,
          },
        }),
      );
    });

    it("onSimulationComplete: real degrade — a selfAnalyze available:false response never blocks proposal generation, body.selfAnalysis is simply omitted", async () => {
      const stored = buildStored({ scoring: { verdict: "NO-GO" } });
      const proposals = buildFakeProposalRepository();
      const llm = buildFakeLlmService(); // default fake selfAnalyze already returns available:false
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        llm,
        buildFakePromptOverride(),
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
      );
      await service.onSimulationComplete(stored.id);

      expect(llm.generateImprovementPlan).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({ selfAnalysis: undefined }),
      );
      expect(proposals.create).toHaveBeenCalledWith(
        expect.objectContaining({ selfAnalysis: undefined }),
      );
      // The proposal itself still gets created — self-analysis unavailability is never a gate.
      expect(proposals.create).toHaveBeenCalledTimes(1);
    });

    it("onSimulationComplete: real degrade — selfAnalyze THROWING never blocks proposal generation (caught, logged, swallowed, proposal still created)", async () => {
      const stored = buildStored({ scoring: { verdict: "NO-GO" } });
      const proposals = buildFakeProposalRepository();
      const llm = buildFakeLlmService({
        selfAnalyze: vi.fn(async () => {
          throw new Error("boom");
        }),
      });
      const service = new LearningService(
        buildFakeSimulationRepository(stored),
        proposals,
        llm,
        buildFakePromptOverride(),
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
      );

      await expect(service.onSimulationComplete(stored.id)).resolves.toBeUndefined();

      expect(llm.generateImprovementPlan).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({ selfAnalysis: undefined }),
      );
      expect(proposals.create).toHaveBeenCalledTimes(1);
    });

    it("onAgentRunJudged: real successful self-analysis flows into generateImprovementPlan's body.selfAnalysis and the persisted proposal row", async () => {
      const proposals = buildFakeProposalRepository();
      const selfAnalyze = vi.fn(async () => ({
        available: true as const,
        rootCauses: ["Trend menurun pada dimensi outcome_completeness"],
        patterns: "Belum ada proposal sebelumnya untuk tenant ini.",
        confidence: 0.5,
      }));
      const llm = buildLlmWithSelfAnalysis(selfAnalyze);
      const service = new LearningService(
        buildFakeSimulationRepository(undefined),
        proposals,
        llm,
        buildFakePromptOverride(),
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
      );

      await service.onAgentRunJudged("dss-motor", "agent-run-si3-1", "CLARA", {
        scores: { overall: 40 },
        gaps: [],
        trend: "DECLINING",
      });

      expect(selfAnalyze).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({ agent: "CLARA", currentPromptKey: "clara_system_prompt" }),
      );
      expect(llm.generateImprovementPlan).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({
          selfAnalysis: {
            rootCauses: ["Trend menurun pada dimensi outcome_completeness"],
            patterns: "Belum ada proposal sebelumnya untuk tenant ini.",
            confidence: 0.5,
          },
        }),
      );
      expect(proposals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          selfAnalysis: {
            rootCauses: ["Trend menurun pada dimensi outcome_completeness"],
            patterns: "Belum ada proposal sebelumnya untuk tenant ini.",
            confidence: 0.5,
          },
        }),
      );
    });

    it("onAgentRunJudged: real degrade — selfAnalyze unavailable never blocks proposal generation", async () => {
      const proposals = buildFakeProposalRepository();
      const llm = buildFakeLlmService(); // default fake selfAnalyze returns available:false
      const service = new LearningService(
        buildFakeSimulationRepository(undefined),
        proposals,
        llm,
        buildFakePromptOverride(),
        buildFakeAgentConfigService(),
        buildFakeConfigApplier(),
        buildFakeLogicApplier(),
      );

      await service.onAgentRunJudged("dss-motor", "agent-run-si3-2", "SAMANTHA", {
        scores: { overall: 20 },
        gaps: [],
        trend: "STABLE",
      });

      expect(proposals.create).toHaveBeenCalledTimes(1);
      expect(proposals.create).toHaveBeenCalledWith(
        expect.objectContaining({ selfAnalysis: undefined }),
      );
    });
  });
});
