import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/**
 * AIPlannerNode — decomposes a goal into an ordered plan of Capability/Node references.
 * Contract only, per the user's AI Native Node System request: schema + manifest +
 * registry integration + lifecycle, **no planning execution** (no LLM call, no Planner
 * implementation — that belongs to a future Planner/Agent Runtime, 005.14+).
 */
export const aiPlannerNodeConfigSchema = z.object({
  goal: z.string().min(1),
  maxSteps: z.number().int().positive().optional(),
  planningStrategy: z.enum(["sequential", "hierarchical", "reactive"]).optional(),
});
export type AIPlannerNodeConfig = z.infer<typeof aiPlannerNodeConfigSchema>;

export const aiPlannerNodeManifest: NodeManifest = {
  type: NodeType.AI_PLANNER,
  category: NodeCategory.AI_NATIVE,
  name: "AI Planner",
  description: "Decomposes a goal into an ordered plan — contract only, no planning execution.",
  version: "1.0.0",
  configSchema: aiPlannerNodeConfigSchema,
};
