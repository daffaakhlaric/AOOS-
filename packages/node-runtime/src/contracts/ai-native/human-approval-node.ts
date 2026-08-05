import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/** HumanApprovalNode — a specialized Human Node requesting an approve/reject decision. Contract only — no approval UI/workflow execution. */
export const humanApprovalNodeConfigSchema = z.object({
  approverRole: z.string().min(1),
  approvalMessage: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().optional(),
});
export type HumanApprovalNodeConfig = z.infer<typeof humanApprovalNodeConfigSchema>;

export const humanApprovalNodeManifest: NodeManifest = {
  type: NodeType.HUMAN_APPROVAL,
  category: NodeCategory.HUMAN,
  name: "Human Approval",
  description: "Requests an approve/reject decision from a human role — contract only.",
  version: "1.0.0",
  configSchema: humanApprovalNodeConfigSchema,
};
