import { describe, expect, it } from "vitest";

import { InvalidNamespaceException } from "../../src/errors/invalid-namespace-exception.js";
import {
  buildKnowledgeNamespaceUri,
  isValidKnowledgeNamespace,
  parseKnowledgeNamespace,
} from "../../src/namespace/knowledge-namespace.js";

describe("Namespace Test — knowledge:// URIs", () => {
  it("buildKnowledgeNamespaceUri() builds the canonical 4-segment URI", () => {
    expect(buildKnowledgeNamespaceUri("tenant-1", "workspace-1", "library-1", "doc-1")).toBe(
      "knowledge://tenant-1/workspace-1/library-1/doc-1",
    );
  });

  it("parseKnowledgeNamespace() round-trips a built URI", () => {
    const uri = buildKnowledgeNamespaceUri("tenant-1", "workspace-1", "library-1", "doc-1");
    const parsed = parseKnowledgeNamespace(uri);
    expect(parsed).toEqual({
      uri,
      tenant: "tenant-1",
      workspace: "workspace-1",
      library: "library-1",
      document: "doc-1",
    });
  });

  it("parseKnowledgeNamespace() throws InvalidNamespaceException for a wrong scheme", () => {
    expect(() => parseKnowledgeNamespace("https://tenant-1/workspace-1/library-1/doc-1")).toThrow(
      InvalidNamespaceException,
    );
  });

  it("parseKnowledgeNamespace() throws InvalidNamespaceException for too few segments", () => {
    expect(() => parseKnowledgeNamespace("knowledge://tenant-1/workspace-1")).toThrow(
      InvalidNamespaceException,
    );
  });

  it("parseKnowledgeNamespace() throws InvalidNamespaceException for too many segments", () => {
    expect(() =>
      parseKnowledgeNamespace("knowledge://tenant-1/workspace-1/library-1/doc-1/extra"),
    ).toThrow(InvalidNamespaceException);
  });

  it("isValidKnowledgeNamespace() returns true for a valid URI and false for an invalid one", () => {
    expect(isValidKnowledgeNamespace("knowledge://tenant-1/workspace-1/library-1/doc-1")).toBe(
      true,
    );
    expect(isValidKnowledgeNamespace("not-a-namespace")).toBe(false);
  });
});
