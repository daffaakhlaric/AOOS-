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

const CASES: Array<[string, KnowledgeGraphException]> = [
  ["GraphNotFoundException", new GraphNotFoundException("g1")],
  ["NodeNotFoundException", new NodeNotFoundException("n1")],
  ["EdgeNotFoundException", new EdgeNotFoundException("e1")],
  ["SnapshotNotFoundException", new SnapshotNotFoundException("s1")],
  ["DuplicateEntryException", new DuplicateEntryException("bucket", "id")],
  ["GraphValidationException", new GraphValidationException("bad")],
  ["GraphAuthorizationException", new GraphAuthorizationException("op")],
  ["RelationshipValidationException", new RelationshipValidationException("bad")],
  ["CycleDetectedException", new CycleDetectedException("a", "b", "DependsOn")],
  ["GraphConfigurationException", new GraphConfigurationException("bad")],
];

describe("every exception subclass — common contract", () => {
  it.each(CASES)(
    "%s is an instanceof Error, KnowledgeGraphException, and reports its own name",
    (name, error) => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(KnowledgeGraphException);
      expect(error.name).toBe(name);
      expect(typeof error.code).toBe("string");
      expect(error.code.length).toBeGreaterThan(0);
      expect(typeof error.message).toBe("string");
      expect(error.message.length).toBeGreaterThan(0);
    },
  );

  it.each(CASES)("%s has a stack trace", (_name, error) => {
    expect(typeof error.stack).toBe("string");
  });
});
