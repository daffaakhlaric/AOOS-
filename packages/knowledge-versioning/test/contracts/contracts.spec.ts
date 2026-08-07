import { describe, expect, it } from "vitest";

import type { IKnowledgeAuditProvider } from "../../src/contracts/i-knowledge-audit-provider.js";
import type { IKnowledgeBranchProvider } from "../../src/contracts/i-knowledge-branch-provider.js";
import type { IKnowledgeComparisonEngine } from "../../src/contracts/i-knowledge-comparison-engine.js";
import type { IKnowledgeConflictResolver } from "../../src/contracts/i-knowledge-conflict-resolver.js";
import type { IKnowledgeDiffProvider } from "../../src/contracts/i-knowledge-diff-provider.js";
import type { IKnowledgeMergeStrategy } from "../../src/contracts/i-knowledge-merge-strategy.js";
import type { IKnowledgeRollbackProvider } from "../../src/contracts/i-knowledge-rollback-provider.js";
import type { IKnowledgeSnapshotProvider } from "../../src/contracts/i-knowledge-snapshot-provider.js";
import type { IKnowledgeVersionPublisher } from "../../src/contracts/i-knowledge-version-publisher.js";
import type { IKnowledgeVersionStorage } from "../../src/contracts/i-knowledge-version-storage.js";
import type { IKnowledgeVersion } from "../../src/contracts/i-knowledge-version.js";
import { KnowledgeVersion } from "../../src/domain/knowledge-version.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("contracts — extension-point interfaces are interface-only (compile-time shape check)", () => {
  it("IKnowledgeVersion is satisfied by the concrete KnowledgeVersion class", () => {
    const version: IKnowledgeVersion = new KnowledgeVersion(executionFixture());
    expect(version.id).toBeTruthy();
  });

  it("extension-point interfaces accept a minimal structural implementation", () => {
    const merge: IKnowledgeMergeStrategy = { name: "noop", apply: () => undefined };
    const compare: IKnowledgeComparisonEngine = { compare: () => ({}) };
    const diff: IKnowledgeDiffProvider = { diff: () => ({}) };
    const snapshot: IKnowledgeSnapshotProvider = { capture: () => undefined };
    const rollback: IKnowledgeRollbackProvider = { rollback: () => undefined };
    const branch: IKnowledgeBranchProvider = {
      createBranch: () => undefined,
      deleteBranch: () => undefined,
    };
    const storage: IKnowledgeVersionStorage = {
      save: () => undefined,
      load: () => undefined,
      delete: () => undefined,
    };
    const audit: IKnowledgeAuditProvider = { record: () => undefined };
    const conflict: IKnowledgeConflictResolver = { resolve: () => ({}) };
    const publisher: IKnowledgeVersionPublisher = { publish: () => undefined };

    expect(merge.name).toBe("noop");
    expect(typeof compare.compare).toBe("function");
    expect(typeof diff.diff).toBe("function");
    expect(typeof snapshot.capture).toBe("function");
    expect(typeof rollback.rollback).toBe("function");
    expect(typeof branch.createBranch).toBe("function");
    expect(typeof storage.save).toBe("function");
    expect(typeof audit.record).toBe("function");
    expect(typeof conflict.resolve).toBe("function");
    expect(typeof publisher.publish).toBe("function");
  });
});
