import { describe, expect, it } from "vitest";

import type { CreatePolicyInput } from "../../src/contracts/i-knowledge-policy-operations.js";
import { KnowledgePolicyRuleType } from "../../src/domain/knowledge-policy-rule-type.js";
import { KnowledgePolicyState } from "../../src/domain/knowledge-policy-state.js";
import { PolicyNotFoundException } from "../../src/errors/policy-not-found-exception.js";
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

describe("KnowledgePolicy — construction", () => {
  it("composes all sub-modules", () => {
    const { policy } = buildPolicy();
    expect(policy.registry).toBeTruthy();
    expect(policy.manager).toBeTruthy();
    expect(policy.stateMachine).toBeTruthy();
    expect(policy.validator).toBeTruthy();
    expect(policy.pipeline).toBeTruthy();
    expect(policy.middleware).toBeTruthy();
    expect(policy.resolver).toBeTruthy();
    expect(policy.events).toBeTruthy();
    expect(policy.metrics).toBeTruthy();
    expect(policy.health).toBeTruthy();
    expect(policy.monitoring).toBeTruthy();
    expect(policy.statistics).toBeTruthy();
    expect(policy.lifecycle).toBeTruthy();
    expect(policy.factory).toBeTruthy();
    expect(policy.permission).toBeTruthy();
    expect(policy.session).toBeTruthy();
  });

  it("use() registers middleware and returns this for chaining", () => {
    const { policy } = buildPolicy();
    const result = policy.use(() => undefined);
    expect(result).toBe(policy);
    expect(policy.middleware.size).toBe(1);
  });
});

describe("KnowledgePolicy — createPolicy", () => {
  it("creates a policy in CREATED state and publishes PolicyCreated", async () => {
    const { policy, publish } = buildPolicy();
    const record = await policy.createPolicy(createInput());
    expect(record.state).toBe(KnowledgePolicyState.CREATED);
    expect(record.policyId).toBe("policy-1");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(policy.count()).toBe(1);
  });

  it("throws PolicyPermissionDeniedException when a deny grant matches", async () => {
    const { policy } = buildPolicy();
    policy.permission.register({ id: "deny-1", scope: { tenantId: "tenant-1" }, effect: "deny" });
    await expect(policy.createPolicy(createInput())).rejects.toThrow(
      PolicyPermissionDeniedException,
    );
  });

  it("runs registered middleware during createPolicy", async () => {
    const { policy } = buildPolicy();
    let called = false;
    policy.use((_execution, next) => {
      called = true;
      return next();
    });
    await policy.createPolicy(createInput());
    expect(called).toBe(true);
  });
});

describe("KnowledgePolicy — validatePolicy", () => {
  it("transitions to VALIDATED on success and publishes PolicyValidated", async () => {
    const { policy, publish } = buildPolicy();
    const created = await policy.createPolicy(createInput());
    const result = await policy.validatePolicy({ token: created.token });
    expect(result.valid).toBe(true);
    expect(policy.require(created.token).state).toBe(KnowledgePolicyState.VALIDATED);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it("throws PolicyNotFoundException for an unknown token", async () => {
    const { policy } = buildPolicy();
    await expect(policy.validatePolicy({ token: "missing" })).rejects.toThrow(
      PolicyNotFoundException,
    );
  });
});

describe("KnowledgePolicy — activatePolicy", () => {
  it("transitions to ACTIVE, records statistics/metrics, and publishes PolicyActivated", async () => {
    const { policy } = buildPolicy();
    const created = await policy.createPolicy(createInput());
    await policy.validatePolicy({ token: created.token });
    const activated = await policy.activatePolicy({ token: created.token, reason: "go-live" });
    expect(activated.state).toBe(KnowledgePolicyState.ACTIVE);
    expect(policy.metrics.snapshot().activePolicyCount).toBe(1);
    expect(policy.statistics.get(activated.policyType).activatedCount).toBe(1);
  });

  it("throws PolicyPermissionDeniedException when denied", async () => {
    const { policy } = buildPolicy();
    const created = await policy.createPolicy(createInput());
    await policy.validatePolicy({ token: created.token });
    policy.permission.register({
      id: "deny-activate",
      scope: { tenantId: "tenant-1" },
      effect: "deny",
      operation: "activate_policy",
    });
    await expect(policy.activatePolicy({ token: created.token })).rejects.toThrow(
      PolicyPermissionDeniedException,
    );
  });
});

describe("KnowledgePolicy — suspendPolicy", () => {
  it("transitions ACTIVE -> SUSPENDED", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    const suspended = await policy.suspendPolicy({ token: active.token });
    expect(suspended.state).toBe(KnowledgePolicyState.SUSPENDED);
  });
});

describe("KnowledgePolicy — restorePolicy", () => {
  it("transitions SUSPENDED -> RESTORED", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    await policy.suspendPolicy({ token: active.token });
    const restored = await policy.restorePolicy({ token: active.token });
    expect(restored.state).toBe(KnowledgePolicyState.RESTORED);
    expect(policy.metrics.snapshot().restoreCount).toBe(1);
  });
});

