import type { ZodTypeAny } from "zod";

import type { NodeManifest } from "../contracts/node-manifest.js";
import type { NodeType } from "../contracts/node-type.js";

export interface INodeRegistry {
  get(type: NodeType): NodeManifest | undefined;
  has(type: NodeType): boolean;
  list(): readonly NodeManifest[];
  getConfigSchema(type: NodeType): ZodTypeAny | undefined;
}
