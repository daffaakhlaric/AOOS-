import { describe, expect, it } from "vitest";

import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "../../src/domain/knowledge-generator-execution.js";
import { GeneratorNotFoundException } from "../../src/errors/generator-not-found-exception.js";
import { KnowledgeGeneratorManager } from "../../src/manager/knowledge-generator-manager.js";
import type { KnowledgeGeneratorRegistryEntry } from "../../src/registry/knowledge-generator-registry-entry.js";
import { KnowledgeGeneratorRegistry } from "../../src/registry/knowledge-generator-registry.js";
import { KnowledgeGeneratorSession } from "../../src/session/knowledge-generator-session.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(token: string, generationId: string): KnowledgeGeneratorExecution {
  return {
    instance: {
      id: generationId,
      token,
      generationId,
      tenantId: "tenant-1",
      state: KnowledgeGenerationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture({ generationId, token }),
    metadata: {
      generationId,
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      generationId,
      assetType: KnowledgeGenerationAssetType.FAQ,
      mode: KnowledgeGenerationMode.CREATE,
      providerType: KnowledgeGenerationProviderType.OPENAI,
      requestedBy: "user-1",
      createdAt: now,
    },
    history: [],
    auditTrail: [],
    logs: [],
  };
}

function buildManager(): KnowledgeGeneratorManager {
  return new KnowledgeGeneratorManager(
    new KnowledgeGeneratorRegistry(),
    new KnowledgeGeneratorSession(),
  );
}

describe("KnowledgeGeneratorManager", () => {
  it("register() stores the execution and Registry entry", () => {
    const manager = buildManager();
    const execution = buildExecution("kgen_1", "g-1");
    const entry: KnowledgeGeneratorRegistryEntry = {
      id: "g-1",
      token: "kgen_1",
      metadata: execution.metadata,
    };
    manager.register("kgen_1", execution, entry);
    expect(manager.get("kgen_1")).toBe(execution);
    expect(manager.count()).toBe(1);
  });

  it("register() records requested statistics", () => {
    const manager = buildManager();
    const execution = buildExecution("kgen_1", "g-1");
    manager.register("kgen_1", execution, {
      id: "g-1",
      token: "kgen_1",
      metadata: execution.metadata,
    });
    expect(manager.statistics.get(KnowledgeGenerationAssetType.FAQ).requestedCount).toBe(1);
  });

  it("get() returns undefined for an unknown token", () => {
    expect(buildManager().get("kgen_missing")).toBeUndefined();
  });

  it("require() throws GeneratorNotFoundException for an unknown token", () => {
    expect(() => buildManager().require("kgen_missing")).toThrow(GeneratorNotFoundException);
  });

  it("require() returns the execution for a known token", () => {
    const manager = buildManager();
    const execution = buildExecution("kgen_1", "g-1");
    manager.register("kgen_1", execution, {
      id: "g-1",
      token: "kgen_1",
      metadata: execution.metadata,
    });
    expect(manager.require("kgen_1")).toBe(execution);
  });

  it("update() replaces the stored execution", () => {
    const manager = buildManager();
    const execution = buildExecution("kgen_1", "g-1");
    manager.register("kgen_1", execution, {
      id: "g-1",
      token: "kgen_1",
      metadata: execution.metadata,
    });
    const updated = { ...execution, metadata: { ...execution.metadata, title: "Updated" } };
    manager.update("kgen_1", updated);
    expect(manager.get("kgen_1")?.metadata.title).toBe("Updated");
  });

  it("update() throws GeneratorNotFoundException for an unknown token", () => {
    const manager = buildManager();
    expect(() => manager.update("kgen_missing", buildExecution("kgen_missing", "g-x"))).toThrow(
      GeneratorNotFoundException,
    );
  });

  it("unregister() removes the execution and returns true", () => {
    const manager = buildManager();
    const execution = buildExecution("kgen_1", "g-1");
    manager.register("kgen_1", execution, {
      id: "g-1",
      token: "kgen_1",
      metadata: execution.metadata,
    });
    expect(manager.unregister("kgen_1")).toBe(true);
    expect(manager.get("kgen_1")).toBeUndefined();
  });

  it("unregister() returns false for an unknown token", () => {
    expect(buildManager().unregister("kgen_missing")).toBe(false);
  });

  it("list() returns every registered execution", () => {
    const manager = buildManager();
    const a = buildExecution("kgen_1", "g-1");
    const b = buildExecution("kgen_2", "g-2");
    manager.register("kgen_1", a, { id: "g-1", token: "kgen_1", metadata: a.metadata });
    manager.register("kgen_2", b, { id: "g-2", token: "kgen_2", metadata: b.metadata });
    expect(manager.list()).toHaveLength(2);
  });

  it("count() reflects the number of registered executions", () => {
    const manager = buildManager();
    expect(manager.count()).toBe(0);
    const execution = buildExecution("kgen_1", "g-1");
    manager.register("kgen_1", execution, {
      id: "g-1",
      token: "kgen_1",
      metadata: execution.metadata,
    });
    expect(manager.count()).toBe(1);
  });
});
