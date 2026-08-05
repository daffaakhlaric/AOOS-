import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** KnowledgeSearchNode — requests a search against a Knowledge Base by id. Contract only — no RAG, no Vector DB (see `IKnowledgeProvider`/`IKnowledgeRetriever`). */
export const knowledgeSearchNodeConfigSchema = z.object({
  query: z.string().min(1),
  knowledgeBaseId: z.string().min(1).optional(),
  topK: z.number().int().positive().optional(),
});
export type KnowledgeSearchNodeConfig = z.infer<typeof knowledgeSearchNodeConfigSchema>;

export const knowledgeSearchNodeManifest: NodeManifest = {
  type: NodeType.KNOWLEDGE_SEARCH,
  category: NodeCategory.KNOWLEDGE,
  name: "Knowledge Search",
  description:
    "Requests a search against a Knowledge Base by id — contract only, no RAG/Vector DB.",
  version: "1.0.0",
  configSchema: knowledgeSearchNodeConfigSchema,
};
