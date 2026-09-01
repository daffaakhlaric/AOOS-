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
      expect(client.rows("learning_proposals")).toHaveLength(1);
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
});
