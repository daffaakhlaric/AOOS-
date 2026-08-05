import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** AIConsensusNode — merges multiple participant outputs into one agreed result above a threshold. Contract only — no consensus execution. */
export const aiConsensusNodeConfigSchema = z.object({
  participantNodeIds: z.array(z.string().min(1)).min(2),
  threshold: z.number().min(0).max(1).optional(),
});
export type AIConsensusNodeConfig = z.infer<typeof aiConsensusNodeConfigSchema>;

export const aiConsensusNodeManifest: NodeManifest = {
  type: NodeType.AI_CONSENSUS,
  category: NodeCategory.AI_NATIVE,
  name: "AI Consensus",
  description:
    "Merges participant outputs into one agreed result — contract only, no consensus execution.",
  version: "1.0.0",
  configSchema: aiConsensusNodeConfigSchema,
};
