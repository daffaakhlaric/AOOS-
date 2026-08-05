import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** AIReasonNode — produces a reasoning trace over a question. Contract only — no LLM call. */
export const aiReasonNodeConfigSchema = z.object({
  question: z.string().min(1),
  reasoningDepth: z.number().int().positive().optional(),
});
export type AIReasonNodeConfig = z.infer<typeof aiReasonNodeConfigSchema>;

export const aiReasonNodeManifest: NodeManifest = {
  type: NodeType.AI_REASON,
  category: NodeCategory.AI_NATIVE,
  name: "AI Reason",
  description: "Produces a reasoning trace over a question — contract only, no LLM call.",
  version: "1.0.0",
  configSchema: aiReasonNodeConfigSchema,
};
