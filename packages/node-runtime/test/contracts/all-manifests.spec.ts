import { describe, expect, it } from "vitest";

import { ALL_NODE_MANIFESTS } from "../../src/contracts/all-manifests.js";
import { nodeManifestSchema } from "../../src/contracts/node-manifest.js";
import { NodeType } from "../../src/contracts/node-type.js";

describe("ALL_NODE_MANIFESTS", () => {
  it("every manifest is a valid NodeManifest and every NodeType is covered exactly once", () => {
    const seen = new Set<NodeType>();
    for (const manifest of ALL_NODE_MANIFESTS) {
      expect(nodeManifestSchema.safeParse(manifest).success).toBe(true);
      expect(seen.has(manifest.type)).toBe(false);
      seen.add(manifest.type);
    }
    expect(seen.size).toBe(Object.values(NodeType).length);
  });

  it("the Script manifest has no configSchema — interface only", () => {
    const script = ALL_NODE_MANIFESTS.find((manifest) => manifest.type === NodeType.SCRIPT);
    expect(script?.configSchema).toBeUndefined();
  });
});
