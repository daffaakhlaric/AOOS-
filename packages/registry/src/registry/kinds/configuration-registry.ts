import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const configurationManifestSchema = baseManifestSchema.extend({
  schema_ref: z.string().optional(),
  environment: z.enum(["development", "test", "staging", "production"]).default("development"),
});

export type ConfigurationManifest = z.infer<typeof configurationManifestSchema>;

export function createConfigurationRegistry(
  events?: RegistryEventEmitter,
): Registry<ConfigurationManifest> {
  return new Registry<ConfigurationManifest>({
    kind: RegistryKind.CONFIGURATION,
    schema: configurationManifestSchema,
    events,
  });
}
