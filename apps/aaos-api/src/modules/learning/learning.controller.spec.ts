import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { LearningProposalRow } from "./infrastructure/learning-proposal.repository.js";
import type { LearningDecisionService } from "./learning-decision.service.js";
import { LearningController } from "./learning.controller.js";

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

describe("LearningController", () => {
  it("GET proposals delegates to LearningDecisionService.listProposals, tenant-scoped, camelCase-mapped", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(decisions);
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
      },
    ]);
  });

  it("GET proposals/:id delegates to LearningDecisionService.getProposal", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(decisions);
    const result = await controller.getProposal("proposal-1");
    expect(decisions.getProposal).toHaveBeenCalledWith("proposal-1");
    expect(result.id).toBe("proposal-1");
  });

  it("POST proposals/:id/approve delegates to LearningDecisionService.approve with decidedBy/decisionNotes", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(decisions);
    const result = await controller.approve("proposal-1", {
      decidedBy: "m@x.id",
      decisionNotes: "Setuju",
    });
    expect(decisions.approve).toHaveBeenCalledWith("proposal-1", "m@x.id", "Setuju");
    expect(result.status).toBe("APPROVED");
  });

  it("POST proposals/:id/reject delegates to LearningDecisionService.reject", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(decisions);
    const result = await controller.reject("proposal-1", {
      decidedBy: undefined,
      decisionNotes: undefined,
    });
    expect(decisions.reject).toHaveBeenCalledWith("proposal-1", undefined, undefined);
    expect(result.status).toBe("REJECTED");
  });

  it("GET prompt-overrides/:tenantId/active delegates to LearningDecisionService.listActiveOverrides", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(decisions);
    const result = await controller.listActiveOverrides("dss-motor");
    expect(decisions.listActiveOverrides).toHaveBeenCalledWith("dss-motor");
    expect(result).toEqual([]);
  });

  it("POST prompt-overrides/:tenantId/:agent/:promptKey/rollback delegates to LearningDecisionService.rollback", async () => {
    const decisions = buildFakeDecisions();
    const controller = new LearningController(decisions);
    const result = await controller.rollback("dss-motor", "SAMANTHA", "analyze");
    expect(decisions.rollback).toHaveBeenCalledWith("dss-motor", "SAMANTHA", "analyze");
    expect(result).toEqual({ rolledBackToVersion: 1 });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", LearningController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
