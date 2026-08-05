import { describe, expect, it } from "vitest";

import { knowledgeRuntimeCacheReferenceSchema } from "../../src/domain/knowledge-runtime-cache-reference.js";
import {
  advanceCursor,
  knowledgeRuntimeCursorSchema,
  resetCursor,
} from "../../src/domain/knowledge-runtime-cursor.js";
import { knowledgeRuntimeHistoryEntrySchema } from "../../src/domain/knowledge-runtime-history.js";
import { knowledgeRuntimeInstanceSchema } from "../../src/domain/knowledge-runtime-instance.js";
import {
  isLeaseExpired,
  knowledgeRuntimeLeaseSchema,
} from "../../src/domain/knowledge-runtime-lease.js";
import {
  EMPTY_KNOWLEDGE_RUNTIME_METADATA,
  knowledgeRuntimeMetadataSchema,
} from "../../src/domain/knowledge-runtime-metadata.js";
import { KnowledgeRuntimeState } from "../../src/domain/knowledge-runtime-state.js";
import {
  EMPTY_KNOWLEDGE_RUNTIME_STATISTICS,
  knowledgeRuntimeStatisticsSchema,
} from "../../src/domain/knowledge-runtime-statistics.js";

describe("Domain Test — schemas", () => {
  it("knowledgeRuntimeHistoryEntrySchema accepts a valid entry", () => {
    const result = knowledgeRuntimeHistoryEntrySchema.safeParse({
      sequence: 0,
      fromState: KnowledgeRuntimeState.CREATED,
      toState: KnowledgeRuntimeState.LOADING,
      occurredAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("knowledgeRuntimeMetadataSchema accepts EMPTY_KNOWLEDGE_RUNTIME_METADATA", () => {
    expect(knowledgeRuntimeMetadataSchema.safeParse(EMPTY_KNOWLEDGE_RUNTIME_METADATA).success).toBe(
      true,
    );
  });

  it("knowledgeRuntimeStatisticsSchema accepts EMPTY_KNOWLEDGE_RUNTIME_STATISTICS", () => {
    expect(
      knowledgeRuntimeStatisticsSchema.safeParse(EMPTY_KNOWLEDGE_RUNTIME_STATISTICS).success,
    ).toBe(true);
  });

  it("knowledgeRuntimeCursorSchema/advanceCursor/resetCursor work together", () => {
    const cursor = resetCursor("ktok_1");
    expect(knowledgeRuntimeCursorSchema.safeParse(cursor).success).toBe(true);
    const advanced = advanceCursor(cursor, 3);
    expect(advanced.position).toBe(3);
  });

  it("knowledgeRuntimeLeaseSchema accepts a valid Lease; isLeaseExpired() reflects expiresAt", () => {
    const lease = {
      id: "l-1",
      token: "ktok_1",
      holder: "user-1",
      acquiredAt: new Date(0).toISOString(),
      expiresAt: new Date(0).toISOString(),
    };
    expect(knowledgeRuntimeLeaseSchema.safeParse(lease).success).toBe(true);
    expect(isLeaseExpired(lease, new Date(1000))).toBe(true);
    expect(
      isLeaseExpired({ ...lease, expiresAt: new Date(2000).toISOString() }, new Date(1000)),
    ).toBe(false);
  });

  it("knowledgeRuntimeCacheReferenceSchema accepts a valid reference", () => {
    const result = knowledgeRuntimeCacheReferenceSchema.safeParse({
      cacheKey: "k-1",
      cachedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("knowledgeRuntimeInstanceSchema accepts a minimal valid Instance", () => {
    const now = new Date().toISOString();
    const result = knowledgeRuntimeInstanceSchema.safeParse({
      id: "i-1",
      token: "ktok_1",
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      state: KnowledgeRuntimeState.CREATED,
      metadata: EMPTY_KNOWLEDGE_RUNTIME_METADATA,
      statistics: EMPTY_KNOWLEDGE_RUNTIME_STATISTICS,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it("knowledgeRuntimeInstanceSchema rejects a missing tenantId", () => {
    const now = new Date().toISOString();
    const result = knowledgeRuntimeInstanceSchema.safeParse({
      id: "i-1",
      token: "ktok_1",
      knowledgeId: "k-1",
      state: KnowledgeRuntimeState.CREATED,
      metadata: EMPTY_KNOWLEDGE_RUNTIME_METADATA,
      statistics: EMPTY_KNOWLEDGE_RUNTIME_STATISTICS,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(false);
  });
});
