import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { AgentConfigService } from "../agent-config/agent-config.service.js";
import type { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { LearningProposalRow } from "./infrastructure/learning-proposal.repository.js";
import type { LearningDecisionService } from "./learning-decision.service.js";
import { LearningController } from "./learning.controller.js";
import type { LearningService } from "./learning.service.js";

const PROPOSAL_ROW: LearningProposalRow = {
  id: "proposal-1",
  tenant_id: "dss-motor",
  simulation_id: "sim-1",
  agent_run_id: null,
  agent: "SAMANTHA",
  analysis: "analisa nyata",
  gaps: { verdict: "NO-GO" },
  improvements: [],
  status: "PENDING",
  decided_by: null,
  decision_notes: null,
  decided_at: null,
  created_at: "2026-08-01T00:00:00.000Z",
  auto_applied_config_keys: [],
  sandbox_blocked_items: [],
  self_analysis: null,
  accuracy_verdict: null,
  accuracy_reason: null,
  accuracy_score_before: null,
  accuracy_score_after: null,
  accuracy_sample_before: null,
  accuracy_sample_after: null,
  accuracy_checked_at: null,
};

function buildFakeDecisions(): LearningDecisionService {
  return {
    listProposals: vi.fn(async () => [PROPOSAL_ROW]),
    getProposal: vi.fn(async () => PROPOSAL_ROW),
    approve: vi.fn(async () => ({ ...PROPOSAL_ROW, status: "APPROVED", decided_by: "m@x.id" })),
    reject: vi.fn(async () => ({ ...PROPOSAL_ROW, status: "REJECTED" })),
    rollback: vi.fn(async () => ({ rolledBackToVersion: 1 })),
    listActiveOverrides: vi.fn(async () => []),
  } as unknown as LearningDecisionService;
}

/** AAOS Self-Improving, Phase SI-6 — real, minimal fakes for the 3 new real dependencies this controller now takes (`LearningService`/`AgentConfigService`/`JudgeResultRepository`), unused by the pre-existing tests below but required to construct the controller at all. */
function buildFakeLearning(): LearningService {
  return {
    triggerManualCheck: vi.fn(async () => ({ triggered: false, reason: "unused in these tests" })),
  } as unknown as LearningService;
}
function buildFakeAgentConfig(): AgentConfigService {
  return {
    listForTenant: vi.fn(async () => []),
    set: vi.fn(),
  } as unknown as AgentConfigService;
}
function buildFakeJudgeResults(): JudgeResultRepository {
  return {
    listForTenantSince: vi.fn(async () => []),
  } as unknown as JudgeResultRepository;
}

describe("LearningController", () => {
  it("GET proposals delegates to LearningDecisionService.listProposals, tenant-scoped, camelCase-mapped", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(
      decisions,
      buildFakeLearning(),
      buildFakeAgentConfig(),
      buildFakeJudgeResults(),
    );
    const result = await controller.listProposals("dss-motor", "PENDING");
    expect(decisions.listProposals).toHaveBeenCalledWith("dss-motor", "PENDING");
    expect(result).toEqual([
      {
        id: "proposal-1",
        tenantId: "dss-motor",
        simulationId: "sim-1",
        agentRunId: null,
        agent: "SAMANTHA",
        analysis: "analisa nyata",
        gaps: { verdict: "NO-GO" },
        improvements: [],
        status: "PENDING",
        decidedBy: null,
        decisionNotes: null,
        decidedAt: null,
        createdAt: "2026-08-01T00:00:00.000Z",
        accuracyVerdict: null,
        accuracyReason: null,
        accuracyScoreBefore: null,
        accuracyScoreAfter: null,
        accuracySampleBefore: null,
        accuracySampleAfter: null,
        accuracyCheckedAt: null,
      },
    ]);
  });

  it("GET proposals/:id delegates to LearningDecisionService.getProposal", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(
      decisions,
      buildFakeLearning(),
      buildFakeAgentConfig(),
      buildFakeJudgeResults(),
    );
    const result = await controller.getProposal("proposal-1");
    expect(decisions.getProposal).toHaveBeenCalledWith("proposal-1");
    expect(result.id).toBe("proposal-1");
  });

  it("POST proposals/:id/approve delegates to LearningDecisionService.approve with decidedBy/decisionNotes", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(
      decisions,
      buildFakeLearning(),
      buildFakeAgentConfig(),
      buildFakeJudgeResults(),
    );
    const result = await controller.approve("proposal-1", {
      decidedBy: "m@x.id",
      decisionNotes: "Setuju",
    });
    expect(decisions.approve).toHaveBeenCalledWith("proposal-1", "m@x.id", "Setuju");
    expect(result.status).toBe("APPROVED");
  });

  it("POST proposals/:id/reject delegates to LearningDecisionService.reject", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(
      decisions,
      buildFakeLearning(),
      buildFakeAgentConfig(),
      buildFakeJudgeResults(),
    );
    const result = await controller.reject("proposal-1", {
      decidedBy: undefined,
      decisionNotes: undefined,
    });
    expect(decisions.reject).toHaveBeenCalledWith("proposal-1", undefined, undefined);
    expect(result.status).toBe("REJECTED");
  });

  it("GET prompt-overrides/:tenantId/active delegates to LearningDecisionService.listActiveOverrides", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(
      decisions,
      buildFakeLearning(),
      buildFakeAgentConfig(),
      buildFakeJudgeResults(),
    );
    const result = await controller.listActiveOverrides("dss-motor");
    expect(decisions.listActiveOverrides).toHaveBeenCalledWith("dss-motor");
    expect(result).toEqual([]);
  });

  it("POST prompt-overrides/:tenantId/:agent/:promptKey/rollback delegates to LearningDecisionService.rollback", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(
      decisions,
      buildFakeLearning(),
      buildFakeAgentConfig(),
      buildFakeJudgeResults(),
    );
    const result = await controller.rollback("dss-motor", "SAMANTHA", "analyze");
    expect(decisions.rollback).toHaveBeenCalledWith("dss-motor", "SAMANTHA", "analyze");
    expect(result).toEqual({ rolledBackToVersion: 1 });
  });

  it("POST trigger delegates to LearningService.triggerManualCheck, tenant-scoped", async () => {
    const learning = buildFakeLearning();
    const controller = new LearningController(
      buildFakeDecisions(),
      learning,
      buildFakeAgentConfig(),
      buildFakeJudgeResults(),
    );
    const result = await controller.trigger("dss-motor", { agent: "SAMANTHA" });
    expect(learning.triggerManualCheck).toHaveBeenCalledWith("dss-motor", "SAMANTHA");
    expect(result).toEqual({ triggered: false, reason: "unused in these tests" });
  });

  it("GET configs delegates to AgentConfigService.listForTenant, tenant-scoped, camelCase-mapped", async () => {
    const agentConfig = buildFakeAgentConfig();
    (agentConfig.listForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "cfg-1",
        tenant_id: "dss-motor",
        agent: "GLOBAL",
        config_key: "live_run_gap_threshold",
        value: "60",
        data_type: "number",
        description: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
        updated_by: null,
      },
    ]);
    const controller = new LearningController(
      buildFakeDecisions(),
      buildFakeLearning(),
      agentConfig,
      buildFakeJudgeResults(),
    );
    const result = await controller.listConfigs("dss-motor");
    expect(agentConfig.listForTenant).toHaveBeenCalledWith("dss-motor");
    expect(result).toEqual([
      {
        id: "cfg-1",
        tenantId: "dss-motor",
        agent: "GLOBAL",
        configKey: "live_run_gap_threshold",
        value: "60",
        dataType: "number",
        description: null,
        updatedAt: "2026-08-01T00:00:00.000Z",
        updatedBy: null,
      },
    ]);
  });

  it("PUT configs delegates to AgentConfigService.set, tenant-scoped", async () => {
    const agentConfig = buildFakeAgentConfig();
    (agentConfig.set as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cfg-1",
      tenant_id: "dss-motor",
      agent: "GLOBAL",
      config_key: "live_run_gap_threshold",
      value: "55",
      data_type: "number",
      description: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-02T00:00:00.000Z",
      updated_by: "m@x.id",
    });
    const controller = new LearningController(
      buildFakeDecisions(),
      buildFakeLearning(),
      agentConfig,
      buildFakeJudgeResults(),
    );
    const result = await controller.setConfig("dss-motor", {
      agent: "GLOBAL",
      configKey: "live_run_gap_threshold",
      value: 55,
      updatedBy: "m@x.id",
    });
    expect(agentConfig.set).toHaveBeenCalledWith(
      "dss-motor",
      "GLOBAL",
      "live_run_gap_threshold",
      55,
      "m@x.id",
    );
    expect(result.value).toBe("55");
  });

  it("GET judge-history delegates to JudgeResultRepository.listForTenantSince, tenant-scoped, camelCase-mapped", async () => {
    const judgeResults = buildFakeJudgeResults();
    (judgeResults.listForTenantSince as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "jr-1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        run_id: "run-1",
        scores: { overall: 82 },
        strengths: [],
        gaps: [],
        notes: null,
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ]);
    const controller = new LearningController(
      buildFakeDecisions(),
      buildFakeLearning(),
      buildFakeAgentConfig(),
      judgeResults,
    );
    const result = await controller.judgeHistory("dss-motor", "SAMANTHA", "30");
    expect(judgeResults.listForTenantSince).toHaveBeenCalledWith(
      "dss-motor",
      "SAMANTHA",
      expect.any(String),
    );
    expect(result).toEqual([{ createdAt: "2026-08-01T00:00:00.000Z", overall: 82 }]);
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", LearningController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
