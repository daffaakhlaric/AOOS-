import { ConflictError, NotFoundError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { PromptOverrideRepository } from "../prompt-override/infrastructure/prompt-override.repository.js";
import { PromptOverrideService } from "../prompt-override/prompt-override.service.js";

import {
  LearningProposalRepository,
  type LearningProposalRow,
} from "./infrastructure/learning-proposal.repository.js";
import { LearningDecisionService } from "./learning-decision.service.js";

const FIXED_NOW = new Date("2026-08-29T12:00:00.000Z");

function seedProposal(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<LearningProposalRow> = {},
): void {
  client.seed("learning_proposals", {
    id: "proposal-1",
    tenant_id: "dss-motor",
    simulation_id: "sim-1",
    agent_run_id: null,
    agent: "SAMANTHA",
    analysis: "analisa nyata",
    gaps: { verdict: "NO-GO" },
    improvements: [
      {
        agent: "SAMANTHA",
        type: "PROMPT_UPDATE",
        target: "analyze",
        before: "old prompt",
        after: "new, improved prompt",
        reason: "coverage rendah",
        severity: "HIGH",
      },
    ],
    status: "PENDING",
    decided_by: null,
    decision_notes: null,
    decided_at: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  });
}

function buildService(client: ReturnType<typeof createFakeSupabaseClient>): {
  service: LearningDecisionService;
  promptRepository: PromptOverrideRepository;
} {
  const proposals = new LearningProposalRepository(client);
  const promptRepository = new PromptOverrideRepository(client);
  const promptOverride = new PromptOverrideService(promptRepository, () => FIXED_NOW);
  const service = new LearningDecisionService(proposals, promptOverride, () => FIXED_NOW);
  return { service, promptRepository };
}

describe("LearningDecisionService", () => {
  describe("getProposal", () => {
    it("throws NotFoundError for a missing id", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);
      await expect(service.getProposal("missing")).rejects.toThrow(NotFoundError);
    });
  });

  describe("approve", () => {
    it("activates exactly one new agent_prompt_overrides row and deactivates the prior active one", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client);
      client.seed("agent_prompt_overrides", {
        id: "prior-1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        prompt_key: "analyze",
        content: "old prompt",
        version: 1,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        activated_at: "2026-01-01T00:00:00.000Z",
        deactivated_at: null,
      });
      const { service } = buildService(client);

      const result = await service.approve("proposal-1", "manager@dss-motor.id", "Setuju");

      expect(result.status).toBe("APPROVED");
      expect(result.decided_by).toBe("manager@dss-motor.id");
      expect(result.decision_notes).toBe("Setuju");
      expect(result.decided_at).toBe(FIXED_NOW.toISOString());

      const rows = client.rows("agent_prompt_overrides");
      const activeRows = rows.filter((row) => row["is_active"] === true);
      expect(activeRows).toHaveLength(1);
      expect(activeRows[0]?.["content"]).toBe("new, improved prompt");
      expect(activeRows[0]?.["version"]).toBe(2);

      const priorRow = rows.find((row) => row["id"] === "prior-1");
      expect(priorRow?.["is_active"]).toBe(false);
      expect(priorRow?.["deactivated_at"]).toBe(FIXED_NOW.toISOString());
    });

    it("creates version 1 when no prior active override exists for that key", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client);
      const { service } = buildService(client);

      await service.approve("proposal-1", undefined, undefined);

      const rows = client.rows("agent_prompt_overrides");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.["version"]).toBe(1);
      expect(rows[0]?.["is_active"]).toBe(true);
    });

    it("writes decided_by=null/decision_notes=null when omitted from the request", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client);
      const { service } = buildService(client);
      const result = await service.approve("proposal-1", undefined, undefined);
      expect(result.decided_by).toBeNull();
      expect(result.decision_notes).toBeNull();
    });

    it("never writes an agent_prompt_overrides row for a CONFIG_UPDATE improvement (documented no-op, not an error)", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, {
        improvements: [
          {
            agent: "SAMANTHA",
            type: "CONFIG_UPDATE",
            target: "some_config_key",
            before: "10",
            after: "20",
            reason: "test",
            severity: "LOW",
          },
        ],
      });
      const { service } = buildService(client);

      const result = await service.approve("proposal-1", "manager@dss-motor.id", undefined);

      expect(result.status).toBe("APPROVED");
      expect(client.rows("agent_prompt_overrides")).toHaveLength(0);
    });

    it("skips a malformed improvement item without throwing, and still approves", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { improvements: [{ garbage: true }] });
      const { service } = buildService(client);

      const result = await service.approve("proposal-1", undefined, undefined);
      expect(result.status).toBe("APPROVED");
      expect(client.rows("agent_prompt_overrides")).toHaveLength(0);
    });

    it("applies every PROMPT_UPDATE improvement when a proposal has more than one", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, {
        improvements: [
          {
            agent: "SAMANTHA",
            type: "PROMPT_UPDATE",
            target: "analyze",
            before: "old",
            after: "new analyze",
            reason: "x",
            severity: "HIGH",
          },
          {
            agent: "CLARA",
            type: "PROMPT_UPDATE",
            target: "clara_system_prompt",
            before: "old",
            after: "new clara prompt",
            reason: "x",
            severity: "MEDIUM",
          },
        ],
      });
      const { service } = buildService(client);

      await service.approve("proposal-1", undefined, undefined);

      const rows = client.rows("agent_prompt_overrides");
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r["prompt_key"] === "analyze")?.["content"]).toBe("new analyze");
      expect(rows.find((r) => r["prompt_key"] === "clara_system_prompt")?.["content"]).toBe(
        "new clara prompt",
      );
    });

    it("throws ConflictError when the proposal is already APPROVED — never re-decides", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, {
        status: "APPROVED",
        decided_by: "someone@dss-motor.id",
        decided_at: "2026-08-02T00:00:00.000Z",
      });
      const { service } = buildService(client);

      await expect(
        service.approve("proposal-1", "another@dss-motor.id", undefined),
      ).rejects.toThrow(ConflictError);
      // No agent_prompt_overrides row created by the rejected re-approve attempt.
      expect(client.rows("agent_prompt_overrides")).toHaveLength(0);
      // Original decision untouched.
      const proposal = await service.getProposal("proposal-1");
      expect(proposal.decided_by).toBe("someone@dss-motor.id");
    });

    it("throws ConflictError when the proposal is already REJECTED", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { status: "REJECTED" });
      const { service } = buildService(client);
      await expect(service.approve("proposal-1", undefined, undefined)).rejects.toThrow(
        ConflictError,
      );
    });

    describe("AAOS Self-Improving (Phase SI-5) — the real human-override route for a sandbox-blocked PROMPT_UPDATE", () => {
      it("approves a proposal with status AUTO_APPLY_BLOCKED_BY_SANDBOX (a real, additive decidable status)", async () => {
        const client = createFakeSupabaseClient();
        seedProposal(client, {
          status: "AUTO_APPLY_BLOCKED_BY_SANDBOX",
          auto_applied_config_keys: [],
          sandbox_blocked_items: [
            { agent: "SAMANTHA", target: "analyze", result: { available: true, delta: -5 } },
          ],
        });
        const { service } = buildService(client);

        const result = await service.approve(
          "proposal-1",
          "manager@dss-motor.id",
          "Force override",
        );

        expect(result.status).toBe("APPROVED");
        const rows = client.rows("agent_prompt_overrides");
        expect(rows).toHaveLength(1);
        expect(rows[0]?.["content"]).toBe("new, improved prompt");
      });

      it("rejects a proposal with status AUTO_APPLY_BLOCKED_BY_SANDBOX (also decidable) — never writes agent_prompt_overrides", async () => {
        const client = createFakeSupabaseClient();
        seedProposal(client, { status: "AUTO_APPLY_BLOCKED_BY_SANDBOX" });
        const { service } = buildService(client);

        const result = await service.reject("proposal-1", "manager@dss-motor.id", "Tidak relevan");

        expect(result.status).toBe("REJECTED");
        expect(client.rows("agent_prompt_overrides")).toHaveLength(0);
      });

      it("never double-writes a PROMPT_UPDATE target that was already auto-applied at persist time (auto_applied_config_keys already contains it)", async () => {
        const client = createFakeSupabaseClient();
        seedProposal(client, {
          status: "AUTO_APPLY_BLOCKED_BY_SANDBOX",
          improvements: [
            {
              agent: "SAMANTHA",
              type: "PROMPT_UPDATE",
              target: "analyze",
              before: "old",
              after: "already-applied version",
              reason: "x",
              severity: "HIGH",
            },
            {
              agent: "CLARA",
              type: "PROMPT_UPDATE",
              target: "clara_system_prompt",
              before: "old",
              after: "the real blocked target",
              reason: "x",
              severity: "MEDIUM",
            },
          ],
          // "analyze" was already auto-applied at persist time; "clara_system_prompt" was the one
          // sandbox-blocked (SANDBOX only ever tests SAMANTHA/analyze — a CLARA item always degrades
          // to unavailable, but this test only cares about the "already applied" skip logic here).
          auto_applied_config_keys: ["analyze"],
        });
        const { service } = buildService(client);

        await service.approve("proposal-1", undefined, undefined);

        const rows = client.rows("agent_prompt_overrides");
        // Only the NOT-already-applied target ("clara_system_prompt") gets a real write here.
        expect(rows).toHaveLength(1);
        expect(rows[0]?.["prompt_key"]).toBe("clara_system_prompt");
        expect(rows[0]?.["content"]).toBe("the real blocked target");
      });
    });

    it("leaves the proposal PENDING (never marks APPROVED) when applying an improvement fails", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client);
      const proposals = new LearningProposalRepository(client);
      const promptRepository = new PromptOverrideRepository(client);
      const promptOverride = new PromptOverrideService(promptRepository, () => FIXED_NOW);
      // Force the underlying write to fail.
      client.forceErrorOnce("agent_prompt_overrides", "insert failed");
      const service = new LearningDecisionService(proposals, promptOverride, () => FIXED_NOW);

      await expect(service.approve("proposal-1", undefined, undefined)).rejects.toThrow();

      const proposal = await service.getProposal("proposal-1");
      expect(proposal.status).toBe("PENDING");
      expect(proposal.decided_at).toBeNull();
    });
  });

  describe("reject", () => {
    it("writes status=REJECTED/decided_by/decision_notes/decided_at and touches NOTHING in agent_prompt_overrides", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client);
      client.seed("agent_prompt_overrides", {
        id: "prior-1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        prompt_key: "analyze",
        content: "unchanged",
        version: 1,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        activated_at: "2026-01-01T00:00:00.000Z",
        deactivated_at: null,
      });
      const { service } = buildService(client);

      const result = await service.reject("proposal-1", "manager@dss-motor.id", "Tidak relevan");

      expect(result.status).toBe("REJECTED");
      expect(result.decided_by).toBe("manager@dss-motor.id");
      expect(result.decision_notes).toBe("Tidak relevan");
      expect(result.decided_at).toBe(FIXED_NOW.toISOString());

      // Exactly the same single row, completely unchanged.
      const rows = client.rows("agent_prompt_overrides");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.["content"]).toBe("unchanged");
      expect(rows[0]?.["is_active"]).toBe(true);
      expect(rows[0]?.["version"]).toBe(1);
    });

    it("throws ConflictError when the proposal is not PENDING", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { status: "APPROVED" });
      const { service } = buildService(client);
      await expect(service.reject("proposal-1", undefined, undefined)).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe("rollback", () => {
    it("restores the previous version when one exists", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_prompt_overrides", {
        id: "v1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        prompt_key: "analyze",
        content: "v1 content",
        version: 1,
        is_active: false,
        created_at: "2026-01-01T00:00:00.000Z",
        activated_at: "2026-01-01T00:00:00.000Z",
        deactivated_at: "2026-08-01T00:00:00.000Z",
      });
      client.seed("agent_prompt_overrides", {
        id: "v2",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        prompt_key: "analyze",
        content: "v2 content",
        version: 2,
        is_active: true,
        created_at: "2026-08-01T00:00:00.000Z",
        activated_at: "2026-08-01T00:00:00.000Z",
        deactivated_at: null,
      });
      const { service } = buildService(client);

      const result = await service.rollback("dss-motor", "SAMANTHA", "analyze");

      expect(result.rolledBackToVersion).toBe(1);
      const rows = client.rows("agent_prompt_overrides");
      expect(rows.find((r) => r["id"] === "v1")?.["is_active"]).toBe(true);
      expect(rows.find((r) => r["id"] === "v2")?.["is_active"]).toBe(false);
    });

    it("clears to no active override when there was no previous version", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_prompt_overrides", {
        id: "v1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        prompt_key: "analyze",
        content: "v1 content",
        version: 1,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        activated_at: "2026-01-01T00:00:00.000Z",
        deactivated_at: null,
      });
      const { service } = buildService(client);

      const result = await service.rollback("dss-motor", "SAMANTHA", "analyze");

      expect(result.rolledBackToVersion).toBeNull();
      expect(
        client.rows("agent_prompt_overrides").filter((row) => row["is_active"] === true),
      ).toHaveLength(0);
    });

    it("throws ConflictError when there is no active override to roll back", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);
      await expect(service.rollback("dss-motor", "SAMANTHA", "analyze")).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe("setOverride (real, direct human/coordinator-authored write, no proposal required)", () => {
    it("creates version 1 for a tenant/agent/promptKey with no prior override", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);

      const row = await service.setOverride(
        "dss-motor",
        "CLARA",
        "clara_system_prompt",
        "Kamu adalah Clara...",
      );

      expect(row.version).toBe(1);
      expect(row.is_active).toBe(true);
      expect(row.content).toBe("Kamu adalah Clara...");
      expect(row.tenant_id).toBe("dss-motor");
      expect(row.agent).toBe("CLARA");
      expect(row.prompt_key).toBe("clara_system_prompt");
    });

    it("deactivates the prior active row and activates a new, incremented version", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_prompt_overrides", {
        id: "active-1",
        tenant_id: "dss-motor",
        agent: "CLARA",
        prompt_key: "clara_system_prompt",
        content: "old prompt",
        version: 1,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        activated_at: "2026-01-01T00:00:00.000Z",
        deactivated_at: null,
      });
      const { service } = buildService(client);

      const row = await service.setOverride(
        "dss-motor",
        "CLARA",
        "clara_system_prompt",
        "new prompt",
      );

      expect(row.version).toBe(2);
      expect(row.is_active).toBe(true);
      const rows = client.rows("agent_prompt_overrides");
      const previous = rows.find((r) => r["id"] === "active-1");
      expect(previous?.["is_active"]).toBe(false);
    });
  });

  describe("listProposals / listActiveOverrides", () => {
    it("lists only the tenant's own proposals, optionally filtered by status", async () => {
      const client = createFakeSupabaseClient();
      seedProposal(client, { id: "p1", status: "PENDING" });
      seedProposal(client, { id: "p2", status: "APPROVED" });
      seedProposal(client, { id: "p-other", tenant_id: "other-tenant" });
      const { service } = buildService(client);

      const all = await service.listProposals("dss-motor");
      expect(all.map((row) => row.id).sort()).toEqual(["p1", "p2"]);

      const pending = await service.listProposals("dss-motor", "PENDING");
      expect(pending.map((row) => row.id)).toEqual(["p1"]);
    });

    it("lists only active overrides for the tenant", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_prompt_overrides", {
        id: "active-1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        prompt_key: "analyze",
        content: "x",
        version: 1,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        activated_at: "2026-01-01T00:00:00.000Z",
        deactivated_at: null,
      });
      const { service } = buildService(client);
      const rows = await service.listActiveOverrides("dss-motor");
      expect(rows.map((row) => row.id)).toEqual(["active-1"]);
    });
  });
});
