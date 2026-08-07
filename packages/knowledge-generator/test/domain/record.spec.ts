import { describe, expect, it } from "vitest";

import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationRecord } from "../../src/domain/knowledge-generation-record.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "../../src/domain/knowledge-generator-execution.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(): KnowledgeGeneratorExecution {
  const context = contextFixture({ generationId: "g-1", token: "kgen_record" });
  return {
    instance: {
      id: "g-1",
      token: "kgen_record",
      generationId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeGenerationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context,
    metadata: {
      generationId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      generationId: "g-1",
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

describe("KnowledgeGenerationRecord", () => {
  it("exposes id/token/generationId/state", () => {
    const record = new KnowledgeGenerationRecord(buildExecution());
    expect(record.id).toBe("g-1");
    expect(record.token).toBe("kgen_record");
    expect(record.generationId).toBe("g-1");
    expect(record.state).toBe(KnowledgeGenerationState.DRAFT);
  });

  it("exposes metadata/request/context", () => {
    const record = new KnowledgeGenerationRecord(buildExecution());
    expect(record.metadata.title).toBe("Title");
    expect(record.request.assetType).toBe(KnowledgeGenerationAssetType.FAQ);
    expect(record.context.tenantId).toBe("tenant-1");
  });

  it("exposes undefined optional fields when unresolved", () => {
    const record = new KnowledgeGenerationRecord(buildExecution());
    expect(record.result).toBeUndefined();
    expect(record.contextReference).toBeUndefined();
    expect(record.promptReference).toBeUndefined();
    expect(record.policy).toBeUndefined();
    expect(record.configuration).toBeUndefined();
  });

  it("exposes empty history/auditTrail/logs on a fresh execution", () => {
    const record = new KnowledgeGenerationRecord(buildExecution());
    expect(record.history).toEqual([]);
    expect(record.auditTrail).toEqual([]);
    expect(record.logs).toEqual([]);
  });

  it("toExecution() returns the underlying execution envelope", () => {
    const execution = buildExecution();
    const record = new KnowledgeGenerationRecord(execution);
    expect(record.toExecution()).toBe(execution);
  });
});
