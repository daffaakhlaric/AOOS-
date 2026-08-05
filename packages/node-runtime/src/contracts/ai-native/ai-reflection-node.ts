import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** AIReflectionNode — reviews a prior Node's output against criteria. Contract only — no reflection execution. */
export const aiReflectionNodeConfigSchema = z.object({
  subjectNodeId: z.string().min(1),
  criteria: z.array(z.string().min(1)).optional(),
});
export type AIReflectionNodeConfig = z.infer<typeof aiReflectionNodeConfigSchema>;

export const aiReflectionNodeManifest: NodeManifest = {
  type: NodeType.AI_REFLECTION,
  category: NodeCategory.AI_NATIVE,
  name: "AI Reflection",
  description:
    "Reviews a prior Node's output against criteria — contract only, no reflection execution.",
  version: "1.0.0",
  configSchema: aiReflectionNodeConfigSchema,
};
