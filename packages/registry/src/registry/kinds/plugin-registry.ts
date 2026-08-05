import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const pluginManifestSchema = baseManifestSchema.extend({
  provides: z.array(z.string()).optional(),
  entrypoint: z.string().min(1),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export function createPluginRegistry(events?: RegistryEventEmitter): Registry<PluginManifest> {
  return new Registry<PluginManifest>({
    kind: RegistryKind.PLUGIN,
    schema: pluginManifestSchema,
    events,
  });
}
