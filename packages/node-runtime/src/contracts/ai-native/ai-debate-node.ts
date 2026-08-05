import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** AIDebateNode — runs a multi-perspective debate over a topic. Contract only — no debate execution. */
export const aiDebateNodeConfigSchema = z.object({
  topic: z.string().min(1),
  participantCount: z.number().int().min(2),
  rounds: z.number().int().positive().optional(),
});
export type AIDebateNodeConfig = z.infer<typeof aiDebateNodeConfigSchema>;

export const aiDebateNodeManifest: NodeManifest = {
  type: NodeType.AI_DEBATE,
  category: NodeCategory.AI_NATIVE,
  name: "AI Debate",
  description: "Runs a multi-perspective debate over a topic — contract only, no debate execution.",
  version: "1.0.0",
  configSchema: aiDebateNodeConfigSchema,
};
