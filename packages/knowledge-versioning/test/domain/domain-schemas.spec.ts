import { describe, expect, it } from "vitest";

import { KnowledgeBranchType } from "../../src/domain/knowledge-branch-type.js";
import { knowledgeBranchSchema } from "../../src/domain/knowledge-branch.js";
import { knowledgeComparisonSchema } from "../../src/domain/knowledge-comparison.js";
import { KnowledgeHistory } from "../../src/domain/knowledge-history.js";
import { KnowledgeLineage } from "../../src/domain/knowledge-lineage.js";
import { knowledgeMergeSchema } from "../../src/domain/knowledge-merge.js";
import { knowledgeRevisionSchema } from "../../src/domain/knowledge-revision.js";
import { knowledgeRollbackSchema } from "../../src/domain/knowledge-rollback.js";
import { knowledgeSnapshotSchema } from "../../src/domain/knowledge-snapshot.js";
import { knowledgeVersionAuditEntrySchema } from "../../src/domain/knowledge-version-audit.js";
import { knowledgeVersionInstanceSchema } from "../../src/domain/knowledge-version-instance.js";
import { knowledgeVersionLogEntrySchema } from "../../src/domain/knowledge-version-log.js";
import { knowledgeVersionMetadataSchema } from "../../src/domain/knowledge-version-metadata.js";
import { KnowledgeVersionOperation } from "../../src/domain/knowledge-version-operation.js";
import { knowledgeVersionStateSchema } from "../../src/domain/knowledge-version-state-schema.js";
import {
  KNOWLEDGE_VERSION_SETTLED_STATES,
  KNOWLEDGE_VERSION_STATE_TRANSITIONS,
  KNOWLEDGE_VERSION_TERMINAL_STATES,
  KnowledgeVersionState,
} from "../../src/domain/knowledge-version-state.js";
import {
  EMPTY_KNOWLEDGE_VERSION_STATISTICS,
  knowledgeVersionStatisticsSnapshotSchema,
} from "../../src/domain/knowledge-version-statistics-snapshot.js";
import { knowledgeVersionTraceSchema } from "../../src/domain/knowledge-version-trace.js";
import {
  NUMERIC_KNOWLEDGE_VERSION_TYPES,
  KnowledgeVersionType,
} from "../../src/domain/knowledge-version-type.js";
import { KnowledgeVersion } from "../../src/domain/knowledge-version.js";
import { VersionLineageException } from "../../src/errors/version-lineage-exception.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("domain schemas", () => {
  it("validates a KnowledgeBranch", () => {
    const branch = {
      id: "b1",
      name: "main",
      branchType: KnowledgeBranchType.MAIN,
      assetId: "asset-1",
      tenantId: "tenant-1",
      createdAt: new Date().toISOString(),
    };
    expect(knowledgeBranchSchema.parse(branch)).toEqual(branch);
  });

  it("validates a KnowledgeComparison", () => {
    const comparison = {
      id: "c1",
      leftVersionId: "v1",
      rightVersionId: "v2",
      comparedAt: new Date().toISOString(),
    };
    expect(knowledgeComparisonSchema.parse(comparison)).toEqual(comparison);
  });

  it("validates a KnowledgeMerge", () => {
    const merge = {
      id: "m1",
      sourceVersionId: "v1",
      targetVersionId: "v2",
      occurredAt: new Date().toISOString(),
    };
    expect(knowledgeMergeSchema.parse(merge)).toEqual(merge);
  });

  it("validates a KnowledgeRevision", () => {
    const revision = {
      id: "rev-1",
      versionId: "v1",
      revisionNumber: 1,
      createdAt: new Date().toISOString(),
    };
    expect(knowledgeRevisionSchema.parse(revision)).toEqual(revision);
    expect(() => knowledgeRevisionSchema.parse({})).toThrow();
  });

  it("validates a KnowledgeRollback", () => {
    const rollback = {
      id: "r1",
      versionId: "v1",
      targetVersionId: "v0",
      occurredAt: new Date().toISOString(),
    };
    expect(knowledgeRollbackSchema.parse(rollback)).toEqual(rollback);
  });

  it("validates a KnowledgeSnapshot", () => {
    const snapshot = {
      id: "s1",
      versionId: "v1",
      capturedState: KnowledgeVersionState.DRAFT,
      capturedAt: new Date().toISOString(),
    };
    expect(knowledgeSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("validates a KnowledgeVersionAuditEntry", () => {
    const audit = {
      id: "a1",
      operation: "createVersion",
      versionId: "v1",
      tenantId: "tenant-1",
      occurredAt: new Date().toISOString(),
    };
    expect(knowledgeVersionAuditEntrySchema.parse(audit)).toEqual(audit);
  });

  it("validates a KnowledgeVersionInstance", () => {
    const instance = {
      id: "i1",
      token: "kver_1",
      versionId: "v1",
      assetId: "a1",
      tenantId: "tenant-1",
      state: KnowledgeVersionState.DRAFT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(knowledgeVersionInstanceSchema.parse(instance)).toEqual(instance);
  });

  it("validates a KnowledgeVersionLogEntry", () => {
    const log = {
      sequence: 0,
      level: "info" as const,
      operation: "createVersion",
      message: "done",
      occurredAt: new Date().toISOString(),
    };
    expect(knowledgeVersionLogEntrySchema.parse(log)).toEqual(log);
  });

  it("validates a KnowledgeVersionMetadata", () => {
    const metadata = metadataFixture();
    expect(knowledgeVersionMetadataSchema.parse(metadata)).toEqual(metadata);
  });

  it("validates knowledgeVersionStateSchema", () => {
    expect(knowledgeVersionStateSchema.parse(KnowledgeVersionState.DRAFT)).toBe(
      KnowledgeVersionState.DRAFT,
    );
    expect(() => knowledgeVersionStateSchema.parse("bogus")).toThrow();
  });

  it("validates knowledgeVersionStatisticsSnapshotSchema and EMPTY constant", () => {
    expect(
      knowledgeVersionStatisticsSnapshotSchema.parse(EMPTY_KNOWLEDGE_VERSION_STATISTICS),
    ).toEqual(EMPTY_KNOWLEDGE_VERSION_STATISTICS);
  });

  it("validates a KnowledgeVersionTrace", () => {
    const trace = {
      traceId: "t1",
      correlationId: "c1",
      operation: "createVersion",
      tracedAt: new Date().toISOString(),
      runCount: 1,
    };
    expect(knowledgeVersionTraceSchema.parse(trace)).toEqual(trace);
  });

  it("exposes the exact 10 KnowledgeVersionTypes", () => {
    expect(Object.values(KnowledgeVersionType)).toHaveLength(10);
  });

  it("marks MAJOR/MINOR/PATCH/RELEASE/HOTFIX as numeric types", () => {
    expect(NUMERIC_KNOWLEDGE_VERSION_TYPES.has(KnowledgeVersionType.MAJOR)).toBe(true);
    expect(NUMERIC_KNOWLEDGE_VERSION_TYPES.has(KnowledgeVersionType.DRAFT)).toBe(false);
  });

  it("exposes the exact 11 KnowledgeVersionStates", () => {
    expect(Object.values(KnowledgeVersionState)).toHaveLength(11);
  });

  it("marks DESTROYED as the sole terminal state", () => {
    expect(KNOWLEDGE_VERSION_TERMINAL_STATES.size).toBe(1);
    expect(KNOWLEDGE_VERSION_TERMINAL_STATES.has(KnowledgeVersionState.DESTROYED)).toBe(true);
  });

  it("has no outgoing transitions from DESTROYED", () => {
    expect(KNOWLEDGE_VERSION_STATE_TRANSITIONS[KnowledgeVersionState.DESTROYED]).toEqual([]);
  });

  it("marks settled states", () => {
    expect(KNOWLEDGE_VERSION_SETTLED_STATES.has(KnowledgeVersionState.ARCHIVED)).toBe(true);
    expect(KNOWLEDGE_VERSION_SETTLED_STATES.has(KnowledgeVersionState.DRAFT)).toBe(false);
  });

  it("exposes the exact 11 KnowledgeVersionOperations", () => {
    expect(Object.values(KnowledgeVersionOperation)).toHaveLength(11);
  });
});

describe("KnowledgeHistory", () => {
  it("records entries with sequence and reads them back", () => {
    const history = new KnowledgeHistory("v1");
    expect(history.id).toBe("v1");
    expect(history.count()).toBe(0);
    const entry = history.record({ operation: "createVersion" });
    expect(entry.sequence).toBe(0);
    expect(history.count()).toBe(1);
    expect(history.entries()).toHaveLength(1);
    expect(history.latest()).toEqual(entry);
  });

  it("returns undefined latest() when empty", () => {
    const history = new KnowledgeHistory("v2");
    expect(history.latest()).toBeUndefined();
  });

  it("returns a defensive copy from entries()", () => {
    const history = new KnowledgeHistory("v3");
    history.record({ operation: "op" });
    const entries = history.entries();
    (entries as unknown[]).push("mutated");
    expect(history.count()).toBe(1);
  });
});

describe("KnowledgeLineage", () => {
  it("adds and reads edges", () => {
    const lineage = new KnowledgeLineage("asset-1");
    expect(lineage.id).toBe("asset-1");
    const edge = lineage.addEdge("v1", "v2");
    expect(edge.parentVersionId).toBe("v1");
    expect(lineage.edges()).toHaveLength(1);
    expect(lineage.childrenOf("v1")).toEqual(["v2"]);
    expect(lineage.parentsOf("v2")).toEqual(["v1"]);
  });

  it("rejects a self-edge", () => {
    const lineage = new KnowledgeLineage("asset-1");
    expect(() => lineage.addEdge("v1", "v1")).toThrow(VersionLineageException);
  });

  it("rejects a duplicate edge", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    expect(() => lineage.addEdge("v1", "v2")).toThrow(VersionLineageException);
  });

  it("walks ancestors and descendants transitively", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    lineage.addEdge("v2", "v3");
    expect(lineage.ancestorsOf("v3")).toEqual(expect.arrayContaining(["v1", "v2"]));
    expect(lineage.descendantsOf("v1")).toEqual(expect.arrayContaining(["v2", "v3"]));
  });

  it("returns empty arrays for versions with no relations", () => {
    const lineage = new KnowledgeLineage("asset-1");
    expect(lineage.parentsOf("unknown")).toEqual([]);
    expect(lineage.childrenOf("unknown")).toEqual([]);
    expect(lineage.ancestorsOf("unknown")).toEqual([]);
  });

  it("indexes a second child under the same existing parent key", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    lineage.addEdge("v1", "v3");
    expect(lineage.childrenOf("v1")).toEqual(expect.arrayContaining(["v2", "v3"]));
  });

  it("de-duplicates a diamond-shaped descendant walk (shared descendant visited twice)", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    lineage.addEdge("v1", "v3");
    lineage.addEdge("v2", "v4");
    lineage.addEdge("v3", "v4");
    const descendants = lineage.descendantsOf("v1");
    expect(descendants.filter((id) => id === "v4")).toHaveLength(1);
    expect(descendants).toEqual(expect.arrayContaining(["v2", "v3", "v4"]));
  });
});

