import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** AISimulationNode — runs a scenario forward N iterations to project outcomes. Contract only — no Simulation Runtime here (that remains out of scope per "DO NOT IMPLEMENT"). */
export const aiSimulationNodeConfigSchema = z.object({
  scenario: z.string().min(1),
  iterations: z.number().int().positive().optional(),
});
export type AISimulationNodeConfig = z.infer<typeof aiSimulationNodeConfigSchema>;

export const aiSimulationNodeManifest: NodeManifest = {
  type: NodeType.AI_SIMULATION,
  category: NodeCategory.AI_NATIVE,
  name: "AI Simulation",
  description: "Projects a scenario forward N iterations — contract only, no simulation execution.",
  version: "1.0.0",
  configSchema: aiSimulationNodeConfigSchema,
};
