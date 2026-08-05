import { z } from "zod";

import { NodeCategory } from "./node-category.js";
import { NodeType } from "./node-type.js";

/**
 * The registered description of one Node Type — what `registry/node-registry.ts` stores
 * and `factory/node-factory.ts`/`validator/` read from. `configSchema` validates a Node
 * Instance's `config` (the AI-native manifests in `contracts/ai-native/` each define
 * their own); manifests carry no execution logic of any kind.
 */
export const nodeManifestSchema = z.object({
  type: z.nativeEnum(NodeType),
  category: z.nativeEnum(NodeCategory),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be SemVer x.y.z"),
  configSchema: z.custom<z.ZodTypeAny>((value) => value instanceof z.ZodType).optional(),
});

export type NodeManifest = z.infer<typeof nodeManifestSchema>;
