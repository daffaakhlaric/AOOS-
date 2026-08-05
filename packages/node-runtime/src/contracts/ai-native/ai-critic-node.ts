import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** AICriticNode — scores a target Node's output against a rubric. Contract only — no critique execution. */
export const aiCriticNodeConfigSchema = z.object({
  targetNodeId: z.string().min(1),
  rubric: z.array(z.string().min(1)).optional(),
});
export type AICriticNodeConfig = z.infer<typeof aiCriticNodeConfigSchema>;

export const aiCriticNodeManifest: NodeManifest = {
  type: NodeType.AI_CRITIC,
  category: NodeCategory.AI_NATIVE,
  name: "AI Critic",
  description:
    "Scores a target Node's output against a rubric — contract only, no critique execution.",
  version: "1.0.0",
  configSchema: aiCriticNodeConfigSchema,
};
