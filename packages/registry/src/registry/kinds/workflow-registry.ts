import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const workflowManifestSchema = baseManifestSchema.extend({
  required_agents: z.array(z.string()).optional(),
  required_tools: z.array(z.string()).optional(),
  timeout: z.string().optional(),
});

export type WorkflowManifest = z.infer<typeof workflowManifestSchema>;

export function createWorkflowRegistry(events?: RegistryEventEmitter): Registry<WorkflowManifest> {
  return new Registry<WorkflowManifest>({
    kind: RegistryKind.WORKFLOW,
    schema: workflowManifestSchema,
    events,
  });
}
