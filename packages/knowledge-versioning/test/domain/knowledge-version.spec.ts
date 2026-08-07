import { describe, expect, it } from "vitest";

import { KnowledgeVersion } from "../../src/domain/knowledge-version.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeVersion", () => {
  const execution = executionFixture();
  const version = new KnowledgeVersion(execution);

  it("exposes id from the instance", () => {
    expect(version.id).toBe(execution.instance.id);
  });

  it("exposes token from the instance", () => {
    expect(version.token).toBe(execution.instance.token);
  });

  it("exposes versionId from metadata", () => {
    expect(version.versionId).toBe(execution.metadata.versionId);
  });

  it("exposes assetId from metadata", () => {
    expect(version.assetId).toBe(execution.metadata.assetId);
  });

  it("exposes versionType from metadata", () => {
    expect(version.versionType).toBe(execution.metadata.versionType);
  });

  it("exposes versionNumber from metadata", () => {
    expect(version.versionNumber).toBe(execution.metadata.versionNumber);
  });

  it("exposes branchId from metadata when set", () => {
    const withBranch = new KnowledgeVersion(
      executionFixture({ metadata: { ...execution.metadata, branchId: "branch-1" } }),
    );
    expect(withBranch.branchId).toBe("branch-1");
  });

  it("exposes undefined branchId when not set", () => {
    expect(version.branchId).toBeUndefined();
  });

  it("exposes state from the instance", () => {
    expect(version.state).toBe(execution.instance.state);
  });

  it("exposes the full metadata record", () => {
    expect(version.metadata).toBe(execution.metadata);
  });

  it("exposes the full configuration record", () => {
    expect(version.configuration).toBe(execution.configuration);
  });

  it("exposes the context", () => {
    expect(version.context).toBe(execution.context);
  });

  it("exposes the history entries", () => {
    expect(version.history).toBe(execution.history);
  });

  it("exposes the audit trail", () => {
    expect(version.auditTrail).toBe(execution.auditTrail);
  });

  it("exposes the logs", () => {
    expect(version.logs).toBe(execution.logs);
  });

  it("toExecution returns the underlying execution record", () => {
    expect(version.toExecution()).toBe(execution);
  });
});