describe("KnowledgeVersion", () => {
  it("exposes read-only view fields from the execution", () => {
    const execution = executionFixture();
    const version = new KnowledgeVersion(execution);
    expect(version.id).toBe(execution.instance.id);
    expect(version.token).toBe(execution.instance.token);
    expect(version.versionId).toBe(execution.metadata.versionId);
    expect(version.assetId).toBe(execution.metadata.assetId);
    expect(version.versionType).toBe(execution.metadata.versionType);
    expect(version.versionNumber).toBe(execution.metadata.versionNumber);
    expect(version.branchId).toBeUndefined();
    expect(version.state).toBe(execution.instance.state);
    expect(version.metadata).toBe(execution.metadata);
    expect(version.configuration).toBe(execution.configuration);
    expect(version.context).toBe(execution.context);
    expect(version.history).toBe(execution.history);
    expect(version.auditTrail).toBe(execution.auditTrail);
    expect(version.logs).toBe(execution.logs);
    expect(version.toExecution()).toBe(execution);
  });

  it("exposes branchId when set", () => {
    const metadata = metadataFixture({ branchId: "b1" });
    const execution = executionFixture({ metadata });
    const version = new KnowledgeVersion(execution);
    expect(version.branchId).toBe("b1");
  });
});

describe("fixtures sanity", () => {
  it("contextFixture / configurationFixture / metadataFixture produce valid records", () => {
    expect(contextFixture().tenantId).toBe("tenant-1");
    expect(configurationFixture().versionId).toBe("version-1");
    expect(metadataFixture().versionId).toBe("version-1");
  });
});
