import { expect, it, vi } from "vitest";

import type { ActivityLogger } from "../activity-log/activity-logger.service.js";
import type { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import { ActionActivityService } from "./action-activity.service.js";
import type { ExecutionRow } from "./action.repository.js";
function setup(state: string) {
  const activity = { start: vi.fn(async () => "activity"), complete: vi.fn(), escalate: vi.fn() };
  const service = new ActionActivityService(
    activity as unknown as ActivityLogger,
    { resolveMode: vi.fn(async () => "LIVE") } as unknown as ModeGuardService,
  );
  const row = {
    id: "action",
    tenant_id: "tenant",
    revision: 1,
    state,
    command: {
      actionType: "PAUSE_CAMPAIGN",
      entityId: "100",
      correlationId: "c",
      accessToken: "SECRET",
    },
  } as unknown as ExecutionRow;
  return { service, activity, row };
}
it("records verified outcomes with safe identifiers only", async () => {
  const f = setup("VERIFIED");
  await f.service.record(f.row, "user", "EXECUTION");
  expect(f.activity.complete).toHaveBeenCalledWith(
    "activity",
    expect.objectContaining({ status: "SUCCESS" }),
  );
  expect(JSON.stringify(f.activity.start.mock.calls)).not.toContain("SECRET");
  expect(f.activity.start).toHaveBeenCalledWith(
    expect.objectContaining({
      tenantId: "tenant",
      input: expect.objectContaining({ actionId: "action", userId: "user" }),
    }),
  );
});
it.each(["UNCERTAIN", "FAILED", "EXECUTING"])("never reports %s as success", async (state) => {
  const f = setup(state);
  await f.service.record(f.row, "user", "EXECUTION");
  expect(f.activity.complete).not.toHaveBeenCalled();
  expect(f.activity.escalate).toHaveBeenCalled();
});
it("does not report a rejected replay as a successful new execution", async () => {
  const f = setup("VERIFIED");
  await f.service.record(f.row, "user", "EXECUTION_REJECTED");
  expect(f.activity.complete).not.toHaveBeenCalled();
  expect(f.activity.escalate).toHaveBeenCalled();
});
it("does not mask provider outcomes when activity persistence fails", async () => {
  const f = setup("VERIFIED");
  f.activity.start.mockRejectedValue(new Error("storage unavailable"));
  await expect(f.service.record(f.row, "user", "EXECUTION")).resolves.toBeUndefined();
});
