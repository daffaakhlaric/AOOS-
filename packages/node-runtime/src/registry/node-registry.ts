import { SchemaRegistry } from "@aos/workflow-definition";
import type { ZodTypeAny } from "zod";

import { ALL_NODE_MANIFESTS } from "../contracts/all-manifests.js";
import type { NodeManifest } from "../contracts/node-manifest.js";
import type { NodeType } from "../contracts/node-type.js";
import { NodeRegistryException } from "../errors/node-registry-exception.js";

import type { INodeRegistry } from "./i-node-registry.js";

/**
 * "NODE REGISTRY: Integrate with existing Registry. Read-only. No duplication."
 * (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md). Reuses `@aos/workflow-definition`'s
 * `SchemaRegistry` (built in 005.6A as the extension point for exactly this — "a future
 * custom Node Type ... would register its schema into") for `configSchema` storage,
 * rather than inventing a second Map-based registry. Every Node Manifest is registered
 * once at construction; after that this class is read-only (`get`/`has`/`list`).
 */
export class NodeRegistry implements INodeRegistry {
  private readonly schemaRegistry = new SchemaRegistry();
  private readonly manifestsByType = new Map<NodeType, NodeManifest>();

  constructor(manifests: readonly NodeManifest[] = ALL_NODE_MANIFESTS) {
    for (const manifest of manifests) {
      if (this.manifestsByType.has(manifest.type)) {
        throw new NodeRegistryException(
          `Cannot register Node manifest "${manifest.type}": already registered`,
        );
      }
      this.manifestsByType.set(manifest.type, manifest);
      if (manifest.configSchema) {
        this.schemaRegistry.register(manifest.type, manifest.configSchema);
      }
    }
  }

  get(type: NodeType): NodeManifest | undefined {
    return this.manifestsByType.get(type);
  }

  has(type: NodeType): boolean {
    return this.manifestsByType.has(type);
  }

  list(): readonly NodeManifest[] {
    return Array.from(this.manifestsByType.values());
  }

  getConfigSchema(type: NodeType): ZodTypeAny | undefined {
    return this.schemaRegistry.get(type);
  }
}
