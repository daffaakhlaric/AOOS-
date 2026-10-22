import { expect, it, vi } from "vitest";

import { ActionQueryService, actionSummary, stepSummary } from "./action-query.service.js";
import { ActionRepository, type ExecutionRow, type StepRow } from "./action.repository.js";

it("rejects another tenant's action before fetching steps", async () => {
  const repo = Object.create(ActionRepository.prototype) as ActionRepository;
  repo.find = vi.fn(async () => ({ tenant_id: "b", command: { tenantId: "b" } }) as ExecutionRow);
  repo.steps = vi.fn();
  await expect(new ActionQueryService(repo).detail("a", "id")).rejects.toThrow("Action not found");
  expect(repo.find).toHaveBeenCalledWith("a", "id");
  expect(repo.steps).not.toHaveBeenCalled();
});
it("public summaries omit claim tokens, arbitrary intent and raw provider errors", () => {
  const row = {
    id: "id",
    state: "UNCERTAIN",
    claim_token: "private-claim",
    error_code: "raw-secret",
    command: { tenantId: "a", targetState: { access_token: "secret" } },
  } as unknown as ExecutionRow;
  const summary = actionSummary(row);
  expect(summary.verified).toBe(false);
  expect(JSON.stringify(summary)).not.toMatch(/secret|private-claim|access_token/);
  const step = {
    state: "VERIFYING",
    receipt: { token: "secret" },
    intent: { token: "secret" },
    verification: { error: "secret" },
  } as unknown as StepRow;
  expect(stepSummary(step).verified).toBe(false);
  expect(JSON.stringify(stepSummary(step))).not.toContain("secret");
});
