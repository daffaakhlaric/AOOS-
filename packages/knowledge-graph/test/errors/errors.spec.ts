import { describe, expect, it } from "vitest";

import { CycleDetectedException } from "../../src/errors/cycle-detected-exception.js";
import { DuplicateEntryException } from "../../src/errors/duplicate-entry-exception.js";
import { EdgeNotFoundException } from "../../src/errors/edge-not-found-exception.js";
import { GraphAuthorizationException } from "../../src/errors/graph-authorization-exception.js";
import { GraphConfigurationException } from "../../src/errors/graph-configuration-exception.js";
import { GraphNotFoundException } from "../../src/errors/graph-not-found-exception.js";
import { GraphValidationException } from "../../src/errors/graph-validation-exception.js";
import { KnowledgeGraphException } from "../../src/errors/knowledge-graph-exception.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { RelationshipValidationException } from "../../src/errors/relationship-validation-exception.js";
import { SnapshotNotFoundException } from "../../src/errors/snapshot-not-found-exception.js";

describe("KnowledgeGraphException", () => {
  it("defaults code to KNOWLEDGE_GRAPH_ERROR", () => {
    const error = new KnowledgeGraphException("boom");
    expect(error.code).toBe("KNOWLEDGE_GRAPH_ERROR");
    expect(error.message).toBe("boom");
    expect(error.name).toBe("KnowledgeGraphException");
    expect(error).toBeInstanceOf(Error);
    expect(error.context).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  it("accepts a custom code/context/cause", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeGraphException("boom", {
      code: "CUSTOM",
      context: { a: 1 },
      cause,
    });
    expect(error.code).toBe("CUSTOM");
    expect(error.context).toEqual({ a: 1 });
    expect(error.cause).toBe(cause);
  });

  it("subclasses report their own class name via new.target", () => {
    class SubException extends KnowledgeGraphException {}
    const error = new SubException("sub");
    expect(error.name).toBe("SubException");
    expect(error).toBeInstanceOf(KnowledgeGraphException);
  });
});

describe("GraphNotFoundException", () => {
  it("carries the missing graph id", () => {
    const error = new GraphNotFoundException("graph-1");
    expect(error.code).toBe("GRAPH_NOT_FOUND");
    expect(error.message).toContain("graph-1");
    expect(error.context).toEqual({ graphId: "graph-1" });
    expect(error).toBeInstanceOf(KnowledgeGraphException);
  });
});

describe("NodeNotFoundException", () => {
  it("carries the missing node id", () => {
    const error = new NodeNotFoundException("node-1");
    expect(error.code).toBe("NODE_NOT_FOUND");
    expect(error.message).toContain("node-1");
  });
});

describe("EdgeNotFoundException", () => {
  it("carries the missing edge id", () => {
    const error = new EdgeNotFoundException("edge-1");
    expect(error.code).toBe("EDGE_NOT_FOUND");
    expect(error.message).toContain("edge-1");
  });
});

describe("SnapshotNotFoundException", () => {
  it("carries the missing snapshot id", () => {
    const error = new SnapshotNotFoundException("snap-1");
    expect(error.code).toBe("SNAPSHOT_NOT_FOUND");
    expect(error.message).toContain("snap-1");
  });
});

describe("DuplicateEntryException", () => {
  it("carries the bucket name and colliding id", () => {
    const error = new DuplicateEntryException("node", "node-1");
    expect(error.code).toBe("DUPLICATE_ENTRY");
    expect(error.message).toContain("node");
    expect(error.message).toContain("node-1");
    expect(error.context).toEqual({ bucket: "node", id: "node-1" });
  });
});

describe("GraphValidationException", () => {
  it("carries a message and optional context", () => {
    const error = new GraphValidationException("bad input", { field: "name" });
    expect(error.code).toBe("GRAPH_VALIDATION_FAILED");
    expect(error.context).toEqual({ field: "name" });
  });

  it("tolerates no context", () => {
    const error = new GraphValidationException("bad input");
    expect(error.context).toBeUndefined();
  });
});

describe("GraphAuthorizationException", () => {
  it("names the operation and actor", () => {
    const error = new GraphAuthorizationException("CreateNode", "alice");
    expect(error.code).toBe("GRAPH_AUTHORIZATION_DENIED");
    expect(error.message).toContain("CreateNode");
    expect(error.message).toContain("alice");
  });

  it("defaults the actor label to <anonymous>", () => {
    const error = new GraphAuthorizationException("CreateNode");
    expect(error.message).toContain("<anonymous>");
  });
});

describe("RelationshipValidationException", () => {
  it("carries a message and context", () => {
    const error = new RelationshipValidationException("bad relationship", { edgeId: "e1" });
    expect(error.code).toBe("RELATIONSHIP_VALIDATION_FAILED");
    expect(error.context).toEqual({ edgeId: "e1" });
  });
});

describe("CycleDetectedException", () => {
  it("describes the rejected edge", () => {
    const error = new CycleDetectedException("A", "B", "DependsOn");
    expect(error.code).toBe("CYCLE_DETECTED");
    expect(error.message).toContain("A");
    expect(error.message).toContain("B");
    expect(error.message).toContain("DependsOn");
    expect(error.context).toEqual({ sourceNodeId: "A", targetNodeId: "B", edgeType: "DependsOn" });
  });
});

describe("GraphConfigurationException", () => {
  it("carries a message and context", () => {
    const error = new GraphConfigurationException("bad config", { field: "maxTraversalDepth" });
    expect(error.code).toBe("GRAPH_CONFIGURATION_INVALID");
    expect(error.context).toEqual({ field: "maxTraversalDepth" });
  });
});
