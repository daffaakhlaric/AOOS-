import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const integrationManifestSchema = baseManifestSchema.extend({
  provider: z.string().min(1),
  auth_type: z.enum(["api_key", "oauth2", "webhook_signature"]),
});

export type IntegrationManifest = z.infer<typeof integrationManifestSchema>;

export function createIntegrationRegistry(
  events?: RegistryEventEmitter,
): Registry<IntegrationManifest> {
  return new Registry<IntegrationManifest>({
    kind: RegistryKind.INTEGRATION,
    schema: integrationManifestSchema,
    events,
  });
}
