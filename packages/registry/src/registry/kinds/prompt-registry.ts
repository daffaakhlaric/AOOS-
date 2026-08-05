import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const promptManifestSchema = baseManifestSchema.extend({
  target_agent: z.string().min(1),
  variables: z.array(z.string()).optional(),
});

export type PromptManifest = z.infer<typeof promptManifestSchema>;

export function createPromptRegistry(events?: RegistryEventEmitter): Registry<PromptManifest> {
  return new Registry<PromptManifest>({
    kind: RegistryKind.PROMPT,
    schema: promptManifestSchema,
    events,
  });
}
