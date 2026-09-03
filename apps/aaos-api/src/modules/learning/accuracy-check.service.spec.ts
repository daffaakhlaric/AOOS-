import { describe, expect, it } from "vitest";

import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../test-support/fake-supabase-client.js";
import { AgentConfigService } from "../agent-config/agent-config.service.js";
import { AgentConfigRepository } from "../agent-config/infrastructure/agent-config.repository.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";

import { AccuracyCheckService } from "./accuracy-check.service.js";
import { LearningProposalRepository } from "./infrastructure/learning-proposal.repository.js";

const FIXED_NOW = new Date("2026-09-03T12:00:00.000Z");

function seedProposal(
  client: FakeSupabaseClient,
  overrides: Partial<{
    id: string;
    tenant_id: string;
    agent: string;
    status: string;
    created_at: string;
    accuracy_verdict: string | null;
  }> = {},
): void {
  client.seed("learning_proposals", {
    id: overrides.id ?? "proposal-1",
    tenant_id: overrides.tenant_id ?? "dss-motor",
    simulation_id: null,
    agent_run_id: "agent-run-1",
    agent: overrides.agent ?? "SAMANTHA",
    analysis: "analisa nyata",
    gaps: {},
    improvements: [],
    status: overrides.status ?? "AUTO_APPLIED",
    decided_by: null,
    decision_notes: null,
    decided_at: null,
    created_at: overrides.created_at ?? "2026-08-15T00:00:00.000Z",
    auto_applied_config_keys: ["analyze"],
    sandbox_blocked_items: [],
    self_analysis: null,
    accuracy_verdict: overrides.accuracy_verdict ?? null,
    accuracy_reason: null,
    accuracy_score_before: null,
    accuracy_score_after: null,
    accuracy_sample_before: null,
    accuracy_sample_after: null,
    accuracy_checked_at: null,
  });
}

function seedJudgeResult(
  client: FakeSupabaseClient,
  overrides: { tenant_id?: string; agent?: string; created_at: string; overall: number },
): void {
  client.seed("judge_results", {
    id: `jr-${overrides.created_at}`,
    tenant_id: overrides.tenant_id ?? "dss-motor",
    agent: overrides.agent ?? "SAMANTHA",
    run_id: `run-${overrides.created_at}`,
    scores: { overall: overrides.overall },
    strengths: [],
    gaps: [],
    notes: null,
    created_at: overrides.created_at,
  });
}

function buildService(client: FakeSupabaseClient): AccuracyCheckService {
  return new AccuracyCheckService(
    new LearningProposalRepository(client),
    new JudgeResultRepository(client),
    new AgentConfigService(new AgentConfigRepository(client)),
    () => FIXED_NOW,
  );
}

