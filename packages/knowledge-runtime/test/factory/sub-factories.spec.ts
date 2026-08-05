import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimeContextFactory } from "../../src/factory/runtime-context-factory.js";
import { RuntimeMetadataFactory } from "../../src/factory/runtime-metadata-factory.js";
import { RuntimeSessionFactory } from "../../src/factory/runtime-session-factory.js";
import { RuntimeSnapshotFactory } from "../../src/factory/runtime-snapshot-factory.js";
import { RuntimeTokenFactory } from "../../src/factory/runtime-token-factory.js";
import { KnowledgeRuntimeSessionState } from "../../src/session/knowledge-runtime-session-state.js";
import { isKnowledgeRuntimeToken } from "../../src/token/knowledge-runtime-token.js";

describe("Factory Test — RuntimeTokenFactory", () => {
  it("create() produces a valid KnowledgeRuntimeToken", () => {
    expect(isKnowledgeRuntimeToken(new RuntimeTokenFactory().create())).toBe(true);
  });
});

describe("Factory Test — RuntimeContextFactory", () => {
  it("create() wraps createKnowledgeRuntimeContext()", () => {
    const context = new RuntimeContextFactory().create({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
    });
    expect(context.knowledgeId).toBe("k-1");
  });
});

describe("Factory Test — RuntimeMetadataFactory", () => {
  it("create() defaults to empty labels/custom", () => {
    const metadata = new RuntimeMetadataFactory().create();
    expect(metadata.labels).toEqual([]);
    expect(metadata.custom).toEqual({});
  });

  it("create() honors overrides", () => {
    const metadata = new RuntimeMetadataFactory().create({ createdBy: "user-1", labels: ["x"] });
    expect(metadata.createdBy).toBe("user-1");
    expect(metadata.labels).toEqual(["x"]);
  });
});

describe("Factory Test — RuntimeSessionFactory", () => {
  it("create() produces an unregistered, OPEN SessionRecord", () => {
    const record = new RuntimeSessionFactory().create("ktok_1", "user-1");
    expect(record.state).toBe(KnowledgeRuntimeSessionState.OPEN);
    expect(record.lease.holder).toBe("user-1");
  });
});

describe("Factory Test — RuntimeSnapshotFactory", () => {
  it("create() produces an unrecorded Snapshot from an Execution", () => {
    const execution = new KnowledgeRuntimeFactory().createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
    });
    const snapshot = new RuntimeSnapshotFactory().create(execution, 2);
    expect(snapshot.sequence).toBe(2);
    expect(snapshot.instanceToken).toBe(execution.instance.token);
  });
});
