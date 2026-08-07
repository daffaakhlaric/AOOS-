import { describe, expect, it } from "vitest";

import type { CreatePolicyInput } from "../../src/contracts/i-knowledge-policy-operations.js";
import { KnowledgePolicyScopeType } from "../../src/domain/knowledge-policy-scope-type.js";
import { KnowledgePolicyState } from "../../src/domain/knowledge-policy-state.js";
import { PolicyPermissionDeniedException } from "../../src/errors/policy-permission-denied-exception.js";
import { KnowledgePolicy } from "../../src/policy/knowledge-policy.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildPolicy() {
  const { publisher, publish } = fakePublisher();
  const policy = new KnowledgePolicy(publisher);
  return { policy, publish };
}

function createInput(overrides: Partial<CreatePolicyInput> = {}): CreatePolicyInput {
  return {
    metadata: metadataFixture(),
    configuration: configurationFixture(),
    context: contextFixture(),
    ...overrides,
  };
}

async function createActivePolicy(policy: KnowledgePolicy) {
  const created = await policy.createPolicy(createInput());
  await policy.validatePolicy({ token: created.token });
  return policy.activatePolicy({ token: created.token });
}

function denyGrant(operation: string) {
  return {
    id: `deny-${operation}`,
    scope: { tenantId: "tenant-1" },
    effect: "deny" as const,
    operation,
  };
}

describe("KnowledgePolicy — createPolicy with explicit scopes", () => {
  it("stores supplied scopes on the created record", async () => {
    const { policy } = buildPolicy();
    const record = await policy.createPolicy(
      createInput({
        scopes: [
          {
            id: "scope-1",
            policyId: "policy-1",
            scopeType: KnowledgePolicyScopeType.WORKSPACE,
            metadata: {},
          },
        ],
      }),
    );
    expect(record.scopes).toHaveLength(1);
  });
});

describe("KnowledgePolicy — validatePolicy does not transition on failure", () => {
  it("returns invalid without changing state when metadata is broken post-creation", async () => {
    const { policy } = buildPolicy();
    const created = await policy.createPolicy(createInput());
    // Force an invalid state directly via the manager to exercise the "not valid" branch.
    const execution = policy.manager.require(created.token);
    policy.manager.update(created.token, {
      ...execution,
      metadata: { ...execution.metadata, policyName: "" },
    });
    const result = await policy.validatePolicy({ token: created.token });
    expect(result.valid).toBe(false);
    expect(policy.require(created.token).state).toBe(KnowledgePolicyState.CREATED);
  });
});

describe("KnowledgePolicy — permission denial across every gated operation", () => {
  it("suspendPolicy respects a deny grant", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    policy.permission.register(denyGrant("suspend_policy"));
    await expect(policy.suspendPolicy({ token: active.token })).rejects.toThrow(
      PolicyPermissionDeniedException,
    );
  });

  it("archivePolicy respects a deny grant", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    policy.permission.register(denyGrant("archive_policy"));
    await expect(policy.archivePolicy({ token: active.token })).rejects.toThrow(
      PolicyPermissionDeniedException,
    );
  });

  it("restorePolicy respects a deny grant", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    await policy.suspendPolicy({ token: active.token });
    policy.permission.register(denyGrant("restore_policy"));
    await expect(policy.restorePolicy({ token: active.token })).rejects.toThrow(
      PolicyPermissionDeniedException,
    );
  });

  it("destroyPolicy respects a deny grant", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    policy.permission.register(denyGrant("destroy_policy"));
    await expect(policy.destroyPolicy({ token: active.token })).rejects.toThrow(
      PolicyPermissionDeniedException,
    );
  });

  it("assignPolicy respects a deny grant", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    policy.permission.register(denyGrant("assign_policy"));
    await expect(
      policy.assignPolicy({ token: active.token, targetType: "workspace", targetId: "w1" }),
    ).rejects.toThrow(PolicyPermissionDeniedException);
  });

  it("unassignPolicy respects a deny grant", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    const { assignment } = await policy.assignPolicy({
      token: active.token,
      targetType: "workspace",
      targetId: "w1",
    });
    policy.permission.register(denyGrant("unassign_policy"));
    await expect(
      policy.unassignPolicy({ token: active.token, assignmentId: assignment.id }),
    ).rejects.toThrow(PolicyPermissionDeniedException);
  });
});

describe("KnowledgePolicy — full lifecycle walk", () => {
  it("walks draft -> created -> validated -> active -> suspended -> restored -> archived -> destroyed", async () => {
    const { policy } = buildPolicy();
    const created = await policy.createPolicy(createInput());
    expect(created.state).toBe(KnowledgePolicyState.CREATED);

    await policy.validatePolicy({ token: created.token });
    expect(policy.require(created.token).state).toBe(KnowledgePolicyState.VALIDATED);

    await policy.activatePolicy({ token: created.token });
    expect(policy.require(created.token).state).toBe(KnowledgePolicyState.ACTIVE);

    await policy.suspendPolicy({ token: created.token });
    expect(policy.require(created.token).state).toBe(KnowledgePolicyState.SUSPENDED);

    await policy.restorePolicy({ token: created.token });
    expect(policy.require(created.token).state).toBe(KnowledgePolicyState.RESTORED);

    await policy.archivePolicy({ token: created.token });
    expect(policy.require(created.token).state).toBe(KnowledgePolicyState.ARCHIVED);

    const destroyed = await policy.destroyPolicy({ token: created.token });
    expect(destroyed.state).toBe(KnowledgePolicyState.DESTROYED);

    const history = policy.require(created.token).history;
    expect(history.length).toBeGreaterThanOrEqual(6);
  });
});
