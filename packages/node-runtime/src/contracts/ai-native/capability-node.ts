import { z } from "zod";

import { NodeCategory } from "../node-category.js";
import type { NodeManifest } from "../node-manifest.js";
import { NodeType } from "../node-type.js";

/**
 * CapabilityNode — "Node requests: Capability... Node never calls Tool. Node never calls
 * Connector." (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — "CAPABILITY"). References
 * a Capability id by string only (e.g. `"crm.create"`, `"appointment.book"`,
 * `"inventory.search"`, `"knowledge.search"`) — resolving and invoking that Capability is
 * entirely out of scope here.
 */
export const capabilityNodeConfigSchema = z.object({
  capabilityId: z.string().min(1),
  capabilityVersion: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
});
export type CapabilityNodeConfig = z.infer<typeof capabilityNodeConfigSchema>;

export const capabilityNodeManifest: NodeManifest = {
  type: NodeType.CAPABILITY,
  category: NodeCategory.CAPABILITY,
  name: "Capability",
  description: "References a Capability id — never a Tool or Connector — contract only.",
  version: "1.0.0",
  configSchema: capabilityNodeConfigSchema,
};
