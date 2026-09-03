import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import { LearningProposalRepository } from "../learning/infrastructure/learning-proposal.repository.js";

import { JudgeMemoryService } from "./judge-memory.service.js";

const TENANT_ID = "dss-motor";

function buildService(
  client: ReturnType<typeof createFakeSupabaseClient> = createFakeSupabaseClient(),
): {
  readonly client: ReturnType<typeof createFakeSupabaseClient>;
  readonly service: JudgeMemoryService;
} {
  return {
    client,
    service: new JudgeMemoryService(
      new JudgeResultRepository(client),
      new LearningProposalRepository(client),
    ),
  };
}

function seedJudgeResult(
  client: ReturnType<typeof createFakeSupabaseClient>,
  id: string,
  overall: number,
  createdAt: string,
  agent = "SAMANTHA",
): void {
  client.seed("judge_results", {
    id,
    tenant_id: TENANT_ID,
    agent,
    run_id: `run-${id}`,
    scores: { overall },
    strengths: [],
    gaps: [],
    notes: "n",
    created_at: createdAt,
  });
}

function seedProposal(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Record<string, unknown>,
): void {
  client.seed("learning_proposals", {
    id: `proposal-${Math.random()}`,
    tenant_id: TENANT_ID,
    simulation_id: "sim-1",
    agent_run_id: null,
    agent: "SAMANTHA",
    analysis: "a",
    gaps: {},
    improvements: [],
    status: "PENDING",
    decided_by: null,
    decision_notes: null,
    decided_at: null,
    auto_applied_config_keys: [],
    self_analysis: null,
    ...overrides,
  });
}

