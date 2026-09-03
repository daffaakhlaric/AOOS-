import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  LearningProposalRepository,
  LearningProposalRepositoryError,
  type LearningProposalRow,
} from "./learning-proposal.repository.js";

function seedProposal(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<LearningProposalRow> = {},
): void {
  client.seed("learning_proposals", {
    id: "row-1",
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
    ...overrides,
  });
}

describe("LearningProposalRepository", () => {
  describe("create", () => {
    it("inserts a real row with status PENDING and every decision column unset", async () => {
      const client = createFakeSupabaseClient();
      const repository = new LearningProposalRepository(client);
      const row = await repository.create({
        tenantId: "dss-motor",
        simulationId: "sim-1",
        agent: "SAMANTHA",
        analysis: "analisa nyata",
        gaps: { verdict: "NO-GO" },
        improvements: [{ target: "analyze" }],
      });
      expect(row.status).toBe("PENDING");
      expect(row.decided_by).toBeFalsy();
      expect(row.decided_at).toBeFalsy();
      expect(row.simulation_id).toBe("sim-1");
      expect(row.agent_run_id).toBeNull();
      expect(client.rows("learning_proposals")).toHaveLength(1);
    });

    it("inserts a real row with agent_run_id populated and simulation_id NULL (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — the LIVE-run trigger source)", async () => {
      const client = createFakeSupabaseClient();
      const repository = new LearningProposalRepository(client);
      const row = await repository.create({
        tenantId: "dss-motor",
        agentRunId: "agent-run-1",
        agent: "CLARA",
        analysis: "analisa run live",
        gaps: { source: "LIVE_RUN" },
        improvements: [],
      });
      expect(row.agent_run_id).toBe("agent-run-1");
      expect(row.simulation_id).toBeNull();
      expect(row.status).toBe("PENDING");
    });

    it("throws (never inserts) when both simulationId and agentRunId are given", async () => {
      const client = createFakeSupabaseClient();
      const repository = new LearningProposalRepository(client);
      await expect(
        repository.create({
          tenantId: "dss-motor",
          simulationId: "sim-1",
          agentRunId: "agent-run-1",
          agent: "SAMANTHA",
          analysis: "a",
          gaps: {},
          improvements: [],
        }),
      ).rejects.toThrow(LearningProposalRepositoryError);
      expect(client.rows("learning_proposals")).toHaveLength(0);
    });

    it("throws (never inserts) when neither simulationId nor agentRunId is given", async () => {
      const client = createFakeSupabaseClient();
      const repository = new LearningProposalRepository(client);
      await expect(
        repository.create({
          tenantId: "dss-motor",
          agent: "SAMANTHA",
          analysis: "a",
          gaps: {},
          improvements: [],
        }),
      ).rejects.toThrow(LearningProposalRepositoryError);
      expect(client.rows("learning_proposals")).toHaveLength(0);
    });

    it("throws LearningProposalRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("learning_proposals", "connection reset");
      const repository = new LearningProposalRepository(client);
      await expect(
        repository.create({
          tenantId: "dss-motor",
          simulationId: "sim-1",
          agent: "SAMANTHA",
          analysis: "a",
          gaps: {},
          improvements: [],
        }),
      ).rejects.toThrow(LearningProposalRepositoryError);
    });
  });

  describe("listRecentForTenant", () => {
    it("returns only the tenant's own rows, oldest-first, capped at the given limit", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "row-1", created_at: "2026-08-01T00:00:00.000Z" });
      seedProposal(client, { id: "row-2", created_at: "2026-08-02T00:00:00.000Z" });
      seedProposal(client, { id: "row-3", created_at: "2026-08-03T00:00:00.000Z" });
      seedProposal(client, {
        id: "row-other-tenant",
        tenant_id: "other-tenant",
        created_at: "2026-08-04T00:00:00.000Z",
      });

      const repository = new LearningProposalRepository(client);
      const rows = await repository.listRecentForTenant("dss-motor", 2);
      expect(rows.map((row) => row.id)).toEqual(["row-2", "row-3"]);
    });

    it("returns an empty list when the tenant has no proposals", async () => {
      const client = createFakeSupabaseClient();
      const repository = new LearningProposalRepository(client);
      expect(await repository.listRecentForTenant("dss-motor")).toEqual([]);
    });

    it("throws LearningProposalRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("learning_proposals", "connection reset");
      const repository = new LearningProposalRepository(client);
      await expect(repository.listRecentForTenant("dss-motor")).rejects.toThrow(
        LearningProposalRepositoryError,
      );
    });
  });

  describe("findById", () => {
    it("returns the matching row", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "row-1" });
      const repository = new LearningProposalRepository(client);
      const row = await repository.findById("row-1");
      expect(row?.id).toBe("row-1");
    });

    it("returns undefined when no row matches", async () => {
      const client = createFakeSupabaseClient();
      const repository = new LearningProposalRepository(client);
      expect(await repository.findById("missing")).toBeUndefined();
    });

    it("throws LearningProposalRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("learning_proposals", "connection reset");
      const repository = new LearningProposalRepository(client);
      await expect(repository.findById("row-1")).rejects.toThrow(LearningProposalRepositoryError);
    });
  });

  describe("listForTenant", () => {
    it("returns only the tenant's own rows, newest-first", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "row-1", created_at: "2026-08-01T00:00:00.000Z" });
      seedProposal(client, { id: "row-2", created_at: "2026-08-02T00:00:00.000Z" });
      seedProposal(client, {
        id: "row-other-tenant",
        tenant_id: "other-tenant",
        created_at: "2026-08-03T00:00:00.000Z",
      });
      const repository = new LearningProposalRepository(client);
      const rows = await repository.listForTenant("dss-motor");
      expect(rows.map((row) => row.id)).toEqual(["row-2", "row-1"]);
    });

    it("filters by status when given", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "row-pending", status: "PENDING" });
      seedProposal(client, { id: "row-approved", status: "APPROVED" });
      const repository = new LearningProposalRepository(client);
      const rows = await repository.listForTenant("dss-motor", "PENDING");
      expect(rows.map((row) => row.id)).toEqual(["row-pending"]);
    });

    it("throws LearningProposalRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("learning_proposals", "connection reset");
      const repository = new LearningProposalRepository(client);
      await expect(repository.listForTenant("dss-motor")).rejects.toThrow(
        LearningProposalRepositoryError,
      );
    });
  });

  describe("updateDecision", () => {
    it("writes status/decided_by/decision_notes/decided_at on the matching row", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "row-1" });
      const repository = new LearningProposalRepository(client);
      await repository.updateDecision(
        "row-1",
        "APPROVED",
        "manager@dss-motor.id",
        "Looks good",
        "2026-08-05T00:00:00.000Z",
      );
      const row = await repository.findById("row-1");
      expect(row?.status).toBe("APPROVED");
      expect(row?.decided_by).toBe("manager@dss-motor.id");
      expect(row?.decision_notes).toBe("Looks good");
      expect(row?.decided_at).toBe("2026-08-05T00:00:00.000Z");
    });

    it("writes null decided_by/decision_notes when omitted", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "row-1" });
      const repository = new LearningProposalRepository(client);
      await repository.updateDecision(
        "row-1",
        "REJECTED",
        undefined,
        undefined,
        "2026-08-05T00:00:00.000Z",
      );
      const row = await repository.findById("row-1");
      expect(row?.status).toBe("REJECTED");
      expect(row?.decided_by).toBeNull();
      expect(row?.decision_notes).toBeNull();
    });

    it("throws LearningProposalRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("learning_proposals", "connection reset");
      const repository = new LearningProposalRepository(client);
      await expect(
        repository.updateDecision(
          "row-1",
          "APPROVED",
          undefined,
          undefined,
          "2026-08-05T00:00:00.000Z",
        ),
      ).rejects.toThrow(LearningProposalRepositoryError);
    });
  });

  describe("markAutoApplied (AAOS Self-Improving, Phase SI-1)", () => {
    it("writes auto_applied_config_keys and status on the matching row", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "row-1" });
      const repository = new LearningProposalRepository(client);
      await repository.markAutoApplied("row-1", ["pause_cpl_multiplier"], "AUTO_APPLIED");
      const row = await repository.findById("row-1");
      expect(row?.status).toBe("AUTO_APPLIED");
      expect(row?.auto_applied_config_keys).toEqual(["pause_cpl_multiplier"]);
    });

    it("can keep status PENDING while still recording partial auto-applied keys (mixed proposal)", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "row-1" });
      const repository = new LearningProposalRepository(client);
      await repository.markAutoApplied("row-1", ["live_run_gap_threshold"], "PENDING");
      const row = await repository.findById("row-1");
      expect(row?.status).toBe("PENDING");
      expect(row?.auto_applied_config_keys).toEqual(["live_run_gap_threshold"]);
    });

    it("throws LearningProposalRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "row-1" });
      client.forceErrorOnce("learning_proposals", "connection reset");
      const repository = new LearningProposalRepository(client);
      await expect(
        repository.markAutoApplied("row-1", ["pause_cpl_multiplier"], "AUTO_APPLIED"),
      ).rejects.toThrow(LearningProposalRepositoryError);
    });
  });
});
