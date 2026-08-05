import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const modelManifestSchema = baseManifestSchema.extend({
  provider: z.string().min(1),
  context_window: z.number().int().positive().optional(),
  cost_tier: z.enum(["fast_cheap", "balanced", "top_reasoning"]),
});

export type ModelManifest = z.infer<typeof modelManifestSchema>;

export function createModelRegistry(events?: RegistryEventEmitter): Registry<ModelManifest> {
  return new Registry<ModelManifest>({
    kind: RegistryKind.MODEL,
    schema: modelManifestSchema,
    events,
  });
}
