import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

/**
 * Agent Blueprint manifest (docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md, user addition) —
 * "Bukan Agent Runtime, tetapi template declarative untuk agent yang dapat dipakai oleh AI
 * Builder atau Marketplace." Distinct from the Agent Registry (`agent-registry.ts`), which
 * holds live/instantiable Agent manifests: a Blueprint is a template an AI Builder can turn
 * INTO an Agent Registry entry, not something the Agent Runtime consumes directly.
 *
 * Example (from the source prompt):
 * ```yaml
 * id: inventory-agent
 * industry: [automotive]
 * required_capabilities: [inventory.read, inventory.update]
 * required_tools: [dms-connector]
 * required_memory: [short-term]
 * required_workflows: [inventory-sync]
 * recommended_models: [gpt-5.5, claude-sonnet-5]
 * ```
 */
export const agentBlueprintManifestSchema = baseManifestSchema.extend({
  required_capabilities: z.array(z.string()).optional(),
  required_tools: z.array(z.string()).optional(),
  required_memory: z.array(z.string()).optional(),
  required_workflows: z.array(z.string()).optional(),
  /** Model Profile Registry entry ids — advisory only, not cross-reference-validated (a Blueprint may recommend models it doesn't require). */
  recommended_models: z.array(z.string()).optional(),
});

export type AgentBlueprintManifest = z.infer<typeof agentBlueprintManifestSchema>;

export function createAgentBlueprintRegistry(
  events?: RegistryEventEmitter,
): Registry<AgentBlueprintManifest> {
  return new Registry<AgentBlueprintManifest>({
    kind: RegistryKind.AGENT_BLUEPRINT,
    schema: agentBlueprintManifestSchema,
    events,
  });
}
