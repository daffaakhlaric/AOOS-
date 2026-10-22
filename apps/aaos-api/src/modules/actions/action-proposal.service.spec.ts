import type { SupabaseClientLike } from "@aos/lead-store";
import { MetaApiClient } from "@aos/meta-ads-connector";
import { afterEach, expect, it, vi } from "vitest";

import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import type { PendingActionRow } from "../pending-actions/infrastructure/pending-action.repository.js";

import { ActionProposalService } from "./action-proposal.service.js";
import { ActionRepository, type ExecutionRow, type StepRow } from "./action.repository.js";
afterEach(() => vi.restoreAllMocks());
function setup() {
  const repo = Object.create(ActionRepository.prototype) as ActionRepository;
  repo.find = vi.fn(async () => null);
  repo.create = vi.fn();
  const evidence = { decision: { decision: "PAUSE", reason: "Biaya naik dengan hasil menurun" } };
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: evidence, error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const db = { from: vi.fn(() => query) };
  const registry = {
    resolve: vi.fn(async () => ({
      ok: true,
      value: {
        tenantId: "a",
        integrationId: "meta",
        credentialVersion: 1,
        adAccountIds: ["act_1"],
        accessToken: "fixture",
      },
    })),
  };
  const read = vi
    .spyOn(MetaApiClient.prototype, "verifyObjectState")
    .mockResolvedValue({ status: "VERIFIED" } as never);
  const service = new ActionProposalService(
    repo,
    db as unknown as SupabaseClientLike,
    registry as unknown as MetaAdsConnectorRegistry,
  );
  const row = {
    id: "id",
    tenant_id: "a",
    status: "PENDING",
    action_type: "REVIEW_SAMANTHA_RECOMMENDATION",
    created_at: "2026-10-22T00:00:00Z",
    payload: { decision: "PAUSE", campaignId: "100", assessmentId: "e", policyVersion: 1 },
  } as PendingActionRow;
  return { service, row, repo, evidence, query, read };
}
it("creates a frozen proposal from owned persisted assessment and verified provider state", async () => {
  const f = setup();
  await f.service.fromRecommendation(f.row);
  expect(f.query.eq).toHaveBeenCalledWith("tenant_id", "a");
  expect(f.query.eq).toHaveBeenCalledWith("meta_campaign_id", "100");
  expect(f.repo.create).toHaveBeenCalledWith(
    expect.objectContaining({
      actionId: "id",
      actor: { type: "SAMANTHA" },
      reason: f.evidence.decision.reason,
      evidenceSnapshotId: "e",
    }),
    "id",
  );
  expect(f.read).toHaveBeenCalledWith("100", "act_1", { status: "ACTIVE" }, "fixture");
});
it("does not turn scale recommendations into unsupported execution plans", async () => {
  const f = setup();
  f.row.payload["decision"] = "SCALE";
  await f.service.fromRecommendation(f.row);
  expect(f.repo.create).not.toHaveBeenCalled();
  expect(f.read).not.toHaveBeenCalled();
});
it("reuses a persisted plan without rereading Meta or creating another action", async () => {
  const f = setup();
  await f.service.fromRecommendation(f.row);
  const command = vi.mocked(f.repo.create).mock.calls[0]![0];
  vi.mocked(f.repo.find).mockResolvedValue({ command } as ExecutionRow);
  f.repo.steps = vi.fn(
    async () =>
      command.steps.map((step, ordinal) => ({
        action_id: command.actionId,
        tenant_id: command.tenantId,
        step_key: step.key,
        intent: step.intent,
        ordinal,
      })) as StepRow[],
  );
  await f.service.fromRecommendation(f.row);
  expect(f.repo.create).toHaveBeenCalledTimes(1);
  expect(f.read).toHaveBeenCalledTimes(1);
});
it("rejects a recommendation inconsistent with persisted evidence", async () => {
  const f = setup();
  f.evidence.decision.decision = "KEEP";
  await expect(f.service.fromRecommendation(f.row)).rejects.toThrow("PROPOSAL_EVIDENCE_MISMATCH");
  expect(f.repo.create).not.toHaveBeenCalled();
});
it("does not queue an active-state mutation when provider state cannot be verified", async () => {
  const f = setup();
  f.read.mockResolvedValue({ status: "UNVERIFIED" } as never);
  await expect(f.service.fromRecommendation(f.row)).rejects.toThrow(
    "PROPOSAL_CURRENT_STATE_UNVERIFIED",
  );
  expect(f.repo.create).not.toHaveBeenCalled();
});
