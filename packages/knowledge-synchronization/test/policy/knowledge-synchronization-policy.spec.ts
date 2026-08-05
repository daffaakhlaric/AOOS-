import { describe, expect, it } from "vitest";

import { KnowledgeConflictResolutionStrategy } from "../../src/domain/knowledge-conflict-resolution-strategy.js";
import { KnowledgeSynchronizationMode } from "../../src/domain/knowledge-synchronization-mode.js";
import { ConflictResolutionNotSupportedException } from "../../src/errors/conflict-resolution-not-supported-exception.js";
import { KnowledgeSynchronizationPolicy } from "../../src/policy/knowledge-synchronization-policy.js";
import { KnowledgeSynchronizationRegistry } from "../../src/registry/knowledge-synchronization-registry.js";
import { jobFixture } from "../helpers/job-fixture.js";

describe("KnowledgeSynchronizationPolicy — Policy evaluation", () => {
  it("allows a Job when no Policy is registered", () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    expect(policy.evaluate(jobFixture())).toEqual([]);
  });

  it("applicablePolicies() only returns enabled Policies whose scope covers the Job", () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    policy.register({
      id: "p-enabled",
      name: "Enabled",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    policy.register({
      id: "p-disabled",
      name: "Disabled",
      scope: { tenantId: "tenant-1" },
      enabled: false,
      createdAt: new Date().toISOString(),
    });
    policy.register({
      id: "p-other-tenant",
      name: "Other tenant",
      scope: { tenantId: "other" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    expect(policy.applicablePolicies(jobFixture()).map((p) => p.id)).toEqual(["p-enabled"]);
  });

  it("applicablePolicies() excludes a Policy scoped to a different workspaceId", () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    policy.register({
      id: "p-workspace",
      name: "Workspace scoped",
      scope: { tenantId: "tenant-1", workspaceId: "other-workspace" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    expect(policy.applicablePolicies(jobFixture()).map((p) => p.id)).toEqual([]);
  });

  it("applicablePolicies() includes a Policy scoped to the Job's workspaceId", () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    policy.register({
      id: "p-workspace",
      name: "Workspace scoped",
      scope: { tenantId: "tenant-1", workspaceId: "workspace-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    expect(policy.applicablePolicies(jobFixture()).map((p) => p.id)).toEqual(["p-workspace"]);
  });

  it("flags a violation when the Job's mode is not in allowedModes", () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    policy.register({
      id: "p-1",
      name: "Manual only",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      allowedModes: [KnowledgeSynchronizationMode.SCHEDULED],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(jobFixture({ mode: KnowledgeSynchronizationMode.MANUAL }));
    expect(violations).toHaveLength(1);
  });

  it("flags a violation when the Job's mode is in deniedModes", () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    policy.register({
      id: "p-1",
      name: "No streaming",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedModes: [KnowledgeSynchronizationMode.STREAMING],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(
      jobFixture({ mode: KnowledgeSynchronizationMode.STREAMING }),
    );
    expect(violations).toHaveLength(1);
  });

  it("passes when the Job's mode is within allowedModes", () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    policy.register({
      id: "p-1",
      name: "Manual allowed",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      allowedModes: [KnowledgeSynchronizationMode.MANUAL],
      createdAt: new Date().toISOString(),
    });
    expect(policy.evaluate(jobFixture({ mode: KnowledgeSynchronizationMode.MANUAL }))).toEqual([]);
  });
});

describe("KnowledgeSynchronizationPolicy — Conflict Resolution", () => {
  it("returns changes unchanged when no strategy is requested", async () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    const changes = [{ id: "c-1" }] as never;
    expect(await policy.resolveConflicts(changes)).toBe(changes);
  });

  it("dispatches to the registered resolver for a requested strategy", async () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    const resolved = [{ id: "resolved" }] as never;
    policy.registerConflictResolver({
      id: "resolver-1",
      strategy: KnowledgeConflictResolutionStrategy.LAST_WRITE_WINS,
      resolve: async () => resolved,
    });
    const result = await policy.resolveConflicts(
      [],
      KnowledgeConflictResolutionStrategy.LAST_WRITE_WINS,
    );
    expect(result).toBe(resolved);
  });

  it("throws ConflictResolutionNotSupportedException for an unregistered requested strategy", async () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    await expect(
      policy.resolveConflicts([], KnowledgeConflictResolutionStrategy.MERGE),
    ).rejects.toThrow(ConflictResolutionNotSupportedException);
  });

  it("isConflictResolutionSupported() reflects registration state", () => {
    const policy = new KnowledgeSynchronizationPolicy(new KnowledgeSynchronizationRegistry());
    expect(policy.isConflictResolutionSupported(KnowledgeConflictResolutionStrategy.CUSTOM)).toBe(
      false,
    );
    policy.registerConflictResolver({
      id: "resolver-1",
      strategy: KnowledgeConflictResolutionStrategy.CUSTOM,
      resolve: async (changes) => changes,
    });
    expect(policy.isConflictResolutionSupported(KnowledgeConflictResolutionStrategy.CUSTOM)).toBe(
      true,
    );
  });
});
