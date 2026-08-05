import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const featureManifestSchema = baseManifestSchema.extend({
  flag_key: z.string().min(1),
  default_enabled: z.boolean().default(false),
});

export type FeatureManifest = z.infer<typeof featureManifestSchema>;

export function createFeatureRegistry(events?: RegistryEventEmitter): Registry<FeatureManifest> {
  return new Registry<FeatureManifest>({
    kind: RegistryKind.FEATURE,
    schema: featureManifestSchema,
    events,
  });
}
