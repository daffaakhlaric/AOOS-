import { ok } from "@aos/common";
import { MetaApiClient } from "@aos/meta-ads-connector";
import { afterEach, expect, it, vi } from "vitest";

import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";
import { defaultGrowthPolicy } from "../automation-policy/domain/growth-policy.js";
import type { GrowthPolicyService } from "../automation-policy/growth-policy.service.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";

import { ActionApprovalService } from "./action-approval.service.js";
import type { ActionEvidenceService } from "./action-evidence.service.js";
import { ActionRepository, commandHash, type ExecutionRow } from "./action.repository.js";
import type { ActionCommand } from "./action.types.js";

afterEach(() => vi.restoreAllMocks());
function setup() {
  const identity = {
    tenantId: "a",
    workspaceId: "a",
    userId: "human",
    permissions: ["campaign:write"],
  } as TrustedTenantContext;
  const command: ActionCommand = {
    actionId: "id",
    revision: 1,
    tenantId: "a",
    workspaceId: "a",
    integrationId: "meta-a",
    credentialVersion: 2,
    adAccountId: "act_1",
    actor: { type: "SAMANTHA" },
    actionType: "PAUSE_CAMPAIGN",
    entityType: "CAMPAIGN",
    entityId: "100",
    targetState: { status: "PAUSED" },
    currentStateSnapshot: { status: "ACTIVE" },
    policyVersion: 3,
    evidenceSnapshotId: "evidence",
    correlationId: "correlation",
    createdAt: "2026-10-22T00:00:00Z",
    steps: [{ key: "pause", intent: { status: "PAUSED" } }],
  };
  const row = {
    id: "id",
    tenant_id: "a",
    command,
    command_hash: commandHash(command),
    state: "AWAITING_APPROVAL",
  } as ExecutionRow;
  const repo = Object.create(ActionRepository.prototype) as ActionRepository;
  repo.find = vi.fn(async () => row);
  repo.approve = vi.fn(async () => true);
  const policy = defaultGrowthPolicy();
  policy.safetyPolicy.permissions.PAUSE_CAMPAIGN = "APPROVAL_REQUIRED";
  const current = vi.fn(async () => ({ version: 3, policy, updatedAt: null }));
  const registry = {
    resolve: vi.fn(async () =>
      ok({
        tenantId: "a",
        integrationId: "meta-a",
        credentialVersion: 2,
        adAccountIds: ["act_1"],
        accessToken: "test",
      }),
    ),
  };
  const read = vi
    .spyOn(MetaApiClient.prototype, "verifyObjectState")
    .mockResolvedValue({ status: "VERIFIED", mismatchedFields: [] });
  const service = new ActionApprovalService(
    repo,
    { current } as unknown as GrowthPolicyService,
    registry as unknown as MetaAdsConnectorRegistry,
    { verify: vi.fn(async () => undefined) } as unknown as ActionEvidenceService,
  );
  return { identity, command, row, repo, policy, current, registry, read, service };
}
it("binds approval to trusted human identity and checks provider before-state without executing", async () => {
  const f = setup();
  vi.mocked(f.repo.find)
    .mockResolvedValueOnce(f.row)
    .mockResolvedValueOnce({ ...f.row, state: "APPROVED" });
  const result = await f.service.approve(f.identity, "id", f.row.command_hash);
  expect(f.repo.approve).toHaveBeenCalledWith("a", "id", f.row.command_hash, "human");
  expect(f.read).toHaveBeenCalledWith("100", "act_1", { status: "ACTIVE" }, "test");
  expect(result.executionReady).toBe(false);
  expect(result.state).toBe("APPROVED");
});
it("denies viewers and wrong workspaces before reading provider state", async () => {
  const f = setup();
  await expect(
    f.service.approve({ ...f.identity, permissions: ["read"] }, "id", f.row.command_hash),
  ).rejects.toThrow("ACTION_APPROVAL_FORBIDDEN");
  await expect(
    f.service.approve({ ...f.identity, workspaceId: "other" }, "id", f.row.command_hash),
  ).rejects.toThrow("Action not found");
  expect(f.read).not.toHaveBeenCalled();
});
it("rejects edited hash, changed policy, or changed credential before approval", async () => {
  const f = setup();
  await expect(f.service.approve(f.identity, "id", "0".repeat(64))).rejects.toThrow(
    "ACTION_REVISION_MISMATCH",
  );
  f.current.mockResolvedValueOnce({ version: 4, policy: f.policy, updatedAt: null });
  await expect(f.service.approve(f.identity, "id", f.row.command_hash)).rejects.toThrow(
    "REAPPROVAL_REQUIRED",
  );
  f.registry.resolve.mockResolvedValueOnce(
    ok({
      tenantId: "a",
      integrationId: "meta-a",
      credentialVersion: 3,
      adAccountIds: ["act_1"],
      accessToken: "test",
    }),
  );
  await expect(f.service.approve(f.identity, "id", f.row.command_hash)).rejects.toThrow(
    "INTEGRATION_CHANGED",
  );
  expect(f.repo.approve).not.toHaveBeenCalled();
});
it("rejects stale provider state and a lost atomic approval race", async () => {
  const f = setup();
  f.read.mockResolvedValueOnce({ status: "MISMATCH", mismatchedFields: ["status"] });
  await expect(f.service.approve(f.identity, "id", f.row.command_hash)).rejects.toThrow(
    "STALE_OR_UNVERIFIED_ACTION",
  );
  expect(f.repo.approve).not.toHaveBeenCalled();
  vi.mocked(f.repo.approve).mockResolvedValue(false);
  await expect(f.service.approve(f.identity, "id", f.row.command_hash)).rejects.toThrow(
    "ACTION_ALREADY_DECIDED",
  );
});

it("rechecks the policy after the provider read and never approves under a newer policy", async () => {
  const f = setup();
  f.current
    .mockResolvedValueOnce({ version: 3, policy: f.policy, updatedAt: null })
    .mockResolvedValueOnce({ version: 4, policy: f.policy, updatedAt: null });
  await expect(f.service.approve(f.identity, "id", f.row.command_hash)).rejects.toThrow(
    "REAPPROVAL_REQUIRED",
  );
  expect(f.read).toHaveBeenCalledTimes(1);
  expect(f.repo.approve).not.toHaveBeenCalled();
});
