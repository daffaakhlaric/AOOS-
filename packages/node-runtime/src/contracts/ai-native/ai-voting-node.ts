import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** AIVotingNode — selects among candidate outputs by vote. Contract only — no voting execution. */
export const aiVotingNodeConfigSchema = z.object({
  candidateNodeIds: z.array(z.string().min(1)).min(2),
  quorum: z.number().int().positive().optional(),
});
export type AIVotingNodeConfig = z.infer<typeof aiVotingNodeConfigSchema>;

export const aiVotingNodeManifest: NodeManifest = {
  type: NodeType.AI_VOTING,
  category: NodeCategory.AI_NATIVE,
  name: "AI Voting",
  description: "Selects among candidate outputs by vote — contract only, no voting execution.",
  version: "1.0.0",
  configSchema: aiVotingNodeConfigSchema,
};
