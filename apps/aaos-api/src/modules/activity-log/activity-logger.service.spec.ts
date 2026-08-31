import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";

import { ActivityLogger } from "./activity-logger.service.js";
import type { ActivityRow } from "./infrastructure/activity.repository.js";
import { ActivityRepository } from "./infrastructure/activity.repository.js";

function buildLogger() {
  const client = createFakeSupabaseClient();
  const repository = new ActivityRepository(client);
  return { client, repository, logger: new ActivityLogger(repository) };
}

/** `complete`/`fail` are best-effort and typed `ActivityRow | undefined` — every real test here expects the write to have actually succeeded, so this narrows that down for readability rather than repeating an `expect(updated).toBeDefined()` guard in every test. */
function assertDefined(row: ActivityRow | undefined): ActivityRow {
  if (row === undefined) {
    throw new Error("expected a real ActivityRow, got undefined");
  }
  return row;
}

describe("ActivityLogger", () => {
  describe("start", () => {
    it("inserts a real RUNNING row with the given mode/agent/actionType and returns its id", async () => {
      const { client, logger } = buildLogger();
      const id = await logger.start({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "EXECUTE_VERDICT",
        mode: "LIVE",
        loopId: "corr-1",
        input: { verdict: "PAUSE" },
      });

      expect(typeof id).toBe("string");
      const rows = client.rows("agent_activities");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id,
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        action_type: "EXECUTE_VERDICT",
        mode: "LIVE",
        status: "RUNNING",
        loop_id: "corr-1",
        input: { verdict: "PAUSE" },
        tool_calls: [],
        completed_at: null,
      });
    });
  });

  describe("complete", () => {
    it("writes SUCCESS + output for a real LIVE execution, stamping completed_at/duration_ms", async () => {
      const { logger } = buildLogger();
      const id = await logger.start({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "CREATE_CAMPAIGN",
        mode: "LIVE",
      });

      const updated = assertDefined(
        await logger.complete(id, {
          status: "SUCCESS",
          output: { campaignId: "120000000000099" },
        }),
      );

      expect(updated.status).toBe("SUCCESS");
      expect(updated.output).toEqual({ campaignId: "120000000000099" });
      expect(updated.dev_preview).toBeNull();
      expect(updated.completed_at).not.toBeNull();
      expect(updated.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("writes SIMULATED + devPreview for a real DEV-mode call", async () => {
      const { logger } = buildLogger();
      const id = await logger.start({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "CREATE_CAMPAIGN",
        mode: "DEV",
      });

      const updated = assertDefined(
        await logger.complete(id, {
          status: "SIMULATED",
          devPreview: { simulated: true },
        }),
      );

      expect(updated.status).toBe("SIMULATED");
      expect(updated.dev_preview).toEqual({ simulated: true });
      expect(updated.output).toBeNull();
    });
  });

  describe("fail", () => {
    it("writes a real ERROR row with the actual thrown error's message/stack", async () => {
      const { logger } = buildLogger();
      const id = await logger.start({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "EXECUTE_VERDICT",
        mode: "LIVE",
      });

      const updated = assertDefined(
        await logger.fail(id, new Error("Meta API rejected the mutation")),
      );

      expect(updated.status).toBe("ERROR");
      expect(updated.error_message).toBe("Meta API rejected the mutation");
      expect(updated.error_stack).not.toBeNull();
      expect(updated.completed_at).not.toBeNull();
    });

    it("stringifies a non-Error thrown value rather than fabricating a message", async () => {
      const { logger } = buildLogger();
      const id = await logger.start({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "EXECUTE_VERDICT",
        mode: "LIVE",
      });

      const updated = assertDefined(await logger.fail(id, "raw string failure"));

      expect(updated.status).toBe("ERROR");
      expect(updated.error_message).toBe("raw string failure");
      expect(updated.error_stack).toBeNull();
    });
  });

  describe("logToolCall / logReasoning", () => {
    it("appends a real tool-call entry to tool_calls without clobbering earlier entries", async () => {
      const { client, logger } = buildLogger();
      const id = await logger.start({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "EXECUTE_VERDICT",
        mode: "LIVE",
      });

      await logger.logToolCall(id, { tool: "getAdAccount", input: { id: "act_1" } });
      await logger.logToolCall(id, { tool: "executeVerdict", output: { action: "PAUSED" } });

      const [row] = client.rows("agent_activities");
      expect(row?.["tool_calls"]).toHaveLength(2);
      expect((row?.["tool_calls"] as Array<{ tool: string }>)[0]?.tool).toBe("getAdAccount");
      expect((row?.["tool_calls"] as Array<{ tool: string }>)[1]?.tool).toBe("executeVerdict");
    });

    it("sets the real reasoning text", async () => {
      const { client, logger } = buildLogger();
      const id = await logger.start({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "EXECUTE_VERDICT",
        mode: "LIVE",
      });

      await logger.logReasoning(id, "Frequency 4.2, CPL naik 30% — pause disarankan.");

      const [row] = client.rows("agent_activities");
      expect(row?.["reasoning"]).toBe("Frequency 4.2, CPL naik 30% — pause disarankan.");
    });
  });

  describe("best-effort discipline (a logging failure must never fail the real agent action)", () => {
    it("start() never throws — returns undefined and just warns when the insert itself fails", async () => {
      const { client, logger } = buildLogger();
      client.forceErrorOnce("agent_activities", "simulated DB outage");

      const id = await logger.start({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "EXECUTE_VERDICT",
        mode: "LIVE",
      });

      expect(id).toBeUndefined();
    });

    it("complete()/fail()/logToolCall()/logReasoning() silently no-op for an undefined activityId (start() already failed)", async () => {
      const { logger } = buildLogger();

      await expect(logger.complete(undefined, { status: "SUCCESS" })).resolves.toBeUndefined();
      await expect(logger.fail(undefined, new Error("boom"))).resolves.toBeUndefined();
      await expect(logger.logToolCall(undefined, { tool: "x" })).resolves.toBeUndefined();
      await expect(logger.logReasoning(undefined, "reasoning")).resolves.toBeUndefined();
    });
  });
});
