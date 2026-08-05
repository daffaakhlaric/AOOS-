import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const memoryProviderManifestSchema = baseManifestSchema.extend({
  tier: z.enum(["working", "episodic", "semantic"]),
  retention_policy: z.string().optional(),
});

export type MemoryProviderManifest = z.infer<typeof memoryProviderManifestSchema>;

export function createMemoryProviderRegistry(
  events?: RegistryEventEmitter,
): Registry<MemoryProviderManifest> {
  return new Registry<MemoryProviderManifest>({
    kind: RegistryKind.MEMORY_PROVIDER,
    schema: memoryProviderManifestSchema,
    events,
  });
}
