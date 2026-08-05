import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const eventManifestSchema = baseManifestSchema.extend({
  payload_schema_ref: z.string().optional(),
  publishers: z.array(z.string()).optional(),
  subscribers: z.array(z.string()).optional(),
});

export type EventManifest = z.infer<typeof eventManifestSchema>;

export function createEventRegistry(events?: RegistryEventEmitter): Registry<EventManifest> {
  return new Registry<EventManifest>({
    kind: RegistryKind.EVENT,
    schema: eventManifestSchema,
    events,
  });
}
