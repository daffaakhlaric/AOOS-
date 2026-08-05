import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const secretProviderManifestSchema = baseManifestSchema.extend({
  provider: z.enum(["vault", "aws_secrets_manager", "doppler"]),
  resolution_strategy: z.enum(["dynamic", "static"]).default("static"),
});

export type SecretProviderManifest = z.infer<typeof secretProviderManifestSchema>;

export function createSecretProviderRegistry(
  events?: RegistryEventEmitter,
): Registry<SecretProviderManifest> {
  return new Registry<SecretProviderManifest>({
    kind: RegistryKind.SECRET_PROVIDER,
    schema: secretProviderManifestSchema,
    events,
  });
}
