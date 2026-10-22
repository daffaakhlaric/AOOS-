import { expect, it, vi } from "vitest";

import { ActionExecutor, type ActionExecutionPorts } from "./action-executor.service.js";
import { ActionReconciliationService } from "./action-reconciliation.service.js";
import {
  ActionRepository,
  commandHash,
  type ExecutionRow,
  type StepRow,
} from "./action.repository.js";
import type { ActionCommand, ActionState } from "./action.types.js";

function fixture() {
  const command: ActionCommand = {
    actionId: "one",
    revision: 1,
    tenantId: "a",
    workspaceId: "a",
    integrationId: "meta-a",
    credentialVersion: 1,
    adAccountId: "act_1",
    actor: { type: "HUMAN", userId: "owner" },
    actionType: "PAUSE_CAMPAIGN",
    entityType: "CAMPAIGN",
    entityId: "100",
    targetState: { status: "PAUSED" },
    currentStateSnapshot: { status: "ACTIVE" },
    policyVersion: 1,
    evidenceSnapshotId: "evidence-1",
    correlationId: "correlation-1",
    createdAt: "2026-10-21T00:00:00Z",
    steps: [{ key: "pause", intent: { status: "PAUSED" } }],
  };
  let row: ExecutionRow = {
    id: "one",
    tenant_id: "a",
    command,
    command_hash: commandHash(command),
    state: "APPROVED",
    claim_token: null,
    approval_hash: commandHash(command),
    pending_action_id: "pending",
    revision: 1,
    approved_by: "owner",
    approved_at: command.createdAt,
    claimed_at: null,
    error_code: null,
  };
  let step: StepRow = {
    id: "s",
    tenant_id: "a",
    action_id: "one",
    step_key: "pause",
    ordinal: 0,
    intent: { status: "PAUSED" },
    state: "PENDING",
    attempt: 0,
    provider_object_id: null,
    receipt: null,
    verification: null,
    started_at: null,
    finished_at: null,
    error_code: null,
  };
  const repository = Object.create(ActionRepository.prototype) as ActionRepository;
  repository.find = vi.fn(async (tenant: string) => (tenant === "a" ? row : null));
  repository.claim = vi.fn(async () => {
    if (row.state !== "APPROVED") return null;
    row = { ...row, state: "CLAIMED", claim_token: "token" };
    return "token";
  });
  repository.transition = vi.fn(
    async (_t: string, _i: string, _token: string, from: ActionState, to: ActionState) => {
      if (row.state !== from) throw new Error("CONFLICT");
      row = { ...row, state: to };
    },
  );
  repository.steps = vi.fn(async () => [step]);
  repository.beginStep = vi.fn(async () => {
    if (step.state !== "PENDING") return false;
    step = { ...step, state: "SUBMITTING", attempt: step.attempt + 1 };
    return true;
  });
  repository.finishStep = vi.fn(async (_s, from, to, values) => {
    if (step.state !== from) throw new Error("CONFLICT");
    step = { ...step, ...values, state: to };
  });
  const ports: ActionExecutionPorts = {
    revalidate: vi.fn(async () => {}),
    submit: vi.fn(async () => ({ id: "100", receipt: { accepted: true } })),
    verify: vi.fn(async () => ({ matches: true, evidence: { status: "PAUSED" } })),
    verifyHierarchy: vi.fn(async () => true),
  };
  return {
    repository,
    ports,
    executor: new ActionExecutor(repository, ports),
    getRow: () => row,
    getStep: () => step,
  };
}

it("concurrent execute calls perform one provider mutation and verify before completion", async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.executor.execute("a", "one"),
    f.executor.execute("a", "one"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(f.ports.submit).toHaveBeenCalledTimes(1);
  expect(f.ports.verify).toHaveBeenCalledTimes(1);
  expect(f.getRow().state).toBe("VERIFIED");
});
it("lost response stays uncertain and cannot be blindly executed again", async () => {
  const f = fixture();
  vi.mocked(f.ports.submit).mockRejectedValue(new Error("socket closed after acceptance"));
  expect(await f.executor.execute("a", "one")).toBe("UNCERTAIN");
  await expect(f.executor.execute("a", "one")).rejects.toThrow("ACTION_ALREADY_CLAIMED");
  expect(f.getStep().state).toBe("SUBMITTING");
  expect(f.ports.submit).toHaveBeenCalledTimes(1);
});
it("rejects cross tenant and readiness failures before claim or mutation", async () => {
  const f = fixture();
  await expect(f.executor.execute("b", "one")).rejects.toThrow("ACTION_NOT_FOUND");
  vi.mocked(f.ports.revalidate).mockRejectedValue(new Error("META_WRITE_DISABLED"));
  await expect(f.executor.execute("a", "one")).rejects.toThrow("META_WRITE_DISABLED");
  expect(f.repository.claim).not.toHaveBeenCalled();
  expect(f.ports.submit).not.toHaveBeenCalled();
});
it("accepted provider response with wrong read-back is not verified", async () => {
  const f = fixture();
  vi.mocked(f.ports.verify).mockResolvedValue({ matches: false, evidence: { status: "ACTIVE" } });
  expect(await f.executor.execute("a", "one")).toBe("UNCERTAIN");
  expect(f.getStep().provider_object_id).toBe("100");
});
it("an incomplete hierarchy cannot become verified", async () => {
  const f = fixture();
  vi.mocked(f.ports.verifyHierarchy).mockResolvedValue(false);
  expect(await f.executor.execute("a", "one")).toBe("PARTIAL");
});
it("failure to persist the provider receipt remains uncertain", async () => {
  const f = fixture();
  vi.mocked(f.repository.finishStep).mockRejectedValue(new Error("database unavailable"));
  expect(await f.executor.execute("a", "one")).toBe("UNCERTAIN");
  expect(f.ports.submit).toHaveBeenCalledTimes(1);
});

it("reconciles an accepted write with lost response using provider reads without creating twice", async () => {
  const f = fixture();
  vi.mocked(f.ports.submit).mockRejectedValue(new Error("lost response"));
  await f.executor.execute("a", "one");
  const recovery = new ActionReconciliationService(f.repository, f.ports, {
    findCandidates: async () => ["100"],
  });
  expect(await recovery.reconcile("a", "one")).toBe("VERIFIED");
  expect(f.getStep().provider_object_id).toBe("100");
  expect(f.ports.submit).toHaveBeenCalledTimes(1);
});

it("zero or multiple reconciliation candidates stay uncertain, never grant automatic retry", async () => {
  for (const candidates of [[], ["100", "200"]]) {
    const f = fixture();
    vi.mocked(f.ports.submit).mockRejectedValue(new Error("lost response"));
    await f.executor.execute("a", "one");
    const recovery = new ActionReconciliationService(f.repository, f.ports, {
      findCandidates: async () => candidates,
    });
    expect(await recovery.reconcile("a", "one")).toBe("UNCERTAIN");
    expect(f.ports.submit).toHaveBeenCalledTimes(1);
  }
});

it("rejects missing frozen steps before a provider write", async () => {
  const f = fixture();
  vi.mocked(f.repository.steps).mockResolvedValue([]);
  await expect(f.executor.execute("a", "one")).rejects.toThrow("FROZEN_STEP_PLAN_MISMATCH");
  expect(f.ports.submit).not.toHaveBeenCalled();
});
