import { ConflictException } from "@nestjs/common";
import { afterEach, expect, it, vi } from "vitest";

import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";

import type { ActionActivityService } from "./action-activity.service.js";
import type { ActionPolicyContext } from "./action-policy-context.js";
import type { ActionQueryService } from "./action-query.service.js";
import { ActionRuntimeService } from "./action-runtime.service.js";
import {
  ActionRepository,
  commandHash,
  type ExecutionRow,
  type StepRow,
} from "./action.repository.js";
import type { ActionCommand, ActionState } from "./action.types.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function setup(initial = "ACTIVE", loseResponse = false) {
  vi.stubEnv("META_REAL_WRITES_ENABLED", "true");
  let providerStatus = initial;
  let writes = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        writes++;
        providerStatus = "PAUSED";
        if (loseResponse) throw new Error("connection lost");
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "100", account_id: "1", status: providerStatus }), {
        status: 200,
      });
    }),
  );
  const command: ActionCommand = {
    actionId: "one",
    revision: 1,
    tenantId: "a",
    workspaceId: "a",
    integrationId: "meta-a",
    credentialVersion: 1,
    adAccountId: "act_1",
    actor: { type: "HUMAN", userId: "human" },
    actionType: "PAUSE_CAMPAIGN",
    entityType: "CAMPAIGN",
    entityId: "100",
    targetState: { status: "PAUSED" },
    currentStateSnapshot: { status: "ACTIVE" },
    policyVersion: 1,
    evidenceSnapshotId: "e",
    correlationId: "c",
    createdAt: "2026-10-22T00:00:00Z",
    steps: [{ key: "pause", intent: { status: "PAUSED" } }],
  };
  let state: ActionState = "APPROVED";
  let step = {
    id: "step",
    tenant_id: "a",
    action_id: "one",
    step_key: "pause",
    ordinal: 0,
    state: "PENDING",
    intent: { status: "PAUSED" },
    attempt: 0,
    receipt: null,
    verification: null,
    provider_object_id: null,
  } as StepRow;
  const repo = Object.create(ActionRepository.prototype) as ActionRepository;
  repo.find = vi.fn(
    async () =>
      ({
        id: "one",
        tenant_id: "a",
        command,
        state,
        command_hash: commandHash(command),
        approval_hash: commandHash(command),
        claim_token: state === "APPROVED" ? null : "claim",
      }) as ExecutionRow,
  );
  repo.claim = vi.fn(async () => {
    if (state !== "APPROVED") return null;
    state = "CLAIMED";
    return "claim";
  });
  repo.transition = vi.fn(async (_t, _id, _token, from, to) => {
    if (state !== from) throw new Error("CONFLICT");
    state = to;
  });
  repo.steps = vi.fn(async () => [step]);
  repo.beginStep = vi.fn(async () => {
    step = { ...step, state: "SUBMITTING" };
    return true;
  });
  repo.recordReceipt = vi.fn(async (_s, receipt, providerId) => {
    step = { ...step, receipt, provider_object_id: providerId };
  });
  repo.finishStep = vi.fn(async (_s, _from, to, values) => {
    step = { ...step, ...values, state: to };
  });
  const context = {
    resolve: vi.fn(async () => ({ accessToken: "fixture" })),
    resolveReconciliation: vi.fn(async () => ({ accessToken: "fixture" })),
  };
  const queries = { detail: vi.fn(async () => ({ state })) };
  const runtime = new ActionRuntimeService(
    repo,
    context as unknown as ActionPolicyContext,
    queries as unknown as ActionQueryService,
    { record: vi.fn(async () => undefined) } as unknown as ActionActivityService,
  );
  const identity = { tenantId: "a", workspaceId: "a" } as TrustedTenantContext;
  return { runtime, identity, repo, context, getWrites: () => writes, getStep: () => step };
}
it("uses canonical transport, persists receipt, reads back and reports VERIFIED", async () => {
  const f = setup();
  expect((await f.runtime.execute(f.identity, "one")).state).toBe("VERIFIED");
  expect(f.getWrites()).toBe(1);
  expect(f.repo.recordReceipt).toHaveBeenCalledTimes(1);
  expect(f.getStep().provider_object_id).toBe("100");
});
it("already-paused campaign is verified without a second mutation", async () => {
  const f = setup("PAUSED");
  expect((await f.runtime.execute(f.identity, "one")).state).toBe("VERIFIED");
  expect(f.getWrites()).toBe(0);
  expect(f.getStep().receipt?.mutated).toBe(false);
});
it("lost write response stays uncertain and is not retried", async () => {
  const f = setup("ACTIVE", true);
  expect((await f.runtime.execute(f.identity, "one")).state).toBe("UNCERTAIN");
  await expect(f.runtime.execute(f.identity, "one")).rejects.toThrow("ACTION_ALREADY_CLAIMED");
  expect(f.getWrites()).toBe(1);
});
it("reconciles a lost response through reads only, even with writes disabled", async () => {
  const f = setup("ACTIVE", true);
  expect((await f.runtime.execute(f.identity, "one")).state).toBe("UNCERTAIN");
  vi.stubEnv("META_REAL_WRITES_ENABLED", "false");
  f.context.resolve.mockRejectedValue(new Error("META_WRITE_DISABLED"));
  expect((await f.runtime.reconcile(f.identity, "one")).state).toBe("VERIFIED");
  expect(f.getWrites()).toBe(1);
  expect(f.getStep().provider_object_id).toBe("100");
});
it("a current capability block stops execution before claim or write", async () => {
  const f = setup();
  f.context.resolve.mockRejectedValue(new Error("META_CAPABILITY_UNVERIFIED"));
  await expect(f.runtime.execute(f.identity, "one")).rejects.toThrow("META_CAPABILITY_UNVERIFIED");
  expect(f.repo.claim).not.toHaveBeenCalled();
  expect(f.getWrites()).toBe(0);
});
it("preflight reads state without claiming or mutating", async () => {
  const f = setup();
  expect((await f.runtime.preflight(f.identity, "one")).ready).toBe(true);
  expect(f.repo.claim).not.toHaveBeenCalled();
  expect(f.getWrites()).toBe(0);
});
it("preflight returns safe blocker codes and redacts unexpected errors", async () => {
  const f = setup();
  f.context.resolve.mockRejectedValue(new ConflictException("TRACKING_UNVERIFIED"));
  expect((await f.runtime.preflight(f.identity, "one")).blocked).toEqual(["TRACKING_UNVERIFIED"]);
  f.context.resolve.mockRejectedValue(new Error("secret database/provider details"));
  expect((await f.runtime.preflight(f.identity, "one")).blocked).toEqual(["PREFLIGHT_UNAVAILABLE"]);
  expect(f.repo.claim).not.toHaveBeenCalled();
});
it("preflight hides a different tenant's action", async () => {
  const f = setup();
  await expect(f.runtime.preflight({ ...f.identity, tenantId: "other" }, "one")).rejects.toThrow(
    "Action not found",
  );
  expect(f.context.resolve).not.toHaveBeenCalled();
});
