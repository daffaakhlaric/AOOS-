import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** PromptNode — renders a prompt template against Node Variables. Contract only — no LLM call, no AI Gateway/Model Router integration. */
export const promptNodeConfigSchema = z.object({
  template: z.string().min(1),
  variables: z.array(z.string().min(1)).optional(),
});
export type PromptNodeConfig = z.infer<typeof promptNodeConfigSchema>;

export const promptNodeManifest: NodeManifest = {
  type: NodeType.PROMPT,
  category: NodeCategory.AI,
  name: "Prompt",
  description: "Renders a prompt template against Node Variables — contract only, no LLM call.",
  version: "1.0.0",
  configSchema: promptNodeConfigSchema,
};
