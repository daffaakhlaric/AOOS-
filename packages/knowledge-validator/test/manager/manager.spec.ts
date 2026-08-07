import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import type { KnowledgeValidationExecution } from "../../src/domain/knowledge-validation-execution.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { ValidatorNotFoundException } from "../../src/errors/validator-not-found-exception.js";
import { KnowledgeValidatorManager } from "../../src/manager/knowledge-validator-manager.js";
import { KnowledgeValidatorRegistry } from "../../src/registry/knowledge-validator-registry.js";
import { KnowledgeValidatorSession } from "../../src/session/knowledge-validator-session.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = "2026-01-01T00:00:00.000Z";

function buildExecution(token: string, validationId: string): KnowledgeValidationExecution {
  const context = contextFixture({ validationId, tenantId: "t-1" });
  return {
    instance: {
      id: validationId,
      token,
      validationId,
      tenantId: "t-1",
      state: KnowledgeValidationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context: { ...context, token },
    metadata: {
      validationId,
      title: "Title",
      tenantId: "t-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      validationId,
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    },
    resolvedRules: [],
    findings: [],
    resultMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

function buildManager(): KnowledgeValidatorManager {
  return new KnowledgeValidatorManager(
    new KnowledgeValidatorRegistry(),
    new KnowledgeValidatorSession(),
  );
}

describe("KnowledgeValidatorManager", () => {
  it("register stores the execution, retrievable by token", () => {
    const manager = buildManager();
    const execution = buildExecution("tok-1", "v-1");
    manager.register("tok-1", execution, {
      id: "v-1",
      token: "tok-1",
      metadata: execution.metadata,
    });
    expect(manager.get("tok-1")).toBe(execution);
  });

  it("register records the Request Category into Statistics", () => {
    const manager = buildManager();
    const execution = buildExecution("tok-1", "v-1");
    manager.register("tok-1", execution, {
      id: "v-1",
      token: "tok-1",
      metadata: execution.metadata,
    });
    expect(
      manager.statistics.get(KnowledgeValidationCategory.STRUCTURE_VALIDATION).requestedCount,
    ).toBe(1);
  });

  it("get returns undefined for an unknown token", () => {
    const manager = buildManager();
    expect(manager.get("unknown")).toBeUndefined();
  });

  it("require throws ValidatorNotFoundException for an unknown token", () => {
    const manager = buildManager();
    expect(() => manager.require("unknown")).toThrow(ValidatorNotFoundException);
  });

  it("require returns the execution for a known token", () => {
    const manager = buildManager();
    const execution = buildExecution("tok-1", "v-1");
    manager.register("tok-1", execution, {
      id: "v-1",
      token: "tok-1",
      metadata: execution.metadata,
    });
    expect(manager.require("tok-1")).toBe(execution);
  });

  it("update replaces the execution for a known token", () => {
    const manager = buildManager();
    const execution = buildExecution("tok-1", "v-1");
    manager.register("tok-1", execution, {
      id: "v-1",
      token: "tok-1",
      metadata: execution.metadata,
    });
    const updated = { ...execution, findings: [] };
    manager.update("tok-1", updated);
    expect(manager.get("tok-1")).toBe(updated);
  });

  it("update throws ValidatorNotFoundException for an unknown token", () => {
    const manager = buildManager();
    expect(() => manager.update("unknown", buildExecution("tok-1", "v-1"))).toThrow(
      ValidatorNotFoundException,
    );
  });

  it("unregister removes a known token and returns true", () => {
    const manager = buildManager();
    const execution = buildExecution("tok-1", "v-1");
    manager.register("tok-1", execution, {
      id: "v-1",
      token: "tok-1",
      metadata: execution.metadata,
    });
    expect(manager.unregister("tok-1")).toBe(true);
    expect(manager.get("tok-1")).toBeUndefined();
  });

  it("unregister returns false for an unknown token", () => {
    const manager = buildManager();
    expect(manager.unregister("unknown")).toBe(false);
  });

  it("list returns every registered execution", () => {
    const manager = buildManager();
    manager.register("tok-1", buildExecution("tok-1", "v-1"), {
      id: "v-1",
      token: "tok-1",
      metadata: {} as never,
    });
    manager.register("tok-2", buildExecution("tok-2", "v-2"), {
      id: "v-2",
      token: "tok-2",
      metadata: {} as never,
    });
    expect(manager.list()).toHaveLength(2);
  });

  it("count reflects the number of registered executions", () => {
    const manager = buildManager();
    manager.register("tok-1", buildExecution("tok-1", "v-1"), {
      id: "v-1",
      token: "tok-1",
      metadata: {} as never,
    });
    expect(manager.count()).toBe(1);
  });

  describe("Job Ledger", () => {
    it("registerJob + getJob round-trips a job", () => {
      const manager = buildManager();
      manager.registerJob({
        id: "j-1",
        jobId: "j-1",
        validationId: "v-1",
        tenantId: "t-1",
        priority: 5,
        createdAt: now,
      });
      expect(manager.getJob("j-1")?.jobId).toBe("j-1");
    });

    it("getJob returns undefined for an unknown id", () => {
      const manager = buildManager();
      expect(manager.getJob("unknown")).toBeUndefined();
    });

    it("requireJob throws ValidatorNotFoundException for an unknown id", () => {
      const manager = buildManager();
      expect(() => manager.requireJob("unknown")).toThrow(ValidatorNotFoundException);
    });

    it("updateJob throws for an unregistered job", () => {
      const manager = buildManager();
      expect(() =>
        manager.updateJob({
          id: "j-1",
          jobId: "j-1",
          validationId: "v-1",
          tenantId: "t-1",
          priority: 5,
          createdAt: now,
        }),
      ).toThrow(ValidatorNotFoundException);
    });

    it("updateJob replaces a registered job", () => {
      const manager = buildManager();
      manager.registerJob({
        id: "j-1",
        jobId: "j-1",
        validationId: "v-1",
        tenantId: "t-1",
        priority: 5,
        createdAt: now,
      });
      const updated = manager.updateJob({
        id: "j-1",
        jobId: "j-1",
        validationId: "v-1",
        tenantId: "t-1",
        priority: 5,
        createdAt: now,
        completedAt: now,
      });
      expect(updated.completedAt).toBe(now);
    });

    it("listJobs returns every registered job", () => {
      const manager = buildManager();
      manager.registerJob({
        id: "j-1",
        jobId: "j-1",
        validationId: "v-1",
        tenantId: "t-1",
        priority: 5,
        createdAt: now,
      });
      expect(manager.listJobs()).toHaveLength(1);
    });
  });
});