describe("AccuracyCheckService", () => {
  describe("checkOne", () => {
    it("real, honest INCONCLUSIVE degrade — insufficient data on both sides (fewer than 3 rows before AND after)", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { created_at: "2026-08-15T00:00:00.000Z" });
      seedJudgeResult(client, { created_at: "2026-08-10T00:00:00.000Z", overall: 50 });
      seedJudgeResult(client, { created_at: "2026-08-20T00:00:00.000Z", overall: 90 });
      const service = buildService(client);

      const result = await service.checkOne(client.rows("learning_proposals")[0] as never);

      expect(result.verdict).toBe("INCONCLUSIVE");
      expect(result.sampleBefore).toBe(1);
      expect(result.sampleAfter).toBe(1);
      expect(result.reason).toMatch(/Insufficient real data/);
    });

    it("real IMPROVED verdict — sufficient samples on both sides, real average rose beyond the meaningful-difference band", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { created_at: "2026-08-15T00:00:00.000Z" });
      for (const [day, score] of [
        ["10", 50],
        ["11", 52],
        ["12", 48],
      ] as const) {
        seedJudgeResult(client, { created_at: `2026-08-${day}T00:00:00.000Z`, overall: score });
      }
      for (const [day, score] of [
        ["20", 80],
        ["21", 82],
        ["22", 78],
      ] as const) {
        seedJudgeResult(client, { created_at: `2026-08-${day}T00:00:00.000Z`, overall: score });
      }
      const service = buildService(client);

      const result = await service.checkOne(client.rows("learning_proposals")[0] as never);

      expect(result.verdict).toBe("IMPROVED");
      expect(result.scoreBefore).toBeCloseTo(50, 5);
      expect(result.scoreAfter).toBeCloseTo(80, 5);
      expect(result.sampleBefore).toBe(3);
      expect(result.sampleAfter).toBe(3);
    });

    it("real REGRESSED verdict — sufficient samples on both sides, real average fell beyond the meaningful-difference band", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { created_at: "2026-08-15T00:00:00.000Z" });
      for (const [day, score] of [
        ["10", 90],
        ["11", 88],
        ["12", 92],
      ] as const) {
        seedJudgeResult(client, { created_at: `2026-08-${day}T00:00:00.000Z`, overall: score });
      }
      for (const [day, score] of [
        ["20", 40],
        ["21", 42],
        ["22", 38],
      ] as const) {
        seedJudgeResult(client, { created_at: `2026-08-${day}T00:00:00.000Z`, overall: score });
      }
      const service = buildService(client);

      const result = await service.checkOne(client.rows("learning_proposals")[0] as never);

      expect(result.verdict).toBe("REGRESSED");
      expect(result.reason).toMatch(/flagged, not auto-reverted/);
    });

    it("real INCONCLUSIVE verdict — sufficient samples but the real delta is within the meaningful-difference band", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { created_at: "2026-08-15T00:00:00.000Z" });
      for (const [day, score] of [
        ["10", 70],
        ["11", 71],
        ["12", 69],
      ] as const) {
        seedJudgeResult(client, { created_at: `2026-08-${day}T00:00:00.000Z`, overall: score });
      }
      for (const [day, score] of [
        ["20", 71],
        ["21", 72],
        ["22", 70],
      ] as const) {
        seedJudgeResult(client, { created_at: `2026-08-${day}T00:00:00.000Z`, overall: score });
      }
      const service = buildService(client);

      const result = await service.checkOne(client.rows("learning_proposals")[0] as never);

      expect(result.verdict).toBe("INCONCLUSIVE");
      expect(result.reason).toMatch(/not a meaningful difference/);
    });

    it("real write: persists the computed verdict/reason/scores/samples/checkedAt onto the real learning_proposals row", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "proposal-write", created_at: "2026-08-15T00:00:00.000Z" });
      seedJudgeResult(client, { created_at: "2026-08-10T00:00:00.000Z", overall: 50 });
      seedJudgeResult(client, { created_at: "2026-08-20T00:00:00.000Z", overall: 90 });
      const service = buildService(client);

      await service.checkOne(client.rows("learning_proposals")[0] as never);

      const row = client.rows("learning_proposals")[0] as Record<string, unknown>;
      expect(row["accuracy_verdict"]).toBe("INCONCLUSIVE");
      expect(row["accuracy_checked_at"]).toBe(FIXED_NOW.toISOString());
      expect(row["accuracy_sample_before"]).toBe(1);
      expect(row["accuracy_sample_after"]).toBe(1);
    });

    it("respects a real, tenant-overridden ACCURACY/min_delta_to_flag agent_configs row instead of the hardcoded default", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { created_at: "2026-08-15T00:00:00.000Z" });
      client.seed("agent_configs", {
        id: "cfg-accuracy",
        tenant_id: "dss-motor",
        agent: "ACCURACY",
        config_key: "min_delta_to_flag",
        value: "100",
        data_type: "number",
        description: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        updated_by: null,
      });
      for (const [day, score] of [
        ["10", 50],
        ["11", 52],
        ["12", 48],
      ] as const) {
        seedJudgeResult(client, { created_at: `2026-08-${day}T00:00:00.000Z`, overall: score });
      }
      for (const [day, score] of [
        ["20", 80],
        ["21", 82],
        ["22", 78],
      ] as const) {
        seedJudgeResult(client, { created_at: `2026-08-${day}T00:00:00.000Z`, overall: score });
      }
      const service = buildService(client);

      const result = await service.checkOne(client.rows("learning_proposals")[0] as never);

      // A real +30 average delta is real "improvement" magnitude, but the tenant's own real
      // min_delta_to_flag=100 override means it is honestly still within the (huge) configured band.
      expect(result.verdict).toBe("INCONCLUSIVE");
    });
  });

  describe("runWeeklyAccuracyCheck", () => {
    it("checks every real AUTO_APPLIED/AUTO_APPLY_BLOCKED_BY_SANDBOX proposal needing a check, skips ones with an already-decided IMPROVED/REGRESSED verdict", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "needs-check-1", status: "AUTO_APPLIED", accuracy_verdict: null });
      seedProposal(client, {
        id: "needs-check-2",
        status: "AUTO_APPLY_BLOCKED_BY_SANDBOX",
        accuracy_verdict: "INCONCLUSIVE",
      });
      seedProposal(client, {
        id: "already-improved",
        status: "AUTO_APPLIED",
        accuracy_verdict: "IMPROVED",
      });
      seedProposal(client, { id: "still-pending", status: "PENDING", accuracy_verdict: null });
      const service = buildService(client);

      await service.runWeeklyAccuracyCheck();

      const rows = client.rows("learning_proposals") as Record<string, unknown>[];
      const byId = new Map(rows.map((row) => [row["id"], row]));
      expect(byId.get("needs-check-1")?.["accuracy_checked_at"]).toBe(FIXED_NOW.toISOString());
      expect(byId.get("needs-check-2")?.["accuracy_checked_at"]).toBe(FIXED_NOW.toISOString());
      expect(byId.get("already-improved")?.["accuracy_checked_at"]).toBeNull();
      expect(byId.get("still-pending")?.["accuracy_checked_at"]).toBeNull();
    });

    it("real best-effort discipline: one row's failure never aborts the rest of the real batch", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "will-fail", status: "AUTO_APPLIED", accuracy_verdict: null });
      seedProposal(client, { id: "will-succeed", status: "AUTO_APPLIED", accuracy_verdict: null });
      const service = buildService(client);
      const original = service.checkOne.bind(service);
      let calls = 0;
      service.checkOne = async (row) => {
        calls += 1;
        if (row.id === "will-fail") {
          throw new Error("boom");
        }
        return original(row);
      };

      await expect(service.runWeeklyAccuracyCheck()).resolves.toBeUndefined();
      expect(calls).toBe(2);
    });

    it("never throws even when listNeedingAccuracyCheck itself fails", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("learning_proposals", "boom");
      const service = buildService(client);
      await expect(service.runWeeklyAccuracyCheck()).resolves.toBeUndefined();
    });
  });
});
