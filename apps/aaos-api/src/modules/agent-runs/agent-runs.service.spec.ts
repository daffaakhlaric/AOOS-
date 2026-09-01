import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";

import { AgentRunsService } from "./agent-runs.service.js";
import { AgentRunRepository } from "./infrastructure/agent-run.repository.js";

function buildService() {
  const client = createFakeSupabaseClient();
  const repository = new AgentRunRepository(client);
  return { client, repository, service: new AgentRunsService(repository) };
}

describe("AgentRunsService.record", () => {
  it("inserts a real agent_runs row with the given tenant/agent/runRef/context, and returns its real id", async () => {
    const { client, service } = buildService();

    const runId = await service.record("dss-motor", "SAMANTHA", "evt-1", {
      campaigns: 3,
      pause: 1,
      scale: 0,
      aiAvailable: true,
    });

    const rows = client.rows("agent_runs");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenant_id: "dss-motor",
      agent: "SAMANTHA",
      run_ref: "evt-1",
      context: { campaigns: 3, pause: 1, scale: 0, aiAvailable: true },
    });
    expect(typeof rows[0]?.["id"]).toBe("string");
    expect(typeof rows[0]?.["created_at"]).toBe("string");
    expect(runId).toBe(rows[0]?.["id"]);
  });

  it("records a real KAI run keyed by a creative_packages id", async () => {
    const { client, service } = buildService();

    await service.record("dss-motor", "KAI", "pkg-1", {
      vertical: "AUTOMOTIVE",
      angle: "DP_RINGAN",
      status: "PENDING",
      copyVariantCount: 2,
    });

    const rows = client.rows("agent_runs");
    expect(rows[0]).toMatchObject({ agent: "KAI", run_ref: "pkg-1" });
  });

  it("records a real CLARA run keyed by a lead id", async () => {
    const { client, service } = buildService();

    await service.record("dss-motor", "CLARA", "lead-1", {
      closingType: "DP",
      score: 80,
      temperature: "HOT",
    });

    const rows = client.rows("agent_runs");
    expect(rows[0]).toMatchObject({ agent: "CLARA", run_ref: "lead-1" });
  });

  describe("best-effort discipline (a recording failure must never fail the real agent action)", () => {
    it("never throws — swallows and warns when the insert itself fails, returning undefined", async () => {
      const { client, service } = buildService();
      client.forceErrorOnce("agent_runs", "simulated DB outage");

      await expect(
        service.record("dss-motor", "SAMANTHA", "evt-1", { campaigns: 0 }),
      ).resolves.toBeUndefined();
      expect(client.rows("agent_runs")).toHaveLength(0);
    });
  });
});

describe("AgentRunsService.findById (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2)", () => {
  it("returns the real row for a real recorded run's id", async () => {
    const { service } = buildService();
    const runId = await service.record("dss-motor", "KAI", "pkg-1", {
      vertical: "AUTOMOTIVE",
      angle: "DP_RINGAN",
      status: "PENDING",
      copyVariantCount: 2,
    });

    const row = await service.findById(runId as string);

    expect(row).toMatchObject({
      id: runId,
      tenant_id: "dss-motor",
      agent: "KAI",
      run_ref: "pkg-1",
    });
  });

  it("returns undefined for an id that doesn't exist", async () => {
    const { service } = buildService();
    const row = await service.findById("11111111-1111-4111-8111-111111111111");
    expect(row).toBeUndefined();
  });
});
