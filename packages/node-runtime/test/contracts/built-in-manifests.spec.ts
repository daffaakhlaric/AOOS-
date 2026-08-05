import { describe, expect, it } from "vitest";

import { BUILT_IN_NODE_MANIFESTS } from "../../src/contracts/built-in-manifests.js";
import { NodeType } from "../../src/contracts/node-type.js";

function findManifest(type: NodeType) {
  const manifest = BUILT_IN_NODE_MANIFESTS.find((candidate) => candidate.type === type);
  if (!manifest) throw new Error(`manifest not found: ${type}`);
  return manifest;
}

describe("BUILT_IN_NODE_MANIFESTS", () => {
  it("Condition requires an expression", () => {
    const schema = findManifest(NodeType.CONDITION).configSchema!;
    expect(schema.safeParse({ expression: "x > 1" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("Switch requires an expression and at least one case", () => {
    const schema = findManifest(NodeType.SWITCH).configSchema!;
    expect(schema.safeParse({ expression: "x", cases: ["a"] }).success).toBe(true);
    expect(schema.safeParse({ expression: "x", cases: [] }).success).toBe(false);
  });

  it("Fork/Join require at least 2 branches", () => {
    expect(findManifest(NodeType.FORK).configSchema!.safeParse({ branchCount: 2 }).success).toBe(
      true,
    );
    expect(findManifest(NodeType.FORK).configSchema!.safeParse({ branchCount: 1 }).success).toBe(
      false,
    );
    expect(findManifest(NodeType.JOIN).configSchema!.safeParse({ branchCount: 2 }).success).toBe(
      true,
    );
  });

  it("HTTP requires a valid method and URL", () => {
    const schema = findManifest(NodeType.HTTP).configSchema!;
    expect(schema.safeParse({ method: "GET", url: "https://example.com" }).success).toBe(true);
    expect(schema.safeParse({ method: "TRACE", url: "https://example.com" }).success).toBe(false);
  });

  it("Start/End carry no configSchema requirement (empty object accepted)", () => {
    expect(findManifest(NodeType.START).configSchema).toBeUndefined();
    expect(findManifest(NodeType.END).configSchema).toBeUndefined();
  });

  it("Custom accepts a free-form record", () => {
    const schema = findManifest(NodeType.CUSTOM).configSchema!;
    expect(schema.safeParse({ anything: "goes" }).success).toBe(true);
  });
});