describe("JudgeMemoryService.build", () => {
  describe("sparse-data honest degrade (per this phase's own coordinator instruction — never fabricate)", () => {
    it("returns real, honest empty arrays and a null average when the tenant+agent has no history at all", async () => {
      const { service } = buildService();
      const memory = await service.build(TENANT_ID, "SAMANTHA");
      expect(memory).toEqual({
        recent: [],
        averageOverall: null,
        appliedProposals: [],
        knownPatterns: [],
      });
    });

    it("returns real recent/averageOverall but empty appliedProposals/knownPatterns when there is judge history but no applied proposal yet", async () => {
      const { client, service } = buildService();
      seedJudgeResult(client, "j1", 60, "2026-08-01T00:00:00.000Z");
      seedJudgeResult(client, "j2", 80, "2026-08-02T00:00:00.000Z");

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.recent).toEqual([
        { createdAt: "2026-08-01T00:00:00.000Z", overall: 60 },
        { createdAt: "2026-08-02T00:00:00.000Z", overall: 80 },
      ]);
      expect(memory.averageOverall).toBe(70);
      expect(memory.appliedProposals).toEqual([]);
      expect(memory.knownPatterns).toEqual([]);
    });
  });

  describe("real appliedProposals aggregation (computed only from the same recent judge_results window)", () => {
    it("computes a real IMPROVED trend by partitioning recent judge_results around the proposal's own created_at", async () => {
      const { client, service } = buildService();
      seedJudgeResult(client, "j1", 50, "2026-08-01T00:00:00.000Z");
      seedJudgeResult(client, "j2", 55, "2026-08-02T00:00:00.000Z");
      seedJudgeResult(client, "j3", 90, "2026-08-04T00:00:00.000Z");
      seedJudgeResult(client, "j4", 92, "2026-08-05T00:00:00.000Z");
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "AUTO_APPLIED",
        auto_applied_config_keys: ["pause_cpl_multiplier"],
        created_at: "2026-08-03T00:00:00.000Z",
      });

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.appliedProposals).toEqual([
        {
          createdAt: "2026-08-03T00:00:00.000Z",
          appliedTargets: ["pause_cpl_multiplier"],
          scoreBefore: 52.5,
          scoreAfter: 91,
          trend: "IMPROVED",
        },
      ]);
    });

    it("computes a real DECLINED trend the same honest way", async () => {
      const { client, service } = buildService();
      seedJudgeResult(client, "j1", 90, "2026-08-01T00:00:00.000Z");
      seedJudgeResult(client, "j2", 40, "2026-08-04T00:00:00.000Z");
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "AUTO_APPLIED",
        auto_applied_config_keys: ["pause_cpl_multiplier"],
        created_at: "2026-08-02T00:00:00.000Z",
      });

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.appliedProposals[0]?.trend).toBe("DECLINED");
    });

    it("reports trend UNKNOWN (never a guessed direction) when one side of the partition has zero real rows", async () => {
      const { client, service } = buildService();
      seedJudgeResult(client, "j1", 70, "2026-08-05T00:00:00.000Z");
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "AUTO_APPLIED",
        auto_applied_config_keys: ["pause_cpl_multiplier"],
        created_at: "2026-08-01T00:00:00.000Z",
      });

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.appliedProposals[0]).toMatchObject({ scoreBefore: null, trend: "UNKNOWN" });
    });

    it("counts a human-APPROVED proposal's real PROMPT_UPDATE targets from improvements[] (auto_applied_config_keys is never populated by that path)", async () => {
      const { client, service } = buildService();
      seedJudgeResult(client, "j1", 60, "2026-08-01T00:00:00.000Z");
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "APPROVED",
        auto_applied_config_keys: [],
        created_at: "2026-08-02T00:00:00.000Z",
        improvements: [
          {
            agent: "SAMANTHA",
            type: "PROMPT_UPDATE",
            target: "analyze",
            before: "b",
            after: "a",
            reason: "r",
            severity: "MEDIUM",
          },
        ],
      });

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.appliedProposals[0]?.appliedTargets).toEqual(["analyze"]);
    });

    it("never counts a plain PENDING or REJECTED proposal (nothing was genuinely applied)", async () => {
      const { client, service } = buildService();
      seedJudgeResult(client, "j1", 60, "2026-08-01T00:00:00.000Z");
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "PENDING",
        created_at: "2026-08-02T00:00:00.000Z",
      });
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "REJECTED",
        created_at: "2026-08-03T00:00:00.000Z",
      });

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.appliedProposals).toEqual([]);
    });

    it("caps appliedProposals at the 3 most recent real applied proposals", async () => {
      const { client, service } = buildService();
      seedJudgeResult(client, "j1", 60, "2026-08-01T00:00:00.000Z");
      for (let i = 1; i <= 5; i += 1) {
        seedProposal(client, {
          agent: "SAMANTHA",
          status: "AUTO_APPLIED",
          auto_applied_config_keys: [`key-${i}`],
          created_at: `2026-08-0${i + 1}T00:00:00.000Z`,
        });
      }

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.appliedProposals).toHaveLength(3);
      expect(memory.appliedProposals?.map((p) => p.appliedTargets[0])).toEqual([
        "key-3",
        "key-4",
        "key-5",
      ]);
    });
  });

  describe("real knownPatterns (deduplicated self_analysis.patterns from applied proposals only)", () => {
    it("surfaces a real, deduplicated pattern from an applied proposal's self_analysis", async () => {
      const { client, service } = buildService();
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "AUTO_APPLIED",
        auto_applied_config_keys: ["pause_cpl_multiplier"],
        created_at: "2026-08-01T00:00:00.000Z",
        self_analysis: {
          rootCauses: [],
          patterns: "Coverage rendah pada campaign baru.",
          confidence: 0.5,
        },
      });
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "AUTO_APPLIED",
        auto_applied_config_keys: ["live_run_gap_threshold"],
        created_at: "2026-08-02T00:00:00.000Z",
        self_analysis: {
          rootCauses: [],
          patterns: "Coverage rendah pada campaign baru.",
          confidence: 0.5,
        },
      });

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.knownPatterns).toEqual(["Coverage rendah pada campaign baru."]);
    });

    it("never surfaces a pattern from a proposal that was never applied", async () => {
      const { client, service } = buildService();
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "PENDING",
        created_at: "2026-08-01T00:00:00.000Z",
        self_analysis: {
          rootCauses: [],
          patterns: "Belum diterapkan — jangan dianggap known-good.",
          confidence: 0.5,
        },
      });

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.knownPatterns).toEqual([]);
    });

    it("never fabricates a pattern for an applied proposal with no real self_analysis", async () => {
      const { client, service } = buildService();
      seedProposal(client, {
        agent: "SAMANTHA",
        status: "AUTO_APPLIED",
        auto_applied_config_keys: ["pause_cpl_multiplier"],
        created_at: "2026-08-01T00:00:00.000Z",
        self_analysis: null,
      });

      const memory = await service.build(TENANT_ID, "SAMANTHA");

      expect(memory.knownPatterns).toEqual([]);
    });
  });

  it("scopes strictly by tenant+agent — never leaks another tenant's or agent's proposals/judge_results", async () => {
    const { client, service } = buildService();
    seedJudgeResult(client, "j-other-agent", 10, "2026-08-01T00:00:00.000Z", "CLARA");
    seedProposal(client, {
      agent: "CLARA",
      status: "AUTO_APPLIED",
      auto_applied_config_keys: ["should-not-appear"],
      created_at: "2026-08-01T00:00:00.000Z",
    });
    seedProposal(client, {
      tenant_id: "other-tenant",
      agent: "SAMANTHA",
      status: "AUTO_APPLIED",
      auto_applied_config_keys: ["should-not-appear-either"],
      created_at: "2026-08-01T00:00:00.000Z",
    });

    const memory = await service.build(TENANT_ID, "SAMANTHA");

    expect(memory.recent).toEqual([]);
    expect(memory.appliedProposals).toEqual([]);
  });
});