describe("KnowledgePolicy — archivePolicy", () => {
  it("transitions RESTORED -> ARCHIVED", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    await policy.suspendPolicy({ token: active.token });
    await policy.restorePolicy({ token: active.token });
    const archived = await policy.archivePolicy({ token: active.token });
    expect(archived.state).toBe(KnowledgePolicyState.ARCHIVED);
    expect(policy.metrics.snapshot().archiveCount).toBe(1);
  });
});

describe("KnowledgePolicy — destroyPolicy", () => {
  it("transitions ARCHIVED -> DESTROYED, a terminal state", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    await policy.suspendPolicy({ token: active.token });
    await policy.restorePolicy({ token: active.token });
    await policy.archivePolicy({ token: active.token });
    const destroyed = await policy.destroyPolicy({ token: active.token });
    expect(destroyed.state).toBe(KnowledgePolicyState.DESTROYED);
  });
});

describe("KnowledgePolicy — assignPolicy / unassignPolicy", () => {
  it("assignPolicy() creates and registers an assignment", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    const result = await policy.assignPolicy({
      token: active.token,
      targetType: "workspace",
      targetId: "workspace-9",
    });
    expect(result.assignment.targetId).toBe("workspace-9");
    expect(result.policy.assignments).toHaveLength(1);
    expect(policy.metrics.snapshot().assignmentCount).toBe(1);
  });

  it("unassignPolicy() removes the assignment", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    const { assignment } = await policy.assignPolicy({
      token: active.token,
      targetType: "workspace",
      targetId: "workspace-9",
    });
    const result = await policy.unassignPolicy({
      token: active.token,
      assignmentId: assignment.id,
    });
    expect(result.assignments).toHaveLength(0);
  });
});

describe("KnowledgePolicy — evaluatePolicy", () => {
  it("returns PASS when no rule denies", async () => {
    const { policy } = buildPolicy();
    const active = await createActivePolicy(policy);
    const { evaluation } = await policy.evaluatePolicy({
      token: active.token,
      targetId: "target-1",
    });
    expect(evaluation.result).toBe("pass");
    expect(evaluation.violations).toEqual([]);
    expect(policy.metrics.snapshot().evaluationCount).toBe(1);
  });

  it("returns FAIL with a violation when an enabled deny rule matches", async () => {
    const { policy } = buildPolicy();
    const created = await policy.createPolicy(
      createInput({
        rules: [
          {
            id: "rule-1",
            policyId: "policy-1",
            name: "Deny All",
            ruleType: KnowledgePolicyRuleType.DENY,
            priority: 0,
            conditions: [],
            actions: [],
            enabled: true,
            metadata: {},
          },
        ],
      }),
    );
    await policy.validatePolicy({ token: created.token });
    await policy.activatePolicy({ token: created.token });
    const { evaluation } = await policy.evaluatePolicy({
      token: created.token,
      targetId: "target-1",
    });
    expect(evaluation.result).toBe("fail");
    expect(evaluation.violations).toHaveLength(1);
  });

  it("skips disabled rules", async () => {
    const { policy } = buildPolicy();
    const created = await policy.createPolicy(
      createInput({
        rules: [
          {
            id: "rule-1",
            policyId: "policy-1",
            name: "Deny All",
            ruleType: KnowledgePolicyRuleType.DENY,
            priority: 0,
            conditions: [],
            actions: [],
            enabled: false,
            metadata: {},
          },
        ],
      }),
    );
    const { evaluation } = await policy.evaluatePolicy({
      token: created.token,
      targetId: "target-1",
    });
    expect(evaluation.result).toBe("pass");
  });
});

describe("KnowledgePolicy — read accessors", () => {
  it("get() returns undefined for an unknown token", () => {
    const { policy } = buildPolicy();
    expect(policy.get("missing")).toBeUndefined();
  });

  it("get() returns a record for a known token", async () => {
    const { policy } = buildPolicy();
    const created = await policy.createPolicy(createInput());
    expect(policy.get(created.token)?.policyId).toBe("policy-1");
  });

  it("require() throws PolicyNotFoundException for an unknown token", () => {
    const { policy } = buildPolicy();
    expect(() => policy.require("missing")).toThrow(PolicyNotFoundException);
  });

  it("list() and count() reflect registered policies", async () => {
    const { policy } = buildPolicy();
    expect(policy.count()).toBe(0);
    await policy.createPolicy(createInput());
    expect(policy.list()).toHaveLength(1);
    expect(policy.count()).toBe(1);
  });
});
