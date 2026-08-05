import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

/**
 * Agent manifest — exact shape from the user's revised prompt example (content-manager):
 * an Agent declares its required Tools/Models/Permissions/Memory/Workflows by ID, so the
 * Agent Runtime (a future Engineering Task) never needs to change when a new Agent is added —
 * only a manifest is registered here.
 */
export const agentManifestSchema = baseManifestSchema.extend({
  required_tools: z.array(z.string()).optional(),
  required_models: z.array(z.string()).optional(),
  memory: z.array(z.string()).optional(),
  workflows: z.array(z.string()).optional(),
});

export type AgentManifest = z.infer<typeof agentManifestSchema>;

export function createAgentRegistry(events?: RegistryEventEmitter): Registry<AgentManifest> {
  return new Registry<AgentManifest>({
    kind: RegistryKind.AGENT,
    schema: agentManifestSchema,
    events,
  });
}
