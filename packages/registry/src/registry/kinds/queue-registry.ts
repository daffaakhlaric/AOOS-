import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const queueManifestSchema = baseManifestSchema.extend({
  fifo: z.boolean().default(false),
  dead_letter_ref: z.string().optional(),
});

export type QueueManifest = z.infer<typeof queueManifestSchema>;

export function createQueueRegistry(events?: RegistryEventEmitter): Registry<QueueManifest> {
  return new Registry<QueueManifest>({
    kind: RegistryKind.QUEUE,
    schema: queueManifestSchema,
    events,
  });
}
